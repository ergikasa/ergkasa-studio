package al.erkasa.studio.assets;

import al.erkasa.studio.StudioIntegrationTest;
import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;

/**
 * Indexes the real asset library (../assets) into the local Postgres and exercises the REST API.
 * Nothing is mocked: if an asset.json breaks the contract, {@link #everyAssetInTheLibraryIsIndexed} fails.
 */
@StudioIntegrationTest
class AssetApiTest {

    private final HttpClient http = HttpClient.newHttpClient();

    @Value("${local.server.port}")
    private int port;

    @Value("${erkasa.assets.dir}")
    private Path assetsDir;

    private final ObjectMapper mapper = new ObjectMapper();

    @Autowired
    private AssetIndexer indexer;

    @Autowired
    private AssetService service;

    @Test
    void everyAssetInTheLibraryIsIndexed() {
        IndexReport report = indexer.reindex();

        assertThat(report.rejected()).as("rejected assets").isEmpty();
        assertThat(report.indexed()).isGreaterThanOrEqualTo(400);
        // a second run over unchanged files changes nothing
        IndexReport again = indexer.reindex();
        assertThat(again.unchanged()).isEqualTo(again.indexed());
        assertThat(again.deactivated()).isZero();
    }

    /**
     * The API lists exactly the assets of the independent inventory (test resource {@code assets/inventory.json}),
     * by identity and by count, per category. The inventory is a reviewed list kept next to the tests, not derived
     * from the manifest the indexer reads: adding, removing or re-categorising an asset without updating it fails.
     */
    @Test
    void listsExactlyTheInventoryPerCategory() throws Exception {
        Map<String, Set<String>> expected = inventory();
        assertThat(expected).isNotEmpty();
        for (Map.Entry<String, Set<String>> category : expected.entrySet()) {
            Set<String> listed = new TreeSet<>();
            long total = -1;
            for (int offset = 0; ; offset += AssetQuery.MAX_LIMIT) {
                JsonNode page = json(get("/api/assets?category=" + category.getKey() + "&limit=" + AssetQuery.MAX_LIMIT + "&offset=" + offset));
                total = page.path("total").asLong();
                page.path("items").forEach(item -> listed.add(item.path("assetId").asText()));
                if (page.path("items").size() < AssetQuery.MAX_LIMIT) {
                    break;
                }
            }
            assertThat(listed).as("asset ids of category %s", category.getKey()).isEqualTo(category.getValue());
            assertThat(total).as("total of category %s", category.getKey()).isEqualTo(category.getValue().size());
        }

        JsonNode all = json(get("/api/assets?limit=1"));
        assertThat(all.path("total").asLong()).isEqualTo(expected.values().stream().mapToLong(Set::size).sum());

        Map<String, Long> stats = new TreeMap<>();
        json(get("/api/assets/stats")).properties().forEach(e -> stats.put(e.getKey(), e.getValue().asLong()));
        Map<String, Long> expectedStats = new TreeMap<>();
        expected.forEach((k, v) -> expectedStats.put(k, (long) v.size()));
        assertThat(stats).isEqualTo(expectedStats);
    }

    /** The inventory and the library on disk (every asset.json under the root) agree, id by id. */
    @Test
    void inventoryMatchesTheLibraryOnDisk() throws Exception {
        Map<String, Set<String>> onDisk = new TreeMap<>();
        try (Stream<Path> files = Files.walk(assetsDir)) {
            for (Path file : files.filter(f -> f.getFileName().toString().equals("asset.json")).toList()) {
                JsonNode meta = mapper.readTree(file.toFile());
                onDisk.computeIfAbsent(meta.path("category").asText(), k -> new TreeSet<>()).add(meta.path("assetId").asText());
            }
        }
        assertThat(onDisk).isEqualTo(inventory());
    }

