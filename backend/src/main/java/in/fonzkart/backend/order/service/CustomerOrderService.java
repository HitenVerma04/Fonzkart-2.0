package in.fonzkart.backend.order.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import in.fonzkart.backend.auth.config.AuthProperties;
import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.catalog.dto.VariantWithModelDto;
import in.fonzkart.backend.catalog.service.VariantCatalogService;
import in.fonzkart.backend.order.dto.AppOrderDto;
import in.fonzkart.backend.order.entity.CustomerOrder;
import in.fonzkart.backend.order.repository.CustomerOrderRepository;
import in.fonzkart.backend.order.repository.OrderPeopleRepository;
import in.fonzkart.backend.order.rules.OrderJson;
import in.fonzkart.backend.order.rules.OrderStatus;
import in.fonzkart.backend.pricing.rules.JsValues;
import in.fonzkart.backend.pricing.service.PricingService;
import in.fonzkart.backend.rider.entity.Rider;
import in.fonzkart.backend.rider.repository.RiderRepository;
import in.fonzkart.backend.shared.mail.MailService;
import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.user.repository.UserRepository;
import in.fonzkart.backend.user.service.AccountDeletionService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

/**
 * The customer's side of an order: actions/orders.ts (placeOrder, getUserOrders, requestServiceArea) and
 * lib/store.ts → addOrder (routing to a partner, staff notifications and emails).
 * <p>
 * Unlike the original, placeOrder does not trust a price sent by the browser or app: the price is calculated here
 * from the variant's base price and the answers, with the same pricing rules as the quote
 * ({@link PricingService#calculatePrice}). The response includes the order's id, number and that price.
 */
@Service
public class CustomerOrderService {

    private static final Logger log = LoggerFactory.getLogger(CustomerOrderService.class);
    private static final JsonNodeFactory F = JsonNodeFactory.instance;

    public record PlaceOrderRequest(String device, String variant, String address, String pincode,
                                    JsonNode location, JsonNode answers, String category) {
    }

    private final CustomerOrderRepository orders;
    private final OrderPeopleRepository people;
    private final UserRepository users;
    private final RiderRepository riders;
    private final VariantCatalogService variants;
    private final PricingService pricing;
    private final OrderNotifications notify;
    private final AppOrderMapper mapper;
    private final OrderJson json;
    private final MailService mail;
    private final ObjectMapper objectMapper;
    private final String appUrl;
    private final String serviceAreaEmail;

    public CustomerOrderService(CustomerOrderRepository orders, OrderPeopleRepository people, UserRepository users,
                                RiderRepository riders, VariantCatalogService variants, PricingService pricing,
                                OrderNotifications notify, AppOrderMapper mapper, OrderJson json, MailService mail,
                                ObjectMapper objectMapper, AuthProperties auth,
                                @Value("${SUPERADMIN_EMAIL:admin@fonzkart.in}") String serviceAreaEmail) {
        this.orders = orders;
        this.people = people;
        this.users = users;
        this.riders = riders;
        this.variants = variants;
        this.pricing = pricing;
        this.notify = notify;
        this.mapper = mapper;
        this.json = json;
        this.mail = mail;
        this.objectMapper = objectMapper;
        this.appUrl = auth.appUrl();
        this.serviceAreaEmail = serviceAreaEmail;
    }

    // ------------------------------------------------------------------------------------------------ placeOrder

