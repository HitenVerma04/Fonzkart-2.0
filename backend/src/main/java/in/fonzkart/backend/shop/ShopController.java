package in.fonzkart.backend.shop;

import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.shop.ShopService.AdminOverview;
import in.fonzkart.backend.shop.ShopService.FestiveTheme;
import in.fonzkart.backend.shop.ShopService.PlaceOrderInput;
import in.fonzkart.backend.shop.ShopService.ScreenGuardInput;
import in.fonzkart.backend.shop.ShopService.SettingsInput;
import in.fonzkart.backend.shop.ShopService.ShopOrder;
import in.fonzkart.backend.shop.ShopService.StatusInput;
import in.fonzkart.backend.shop.ShopService.Store;
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

/**
 * The screen guard shop: the store and orders for customers, guards, switches and orders for administrators. Also the
 * Customer app's festive theme, which shares the shop's settings table.
 */
@RestController
public class ShopController {

    private final ShopService shop;
    private final SessionService sessions;

    public ShopController(ShopService shop, SessionService sessions) {
        this.shop = shop;
        this.sessions = sessions;
    }

    @GetMapping("/api/app/theme")
    public FestiveTheme festiveTheme() {
        return shop.festiveTheme();
    }

    @PutMapping("/api/app/admin/theme")
    public Map<String, Object> saveFestiveTheme(HttpServletRequest request, @RequestBody FestiveTheme input) {
        return shop.saveFestiveTheme(sessions.getSession(request), input);
    }

    @GetMapping("/api/shop/screen-guards")
    public Store store() {
        return shop.store();
    }

    @PostMapping("/api/shop/orders")
    public ShopOrder placeOrder(HttpServletRequest request, @RequestBody PlaceOrderInput input) {
        return shop.placeOrder(sessions.getSession(request), input);
    }

    @GetMapping("/api/shop/orders")
    public List<ShopOrder> myOrders(HttpServletRequest request) {
        return shop.myOrders(sessions.getSession(request));
    }

    @GetMapping("/api/shop/admin/screen-guards")
    public AdminOverview overview(HttpServletRequest request) {
        return shop.overview(sessions.getSession(request));
    }

    @PostMapping("/api/shop/admin/screen-guards")
    public Map<String, Object> add(HttpServletRequest request, @RequestBody ScreenGuardInput input) {
        return shop.add(sessions.getSession(request), input);
    }

    @PutMapping("/api/shop/admin/screen-guards/{id}")
    public Map<String, Object> update(HttpServletRequest request, @PathVariable String id, @RequestBody ScreenGuardInput input) {
        return shop.update(sessions.getSession(request), id, input);
    }

    @DeleteMapping("/api/shop/admin/screen-guards/{id}")
    public Map<String, Object> delete(HttpServletRequest request, @PathVariable String id) {
        return shop.delete(sessions.getSession(request), id);
    }

    @PutMapping("/api/shop/admin/settings")
    public Map<String, Object> saveSettings(HttpServletRequest request, @RequestBody SettingsInput input) {
        return shop.saveSettings(sessions.getSession(request), input);
    }

    @GetMapping("/api/shop/admin/orders")
    public List<ShopOrder> orders(HttpServletRequest request) {
        return shop.allOrders(sessions.getSession(request));
    }

    @PutMapping("/api/shop/admin/orders/{id}/status")
    public Map<String, Object> setStatus(HttpServletRequest request, @PathVariable String id, @RequestBody StatusInput input) {
        return shop.setStatus(sessions.getSession(request), id, input);
    }
}
