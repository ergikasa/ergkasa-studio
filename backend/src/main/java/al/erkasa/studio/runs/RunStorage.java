package al.erkasa.studio.runs;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * The run folders shared with the worker: {@code <storage>/<runId>/script.json, voice/, video.mp4...}.
 * Artifact refs in task messages are {@code file://<runId>/<file>}, relative to this root. Only the known
 * artifact names are ever served, so a request can never read anything else on disk.
 */
@Component
public class RunStorage {

    static final Pattern RUN_ID = Pattern.compile("^[a-z0-9][a-z0-9-]{0,63}$");
    private static final Pattern SERVABLE = Pattern.compile(
            "^(script\\.json|video-plan\\.json|plan-attempts\\.json|timeline\\.json|video\\.mp4|voice/voice\\.json"
                    + "|audio-plan\\.json|audio-notes\\.txt|mix\\.wav|storyboard\\.json"
                    + "|storyboard/[A-Za-z][A-Za-z0-9_-]{0,40}-[ab]\\.jpg"
                    + "|voice/[A-Za-z][A-Za-z0-9_-]{0,63}\\.mp3)$");
    private static final List<String> MAIN_FILES =
            List.of("script.json", "voice/voice.json", "plan-attempts.json", "video-plan.json", "timeline.json",
                    "audio-plan.json", "audio-notes.txt", "mix.wav", "storyboard.json", "video.mp4");

    private final Path root;
    private final ObjectMapper mapper = new ObjectMapper();

    public RunStorage(@Value("${erkasa.storage.dir:../out/runs}") String dir) {
        this.root = Path.of(dir).toAbsolutePath().normalize();
    }

    public Path root() {
        return root;
    }

    /** The run's folder, or empty for an id that is not a valid run id. */
    public Optional<Path> dir(String runId) {
        if (runId == null || !RUN_ID.matcher(runId).matches()) {
            return Optional.empty();
        }
        Path dir = root.resolve(runId).normalize();
        return dir.startsWith(root) ? Optional.of(dir) : Optional.empty();
    }

    /** A servable artifact of the run, if it exists. */
    public Optional<Path> file(String runId, String relative) {
        if (relative == null || !SERVABLE.matcher(relative).matches()) {
            return Optional.empty();
        }
        return dir(runId).map(d -> d.resolve(relative).normalize())
                .filter(f -> f.startsWith(root) && Files.isRegularFile(f));
    }

    /** The main artifacts that exist so far, plus the voice clips. */
    public List<String> files(String runId) {
        List<String> out = new ArrayList<>();
        Optional<Path> dir = dir(runId);
        if (dir.isEmpty()) {
            return out;
        }
        for (String f : MAIN_FILES) {
            if (Files.isRegularFile(dir.get().resolve(f))) {
                out.add(f);
            }
        }
        Path voice = dir.get().resolve("voice");
        if (Files.isDirectory(voice)) {
            try (Stream<Path> clips = Files.list(voice)) {
                clips.map(p -> "voice/" + p.getFileName())
                        .filter(f -> f.endsWith(".mp3") && SERVABLE.matcher(f).matches())
                        .sorted()
                        .forEach(out::add);
            } catch (IOException e) {
                // a folder being written to; the next poll sees it
            }
        }
        return out;
    }

    /** The title from script.json, once the script step has written it. */
    public Optional<String> title(String runId) {
        return file(runId, "script.json").flatMap(f -> {
            try {
                String t = mapper.readTree(f.toFile()).path("title").asText("");
                return t.isBlank() ? Optional.empty() : Optional.of(t.length() > 200 ? t.substring(0, 200) : t);
            } catch (IOException e) {
                return Optional.empty();
            }
        });
    }
}