    public Map<String, Object> placeOrder(Optional<SessionPayload> session, PlaceOrderRequest r) {
        SessionUser me = activeUser(session).orElseThrow(ActionException::unauthorized);
        if (r == null || !JsText.truthy(r.device()) || !JsText.truthy(r.variant()) || r.address() == null) {
            throw OrderAccess.invalid("Invalid: Order details");
        }
        String deviceName = r.device() + " (" + r.variant() + ")";
        int price = (int) quote(r.device(), r.variant(), r.answers()).get("price");

        Double lat = null;
        Double lng = null;
        if (r.location() != null && r.location().isObject()) {
            lat = r.location().path("lat").isNumber() ? r.location().get("lat").asDouble() : null;
            lng = r.location().path("lng").isNumber() ? r.location().get("lng").asDouble() : null;
        }
        // order.answers ? JSON.stringify(order.answers) : null
        String answersText = JsValues.truthy(r.answers()) ? json.stringify(r.answers()) : null;

        // Route the order to the partner covering its pincode (see partnerForPincode); none: it stays unrouted.
        Optional<User> routed = JsText.truthy(r.pincode()) ? people.findPartnerForPincode(r.pincode()) : Optional.empty();
        CustomerOrder saved = orders.saveAndFlush(CustomerOrder.newOrder(UUID.randomUUID().toString(), me.id(),
                deviceName, price, OrderStatus.PENDING, r.address(), r.pincode(), lat, lng, answersText,
                routed.map(User::getId).orElse(null), JsDates.nowUtc()));
        CustomerOrder order = orders.findById(saved.getId()).orElse(saved);

        Optional<User> customer = users.findById(me.id());
        broadcastNewOrder(order, routed.orElse(null), customer.map(User::getName).orElse(null));
        customer.map(User::getEmail).filter(JsText::truthy).ifPresent(email ->
                mail.sendSystemEmailAsync(email, "Fonzkart: Order Confirmed",
                        orderConfirmedHtml(me.name(), r.device(), r.variant(), price)));
        notify.notifyCustomer(me.id(), "Order placed", "Your order #" + order.orderNumberValue() + " for "
                + deviceName + " is placed. We will assign an executive for the pickup shortly.", order.getId());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("id", order.getId());
        result.put("orderNumber", order.orderNumberValue());
        result.put("price", price);
        return result;
    }

    /**
     * The price an order for this device and these answers gets: the variant's base price and the pricing rules of
     * the category the website's sell flow uses for the model ({@link #sellCategory}). placeOrder records exactly this
     * price, so the apps show it as the final quote ({@code POST /api/orders/quote}).
     */
    public Map<String, Object> quote(String device, String variantName, JsonNode answers) {
        if (!JsText.truthy(device) || !JsText.truthy(variantName)) {
            throw OrderAccess.invalid("Invalid: Order details");
        }
        VariantWithModelDto variant = findDevice(device, variantName)
                .orElseThrow(() -> OrderAccess.invalid("Invalid: Device not found"));
        String category = sellCategory(variant.model() == null ? null : variant.model().category());
        JsonNode pricingAnswers = answers != null && answers.isObject() ? answers : F.objectNode();
        int price = (int) pricing.calculatePrice(variant.basePrice(), pricingAnswers, F.textNode(category));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("price", price);
        m.put("basePrice", variant.basePrice());
        m.put("category", category);
        return m;
    }

    /**
     * The priced catalog variant for a device as the apps name it ("iPhone 13") or as the website's sell flow does,
     * with the brand in front ("Apple iPhone 13"). A leading brand is accepted only when it is the found model's brand
     * (its id is the brand name in lower case with dashes, as addBrand makes it).
     */
    Optional<VariantWithModelDto> findDevice(String device, String variantName) {
        String name = JsText.trim(device);
        Optional<VariantWithModelDto> exact = priced(variants.findVariantByName(name + " (" + variantName + ")"));
        if (exact.isPresent()) {
            return exact;
        }
        for (int space = name.indexOf(' '); space > 0; space = name.indexOf(' ', space + 1)) {
            String brand = JsText.lower(name.substring(0, space)).replaceAll("\\s+", "-");
            Optional<VariantWithModelDto> found = priced(variants.findVariantByName(name.substring(space + 1).trim() + " (" + variantName + ")"))
                    .filter(v -> v.model() != null && brand.equals(v.model().brandId()));
            if (found.isPresent()) {
                return found;
            }
        }
        return Optional.empty();
    }

    private static Optional<VariantWithModelDto> priced(Optional<VariantWithModelDto> variant) {
        return variant.filter(v -> v.basePrice() != null);
    }

