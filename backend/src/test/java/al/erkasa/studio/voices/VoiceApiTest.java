package al.erkasa.studio.voices;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/** Serves the repository's real voices/catalog.json, validated by the voice-catalog contract. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class VoiceApiTest {

    private final HttpClient http = HttpClient.newHttpClient();

    @Value("${local.server.port}")
    private int port;

    @Test
    void servesTheVoiceCatalog() throws Exception {
        HttpResponse<String> res = get("/api/voices");
        assertThat(res.statusCode()).isEqualTo(200);
        assertThat(res.body())
                .contains("erkasa.voice-catalog/1")
                .contains("mark_natural")
                .contains("friendly_woman")
                .contains("american_man")
                .doesNotContain("api_key");
    }

    @Test
    void samplesOnlyForKnownVoices() throws Exception {
        assertThat(get("/api/voices/nobody/sample").statusCode()).isEqualTo(404);
        assertThat(get("/api/voices/..%2Fcatalog/sample").statusCode()).isIn(400, 404);
    }

    private HttpResponse<String> get(String path) throws Exception {
        return http.send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }
}
