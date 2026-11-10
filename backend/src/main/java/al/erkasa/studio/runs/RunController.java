package al.erkasa.studio.runs;

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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Runs: start a video, follow its steps, get its files, retry or cancel it. */
@RestController
@RequestMapping("/api/runs")
public class RunController {

    private final Orchestrator orchestrator;
    private final RunQueries queries;
    private final RunStorage storage;

    public RunController(Orchestrator orchestrator, RunQueries queries, RunStorage storage) {
        this.orchestrator = orchestrator;
        this.queries = queries;
        this.storage = storage;
    }

    /** {@code POST /api/runs} {topic, theme, voice?, seconds?, notes?, silent?} */
    @PostMapping
    public ResponseEntity<RunQueries.RunDetail> create(@RequestBody Orchestrator.NewRun body) {
        String id = orchestrator.createRun(body);
        return ResponseEntity.status(HttpStatus.CREATED).body(detail(id));
    }

    @GetMapping
    public List<RunQueries.RunSummary> list(@RequestParam(defaultValue = "50") int limit) {
        return queries.list(limit);
    }

    @GetMapping("/{id}")
    public RunQueries.RunDetail get(@PathVariable String id) {
        return detail(id);
    }

    @PostMapping("/{id}/cancel")
    public RunQueries.RunDetail cancel(@PathVariable String id) {
        if (!orchestrator.cancel(id)) {
            throw conflict("run " + id + " is not running");
        }
        return detail(id);
    }

    @PostMapping("/{id}/retry")
    public RunQueries.RunDetail retry(@PathVariable String id) {
        if (!orchestrator.retry(id)) {
            throw conflict("only failed or cancelled runs can be retried");
        }
        return detail(id);
    }

    @GetMapping("/{id}/files/{name:.+}")
    public ResponseEntity<Resource> file(@PathVariable String id, @PathVariable String name) {
        return serve(id, name);
    }

    @GetMapping("/{id}/files/voice/{name:.+}")
    public ResponseEntity<Resource> voiceFile(@PathVariable String id, @PathVariable String name) {
        return serve(id, "voice/" + name);
    }

    @ExceptionHandler(Orchestrator.BadRunRequest.class)
    public ResponseEntity<Map<String, String>> badRequest(Orchestrator.BadRunRequest e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    private ResponseEntity<Resource> serve(String id, String relative) {
        Path file = storage.file(id, relative)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, relative + " not found for run " + id));
        String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
        MediaType type = name.endsWith(".mp4") ? MediaType.parseMediaType("video/mp4")
                : name.endsWith(".mp3") ? MediaType.parseMediaType("audio/mpeg")
                : name.endsWith(".wav") ? MediaType.parseMediaType("audio/wav")
                : name.endsWith(".txt") ? MediaType.TEXT_PLAIN
                : MediaType.APPLICATION_JSON;
        // a Resource body gets HTTP Range support, so the video can be seeked in the browser
        return ResponseEntity.ok().contentType(type).cacheControl(CacheControl.noCache()).body(new FileSystemResource(file));
    }

    private RunQueries.RunDetail detail(String id) {
        return queries.get(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "run " + id + " not found"));
    }

    private static ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }
}
