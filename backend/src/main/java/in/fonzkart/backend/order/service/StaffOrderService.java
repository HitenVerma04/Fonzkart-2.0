package in.fonzkart.backend.order.service;

import static in.fonzkart.backend.order.service.OrderAccess.BULK_ORDER_STAFF;
import static in.fonzkart.backend.order.service.OrderAccess.FORBIDDEN_ORDER;
import static in.fonzkart.backend.order.service.OrderAccess.ORDER_DELETERS;
import static in.fonzkart.backend.order.service.OrderAccess.ORDER_STAFF;
import static in.fonzkart.backend.order.service.OrderAccess.PARTNER_ROUTERS;
import static in.fonzkart.backend.order.service.OrderAccess.PRICE_APPROVERS;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.rules.StaffAccess.Staff;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.order.dto.AppOrderDto;
import in.fonzkart.backend.order.entity.CustomerOrder;
import in.fonzkart.backend.order.repository.CustomerOrderRepository;
import in.fonzkart.backend.order.repository.OrderPeopleRepository;
import in.fonzkart.backend.order.service.OrderAccess.OrderContext;
import in.fonzkart.backend.order.service.OrderAccess.OrderScope;
import in.fonzkart.backend.order.service.OrderWorkflow.Actor;
import in.fonzkart.backend.rider.dto.RiderDto;
import in.fonzkart.backend.rider.entity.Rider;
import in.fonzkart.backend.rider.repository.RiderRepository;
import in.fonzkart.backend.shared.mail.MailService;
import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.user.repository.UserRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

/**
 * Staff order screens and actions: app/admin/orders/page.tsx (the Orders page data), app/api/admin/orders (single,
 * bulk and unassigned-count routes) and the order server actions of actions/admin.ts (assignPartner, assignRider).
 * Who may act on which order: {@link OrderAccess}; what each action does: {@link OrderWorkflow}.
 */
@Service
public class StaffOrderService {

    /** What the Orders page lets the caller do (OrderPermissions in components/admin/OrderManager.tsx). */
    public record Permissions(boolean assignPartner, boolean assignRider, boolean approvePrice, boolean manage,
                              boolean bulk, boolean delete) {
    }

    public record PartnerSummary(String id, String name, String phone, String email, List<String> pincodes,
                                 Map<String, String> relationshipManager, boolean routable) {
    }

    public record RiderWithPartner(String id, String name, String phone, String email, String status, String createdAt,
                                   String updatedAt, String partnerId, Map<String, Object> partner) {
    }

    /**
     * The Orders page for the caller. A field executive sees the orders of the rider with their phone number
     * ({@code view: "executive"}); staff see the orders in their scope with the partners and executives they may use.
     */
    public record OrdersPage(String view, String role, List<AppOrderDto> orders, List<RiderWithPartner> riders,
                             List<PartnerSummary> partners, Permissions permissions, List<String> pincodes,
                             List<String> territory) {
    }

    private final StaffAccess staffAccess;
    private final OrderAccess access;
    private final OrderWorkflow workflow;
    private final CustomerOrderRepository orders;
    private final OrderPeopleRepository people;
    private final UserRepository users;
    private final RiderRepository riders;
    private final AppOrderMapper mapper;
    private final MailService mail;
    private final in.fonzkart.backend.city.repository.CityRepository cities;

    public StaffOrderService(StaffAccess staffAccess, OrderAccess access, OrderWorkflow workflow,
                             CustomerOrderRepository orders, OrderPeopleRepository people, UserRepository users,
                             RiderRepository riders, AppOrderMapper mapper, MailService mail,
                             in.fonzkart.backend.city.repository.CityRepository cities) {
        this.staffAccess = staffAccess;
        this.access = access;
        this.workflow = workflow;
        this.orders = orders;
        this.people = people;
        this.users = users;
        this.riders = riders;
        this.mapper = mapper;
        this.mail = mail;
        this.cities = cities;
    }

    // ------------------------------------------------------------------------------------------------ Orders page

