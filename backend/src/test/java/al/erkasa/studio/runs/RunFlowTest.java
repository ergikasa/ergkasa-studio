package al.erkasa.studio.runs;

import al.erkasa.studio.StudioIntegrationTest;
import static org.assertj.core.api.Assertions.assertThat;

import al.erkasa.studio.contracts.ContractSchemas;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.function.Predicate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;

/**
 * The whole orchestration against real Postgres and RabbitMQ: the test plays the worker, reading task
 * commands from the queues and answering with results, failures and progress. Own queue prefix, so a
 * developer's real queues are never touched.
 */
@StudioIntegrationTest
class RunFlowTest {

    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private RabbitTemplate rabbit;

    @Autowired
    private AmqpAdmin admin;

    @Autowired
    private MqNames mq;

    @Autowired
    private ContractSchemas contracts;

    @Autowired
    private Orchestrator orchestrator;

    @Autowired
    private RunStorage storage;

    @BeforeEach
    void emptyTestQueues() {
        admin.purgeQueue(mq.aiQueue(), false);
        admin.purgeQueue(mq.renderQueue(), false);
    }

    @Test
    void silentRunGoesThroughEveryStepIncludingARetry() throws Exception {
        String id = create("""
                {"topic": "why saving alone keeps you broke", "theme": "money", "voice": "american_man",
                 "seconds": 30, "silent": true}
                """);
        JsonNode detail = getJson("/api/runs/" + id);
        assertThat(detail.path("steps").findValuesAsText("id")).containsExactly("script", "plan", "render");

        JsonNode script = nextTask(mq.aiQueue(), id);
        assertThat(script.path("taskType").asText()).isEqualTo("script.write");
        assertThat(contracts.validate("task-command", script).valid()).isTrue();
        assertThat(script.path("params").path("theme").asText()).isEqualTo("money");
        assertThat(script.path("params").path("seconds").asInt()).isEqualTo(30);

        // the worker writes script.json; the orchestrator takes the run title from it
        Path dir = storage.dir(id).orElseThrow();
        Files.createDirectories(dir);
        Files.writeString(dir.resolve("script.json"), "{\"title\": \"Saving Is Not Enough\"}");
        succeed(script, output("script", "file://" + id + "/script.json"));

        JsonNode plan = nextTask(mq.aiQueue(), id);
        assertThat(plan.path("taskType").asText()).isEqualTo("visual.plan");
        assertThat(plan.path("inputs").get(0).path("ref").asText()).isEqualTo("file://" + id + "/script.json");
        assertThat(plan.path("params").path("voice").asText()).isEqualTo("american_man");

        // a retryable failure comes back as a new attempt after the backoff
        failTask(plan, "LLM_OVERLOADED", true);
        JsonNode plan2 = nextTask(mq.aiQueue(), id);
        assertThat(plan2.path("attempt").asInt()).isEqualTo(2);
        assertThat(plan2.path("idempotencyKey").asText()).isEqualTo(plan.path("idempotencyKey").asText());

        progress(plan2, 50, "planning scene 3");
        awaitRun(id, r -> step(r, "plan").path("status").asText().equals("RUNNING")
                && step(r, "plan").path("progress").asInt() == 50);

        succeed(plan2, output("plan", "file://" + id + "/video-plan.json"));
        JsonNode render = nextTask(mq.renderQueue(), id);
        assertThat(render.path("taskType").asText()).isEqualTo("render.finalize");
        assertThat(render.path("inputs").findValuesAsText("role")).contains("plan");

        succeed(render, output("video", "file://" + id + "/video.mp4"));
        JsonNode done = awaitRun(id, r -> r.path("run").path("status").asText().equals("SUCCEEDED"));
        assertThat(done.path("run").path("title").asText()).isEqualTo("Saving Is Not Enough");
        assertThat(done.path("run").path("progress").asInt()).isEqualTo(100);

        // a late result for the first plan attempt changes nothing
        assertThat(orchestrator.applyResult(result(plan, "SUCCEEDED", output("plan", "file://x/y.json"), null))).isFalse();
    }

    @Test
    void finalFailureStopsTheRunAndRetryResumesIt() throws Exception {
        String id = create("{\"topic\": \"the sunk cost fallacy\", \"theme\": \"decisions\", \"silent\": true}");
        JsonNode script = nextTask(mq.aiQueue(), id);
        failTask(script, "MISSING_CONFIG", false);

        JsonNode failed = awaitRun(id, r -> r.path("run").path("status").asText().equals("FAILED"));
        assertThat(failed.path("run").path("error").asText()).startsWith("script: ");
        assertThat(step(failed, "plan").path("status").asText()).isEqualTo("CANCELLED");

        assertThat(post("/api/runs/" + id + "/retry").statusCode()).isEqualTo(200);
        JsonNode again = nextTask(mq.aiQueue(), id);
        assertThat(again.path("stepId").asText()).isEqualTo("script");
        assertThat(again.path("attempt").asInt()).isEqualTo(1);

        assertThat(post("/api/runs/" + id + "/cancel").statusCode()).isEqualTo(200);
        JsonNode cancelled = getJson("/api/runs/" + id);
        assertThat(cancelled.path("run").path("status").asText()).isEqualTo("CANCELLED");
        assertThat(post("/api/runs/" + id + "/cancel").statusCode()).isEqualTo(409);
    }

