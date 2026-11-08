package al.erkasa.studio.contracts;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

/**
 * Validates JSON documents against the contracts exported from {@code /contracts} (Zod -> JSON Schema).
 *
 * <p>Every message a worker sends and every artifact the backend stores goes through here before it is
 * accepted. The contract name is the schema file name without {@code .schema.json}, e.g. {@code scene-plan}.
 */
@Component
public class ContractSchemas {

    private static final Logger log = LoggerFactory.getLogger(ContractSchemas.class);
    private static final String LOCATION = "classpath*:contracts/json-schema/*.schema.json";
    private static final String SUFFIX = ".schema.json";

    /** Jackson 2 mapper used only for schema validation (the validator library is built on Jackson 2). */
    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, JsonSchema> schemas;

    public ContractSchemas() {
        this.schemas = load();
        log.info("Loaded {} contract schemas: {}", schemas.size(), schemas.keySet());
    }

    /** Names of all loaded contracts, sorted. */
    public Set<String> names() {
        return schemas.keySet();
    }

    /** Validates raw JSON text against the named contract. */
    public ValidationResult validateJson(String contract, String json) {
        try {
            return validate(contract, mapper.readTree(json));
        } catch (JsonProcessingException e) {
            return ValidationResult.invalid(List.of("not valid JSON: " + e.getOriginalMessage()));
        }
    }

    /** Validates a parsed JSON tree against the named contract. */
    public ValidationResult validate(String contract, JsonNode document) {
        JsonSchema schema = schemas.get(contract);
        if (schema == null) {
            throw new IllegalArgumentException("unknown contract '" + contract + "', known: " + schemas.keySet());
        }
        Set<ValidationMessage> messages = schema.validate(document);
        if (messages.isEmpty()) {
            return ValidationResult.ok();
        }
        List<String> errors = messages.stream()
                .sorted(Comparator.comparing(ValidationMessage::getMessage))
                .map(ValidationMessage::getMessage)
                .toList();
        return ValidationResult.invalid(errors);
    }

    private static Map<String, JsonSchema> load() {
        JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
        Map<String, JsonSchema> loaded = new TreeMap<>();
        try {
            Resource[] resources = new PathMatchingResourcePatternResolver().getResources(LOCATION);
            for (Resource resource : resources) {
                String file = resource.getFilename();
                if (file == null || !file.endsWith(SUFFIX)) {
                    continue;
                }
                try (InputStream in = resource.getInputStream()) {
                    loaded.put(file.substring(0, file.length() - SUFFIX.length()), factory.getSchema(in));
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException("cannot load contract schemas from " + LOCATION, e);
        }
        if (loaded.isEmpty()) {
            throw new IllegalStateException("no contract schemas found at " + LOCATION + " (run `pnpm contracts:gen`)");
        }
        return Map.copyOf(loaded);
    }

    /** Outcome of a validation: either valid, or the list of human-readable errors. */
    public record ValidationResult(boolean valid, List<String> errors) {

        public ValidationResult {
            errors = List.copyOf(errors);
        }

        static ValidationResult ok() {
            return new ValidationResult(true, List.of());
        }

        static ValidationResult invalid(List<String> errors) {
            return new ValidationResult(false, errors);
        }
    }
}