    @Transactional(readOnly = true)
    public OrdersPage ordersPage(Optional<SessionPayload> session, String filterRiderId) {
        Staff staff = staffAccess.current(session).orElseThrow(ActionException::unauthorized);
        List<String> panelRoles = new ArrayList<>(ORDER_STAFF);
        panelRoles.add(Roles.FIELD_EXECUTIVE);
        if (!panelRoles.contains(staff.role())) {
            throw ActionException.forbidden(StaffAccess.FORBIDDEN_ROLE);
        }
        List<CustomerOrder> all = orders.findAllByOrderByCreatedAtDesc();

        if (Roles.FIELD_EXECUTIVE.equals(staff.role())) {
            String phone = staff.user().getPhone() == null ? "" : staff.user().getPhone();
            Optional<Rider> rider = riders.findFirstByPhone(phone);
            List<CustomerOrder> mine = rider.isEmpty() ? List.of()
                    : all.stream().filter(o -> rider.get().getId().equals(o.getRiderId())).toList();
            return new OrdersPage("executive", staff.role(), map(mine), List.of(), List.of(),
                    new Permissions(false, false, false, false, false, false), List.of(), List.of());
        }

        OrderScope scope = access.scopeFor(staff);
        List<CustomerOrder> visible = all.stream().filter(o -> OrderAccess.inScope(scope, o))
                .filter(o -> !JsText.truthy(filterRiderId) || filterRiderId.equals(o.getRiderId())).toList();

        List<Rider> teamRiders = scope.all() ? riders.findAllByOrderByNameAsc()
                : scope.partnerIds().isEmpty() ? List.of() : riders.findByPartnerIdInOrderByNameAsc(scope.partnerIds());
        Map<String, User> riderPartners = byId(teamRiders.stream().map(Rider::getPartnerId).filter(JsText::truthy).toList());
        List<RiderWithPartner> riderList = teamRiders.stream()
                .map(r -> {
                    RiderDto d = RiderDto.from(r);
                    User p = r.getPartnerId() == null ? null : riderPartners.get(r.getPartnerId());
                    Map<String, Object> partner = null;
                    if (p != null) {
                        partner = new LinkedHashMap<>();
                        partner.put("name", p.getName());
                        partner.put("pincodes", p.getPincodes() == null ? List.of() : List.of(p.getPincodes()));
                    }
                    return new RiderWithPartner(d.id(), d.name(), d.phone(), d.email(), d.status(), d.createdAt(),
                            d.updatedAt(), d.partnerId(), partner);
                }).toList();

        Set<String> partnerIds = new LinkedHashSet<>(scope.partnerIds());
        visible.stream().map(CustomerOrder::getPartnerId).filter(JsText::truthy).forEach(partnerIds::add);
        List<User> partnerUsers = scope.all() ? people.findAllPartnersByName()
                : partnerIds.isEmpty() ? List.of() : people.findPartnersByIdsByName(partnerIds);
        Map<String, User> rms = byId(partnerUsers.stream().map(User::getRelationshipManagerId).filter(JsText::truthy).toList());
        List<PartnerSummary> partnerList = partnerUsers.stream().map(p -> {
            User rm = p.getRelationshipManagerId() == null ? null : rms.get(p.getRelationshipManagerId());
            Map<String, String> rmView = null;
            if (rm != null) {
                rmView = new LinkedHashMap<>();
                rmView.put("name", rm.getName());
                rmView.put("phone", rm.getPhone());
            }
            return new PartnerSummary(p.getId(), p.getName(), p.getPhone(), p.getEmail(),
                    p.getPincodes() == null ? List.of() : List.of(p.getPincodes()), rmView,
                    OrderAccess.canRouteTo(scope, p.getId()));
        }).toList();

        String role = staff.role();
        Permissions permissions = new Permissions(PARTNER_ROUTERS.contains(role), ORDER_STAFF.contains(role),
                PRICE_APPROVERS.contains(role), ORDER_STAFF.contains(role), BULK_ORDER_STAFF.contains(role),
                ORDER_DELETERS.contains(role));
        List<String> territory = staff.isZonalHead()
                ? cities.findAllById(staffAccess.zonalHeadManagedCityIds(staff)).stream()
                    .map(in.fonzkart.backend.city.entity.City::getName).toList()
                : List.of();
        List<String> myPincodes = staff.isPartner() && staff.user().getPincodes() != null
                ? List.of(staff.user().getPincodes()) : List.of();
        return new OrdersPage("staff", role, map(visible), riderList, partnerList, permissions, myPincodes, territory);
    }

    /** Open orders without an executive among those the caller sees (the admin panel's "order waiting" buzzer). */
    public Map<String, Object> unassignedCount(Optional<SessionPayload> session) {
        Staff staff = staffAccess.current(session).orElseThrow(ActionException::unauthorized);
        if (!ORDER_STAFF.contains(staff.role())) {
            return Map.of("count", 0);
        }
        OrderScope scope = access.scopeFor(staff);
        long count = orders.findOpenWithoutExecutive().stream().filter(o -> OrderAccess.inScope(scope, o)).count();
        return Map.of("count", count);
    }