    @Test
    void filtersAssets() throws Exception {
        HttpResponse<String> characters = get("/api/assets?category=character");
        assertThat(characters.statusCode()).isEqualTo(200);
        assertThat(characters.body()).contains("char_drini_01").contains("char_host_01").doesNotContain("\"category\":\"icon\"");

        HttpResponse<String> money = get("/api/assets?category=metaphor&theme=money&limit=50");
        assertThat(money.statusCode()).isEqualTo(200);
        assertThat(money.body()).contains("met_snowball_01").doesNotContain("\"category\":\"icon\"");
    }

    @Test
    void returnsMetaAndDeclaredFiles() throws Exception {
        HttpResponse<String> meta = get("/api/assets/char_drini_01");
        assertThat(meta.statusCode()).isEqualTo(200);
        assertThat(meta.body()).contains("erkasa.asset/1").contains("\"assetId\": \"char_drini_01\"").contains("rig_side.json");

        HttpResponse<String> svg = get("/api/assets/char_drini_01/files/asset.svg");
        assertThat(svg.statusCode()).isEqualTo(200);
        assertThat(svg.headers().firstValue("content-type")).hasValueSatisfying(t -> assertThat(t).startsWith("image/svg+xml"));
        assertThat(svg.body()).contains("<svg");

        assertThat(get("/api/assets/does_not_exist").statusCode()).isEqualTo(404);
    }

    @Test
    void neverServesFilesOutsideTheAsset() throws Exception {
        // asset.json is on disk but not declared in files -> not served
        assertThat(get("/api/assets/char_drini_01/files/asset.json").statusCode()).isEqualTo(404);
        assertThat(get("/api/assets/char_drini_01/files/..%2F..%2Fmanifest.json").statusCode()).isIn(400, 404);
        assertThat(get("/api/assets/char_drini_01/files/%2E%2E%2Fchar_era_01%2Fasset.svg").statusCode()).isIn(400, 404);
        assertThat(service.file("char_drini_01", "../char_era_01/asset.svg")).isEmpty();
    }

    @Test
    void ranksCandidatesForASlot() throws Exception {
        List<AssetCandidate> ranked = service.candidates("metaphor", null, "money", List.of("compound-interest"), "snowball growth", 5);
        assertThat(ranked).isNotEmpty();
        assertThat(ranked.getFirst().asset().assetId()).isEqualTo("met_snowball_01");
        assertThat(ranked).isSortedAccordingTo((a, b) -> Integer.compare(b.score(), a.score()));

        HttpResponse<String> api = get("/api/assets/candidates?category=object&text=coin%20money&limit=3");
        assertThat(api.statusCode()).isEqualTo(200);
        assertThat(api.body()).contains("\"score\"").contains("\"matched\"");
    }

    private Map<String, Set<String>> inventory() throws Exception {
        try (InputStream in = getClass().getResourceAsStream("/assets/inventory.json")) {
            assertThat(in).as("test resource assets/inventory.json").isNotNull();
            JsonNode root = mapper.readTree(in);
            assertThat(root.path("schema").asText()).isEqualTo("erkasa.asset-inventory/1");
            Map<String, Set<String>> categories = new TreeMap<>();
            root.path("categories").properties().forEach(e -> {
                Set<String> ids = new TreeSet<>();
                e.getValue().forEach(id -> ids.add(id.asText()));
                assertThat(ids).as("duplicates in inventory category %s", e.getKey()).hasSize(e.getValue().size());
                categories.put(e.getKey(), ids);
            });
            Map<String, Long> counts = new TreeMap<>();
            root.path("counts").properties().forEach(e -> counts.put(e.getKey(), e.getValue().asLong()));
            Map<String, Long> listed = new TreeMap<>();
            categories.forEach((k, v) -> listed.put(k, (long) v.size()));
            assertThat(counts).as("inventory counts agree with its lists").isEqualTo(listed);
            return categories;
        }
    }

    private JsonNode json(HttpResponse<String> response) throws Exception {
        assertThat(response.statusCode()).isEqualTo(200);
        return mapper.readTree(response.body());
    }

    private HttpResponse<String> get(String path) throws Exception {
        return http.send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }
}
