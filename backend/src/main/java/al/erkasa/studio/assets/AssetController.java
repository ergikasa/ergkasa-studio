package al.erkasa.studio.assets;

import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** REST API of the asset registry. */
@RestController
@RequestMapping("/api/assets")
public class AssetController {

    private static final MediaType SVG = MediaType.parseMediaType("image/svg+xml");

    private final AssetService service;
    private final AssetIndexer indexer;
    private final AssetRepository repository;

    public AssetController(AssetService service, AssetIndexer indexer, AssetRepository repository) {
        this.service = service;
        this.indexer = indexer;
        this.repository = repository;
    }

    /** {@code GET /api/assets?category=&kind=&theme=&tag=&q=&limit=&offset=} */
    @GetMapping
    public AssetService.Page list(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String kind,
            @RequestParam(required = false) String theme,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "100") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return service.search(new AssetQuery(category, kind, theme, tag, q, limit, offset));
    }

    /** {@code GET /api/assets/stats}: active assets per category. */
    @GetMapping("/stats")
    public Map<String, Long> stats() {
        return repository.countsByCategory();
    }

    /** {@code GET /api/assets/candidates?category=&kind=&theme=&tags=a,b&text=&limit=} ranked for a slot. */
    @GetMapping("/candidates")
    public List<AssetCandidate> candidates(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String kind,
            @RequestParam(required = false) String theme,
            @RequestParam(required = false) List<String> tags,
            @RequestParam(required = false) String text,
            @RequestParam(defaultValue = "10") int limit) {
        return service.candidates(category, kind, theme, tags, text, limit);
    }

    /** {@code GET /api/assets/{id}}: the full asset.json. */
    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public String get(@PathVariable String id) {
        return service.meta(id).orElseThrow(() -> notFound("asset " + id));
    }

    /** {@code GET /api/assets/{id}/files/{file}}: one declared file of the asset (svg, rig json...). */
    @GetMapping("/{id}/files/{file:.+}")
    public ResponseEntity<Resource> file(@PathVariable String id, @PathVariable String file) {
        Path path = service.file(id, file).orElseThrow(() -> notFound("file " + file + " of asset " + id));
        return ResponseEntity.ok()
                .contentType(mediaType(path))
                .cacheControl(CacheControl.noCache())
                .body(new FileSystemResource(path));
    }

    /** {@code POST /api/assets/reindex}: re-reads the library from disk. */
    @PostMapping("/reindex")
    public IndexReport reindex() {
        return indexer.reindex();
    }

    @ExceptionHandler(AssetLibraryException.class)
    public ResponseEntity<Map<String, String>> libraryError(AssetLibraryException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
    }

    private static ResponseStatusException notFound(String what) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, what + " not found");
    }

    private static MediaType mediaType(Path path) {
        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        if (name.endsWith(".svg")) {
            return SVG;
        }
        if (name.endsWith(".json")) {
            return MediaType.APPLICATION_JSON;
        }
        if (name.endsWith(".png")) {
            return MediaType.IMAGE_PNG;
        }
        return MediaType.APPLICATION_OCTET_STREAM;
    }
}