    // ------------------------------------------------------------------------------------------------ actions

    /** actions/admin.ts → assignPartner(orderId, partnerId) */
    public Map<String, Object> assignPartner(Optional<SessionPayload> session, String orderId, String partnerId) {
        OrderContext ctx = access.requireOrderAccess(session, orderId, PARTNER_ROUTERS);
        Map<String, Object> result = workflow.assignPartner(ctx, partnerId);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", true);
        m.put("changed", result.get("changed"));
        return m;
    }

    /** actions/admin.ts → assignRider(orderId, riderId): also emails the customer who is coming. */
    public Map<String, Object> assignRider(Optional<SessionPayload> session, String orderId, String riderId) {
        OrderContext ctx = access.requireOrderAccess(session, orderId, ORDER_STAFF);
        Rider rider = workflow.assignRider(ctx, riderId);
        CustomerOrder order = orders.findById(orderId).orElse(ctx.order());
        users.findById(order.getUserId()).filter(u -> JsText.truthy(u.getEmail())).ifPresent(u ->
                mail.sendSystemEmailAsync(u.getEmail(), "Fonzkart: Executive Assigned for Pickup",
                        executiveAssignedHtml(u.getName(), order.getDevice(), rider, order.getPrice())));
        return Map.of("success", true);
    }

    /** POST app/api/admin/orders/[id]: approve/reject a revised price, fail, restore, hub status, payout, delete. */
    public Map<String, Object> orderAction(Optional<SessionPayload> session, String orderId, JsonNode body) {
        JsonNode b = body == null ? JsonNodeFactory.instance.objectNode() : body;
        String action = b.path("action").isTextual() ? b.get("action").asText() : null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", true);
        if ("approve_verification".equals(action) || "reject_verification".equals(action)) {
            OrderContext ctx = access.requireOrderAccess(session, orderId, PRICE_APPROVERS);
            m.putAll(workflow.decidePrice(ctx, "approve_verification".equals(action), b.get("overridePrice"), b.get("reason")));
            return m;
        }
        if ("fail_order".equals(action)) {
            OrderContext ctx = access.requireOrderAccess(session, orderId, ORDER_STAFF);
            workflow.failOrder(ctx.order(), workflow.staffActor(ctx.staff()), b.get("reason"));
            return m;
        }
        if ("restore_order".equals(action)) {
            OrderContext ctx = access.requireOrderAccess(session, orderId, ORDER_STAFF);
            m.put("status", workflow.restoreOrder(ctx.order(), workflow.staffActor(ctx.staff())));
            return m;
        }
        if ("update_hub_status".equals(action)) {
            OrderContext ctx = access.requireOrderAccess(session, orderId, ORDER_STAFF);
            m.put("hubStatus", workflow.setHubStatus(ctx.order(), workflow.staffActor(ctx.staff()), b.get("hubStatus")));
            return m;
        }
        if ("mark_payout_paid".equals(action)) {
            OrderContext ctx = access.requireOrderAccess(session, orderId, ORDER_STAFF);
            m.put("payout", workflow.markPayoutPaid(ctx.order(), workflow.staffActor(ctx.staff()), b.get("reference")));
            return m;
        }
        if ("delete_order".equals(action)) {
            return deleteOrder(session, orderId);
        }
        throw new ActionException(HttpStatus.BAD_REQUEST, "Invalid action");
    }

    /** DELETE app/api/admin/orders/[id] (and actions/admin.ts → deleteOrder) */
    public Map<String, Object> deleteOrder(Optional<SessionPayload> session, String orderId) {
        access.requireOrderAccess(session, orderId, ORDER_DELETERS);
        orders.deleteById(orderId);
        return Map.of("success", true);
    }

