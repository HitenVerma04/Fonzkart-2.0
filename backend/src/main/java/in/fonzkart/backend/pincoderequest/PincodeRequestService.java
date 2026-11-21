package in.fonzkart.backend.pincoderequest;

import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.rules.StaffAccess.Staff;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.city.entity.City;
import in.fonzkart.backend.city.repository.CityRepository;
import in.fonzkart.backend.city.service.CityAccess;
import in.fonzkart.backend.order.service.OrderNotifications;
import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.user.repository.UserRepository;
import in.fonzkart.backend.user.service.PartnerCities;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pincode requests: a partner asks to serve more pincodes (Partner app), and an admin or the zonal head of the
 * partner's city approves all or some of them or rejects the request (Admin app). Approving adds the pincodes to the
 * partner and, where missing, to its city's pincode list (partners may only serve pincodes on that list). Both sides
 * get a notification (in-app and push).
 */
@Service
public class PincodeRequestService {

    static final String TYPE = "pincode_request";
    private static final int MAX_PINCODES = 200;

    private final PincodeRequestRepository requests;
    private final UserRepository users;
    private final CityRepository cities;
    private final StaffAccess staffAccess;
    private final CityAccess cityAccess;
    private final OrderNotifications notifications;
    private final PartnerCities partnerCities;

    public PincodeRequestService(PincodeRequestRepository requests, UserRepository users, CityRepository cities,
                                 StaffAccess staffAccess, CityAccess cityAccess, OrderNotifications notifications,
                                 PartnerCities partnerCities) {
        this.partnerCities = partnerCities;
        this.requests = requests;
        this.users = users;
        this.cities = cities;
        this.staffAccess = staffAccess;
        this.cityAccess = cityAccess;
        this.notifications = notifications;
    }

    // ------------------------------------------------------------------ partner

    /** The partner's pincodes, its city's list and its requests (newest first). */
    public Map<String, Object> mine(Optional<SessionPayload> session) {
        User partner = partner(session);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pincodes", Arrays.asList(nonNull(partner.getPincodes())));
        out.put("city", cityView(partner.getCityId()));
        // Every city the partner serves (main first), with its pincodes.
        out.put("cities", partnerCities.cityIds(partner).stream().map(this::cityView).filter(c -> c != null).toList());
        out.put("requests", requests.findByPartnerIdOrderByCreatedAtDesc(partner.getId()).stream().map(this::view).toList());
        return out;
    }

    @Transactional
    public Map<String, Object> create(Optional<SessionPayload> session, List<String> pincodes, String note) {
        User partner = partner(session);
        Set<String> wanted = new LinkedHashSet<>();
        for (String p : pincodes == null ? List.<String>of() : pincodes) {
            String code = p == null ? "" : p.trim();
            if (!code.matches("\\d{6}")) {
                return Map.of("error", "\"" + code + "\" is not a 6-digit pincode.");
            }
            wanted.add(code);
        }
        if (wanted.isEmpty()) {
            return Map.of("error", "Add at least one pincode.");
        }
        if (wanted.size() > MAX_PINCODES) {
            return Map.of("error", "Ask for at most " + MAX_PINCODES + " pincodes at a time.");
        }
        wanted.removeAll(Arrays.asList(nonNull(partner.getPincodes())));
        if (wanted.isEmpty()) {
            return Map.of("error", "You already serve all of these pincodes.");
        }
        Set<String> pending = new LinkedHashSet<>();
        for (PincodeRequest r : requests.findByPartnerIdOrderByCreatedAtDesc(partner.getId())) {
            if (PincodeRequest.PENDING.equals(r.getStatus())) {
                pending.addAll(Arrays.asList(r.getPincodes()));
            }
        }
        wanted.removeAll(pending);
        if (wanted.isEmpty()) {
            return Map.of("error", "These pincodes are already in a request waiting for approval.");
        }
        String trimmedNote = note == null || note.isBlank() ? null : note.trim();
        if (trimmedNote != null && trimmedNote.length() > 500) {
            trimmedNote = trimmedNote.substring(0, 500);
        }
        PincodeRequest r = PincodeRequest.create(Cuid.next(), partner.getId(), partner.getCityId(),
                wanted.toArray(String[]::new), trimmedNote, JsDates.nowUtc());
        requests.save(r);

        List<String> reviewers = new ArrayList<>(notifications.adminIds());
        if (partner.getManagerId() != null) {
            reviewers.add(partner.getManagerId());
        }
        notifications.notifyUsers(reviewers, "Pincode request",
                partner.getName() + " asks to serve " + wanted.size() + " more pincode" + (wanted.size() == 1 ? "" : "s")
                        + ": " + preview(wanted) + ". Review it in the Admin app (Pincode requests).", TYPE, null);
        return Map.of("success", true, "id", r.getId());
    }

