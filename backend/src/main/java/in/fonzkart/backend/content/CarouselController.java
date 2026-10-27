package in.fonzkart.backend.content;

import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.content.CarouselService.Slide;
import in.fonzkart.backend.content.CarouselService.SlideInput;
import in.fonzkart.backend.content.CarouselService.SlideOrder;
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

/** The Customer app's home-page carousel: visible cards for everyone, editing for administrators (Admin app). */
@RestController
public class CarouselController {

    private final CarouselService carousel;
    private final SessionService sessions;

    public CarouselController(CarouselService carousel, SessionService sessions) {
        this.carousel = carousel;
        this.sessions = sessions;
    }

    @GetMapping("/api/content/carousel")
    public List<Slide> visible() {
        return carousel.visible();
    }

    @GetMapping("/api/content/carousel/admin")
    public List<Slide> all(HttpServletRequest request) {
        return carousel.all(sessions.getSession(request));
    }

    @PostMapping("/api/content/carousel")
    public Map<String, Object> add(HttpServletRequest request, @RequestBody SlideInput input) {
        return carousel.add(sessions.getSession(request), input);
    }

    @PutMapping("/api/content/carousel/order")
    public Map<String, Object> reorder(HttpServletRequest request, @RequestBody List<SlideOrder> items) {
        return carousel.reorder(sessions.getSession(request), items);
    }

    @PutMapping("/api/content/carousel/{id}")
    public Map<String, Object> update(HttpServletRequest request, @PathVariable String id, @RequestBody SlideInput input) {
        return carousel.update(sessions.getSession(request), id, input);
    }

    @DeleteMapping("/api/content/carousel/{id}")
    public Map<String, Object> delete(HttpServletRequest request, @PathVariable String id) {
        return carousel.delete(sessions.getSession(request), id);
    }
}