    /**
     * POST app/api/admin/orders/bulk: every selected order must be one the caller may act on, or nothing is changed.
     * Orders whose status does not allow the action are skipped; {@code count} is the number actually changed.
     */
    public Map<String, Object> bulk(Optional<SessionPayload> session, JsonNode body) {
        JsonNode b = body == null ? JsonNodeFactory.instance.objectNode() : body;
        JsonNode idsNode = b.get("ids");
        List<String> ids = new ArrayList<>();
        if (idsNode != null && idsNode.isArray()) {
            for (JsonNode i : idsNode) {
                if (!i.isTextual()) {
                    ids.clear();
                    break;
                }
                ids.add(i.asText());
            }
        }
        if (ids.isEmpty()) {
            throw new ActionException(HttpStatus.BAD_REQUEST, "No IDs provided");
        }
        String action = b.path("action").isTextual() ? b.get("action").asText() : null;
        Staff staff = staffAccess.requireRole(session, "bulk_delete".equals(action) ? ORDER_DELETERS : BULK_ORDER_STAFF);
        OrderScope scope = access.scopeFor(staff);
        List<CustomerOrder> selected = orders.findByIdIn(ids);
        if (selected.stream().anyMatch(o -> !OrderAccess.inScope(scope, o))) {
            throw ActionException.forbidden(FORBIDDEN_ORDER);
        }
        Actor actor = workflow.staffActor(staff);
        JsonNode reason = b.get("reason");

        if ("bulk_fail".equals(action)) {
            JsonNode why = in.fonzkart.backend.pricing.rules.JsValues.truthy(reason) ? reason
                    : JsonNodeFactory.instance.textNode("Bulk failure");
            return apply(selected, o -> workflow.failOrder(o, actor, why));
        }
        if ("bulk_restore".equals(action)) {
            return apply(selected, o -> workflow.restoreOrder(o, actor));
        }
        if ("bulk_hub_handover".equals(action)) {
            JsonNode hub = in.fonzkart.backend.pricing.rules.JsValues.truthy(b.get("hubStatus")) ? b.get("hubStatus")
                    : JsonNodeFactory.instance.textNode("handed_over");
            return apply(selected, o -> workflow.setHubStatus(o, actor, hub));
        }
        if ("bulk_delete".equals(action)) {
            orders.deleteAllById(selected.stream().map(CustomerOrder::getId).toList());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("success", true);
            m.put("count", selected.size());
            return m;
        }
        throw new ActionException(HttpStatus.BAD_REQUEST, "Invalid action");
    }

    private Map<String, Object> apply(List<CustomerOrder> selected, Consumer<CustomerOrder> change) {
        int count = 0;
        for (CustomerOrder order : selected) {
            try {
                change.accept(order);
                count++;
            } catch (ActionException e) {
                if (e.status() != HttpStatus.BAD_REQUEST) {
                    throw e; // not possible in this order's status: skip it; anything else stops the batch
                }
            }
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", true);
        m.put("count", count);
        return m;
    }

    // ------------------------------------------------------------------------------------------------ helpers

    private List<AppOrderDto> map(List<CustomerOrder> list) {
        Map<String, User> customers = byId(list.stream().map(CustomerOrder::getUserId).toList());
        return list.stream().map(o -> mapper.toAppOrder(o, customers.get(o.getUserId()))).toList();
    }

    private Map<String, User> byId(List<String> ids) {
        List<String> distinct = ids.stream().distinct().toList();
        if (distinct.isEmpty()) {
            return Map.of();
        }
        return users.findAllById(distinct).stream().collect(Collectors.toMap(User::getId, Function.identity()));
    }

    private static String executiveAssignedHtml(String name, String device, Rider rider, int price) {
        return "<div style=\"font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #3b82f6; border-radius: 10px;\">"
                + "<h2 style=\"color: #3b82f6;\">Executive Assigned! 🚚</h2>"
                + "<p>Dear " + HtmlUtils.htmlEscape(String.valueOf(name)) + ", we have assigned an executive for your <b>"
                + HtmlUtils.htmlEscape(String.valueOf(device)) + "</b> pickup!</p>"
                + "<div style=\"background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #10b981;\">"
                + "<p style=\"margin: 5px 0;\"><b>Executive Name:</b> " + HtmlUtils.htmlEscape(String.valueOf(rider.getName())) + "</p>"
                + "<p style=\"margin: 5px 0;\"><b>Executive Contact:</b> " + HtmlUtils.htmlEscape(String.valueOf(rider.getPhone())) + "</p>"
                + "<p style=\"margin: 5px 0;\"><b>Estimated Offer:</b> ₹" + price + "</p></div>"
                + "<p>They will contact you shortly to coordinate the pickup time at your provided address.</p>"
                + "<p style=\"color: #888; font-size: 12px; margin-top: 20px;\">Fonzkart Logistics Tracking</p></div>";
    }
}
