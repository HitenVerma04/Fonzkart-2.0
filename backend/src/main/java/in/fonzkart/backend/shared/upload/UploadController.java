package in.fonzkart.backend.shared.upload;

import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.rider.service.ExecutiveAuthService;
import in.fonzkart.backend.shared.web.ActionException;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Image uploads for verification photos, catalog images and documents (actions/upload.ts → uploadImage), shared by
 * the website and the apps. Files are kept in {@code UPLOAD_DIR} (in Coolify a persistent volume, so redeploys keep
 * them) and served at {@code /uploads/<name>}, the same URLs the website already stores.
 * <p>
 * Unlike the original, uploading needs a signed-in user or executive, and only images (JPEG, PNG, WebP, GIF, HEIC) up
 * to 10 MB are accepted, recognised by their content rather than their name.
 */
@RestController
public class UploadController {

    private static final Pattern SAFE_NAME = Pattern.compile("[A-Za-z0-9.-]+");
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final long MAX_BYTES = 10L * 1024 * 1024;

    private final Path dir;
    private final SessionService sessions;
    private final StaffAccess staffAccess;
    private final ExecutiveAuthService executives;

    public UploadController(@Value("${fonzkart.uploads.dir:uploads}") String dir, SessionService sessions,
                            StaffAccess staffAccess, ExecutiveAuthService executives) {
        this.dir = Path.of(dir).toAbsolutePath().normalize();
        this.sessions = sessions;
        this.staffAccess = staffAccess;
        this.executives = executives;
    }

    /** Multipart field {@code file}; response {@code {"url": "/uploads/<name>"}}. */
    @PostMapping(value = "/api/uploads", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> upload(HttpServletRequest request, @RequestParam("file") MultipartFile file)
            throws IOException {
        boolean signedIn = staffAccess.current(sessions.getSession(request)).isPresent()
                || executives.currentExecutive(request).isPresent();
        if (!signedIn) {
            throw ActionException.unauthorized();
        }
        if (file == null || file.isEmpty()) {
            throw new ActionException(HttpStatus.BAD_REQUEST, "No file uploaded");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ActionException(HttpStatus.PAYLOAD_TOO_LARGE, "File too large (max 10 MB)");
        }
        byte[] bytes = file.getBytes();
        String extension = imageExtension(bytes);
        if (extension == null) {
            throw new ActionException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Only images can be uploaded");
        }
        // Date.now() + '-' + random + '-' + the original name reduced to safe characters, as uploadImage() names files.
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().replaceAll("[^a-zA-Z0-9.-]", "");
        String base = (original.contains(".") ? original.substring(0, original.lastIndexOf('.')) : original).replace(".", "");
        if (base.isEmpty()) {
            base = "image";
        }
        String name = System.currentTimeMillis() + "-" + RANDOM.nextInt(1_000_000_000) + "-"
                + (base.length() > 60 ? base.substring(0, 60) : base) + "." + extension;
        Files.createDirectories(dir);
        Files.write(dir.resolve(name), bytes);
        return Map.of("url", "/uploads/" + name);
    }

    @GetMapping("/uploads/{name:.+}")
    public ResponseEntity<Resource> serve(@PathVariable String name) {
        if (!SAFE_NAME.matcher(name).matches() || name.contains("..")) {
            return ResponseEntity.notFound().build();
        }
        Path file = dir.resolve(name).normalize();
        if (!file.startsWith(dir) || !Files.isRegularFile(file)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(mediaType(name))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .header("X-Content-Type-Options", "nosniff")
                .body(new FileSystemResource(file));
    }

    /** The image type from the file's first bytes, or null for anything that is not an accepted image. */
    static String imageExtension(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "jpg";
        }
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
            return "png";
        }
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "webp";
        }
        if (b.length >= 6 && b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') {
            return "gif";
        }
        if (b.length >= 12 && b[4] == 'f' && b[5] == 't' && b[6] == 'y' && b[7] == 'p') {
            String brand = new String(b, 8, 4, java.nio.charset.StandardCharsets.US_ASCII).toLowerCase(Locale.ROOT);
            if (brand.equals("heic") || brand.equals("heix") || brand.equals("mif1") || brand.equals("msf1")) {
                return "heic";
            }
        }
        return null;
    }

    private static MediaType mediaType(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) {
            return MediaType.IMAGE_PNG;
        }
        if (lower.endsWith(".gif")) {
            return MediaType.IMAGE_GIF;
        }
        if (lower.endsWith(".webp")) {
            return MediaType.parseMediaType("image/webp");
        }
        if (lower.endsWith(".heic")) {
            return MediaType.parseMediaType("image/heic");
        }
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return MediaType.IMAGE_JPEG;
        }
        return MediaType.APPLICATION_OCTET_STREAM;
    }
}