    @Test
    void withVoiceTheVoiceStepRunsBetweenScriptAndPlan() throws Exception {
        String id = create("{\"topic\": \"why we procrastinate\", \"theme\": \"psychology\"}");
        JsonNode detail = getJson("/api/runs/" + id);
        assertThat(detail.path("steps").findValuesAsText("id")).containsExactly("script", "voice", "plan", "render");
        assertThat(detail.path("run").path("voice").asText()).isEqualTo("mark_natural");
        post("/api/runs/" + id + "/cancel");
    }

    @Test
    void rejectsBadRequestsAndForeignFiles() throws Exception {
        HttpResponse<String> theme = postJson("/api/runs", "{\"topic\": \"x y z\", \"theme\": \"cooking\"}");
        assertThat(theme.statusCode()).isEqualTo(400);
        assertThat(theme.body()).contains("theme");
        HttpResponse<String> voice = postJson("/api/runs", "{\"topic\": \"x y z\", \"theme\": \"money\", \"voice\": \"morgan\"}");
        assertThat(voice.statusCode()).isEqualTo(400);
        assertThat(voice.body()).contains("unknown voice");

        assertThat(get("/api/runs/nope/files/video.mp4").statusCode()).isEqualTo(404);
        assertThat(get("/api/runs/nope/files/..%2F..%2Fpom.xml").statusCode()).isIn(400, 404);
        assertThat(get("/api/runs/nope/files/secrets.env").statusCode()).isEqualTo(404);
    }

    // ------------------------------------------------------------------ the fake worker

    private JsonNode nextTask(String queue, String runId) throws Exception {
        long until = System.currentTimeMillis() + 15_000;
        while (System.currentTimeMillis() < until) {
            Message m = rabbit.receive(queue, 500);
            if (m == null) {
                continue;
            }
            JsonNode cmd = mapper.readTree(new String(m.getBody(), StandardCharsets.UTF_8));
            if (cmd.path("runId").asText().equals(runId)) {
                return cmd;
            }
        }
        throw new AssertionError("no task for run " + runId + " on " + queue);
    }

    private ArrayNode output(String role, String ref) {
        ArrayNode outputs = mapper.createArrayNode();
        outputs.addObject().put("role", role).put("ref", ref);
        return outputs;
    }

    private String result(JsonNode cmd, String status, ArrayNode outputs, ObjectNode error) {
        ObjectNode r = mapper.createObjectNode();
        r.put("schema", "erkasa.task-result/1");
        r.put("messageId", UUID.randomUUID().toString());
        r.put("runId", cmd.path("runId").asText());
        r.put("stepId", cmd.path("stepId").asText());
        r.put("attempt", cmd.path("attempt").asInt());
        r.put("status", status);
        r.set("outputs", outputs);
        r.putObject("metrics").put("seconds", 1.5);
        if (error != null) {
            r.set("error", error);
        }
        r.put("workerVersion", "test");
        return r.toString();
    }

    private void succeed(JsonNode cmd, ArrayNode outputs) {
        publish(MqNames.RESULT_KEY, result(cmd, "SUCCEEDED", outputs, null));
    }

    private void failTask(JsonNode cmd, String code, boolean retryable) {
        ObjectNode error = mapper.createObjectNode().put("code", code).put("message", "test failure").put("retryable", retryable);
        publish(MqNames.RESULT_KEY, result(cmd, "FAILED", mapper.createArrayNode(), error));
    }

    private void progress(JsonNode cmd, int pct, String message) {
        ObjectNode p = mapper.createObjectNode();
        p.put("schema", "erkasa.task-progress/1");
        p.put("runId", cmd.path("runId").asText());
        p.put("stepId", cmd.path("stepId").asText());
        p.put("attempt", cmd.path("attempt").asInt());
        p.put("pct", pct);
        p.put("message", message);
        publish(MqNames.PROGRESS_KEY, p.toString());
    }

    private void publish(String key, String json) {
        MessageProperties props = new MessageProperties();
        props.setContentType(MessageProperties.CONTENT_TYPE_JSON);
        rabbit.send(mq.eventsExchange(), key, new Message(json.getBytes(StandardCharsets.UTF_8), props));
    }

    // ------------------------------------------------------------------ http helpers

    private String create(String body) throws Exception {
        HttpResponse<String> res = postJson("/api/runs", body);
        assertThat(res.statusCode()).as(res.body()).isEqualTo(201);
        return mapper.readTree(res.body()).path("run").path("id").asText();
    }

    private JsonNode awaitRun(String id, Predicate<JsonNode> condition) throws Exception {
        long until = System.currentTimeMillis() + 15_000;
        JsonNode last = null;
        while (System.currentTimeMillis() < until) {
            last = getJson("/api/runs/" + id);
            if (condition.test(last)) {
                return last;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("condition not reached; last state: " + last);
    }

    private static JsonNode step(JsonNode detail, String id) {
        for (JsonNode s : detail.path("steps")) {
            if (s.path("id").asText().equals(id)) {
                return s;
            }
        }
        throw new AssertionError("no step " + id);
    }

    private JsonNode getJson(String path) throws Exception {
        HttpResponse<String> res = get(path);
        assertThat(res.statusCode()).as(res.body()).isEqualTo(200);
        return mapper.readTree(res.body());
    }

    private HttpResponse<String> get(String path) throws Exception {
        return http.send(HttpRequest.newBuilder(uri(path)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> post(String path) throws Exception {
        return http.send(HttpRequest.newBuilder(uri(path)).POST(HttpRequest.BodyPublishers.noBody()).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> postJson(String path, String body) throws Exception {
        return http.send(
                HttpRequest.newBuilder(uri(path))
                        .header("content-type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }
}
