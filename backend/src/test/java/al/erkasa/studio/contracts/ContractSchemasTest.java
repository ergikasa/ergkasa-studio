package al.erkasa.studio.contracts;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import al.erkasa.studio.contracts.ContractSchemas.ValidationResult;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

/**
 * Runs the shared fixtures from {@code /contracts/fixtures} through the Java validator.
 * The TypeScript tests run the same files, so both sides of the system accept and reject the same JSON.
 */
class ContractSchemasTest {

    private static final ContractSchemas SCHEMAS = new ContractSchemas();

    record Fixture(String file, String contract, String json) {
        @Override
        public String toString() {
            return file;
        }
    }

    static Stream<Fixture> valid() throws IOException {
        return fixtures("valid");
    }

    static Stream<Fixture> invalid() throws IOException {
        return fixtures("invalid");
    }

    @Test
    void loadsEveryContract() {
        assertThat(SCHEMAS.names()).contains(
                "asset", "rig", "scene-plan", "video-plan", "timeline",
                "task-command", "task-result", "alignment", "audio-plan");
    }

    @Test
    void findsTheSharedFixtures() throws IOException {
        assertThat(valid().count()).isGreaterThanOrEqualTo(10);
        assertThat(invalid().count()).isGreaterThanOrEqualTo(9);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("valid")
    void acceptsValidFixture(Fixture fixture) {
        ValidationResult result = SCHEMAS.validateJson(fixture.contract(), fixture.json());
        assertThat(result.errors()).as(fixture.file()).isEmpty();
        assertThat(result.valid()).isTrue();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalid")
    void rejectsInvalidFixture(Fixture fixture) {
        ValidationResult result = SCHEMAS.validateJson(fixture.contract(), fixture.json());
        assertThat(result.valid()).as(fixture.file()).isFalse();
        assertThat(result.errors()).isNotEmpty();
    }

    @Test
    void rejectsMalformedJson() {
        assertThat(SCHEMAS.validateJson("task-command", "{not json").valid()).isFalse();
    }

    @Test
    void failsLoudlyOnUnknownContract() {
        assertThatThrownBy(() -> SCHEMAS.validateJson("no-such-contract", "{}"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static Stream<Fixture> fixtures(String kind) throws IOException {
        Resource[] resources = new PathMatchingResourcePatternResolver()
                .getResources("classpath*:contracts/fixtures/" + kind + "/*.json");
        List<Fixture> list = Arrays.stream(resources).map(ContractSchemasTest::read).toList();
        return list.stream();
    }

    private static Fixture read(Resource resource) {
        String file = resource.getFilename();
        try (InputStream in = resource.getInputStream()) {
            String json = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            return new Fixture(file, file.substring(0, file.indexOf('.')), json);
        } catch (IOException e) {
            throw new IllegalStateException("cannot read fixture " + file, e);
        }
    }
}
