package al.erkasa.studio.assets;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Indexes the real asset library (../assets) into the local Postgres and exercises the REST API.
 * Nothing is mocked: if an asset.json breaks the contract, {@link #everyAssetInTheLibraryIsIndexed} fails.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class AssetApiTest {

    private final HttpClient http = HttpClient.newHttpClient();

    @Value("${local.server.port}")
    private int port;

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

    @Test
    void listsAndFiltersAssets() throws Exception {
        HttpResponse<String> characters = get("/api/assets?category=character");
        assertThat(characters.statusCode()).isEqualTo(200);
        assertThat(characters.body()).contains("\"total\":5").contains("char_drini_01");

        HttpResponse<String> money = get("/api/assets?category=metaphor&theme=money&limit=50");
        assertThat(money.statusCode()).isEqualTo(200);
        assertThat(money.body()).contains("met_snowball_01").doesNotContain("\"category\":\"icon\"");

        HttpResponse<String> stats = get("/api/assets/stats");
        assertThat(stats.body()).contains("\"background\":10").contains("\"character\":5");
    }

    @Test
    void returnsMetaAndDeclaredFiles() throws Exception {
        HttpResponse<String> meta = get("/api/assets/char_drini_01");
        assertThat(meta.statusCode()).isEqualTo(200);
        assertThat(meta.body()).contains("\"schema\":\"erkasa.asset/1\"").contains("rig_side.json");

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

    private HttpResponse<String> get(String path) throws Exception {
        return http.send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }
}
