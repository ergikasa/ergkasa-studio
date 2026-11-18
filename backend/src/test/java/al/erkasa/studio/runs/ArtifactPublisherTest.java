package al.erkasa.studio.runs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** The publisher on its own, on a real file system: what it publishes, what it refuses, and idempotency. */
class ArtifactPublisherTest {

    private static final String RUN = "20261118-200000-isolation-ab12";

    @TempDir
    Path root;

    private final ObjectMapper mapper = new ObjectMapper();
    private ArtifactPublisher publisher;
    private Path run;
    private Path attempt;

    @BeforeEach
    void setUp() throws Exception {
        publisher = new ArtifactPublisher(new RunStorage(root.toString()));
        run = Files.createDirectories(root.resolve(RUN));
        attempt = Files.createDirectories(run.resolve("attempts/render-7"));
    }

    private ArrayNode outputs(String... relAndContent) throws Exception {
        ArrayNode out = mapper.createArrayNode();
        for (int i = 0; i < relAndContent.length; i += 2) {
            Path f = attempt.resolve(relAndContent[i]);
            Files.createDirectories(f.getParent());
            Files.writeString(f, relAndContent[i + 1]);
            out.addObject().put("role", "file").put("ref", "file://" + RUN + "/attempts/render-7/" + relAndContent[i])
                    .put("sha256", sha(relAndContent[i + 1]));
        }
        return out;
    }

    private static String sha(String s) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void movesEveryFileToItsPublicNameAndRewritesTheRefs() throws Exception {
        Files.writeString(run.resolve("video.mp4"), "old video");
        ArrayNode out = outputs("video.mp4", "new video", "package/gate.json", "{}");
        ArrayNode published = publisher.publish(RUN, "render", 7, out);

        assertThat(Files.readString(run.resolve("video.mp4"))).isEqualTo("new video");
        assertThat(Files.readString(run.resolve("package/gate.json"))).isEqualTo("{}");
        assertThat(Files.exists(attempt.resolve("video.mp4"))).isFalse();
        assertThat(published.findValuesAsText("ref")).containsExactly(
                "file://" + RUN + "/video.mp4", "file://" + RUN + "/package/gate.json");
        assertThat(published.get(0).path("sha256").asText()).isEqualTo(sha("new video"));
    }

    @Test
    void publishingTheSameResultTwiceIsIdempotent() throws Exception {
        ArrayNode out = outputs("video.mp4", "v", "script.json", "{}");
        publisher.publish(RUN, "render", 7, out);
        // a redelivery after a crash: the sources are gone, the public files carry the right hashes
        ArrayNode again = publisher.publish(RUN, "render", 7, out);
        assertThat(again).hasSize(2);
        assertThat(Files.readString(run.resolve("video.mp4"))).isEqualTo("v");
    }

    @Test
    void finishesAPublicationThatStoppedHalfway() throws Exception {
        ArrayNode out = outputs("a.json", "A", "b.json", "B");
        // as if the process died after the first rename
        Files.move(attempt.resolve("a.json"), run.resolve("a.json"));
        publisher.publish(RUN, "render", 7, out);
        assertThat(Files.readString(run.resolve("a.json"))).isEqualTo("A");
        assertThat(Files.readString(run.resolve("b.json"))).isEqualTo("B");
    }

    @Test
    void refusesAHashThatDoesNotMatchAndMovesNothing() throws Exception {
        ArrayNode out = outputs("video.mp4", "new video", "plan.json", "{}");
        ((com.fasterxml.jackson.databind.node.ObjectNode) out.get(1)).put("sha256", sha("something else"));
        assertThatThrownBy(() -> publisher.publish(RUN, "render", 7, out))
                .isInstanceOf(ArtifactPublisher.PublishRefused.class).hasMessageContaining("plan.json has sha256");
        // verification happens before any move: the valid first file was not published either
        assertThat(Files.exists(run.resolve("video.mp4"))).isFalse();
        assertThat(Files.exists(attempt.resolve("video.mp4"))).isTrue();
    }

