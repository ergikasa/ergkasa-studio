package al.erkasa.studio.assets;

import al.erkasa.studio.contracts.ContractSchemas;
import al.erkasa.studio.contracts.ContractSchemas.ValidationResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Builds the asset registry from the library on disk: {@code <root>/manifest.json} lists every asset and its
 * directory; each directory holds an {@code asset.json} that must pass the {@code asset} contract. Invalid
 * assets are rejected (reported, never written); assets that disappeared from the manifest are deactivated.
 */
@Component
public class AssetIndexer {

    private static final Logger log = LoggerFactory.getLogger(AssetIndexer.class);
    private static final String MANIFEST_SCHEMA = "erkasa.asset-manifest/1";

    private final AssetRepository repository;
    private final ContractSchemas contracts;
    private final Path root;
    private final boolean indexOnStartup;
    private final ObjectMapper mapper = new ObjectMapper();

    public AssetIndexer(
            AssetRepository repository,
            ContractSchemas contracts,
            @Value("${erkasa.assets.dir:../assets}") String dir,
            @Value("${erkasa.assets.index-on-startup:true}") boolean indexOnStartup) {
        this.repository = repository;
        this.contracts = contracts;
        this.root = Path.of(dir).toAbsolutePath().normalize();
        this.indexOnStartup = indexOnStartup;
    }

    /** Absolute, normalized asset library root. */
    public Path root() {
        return root;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void indexOnStartup() {
        if (!indexOnStartup) {
            return;
        }
        if (!Files.isRegularFile(root.resolve("manifest.json"))) {
            log.warn("Asset library not found at {} (set ERKASA_ASSETS_DIR); registry left as is", root);
            return;
        }
        IndexReport report = reindex();
        log.info("Asset registry: {} indexed ({} unchanged), {} deactivated, {} rejected in {} ms from {}",
                report.indexed(), report.unchanged(), report.deactivated(), report.rejected().size(),
                report.millis(), report.root());
        report.rejected().forEach(r -> log.warn("Rejected asset {}: {}", r.assetId(), r.errors()));
    }

    /** Re-reads the whole library and replaces the registry content. Serialized: one run at a time. */
    public synchronized IndexReport reindex() {
        long started = System.nanoTime();
        Path manifestFile = root.resolve("manifest.json");
        JsonNode manifest;
        try {
            manifest = mapper.readTree(manifestFile.toFile());
        } catch (IOException e) {
            throw new AssetLibraryException("cannot read " + manifestFile + ": " + e.getMessage(), e);
        }
        if (!MANIFEST_SCHEMA.equals(manifest.path("schema").asText())) {
            throw new AssetLibraryException(manifestFile + " is not an " + MANIFEST_SCHEMA + " document", null);
        }

        Map<String, String> previous = repository.hashes();
        Map<String, AssetRepository.Row> rows = new LinkedHashMap<>();
        List<IndexReport.Rejected> rejected = new ArrayList<>();
        int unchanged = 0;

        for (JsonNode entry : manifest.path("assets")) {
            String assetId = entry.path("assetId").asText("");
            String relPath = entry.path("path").asText("");
            List<String> errors = new ArrayList<>();
            AssetRepository.Row row = readAsset(assetId, relPath, errors);
            if (row == null) {
                rejected.add(new IndexReport.Rejected(assetId.isEmpty() ? "(no assetId)" : assetId, errors));
                continue;
            }
            if (rows.containsKey(assetId)) {
                rejected.add(new IndexReport.Rejected(assetId, List.of("duplicate assetId in manifest")));
                continue;
            }
            if (row.contentHash().equals(previous.get(assetId))) {
                unchanged++;
            }
            rows.put(assetId, row);
        }

        int deactivated = repository.replaceAll(rows.values());
        long millis = (System.nanoTime() - started) / 1_000_000;
        return new IndexReport(root.toString(), rows.size(), unchanged, deactivated, rejected, millis);
    }

    private AssetRepository.Row readAsset(String assetId, String relPath, List<String> errors) {
        if (assetId.isEmpty() || relPath.isEmpty()) {
            errors.add("manifest entry needs assetId and path");
            return null;
        }
        Path dir = root.resolve(relPath).normalize();
        if (!dir.startsWith(root)) {
            errors.add("path escapes the asset root: " + relPath);
            return null;
        }
        Path metaFile = dir.resolve("asset.json");
        byte[] bytes;
        JsonNode meta;
        try {
            bytes = Files.readAllBytes(metaFile);
            meta = mapper.readTree(bytes);
        } catch (IOException e) {
            errors.add("cannot read " + root.relativize(metaFile) + ": " + e.getMessage());
            return null;
        }
        ValidationResult result = contracts.validate("asset", meta);
        if (!result.valid()) {
            errors.addAll(result.errors());
            return null;
        }
        if (!assetId.equals(meta.path("assetId").asText())) {
            errors.add("asset.json assetId '" + meta.path("assetId").asText() + "' differs from manifest");
            return null;
        }
        for (JsonNode file : meta.path("files")) {
            if (!Files.isRegularFile(dir.resolve(file.asText()).normalize())) {
                errors.add("declared file is missing: " + file.asText());
            }
        }
        if (!errors.isEmpty()) {
            return null;
        }
        return new AssetRepository.Row(
                assetId,
                meta.path("version").asInt(),
                meta.path("name").asText(),
                meta.path("category").asText(),
                meta.path("kind").asText(),
                meta.path("adapter").asText(),
                meta.path("style").asText(),
                root.relativize(dir).toString().replace('\\', '/'),
                meta.path("themes").toString(),
                meta.path("tags").toString(),
                meta.path("capabilities").toString(),
                meta.path("license").toString(),
                meta.toString(),
                sha256(bytes));
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
