package al.erkasa.studio.runs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import al.erkasa.studio.StudioIntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;

/** E1.6 subphase 3: new runs render through the package by default, the choice is recorded, legacy is the rollback. */
@StudioIntegrationTest
class RenderPipelineTest {

    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private Orchestrator orchestrator;

    @Autowired
    private JdbcClient jdbc;

    @Autowired
    private RunStorage storage;

    @Test
    void aNewRunIsRecordedAsPackageAndItsRenderStepAsksForThePackage() throws Exception {
        String id = orchestrator.createRun(new Orchestrator.NewRun("pipeline default", "money", null, 30, null, true, null));
        JsonNode detail = mapper.readTree(get("/api/runs/" + id).body());
        assertThat(detail.path("run").path("pipeline").asText()).isEqualTo("package");
        String param = jdbc.sql("select params->>'pipeline' from step where run_id = :run and id = 'render'")
                .param("run", id).query(String.class).single();
        assertThat(param).isEqualTo("package");
        orchestrator.cancel(id);
    }

    @Test
    void theGateReportAndThePackageAreServedWithTheRun() throws Exception {
        String id = orchestrator.createRun(new Orchestrator.NewRun("pipeline files", "money", null, 30, null, true, null));
        Path dir = storage.dir(id).orElseThrow();
        Files.createDirectories(dir.resolve("package"));
        Files.writeString(dir.resolve("package/gate.json"), "{\"verdict\": \"PASS\"}");
        Files.writeString(dir.resolve("package/film.render.json"), "{}");
        JsonNode detail = mapper.readTree(get("/api/runs/" + id).body());
        assertThat(mapper.convertValue(detail.path("files"), String[].class)).contains("package/gate.json", "package/film.render.json");
        HttpResponse<String> gate = get("/api/runs/" + id + "/files/package/gate.json");
        assertThat(gate.statusCode()).isEqualTo(200);
        assertThat(gate.body()).contains("PASS");
        // still nothing else from the package folder
        Files.writeString(dir.resolve("package/secret.txt"), "x");
        assertThat(get("/api/runs/" + id + "/files/package/secret.txt").statusCode()).isEqualTo(404);
        orchestrator.cancel(id);
    }

    @Test
    void anUnknownPipelineStopsTheBackendFromStarting() {
        assertThatThrownBy(() -> new Orchestrator(null, null, null, null, null, null, true, "fast", 1000))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("legacy or package");
        // legacy is accepted: the rollback
        new Orchestrator(null, null, null, null, null, null, true, "legacy", 1000);
    }

    private HttpResponse<String> get(String path) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }
}