    @Transactional
    public Map<String, Object> cancel(Optional<SessionPayload> session, String id) {
        User partner = partner(session);
        PincodeRequest r = requests.findById(id).filter(x -> x.getPartnerId().equals(partner.getId()))
                .orElseThrow(ActionException::notFound);
        if (!PincodeRequest.PENDING.equals(r.getStatus())) {
            return Map.of("error", "This request was already " + r.getStatus().toLowerCase() + ".");
        }
        r.close(PincodeRequest.CANCELLED, new String[0], null, partner.getId(), JsDates.nowUtc());
        requests.save(r);
        return Map.of("success", true);
    }

    // ------------------------------------------------------------------ reviewers (admins, zonal heads)

    /** Pending requests (oldest first) or decided ones (newest first), limited to what this reviewer may decide. */
    public List<Map<String, Object>> list(Optional<SessionPayload> session, boolean pending) {
        Staff staff = staffAccess.requireRole(session, StaffAccess.CITY_STAFF);
        List<PincodeRequest> found = pending
                ? requests.findByStatusOrderByCreatedAtAsc(PincodeRequest.PENDING)
                : requests.findTop100ByStatusNotOrderByCreatedAtDesc(PincodeRequest.PENDING);
        Map<String, Optional<User>> partners = new HashMap<>();
        List<Map<String, Object>> out = new ArrayList<>();
        for (PincodeRequest r : found) {
            if (staff.isZonalHead() && !mayReview(session, r.getPartnerId())) {
                continue;
            }
            Optional<User> partner = partners.computeIfAbsent(r.getPartnerId(), users::findById);
            Map<String, Object> v = view(r);
            v.put("partner", partner.map(p -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", p.getId());
                m.put("name", p.getName());
                m.put("email", p.getEmail());
                m.put("phone", p.getPhone());
                m.put("pincodes", Arrays.asList(nonNull(p.getPincodes())));
                return m;
            }).orElse(null));
            v.put("city", cityView(partner.map(User::getCityId).orElse(r.getCityId())));
            out.add(v);
        }
        return out;
    }

    /** Adds the chosen pincodes (all of the request's when none are given) to the partner, and to its city's list. */
    @Transactional
    public Map<String, Object> approve(Optional<SessionPayload> session, String id, List<String> chosen, String note) {
        PincodeRequest r = requests.findById(id).orElseThrow(ActionException::notFound);
        cityAccess.requirePartner(session, r.getPartnerId());
        if (!PincodeRequest.PENDING.equals(r.getStatus())) {
            return Map.of("error", "This request was already " + r.getStatus().toLowerCase() + ".");
        }
        Set<String> approve = new LinkedHashSet<>(Arrays.asList(r.getPincodes()));
        if (chosen != null) {
            approve.retainAll(chosen);
        }
        if (approve.isEmpty()) {
            return Map.of("error", "Choose at least one pincode to approve, or reject the request.");
        }
        User partner = users.findById(r.getPartnerId()).orElseThrow(ActionException::notFound);
        if (!Roles.PARTNER.equals(partner.getRole())) {
            return Map.of("error", partner.getName() + " is no longer a partner.");
        }
        LocalDateTime now = JsDates.nowUtc();
        Set<String> partnerPincodes = new LinkedHashSet<>(Arrays.asList(nonNull(partner.getPincodes())));
        partnerPincodes.addAll(approve);
        users.updatePincodesById(partner.getId(), partnerPincodes.toArray(String[]::new), now);
        int addedToCity = 0;
        if (partner.getCityId() != null) {
            Optional<City> city = cities.findById(partner.getCityId());
            if (city.isPresent()) {
                Set<String> cityPincodes = new LinkedHashSet<>(Arrays.asList(nonNull(city.get().getPincodes())));
                int before = cityPincodes.size();
                cityPincodes.addAll(approve);
                addedToCity = cityPincodes.size() - before;
                if (addedToCity > 0) {
                    cities.updatePincodes(city.get().getId(), cityPincodes.toArray(String[]::new), now);
                }
            }
        }
        String reviewNote = blankToNull(note);
        r.close(PincodeRequest.APPROVED, approve.toArray(String[]::new), reviewNote,
                session.map(s -> s.user().id()).orElse(null), now);
        requests.save(r);

        int left = r.getPincodes().length - approve.size();
        notifications.notifyUsers(List.of(partner.getId()), "Pincodes approved",
                "You now serve " + preview(approve) + "." + (left > 0 ? " " + left + " not approved." : "")
                        + (reviewNote != null ? " Note: " + reviewNote : ""), TYPE, null);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("success", true);
        out.put("approved", approve.size());
        out.put("addedToCity", addedToCity);
        return out;
    }

    @Transactional
    public Map<String, Object> reject(Optional<SessionPayload> session, String id, String note) {
        PincodeRequest r = requests.findById(id).orElseThrow(ActionException::notFound);
        cityAccess.requirePartner(session, r.getPartnerId());
        if (!PincodeRequest.PENDING.equals(r.getStatus())) {
            return Map.of("error", "This request was already " + r.getStatus().toLowerCase() + ".");
        }
        String reviewNote = blankToNull(note);
        r.close(PincodeRequest.REJECTED, new String[0], reviewNote, session.map(s -> s.user().id()).orElse(null),
                JsDates.nowUtc());
        requests.save(r);
        notifications.notifyUsers(List.of(r.getPartnerId()), "Pincode request not approved",
                "Your request for " + preview(Arrays.asList(r.getPincodes())) + " was not approved."
                        + (reviewNote != null ? " Reason: " + reviewNote : ""), TYPE, null);
        return Map.of("success", true);
    }

    // ------------------------------------------------------------------ helpers

    private User partner(Optional<SessionPayload> session) {
        Staff staff = staffAccess.requireRole(session, List.of(Roles.PARTNER),
                "Only partners can ask for pincodes.");
        return staff.user();
    }

    private boolean mayReview(Optional<SessionPayload> session, String partnerId) {
        try {
            cityAccess.requirePartner(session, partnerId);
            return true;
        } catch (ActionException e) {
            return false;
        }
    }

    private Map<String, Object> view(PincodeRequest r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("partnerId", r.getPartnerId());
        m.put("pincodes", Arrays.asList(r.getPincodes()));
        m.put("note", r.getNote());
        m.put("status", r.getStatus());
        m.put("approved", Arrays.asList(r.getApproved()));
        m.put("reviewNote", r.getReviewNote());
        m.put("reviewedAt", r.getReviewedAt() == null ? null : JsDates.toIsoString(r.getReviewedAt()));
        m.put("createdAt", JsDates.toIsoString(r.getCreatedAt()));
        return m;
    }

    private Map<String, Object> cityView(String cityId) {
        if (cityId == null) {
            return null;
        }
        return cities.findById(cityId).map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId());
            m.put("name", c.getName());
            m.put("pincodes", Arrays.asList(nonNull(c.getPincodes())));
            return m;
        }).orElse(null);
    }

    private static String preview(java.util.Collection<String> codes) {
        List<String> list = new ArrayList<>(codes);
        return list.size() <= 5 ? String.join(", ", list)
                : String.join(", ", list.subList(0, 5)) + " and " + (list.size() - 5) + " more";
    }

    private static String[] nonNull(String[] a) {
        return a == null ? new String[0] : a;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
