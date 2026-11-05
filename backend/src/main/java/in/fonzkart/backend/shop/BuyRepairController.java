package in.fonzkart.backend.shop;

import in.fonzkart.backend.auth.session.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Buying refurbished devices and booking repairs: listings and prices for everyone, orders for customers, the rest for administrators. */
@RestController
public class BuyRepairController {

    private final BuyService buy;
    private final RepairService repair;
    private final SessionService sessions;

    public BuyRepairController(BuyService buy, RepairService repair, SessionService sessions) {
        this.buy = buy;
        this.repair = repair;
        this.sessions = sessions;
    }

    // ---- Buy ----

    @GetMapping("/api/buy/devices")
    public BuyService.Store devices() {
        return buy.store();
    }

    @PostMapping("/api/buy/orders")
    public BuyService.Order placeOrder(HttpServletRequest request, @RequestBody BuyService.PlaceOrderInput input) {
        return buy.placeOrder(sessions.getSession(request), input);
    }

    @GetMapping("/api/buy/orders")
    public List<BuyService.Order> myOrders(HttpServletRequest request) {
        return buy.myOrders(sessions.getSession(request));
    }

    @GetMapping("/api/buy/admin/devices")
    public BuyService.AdminOverview buyOverview(HttpServletRequest request) {
        return buy.overview(sessions.getSession(request));
    }

    @PostMapping("/api/buy/admin/devices")
    public Map<String, Object> addDevice(HttpServletRequest request, @RequestBody BuyService.DeviceInput input) {
        return buy.add(sessions.getSession(request), input);
    }

    @PutMapping("/api/buy/admin/devices/{id}")
    public Map<String, Object> updateDevice(HttpServletRequest request, @PathVariable String id, @RequestBody BuyService.DeviceInput input) {
        return buy.update(sessions.getSession(request), id, input);
    }

    @DeleteMapping("/api/buy/admin/devices/{id}")
    public Map<String, Object> deleteDevice(HttpServletRequest request, @PathVariable String id) {
        return buy.delete(sessions.getSession(request), id);
    }

    @PutMapping("/api/buy/admin/settings")
    public Map<String, Object> saveBuySwitch(HttpServletRequest request, @RequestBody BuyService.SwitchInput input) {
        return buy.setEnabled(sessions.getSession(request), input);
    }

    @GetMapping("/api/buy/admin/orders")
    public List<BuyService.Order> allOrders(HttpServletRequest request) {
        return buy.allOrders(sessions.getSession(request));
    }

    @PutMapping("/api/buy/admin/orders/{id}/status")
    public Map<String, Object> setOrderStatus(HttpServletRequest request, @PathVariable String id, @RequestBody BuyService.StatusInput input) {
        return buy.setStatus(sessions.getSession(request), id, input);
    }

    // ---- Repair ----

    @GetMapping("/api/repair/prices")
    public RepairService.Store prices() {
        return repair.store();
    }

    @PostMapping("/api/repair/bookings")
    public RepairService.Booking book(HttpServletRequest request, @RequestBody RepairService.BookInput input) {
        return repair.book(sessions.getSession(request), input);
    }

    @GetMapping("/api/repair/bookings")
    public List<RepairService.Booking> myBookings(HttpServletRequest request) {
        return repair.myBookings(sessions.getSession(request));
    }

    @GetMapping("/api/repair/admin/prices")
    public RepairService.AdminOverview repairOverview(HttpServletRequest request) {
        return repair.overview(sessions.getSession(request));
    }

    @PostMapping("/api/repair/admin/prices")
    public Map<String, Object> addPrice(HttpServletRequest request, @RequestBody RepairService.PriceInput input) {
        return repair.add(sessions.getSession(request), input);
    }

    @PutMapping("/api/repair/admin/prices/{id}")
    public Map<String, Object> updatePrice(HttpServletRequest request, @PathVariable String id, @RequestBody RepairService.PriceInput input) {
        return repair.update(sessions.getSession(request), id, input);
    }

    @DeleteMapping("/api/repair/admin/prices/{id}")
    public Map<String, Object> deletePrice(HttpServletRequest request, @PathVariable String id) {
        return repair.delete(sessions.getSession(request), id);
    }

    @PutMapping("/api/repair/admin/settings")
    public Map<String, Object> saveRepairSwitch(HttpServletRequest request, @RequestBody RepairService.SwitchInput input) {
        return repair.setEnabled(sessions.getSession(request), input);
    }

    @GetMapping("/api/repair/admin/bookings")
    public List<RepairService.Booking> allBookings(HttpServletRequest request) {
        return repair.allBookings(sessions.getSession(request));
    }

    @PutMapping("/api/repair/admin/bookings/{id}/status")
    public Map<String, Object> setBookingStatus(HttpServletRequest request, @PathVariable String id, @RequestBody RepairService.StatusInput input) {
        return repair.setStatus(sessions.getSession(request), id, input);
    }
}