    @Test
    void refusesRefsOutsideTheAttemptFolder() throws Exception {
        Files.createDirectories(run.resolve("attempts/render-6"));
        Files.writeString(run.resolve("attempts/render-6/video.mp4"), "stale");
        for (String ref : new String[] {
            "file://" + RUN + "/video.mp4",
            "file://" + RUN + "/attempts/render-6/video.mp4",
            "file://" + RUN + "/attempts/render-7/../render-6/video.mp4",
            "file://" + RUN + "/attempts/render-7/../../other-run/video.mp4",
            "file://other-run/attempts/render-7/video.mp4",
            "file://" + RUN + "/attempts/render-7/attempts/render-6/video.mp4",
            "file://" + RUN + "/attempts/render-7/.hidden",
            "file://" + RUN + "/attempts/render-7/a//b",
        }) {
            ArrayNode out = mapper.createArrayNode();
            out.addObject().put("role", "video").put("ref", ref).put("sha256", sha("stale"));
            assertThatThrownBy(() -> publisher.publish(RUN, "render", 7, out)).as(ref)
                    .isInstanceOf(ArtifactPublisher.PublishRefused.class);
        }
        assertThat(Files.exists(run.resolve("video.mp4"))).isFalse();
    }

    @Test
    void refusesMissingHashesDuplicatesAndEmptyResults() throws Exception {
        ArrayNode noHash = outputs("video.mp4", "v");
        ((com.fasterxml.jackson.databind.node.ObjectNode) noHash.get(0)).remove("sha256");
        assertThatThrownBy(() -> publisher.publish(RUN, "render", 7, noHash)).hasMessageContaining("no sha256");

        ArrayNode twice = outputs("video.mp4", "v");
        twice.add(twice.get(0).deepCopy());
        assertThatThrownBy(() -> publisher.publish(RUN, "render", 7, twice)).hasMessageContaining("listed twice");

        assertThatThrownBy(() -> publisher.publish(RUN, "render", 7, mapper.createArrayNode()))
                .hasMessageContaining("no outputs");
        assertThatThrownBy(() -> publisher.publish(RUN, "render", 8, outputs("x.json", "{}")))
                .hasMessageContaining("does not exist");
    }

    @Test
    void refusesSymbolicLinks() throws Exception {
        Path secret = Files.writeString(root.resolve("secret.txt"), "secret");
        Files.createSymbolicLink(attempt.resolve("video.mp4"), secret);
        ArrayNode out = mapper.createArrayNode();
        out.addObject().put("role", "video").put("ref", "file://" + RUN + "/attempts/render-7/video.mp4")
                .put("sha256", sha("secret"));
        assertThatThrownBy(() -> publisher.publish(RUN, "render", 7, out)).hasMessageContaining("not a regular file");

        // a public folder that is a link out of the run folder
        Files.createSymbolicLink(run.resolve("voice"), Files.createDirectories(root.resolve("elsewhere")));
        ArrayNode voice = outputs("voice/voice.json", "{}");
        assertThatThrownBy(() -> publisher.publish(RUN, "render", 7, voice)).hasMessageContaining("outside the run folder");
        assertThat(Files.exists(root.resolve("elsewhere/voice.json"))).isFalse();
    }

    @Test
    void keepsRoleAndMediaType() throws Exception {
        ArrayNode out = outputs("video.mp4", "v");
        ((com.fasterxml.jackson.databind.node.ObjectNode) out.get(0)).put("role", "video").put("mediaType", "video/mp4");
        JsonNode p = publisher.publish(RUN, "render", 7, out).get(0);
        assertThat(p.path("role").asText()).isEqualTo("video");
        assertThat(p.path("mediaType").asText()).isEqualTo("video/mp4");
    }
}