    /**
     * The category the website's sell flow prices a model with: the category tiles of components/sell/CategorySelector.tsx
     * (smartphone, tablet, camera, laptop, watch, smarttv, console, desktop, earbuds), whatever alias the model is stored
     * with. The same mapping as the apps' sellCategoryOf (mobile/packages/core). Never taken from the request, so a
     * client cannot pick a category without deductions.
     */
    public static String sellCategory(String modelCategory) {
        String c = modelCategory == null ? "" : JsText.lower(JsText.trim(modelCategory));
        return switch (c) {
            case "" -> "smartphone";
            case "mobile" -> "smartphone";
            case "ipad" -> "tablet";
            case "smartwatch" -> "watch";
            case "tv" -> "smarttv";
            default -> c;
        };
    }

    /** addOrder(): notify admins, zonal heads and the order's caretakers (in-app and by email). */
    private void broadcastNewOrder(CustomerOrder order, User routed, String customerName) {
        try {
            List<User> recipients = new ArrayList<>(people.findByRoleIn(List.of(Roles.SUPER_ADMIN, Roles.ADMIN)));
            recipients.addAll(people.findByRoleIn(List.of(Roles.ZONAL_HEAD)));
            List<String> caretakerIds = notify.caretakers(routed == null ? null : routed.getId());
            if (!caretakerIds.isEmpty()) {
                recipients.addAll(people.findByIdIn(caretakerIds));
            }
            // Remove duplicates by email (first position kept).
            Map<String, User> unique = new LinkedHashMap<>();
            for (User u : recipients) {
                unique.put(u.getEmail(), u);
            }
            String area = JsText.truthy(order.getPincode()) ? order.getPincode() : "unknown area";
            notify.notifyUsers(unique.values().stream().map(User::getId).toList(), "New Order: Action Required",
                    "Order #" + order.orderNumberValue() + " for " + order.getDevice() + " placed in " + area + ".",
                    "order_new", order.getId());
            notify.notifyRole(Roles.ADMIN, "New Order Placed",
                    "New global order #" + order.orderNumberValue() + " needs assignment.", "order_new", order.getId());

            String html = newOrderAlertHtml(order, customerName);
            for (User u : unique.values()) {
                mail.sendSystemEmailAsync(u.getEmail(),
                        "New Order Alert: #" + order.orderNumberValue() + " (" + order.getPincode() + ")", html);
            }
        } catch (RuntimeException e) {
            log.error("Critical Notification broadcast failed: {}", e.getMessage());
        }
    }

    // ------------------------------------------------------------------------------------------------ reads

    /** getUserOrders(): the customer's orders (newest first) with the assigned executive's name and phone. */
    public List<JsonNode> getUserOrders(Optional<SessionPayload> session) {
        Optional<SessionUser> me = activeUser(session);
        if (me.isEmpty()) {
            return List.of();
        }
        User user = users.findById(me.get().id()).orElse(null);
        return orders.findByUserIdOrderByCreatedAtDesc(me.get().id()).stream()
                .map(o -> withExecutive(mapper.toAppOrder(o, user), o.getRiderId())).toList();
    }

    /** One of the customer's own orders (Customer app tracker); 404 for anyone else's. */
    public JsonNode getUserOrder(Optional<SessionPayload> session, String orderId) {
        SessionUser me = activeUser(session).orElseThrow(ActionException::unauthorized);
        CustomerOrder order = JsText.truthy(orderId) ? orders.findById(orderId).orElse(null) : null;
        if (order == null || !me.id().equals(order.getUserId())) {
            throw OrderAccess.notFound();
        }
        return withExecutive(mapper.toAppOrder(order, users.findById(me.id()).orElse(null)), order.getRiderId());
    }

    private JsonNode withExecutive(AppOrderDto order, String riderId) {
        ObjectNode node = objectMapper.valueToTree(order);
        Rider rider = JsText.truthy(riderId) ? riders.findById(riderId).orElse(null) : null;
        if (rider == null) {
            node.putNull("executive");
        } else {
            ObjectNode executive = node.putObject("executive");
            executive.put("name", rider.getName());
            executive.put("phone", rider.getPhone());
        }
        return node;
    }

