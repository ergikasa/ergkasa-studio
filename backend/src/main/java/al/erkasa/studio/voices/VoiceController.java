package al.erkasa.studio.voices;

import java.nio.file.Path;
import java.util.Map;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Narrator presets for the Studio's voice picker. */
@RestController
@RequestMapping("/api/voices")
public class VoiceController {

    private static final MediaType MP3 = MediaType.parseMediaType("audio/mpeg");

    private final VoiceCatalogService voices;

    public VoiceController(VoiceCatalogService voices) {
        this.voices = voices;
    }

    /** {@code GET /api/voices}: the whole catalog (default + presets). */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public String catalog() {
        return voices.catalogJson();
    }

    /** {@code GET /api/voices/{id}/sample}: the preset's sample, once made with {@code pnpm voices --samples}. */
    @GetMapping("/{id}/sample")
    public ResponseEntity<Resource> sample(@PathVariable String id) {
        Path file = voices.sample(id).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "no sample for voice " + id + " (run: pnpm voices --samples)"));
        return ResponseEntity.ok()
                .contentType(MP3)
                .cacheControl(CacheControl.noCache())
                .body(new FileSystemResource(file));
    }

    @ExceptionHandler(VoiceCatalogService.VoiceCatalogException.class)
    public ResponseEntity<Map<String, String>> invalidCatalog(VoiceCatalogService.VoiceCatalogException e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
    }
}
