package al.erkasa.studio.voices;

import al.erkasa.studio.contracts.ContractSchemas;
import al.erkasa.studio.contracts.ContractSchemas.ValidationResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * The narrator presets in {@code voices/catalog.json}. Read on every request (the file is tiny and the
 * user edits it by hand), validated against the {@code voice-catalog} contract before it is served.
 * Provider voice ids are not secrets; API keys never pass through here.
 */
@Service
public class VoiceCatalogService {

    private final ContractSchemas contracts;
    private final Path dir;
    private final ObjectMapper mapper = new ObjectMapper();

    public VoiceCatalogService(ContractSchemas contracts, @Value("${erkasa.voices.dir:../voices}") String dir) {
        this.contracts = contracts;
        this.dir = Path.of(dir).toAbsolutePath().normalize();
    }

    /** The validated catalog as JSON text. */
    public String catalogJson() {
        return catalog().toString();
    }

    private JsonNode catalog() {
        Path file = dir.resolve("catalog.json");
        JsonNode node;
        try {
            node = mapper.readTree(Files.readAllBytes(file));
        } catch (IOException e) {
            throw new VoiceCatalogException("cannot read " + file + ": " + e.getMessage());
        }
        ValidationResult result = contracts.validate("voice-catalog", node);
        if (!result.valid()) {
            throw new VoiceCatalogException(file + " is invalid: " + String.join("; ", result.errors()));
        }
        return node;
    }

    /** The generated sample of a preset ({@code voices/samples/<id>.mp3}), if the id exists and the file was made. */
    public Optional<Path> sample(String voiceId) {
        boolean known = false;
        for (JsonNode v : catalog().path("voices")) {
            if (v.path("id").asText().equals(voiceId)) {
                known = true;
                break;
            }
        }
        if (!known) {
            return Optional.empty();
        }
        Path samples = dir.resolve("samples");
        Path file = samples.resolve(voiceId + ".mp3").normalize();
        return file.startsWith(samples) && Files.isRegularFile(file) ? Optional.of(file) : Optional.empty();
    }

    /** The catalog file is missing or breaks the contract. */
    public static class VoiceCatalogException extends RuntimeException {

        private static final long serialVersionUID = 1L;

        public VoiceCatalogException(String message) {
            super(message);
        }
    }
}