    /** The signed-in customer; a session of a deleted (anonymised) account no longer counts. */
    private Optional<SessionUser> activeUser(Optional<SessionPayload> session) {
        Optional<SessionUser> me = session.map(SessionPayload::user).filter(u -> u.id() != null);
        if (me.isEmpty()) {
            return me;
        }
        boolean deleted = users.findById(me.get().id()).map(User::getEmail)
                .map(e -> e.endsWith(AccountDeletionService.DELETED_EMAIL_DOMAIN)).orElse(false);
        return deleted ? Optional.empty() : me;
    }

    // ------------------------------------------------------------------------------------------------ service area

    /** requestServiceArea(pincode, phone, address): emails the admin about an area that is not served yet. */
    public Map<String, Object> requestServiceArea(String pincode, String phone, String address) {
        String html = "<h2>New Service Area Request</h2>"
                + "<p>A customer has requested service in an area that is currently not serviceable.</p><ul>"
                + "<li><b>Pincode:</b> " + escape(pincode) + "</li>"
                + "<li><b>Phone:</b> " + (JsText.truthy(phone) ? escape(phone) : "Not provided") + "</li>"
                + "<li><b>Address/Location:</b> " + (JsText.truthy(address) ? escape(address) : "Not provided") + "</li></ul>";
        mail.sendSystemEmail(serviceAreaEmail, "Service Area Request for " + pincode, html);
        return Map.of("success", true);
    }

    // ------------------------------------------------------------------------------------------------ emails

    private static String escape(String s) {
        return s == null ? "" : HtmlUtils.htmlEscape(s);
    }

    private static String orderConfirmedHtml(String name, String device, String variant, int price) {
        return "<div style=\"font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #10b981; border-radius: 10px;\">"
                + "<h2 style=\"color: #10b981;\">Order Confirmed!</h2>"
                + "<p>Dear " + escape(name) + ", your request to sell your <b>" + escape(device) + " (" + escape(variant)
                + ")</b> has been successfully recorded.</p>"
                + "<div style=\"background-color: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;\">"
                + "<p><b>Estimated Value:</b> ₹" + price + "</p><p><b>Status:</b> Pending Pickup</p></div>"
                + "<p>Our team will review your order and allocate a dedicated executive to your address for pickup shortly.</p>"
                + "<p style=\"color: #888; font-size: 12px; margin-top: 20px;\">Fonzkart Logistics</p></div>";
    }

    private String newOrderAlertHtml(CustomerOrder order, String customerName) {
        return "<div style=\"font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 2px solid #10b981; border-radius: 15px;\">"
                + "<h2 style=\"color: #10b981; font-size: 24px;\">🚀 New Order Received!</h2>"
                + "<p style=\"font-size: 16px; color: #333;\">Order <b>#" + order.orderNumberValue()
                + "</b> has been placed and requires your attention.</p>"
                + "<div style=\"background-color: #f0fdf4; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #d1fae5;\">"
                + "<p style=\"margin: 5px 0;\"><b>Device:</b> " + escape(order.getDevice()) + "</p>"
                + "<p style=\"margin: 5px 0;\"><b>Estimated Offer:</b> ₹" + order.getPrice() + "</p>"
                + "<p style=\"margin: 5px 0;\"><b>Pincode:</b> "
                + (JsText.truthy(order.getPincode()) ? escape(order.getPincode()) : "Not provided") + "</p>"
                + "<p style=\"margin: 5px 0;\"><b>Customer:</b> " + escape(customerName) + "</p></div>"
                + "<a href=\"" + appUrl + "/admin/orders\" style=\"display: inline-block; background-color: #10b981; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px;\">View in Dashboard</a>"
                + "<p style=\"color: #888; font-size: 12px; margin-top: 25px;\">Fonzkart Logistics Management System</p></div>";
    }
}
