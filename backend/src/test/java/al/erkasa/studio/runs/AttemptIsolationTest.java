package al.erkasa.studio.runs;

import static org.assertj.core.api.Assertions.assertThat;

import al.erkasa.studio.StudioIntegrationTest;
import al.erkasa.studio.contracts.ContractSchemas;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.Predicate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.FanoutExchange;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * E1.6 subphase 2 against real Postgres, RabbitMQ and files: every attempt writes only under its own folder,
 * and only the attempt whose fence is current can publish. The test plays the workers (several at once where
 * the scenario needs it) and listens on the control exchange like a worker does.
 *
 * <p>Scenarios (plan §3, subphase 2): 1 normal run, 2 retry after a failure, 3 two workers at once after a
 * timeout, 4 results in reverse order, 5 cancel during a step, 6 refs outside the attempt, 7 wrong hash,
 * 8 cancel messages name the attempt they stop, 9 redelivery after a crash; plus a run retry that restarts
 * attempt numbering, where only the fence tells old from new.
 */
@StudioIntegrationTest
class AttemptIsolationTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Autowired
    private RabbitTemplate rabbit;

    @Autowired
    private AmqpAdmin admin;

    @Autowired
    private MqNames mq;

    @Autowired
    private Orchestrator orchestrator;

    @Autowired
    private RunStorage storage;

    @Autowired
    private JdbcClient jdbc;

    @Autowired
    private ContractSchemas contracts;

    private String controlQueue;

    @BeforeEach
    void listenLikeAWorker() {
        admin.purgeQueue(mq.aiQueue(), false);
        admin.purgeQueue(mq.renderQueue(), false);
        controlQueue = "erkasa-test.control.it-" + UUID.randomUUID().toString().substring(0, 8);
        admin.declareQueue(new Queue(controlQueue, true, false, false));
        admin.declareBinding(BindingBuilder.bind(new Queue(controlQueue)).to(new FanoutExchange(mq.controlExchange())));
    }

    @AfterEach
    void stopListening() {
        admin.removeBinding(new Binding(controlQueue, Binding.DestinationType.QUEUE, mq.controlExchange(), "", null));
        admin.deleteQueue(controlQueue);
    }

    // ------------------------------------------------------------------ scenarios

    @Test
    void s1NormalRunPublishesTheAttemptFilesWithTheirHashes() throws Exception {
        String id = silentRun("isolation normal run");
        JsonNode script = nextTask(mq.aiQueue(), id);
        assertThat(script.path("fence").asLong()).isPositive();
        assertThat(contracts.validate("task-command", script).valid()).isTrue();

        ArrayNode out = produce(script, "script.json", "{\"title\": \"Isolated\"}");
        assertThat(Files.exists(run(id).resolve("script.json"))).as("nothing public before the result").isFalse();
        succeed(script, out);

        awaitStep(id, "script", s -> s.equals("SUCCEEDED"));
        assertThat(Files.readString(run(id).resolve("script.json"))).isEqualTo("{\"title\": \"Isolated\"}");
        JsonNode stored = outputs(id, "script");
        assertThat(stored.get(0).path("ref").asText()).isEqualTo("file://" + id + "/script.json");
        assertThat(stored.get(0).path("sha256").asText()).isEqualTo(sha(run(id).resolve("script.json")));
        assertThat(Files.exists(run(id).resolve(attemptDir(script)).resolve("script.json"))).isFalse();
        // the next step gets the public ref as input
        JsonNode plan = nextTask(mq.aiQueue(), id);
        assertThat(plan.path("inputs").get(0).path("ref").asText()).isEqualTo("file://" + id + "/script.json");
        cancel(id);
    }

    @Test
    void s2RetryAfterAFailurePublishesOnlyTheSecondAttempt() throws Exception {
        String id = silentRun("isolation retry");
        JsonNode first = nextTask(mq.aiQueue(), id);
        produce(first, "script.json", "{\"title\": \"from attempt 1\"}");
        failTask(first, "LLM_OVERLOADED", true);

        JsonNode second = nextTask(mq.aiQueue(), id);
        assertThat(second.path("attempt").asInt()).isEqualTo(2);
        assertThat(second.path("fence").asLong()).isGreaterThan(first.path("fence").asLong());
        succeed(second, produce(second, "script.json", "{\"title\": \"from attempt 2\"}"));

        awaitStep(id, "script", s -> s.equals("SUCCEEDED"));
        assertThat(Files.readString(run(id).resolve("script.json"))).contains("attempt 2");
        assertThat(Files.readString(run(id).resolve(attemptDir(first)).resolve("script.json"))).contains("attempt 1");
        cancel(id);
    }

    @Test
    void s3TwoWorkersAtOnceAfterATimeoutOnlyTheCurrentFencePublishes() throws Exception {
        String id = silentRun("isolation two workers");
        JsonNode old = nextTask(mq.aiQueue(), id);
        expireNow(id, "script");
        JsonNode cancelOld = nextControl(id);
        assertThat(cancelOld.path("reason").asText()).isEqualTo("TIMEOUT");
        assertThat(cancelOld.path("fence").asLong()).isEqualTo(old.path("fence").asLong());
        JsonNode current = nextTask(mq.aiQueue(), id);
        assertThat(current.path("fence").asLong()).isNotEqualTo(old.path("fence").asLong());

        // both workers write at the same time, each into its own folder, then both report
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<ArrayNode>> work = new ArrayList<>();
        for (JsonNode cmd : List.of(old, current)) {
            work.add(pool.submit(() -> {
                start.await();
                ArrayNode out = mapper.createArrayNode();
                for (int i = 0; i < 20; i++) {
                    out = produce(cmd, "script.json", "{\"title\": \"fence " + cmd.path("fence").asLong() + "\", \"i\": " + i + "}");
                }
                return out;
            }));
        }
        start.countDown();
        ArrayNode oldOut = work.get(0).get();
        ArrayNode currentOut = work.get(1).get();
        pool.shutdown();
        succeed(current, currentOut);
        succeed(old, oldOut);

        awaitStep(id, "script", s -> s.equals("SUCCEEDED"));
        Thread.sleep(500); // let the late result arrive
        String published = Files.readString(run(id).resolve("script.json"));
        assertThat(published).contains("fence " + current.path("fence").asLong()).contains("\"i\": 19");
        assertThat(outputs(id, "script").get(0).path("sha256").asText()).isEqualTo(sha(run(id).resolve("script.json")));
        cancel(id);
    }

    @Test
    void s4AResultArrivingAfterTheCurrentOneChangesNothing() throws Exception {
        String id = silentRun("isolation reverse order");
        JsonNode old = nextTask(mq.aiQueue(), id);
        ArrayNode oldOut = produce(old, "script.json", "{\"title\": \"old\"}");
        expireNow(id, "script");
        JsonNode current = nextTask(mq.aiQueue(), id);
        succeed(current, produce(current, "script.json", "{\"title\": \"current\"}"));
        awaitStep(id, "script", s -> s.equals("SUCCEEDED"));
        String hash = sha(run(id).resolve("script.json"));

        // direct, synchronous: the late result is refused and its file stays where it was written
        assertThat(orchestrator.applyResult(result(old, "SUCCEEDED", oldOut, null))).isFalse();
        assertThat(sha(run(id).resolve("script.json"))).isEqualTo(hash);
        assertThat(Files.exists(run(id).resolve(attemptDir(old)).resolve("script.json"))).isTrue();
        // and the same with the right attempt number but the wrong fence
        ObjectNode forged = (ObjectNode) mapper.readTree(result(current, "SUCCEEDED", oldOut, null));
        forged.put("fence", old.path("fence").asLong());
        assertThat(orchestrator.applyResult(forged.toString())).isFalse();
        // and a result without a fence at all
        ObjectNode unfenced = (ObjectNode) mapper.readTree(result(current, "SUCCEEDED", oldOut, null));
        unfenced.remove("fence");
        assertThat(orchestrator.applyResult(unfenced.toString())).isFalse();
        assertThat(sha(run(id).resolve("script.json"))).isEqualTo(hash);
        cancel(id);
    }

    @Test
    void s5CancelStopsTheAttemptAndNothingOfItIsPublished() throws Exception {
        String id = silentRun("isolation cancel");
        JsonNode script = nextTask(mq.aiQueue(), id);
        ArrayNode out = produce(script, "script.json", "{\"title\": \"cancelled\"}");
        cancel(id);

        JsonNode stop = nextControl(id);
        assertThat(contracts.validate("task-cancel", stop).valid()).isTrue();
        assertThat(stop.path("reason").asText()).isEqualTo("CANCELLED");
        assertThat(stop.path("stepId").asText()).isEqualTo("script");
        assertThat(stop.path("fence").asLong()).isEqualTo(script.path("fence").asLong());

        assertThat(orchestrator.applyResult(result(script, "SUCCEEDED", out, null))).isFalse();
        assertThat(Files.exists(run(id).resolve("script.json"))).isFalse();
    }

    @Test
    void s6RefsOutsideTheAttemptFolderAreRefusedAndTheStepRetries() throws Exception {
        String id = silentRun("isolation outside refs");
        JsonNode script = nextTask(mq.aiQueue(), id);
        Files.createDirectories(run(id));
        Files.writeString(run(id).resolve("script.json"), "{\"title\": \"planted\"}");
        ArrayNode out = mapper.createArrayNode();
        out.addObject().put("role", "script").put("ref", "file://" + id + "/" + attemptDir(script) + "/../../script.json")
                .put("sha256", sha(run(id).resolve("script.json")));
        assertThat(orchestrator.applyResult(result(script, "SUCCEEDED", out, null))).isTrue();

        JsonNode detail = stepRow(id, "script");
        assertThat(detail.path("error_code").asText()).isEqualTo("PUBLISH_REFUSED");
        assertThat(detail.path("status").asText()).isIn("PENDING", "QUEUED"); // retried after the backoff
        JsonNode retry = nextTask(mq.aiQueue(), id);
        assertThat(retry.path("fence").asLong()).isGreaterThan(script.path("fence").asLong());
        cancel(id);
    }

    @Test
    void s7AWrongHashIsRefusedAndNothingIsMoved() throws Exception {
        String id = silentRun("isolation wrong hash");
        JsonNode script = nextTask(mq.aiQueue(), id);
        ArrayNode out = produce(script, "script.json", "{\"title\": \"t\"}");
        Files.writeString(run(id).resolve(attemptDir(script)).resolve("script.json"), "{\"title\": \"changed after hashing\"}");
        assertThat(orchestrator.applyResult(result(script, "SUCCEEDED", out, null))).isTrue();
        assertThat(stepRow(id, "script").path("error_code").asText()).isEqualTo("PUBLISH_REFUSED");
        assertThat(Files.exists(run(id).resolve("script.json"))).isFalse();
        assertThat(Files.exists(run(id).resolve(attemptDir(script)).resolve("script.json"))).isTrue();
        cancel(id);
    }

    @Test
    void s8CancelMessagesNameExactlyTheAttemptTheyStop() throws Exception {
        String id = silentRun("isolation cancel names");
        JsonNode first = nextTask(mq.aiQueue(), id);
        expireNow(id, "script");
        JsonNode timeout = nextControl(id);
        JsonNode second = nextTask(mq.aiQueue(), id);
        cancel(id);
        JsonNode cancelled = nextControl(id);
        assertThat(timeout.path("fence").asLong()).isEqualTo(first.path("fence").asLong());
        assertThat(cancelled.path("fence").asLong()).isEqualTo(second.path("fence").asLong());
        assertThat(cancelled.path("attempt").asInt()).isEqualTo(2);
    }

    @Test
    void s9ARedeliveredResultIsAppliedOnceAndIdempotently() throws Exception {
        String id = silentRun("isolation redelivery");
        JsonNode script = nextTask(mq.aiQueue(), id);
        ArrayNode out = produce(script, "script.json", "{\"title\": \"once\"}");
        String json = result(script, "SUCCEEDED", out, null);
        assertThat(orchestrator.applyResult(json)).isTrue();
        String hash = sha(run(id).resolve("script.json"));
        // the same message again (a broker redelivery): the step is no longer active, nothing changes
        assertThat(orchestrator.applyResult(json)).isFalse();
        assertThat(sha(run(id).resolve("script.json"))).isEqualTo(hash);
        assertThat(stepRow(id, "script").path("status").asText()).isEqualTo("SUCCEEDED");
        cancel(id);
    }

    @Test
    void aRunRetryRestartsAttemptNumbersButNeverReusesAFence() throws Exception {
        String id = silentRun("isolation run retry");
        JsonNode before = nextTask(mq.aiQueue(), id);
        ArrayNode beforeOut = produce(before, "script.json", "{\"title\": \"before the retry\"}");
        cancel(id);
        nextControl(id);
        assertThat(postRetry(id)).isTrue();

        JsonNode after = nextTask(mq.aiQueue(), id);
        assertThat(after.path("attempt").asInt()).isEqualTo(before.path("attempt").asInt()).isEqualTo(1);
        assertThat(after.path("fence").asLong()).isNotEqualTo(before.path("fence").asLong());
        // same attempt number, old fence: refused
        assertThat(orchestrator.applyResult(result(before, "SUCCEEDED", beforeOut, null))).isFalse();
        assertThat(Files.exists(run(id).resolve("script.json"))).isFalse();
        succeed(after, produce(after, "script.json", "{\"title\": \"after the retry\"}"));
        awaitStep(id, "script", s -> s.equals("SUCCEEDED"));
        assertThat(Files.readString(run(id).resolve("script.json"))).contains("after the retry");
        cancel(id);
    }

    @Test
    void progressFromAnOldFenceIsIgnored() throws Exception {
        String id = silentRun("isolation progress");
        JsonNode old = nextTask(mq.aiQueue(), id);
        expireNow(id, "script");
        JsonNode current = nextTask(mq.aiQueue(), id);
        ObjectNode p = progressMsg(old, 77);
        p.put("attempt", current.path("attempt").asInt());
        assertThat(orchestrator.applyProgress(p.toString())).isFalse();
        assertThat(orchestrator.applyProgress(progressMsg(current, 40).toString())).isTrue();
        cancel(id);
    }

    // ------------------------------------------------------------------ the fake workers

    private String attemptDir(JsonNode cmd) {
        return ArtifactPublisher.attemptDir(cmd.path("stepId").asText(), cmd.path("fence").asLong());
    }

    /** Writes a file into the command's attempt folder and returns the pointer a worker would report. */
    private ArrayNode produce(JsonNode cmd, String rel, String content) throws Exception {
        String runId = cmd.path("runId").asText();
        Path file = run(runId).resolve(attemptDir(cmd)).resolve(rel);
        Files.createDirectories(file.getParent());
        Path tmp = file.resolveSibling(rel + ".tmp-" + UUID.randomUUID());
        Files.writeString(tmp, content);
        Files.move(tmp, file, java.nio.file.StandardCopyOption.REPLACE_EXISTING, java.nio.file.StandardCopyOption.ATOMIC_MOVE);
        ArrayNode out = mapper.createArrayNode();
        out.addObject().put("role", "script").put("ref", "file://" + runId + "/" + attemptDir(cmd) + "/" + rel)
                .put("sha256", sha(file));
        return out;
    }

    private String result(JsonNode cmd, String status, ArrayNode outputs, ObjectNode error) {
        ObjectNode r = mapper.createObjectNode();
        r.put("schema", "erkasa.task-result/1");
        r.put("messageId", UUID.randomUUID().toString());
        r.put("runId", cmd.path("runId").asText());
        r.put("stepId", cmd.path("stepId").asText());
        r.put("attempt", cmd.path("attempt").asInt());
        r.put("fence", cmd.path("fence").asLong());
        r.put("status", status);
        r.set("outputs", outputs);
        r.putObject("metrics").put("seconds", 0.5);
        if (error != null) {
            r.set("error", error);
        }
        r.put("workerVersion", "test");
        return r.toString();
    }

    private ObjectNode progressMsg(JsonNode cmd, int pct) {
        ObjectNode p = mapper.createObjectNode();
        p.put("schema", "erkasa.task-progress/1");
        p.put("runId", cmd.path("runId").asText());
        p.put("stepId", cmd.path("stepId").asText());
        p.put("attempt", cmd.path("attempt").asInt());
        p.put("fence", cmd.path("fence").asLong());
        p.put("pct", pct);
        p.put("message", "working");
        return p;
    }

    private void succeed(JsonNode cmd, ArrayNode outputs) {
        publishEvent(MqNames.RESULT_KEY, result(cmd, "SUCCEEDED", outputs, null));
    }

    private void failTask(JsonNode cmd, String code, boolean retryable) {
        ObjectNode error = mapper.createObjectNode().put("code", code).put("message", "test failure").put("retryable", retryable);
        publishEvent(MqNames.RESULT_KEY, result(cmd, "FAILED", mapper.createArrayNode(), error));
    }

    private void publishEvent(String key, String json) {
        org.springframework.amqp.core.MessageProperties props = new org.springframework.amqp.core.MessageProperties();
        props.setContentType("application/json");
        rabbit.send(mq.eventsExchange(), key, new Message(json.getBytes(StandardCharsets.UTF_8), props));
    }

    private JsonNode nextTask(String queue, String runId) throws Exception {
        return next(queue, m -> m.path("runId").asText().equals(runId), "task for " + runId);
    }

    private JsonNode nextControl(String runId) throws Exception {
        return next(controlQueue, m -> m.path("runId").asText().equals(runId), "cancel for " + runId);
    }

    private JsonNode next(String queue, Predicate<JsonNode> match, String what) throws Exception {
        long until = System.currentTimeMillis() + 15_000;
        while (System.currentTimeMillis() < until) {
            Message m = rabbit.receive(queue, 500);
            if (m == null) {
                continue;
            }
            JsonNode body = mapper.readTree(new String(m.getBody(), StandardCharsets.UTF_8));
            if (match.test(body)) {
                return body;
            }
        }
        throw new AssertionError("no " + what + " on " + queue);
    }

    // ------------------------------------------------------------------ helpers

    private String silentRun(String topic) {
        return orchestrator.createRun(new Orchestrator.NewRun(topic, "psychology", null, 30, null, true, null));
    }

    private Path run(String id) {
        return storage.dir(id).orElseThrow();
    }

    private void expireNow(String id, String step) {
        jdbc.sql("update step set deadline = now() - interval '1 second' where run_id = :run and id = :id")
                .param("run", id).param("id", step).update();
        jdbc.sql("update step set not_before = null where run_id = :run and id = :id").param("run", id).param("id", step).update();
        orchestrator.expireDeadlines();
        jdbc.sql("update step set not_before = null where run_id = :run and id = :id").param("run", id).param("id", step).update();
    }

    private void cancel(String id) {
        orchestrator.cancel(id);
    }

    private boolean postRetry(String id) {
        return orchestrator.retry(id);
    }

    private JsonNode stepRow(String id, String step) throws Exception {
        String json = jdbc.sql("select row_to_json(s)::text from step s where run_id = :run and id = :id")
                .param("run", id).param("id", step).query(String.class).single();
        return mapper.readTree(json);
    }

    private JsonNode outputs(String id, String step) throws Exception {
        return stepRow(id, step).path("outputs");
    }

    private void awaitStep(String id, String step, Predicate<String> status) throws Exception {
        long until = System.currentTimeMillis() + 15_000;
        String last = null;
        while (System.currentTimeMillis() < until) {
            last = stepRow(id, step).path("status").asText();
            if (status.test(last)) {
                return;
            }
            Thread.sleep(50);
        }
        throw new AssertionError("step " + step + " stuck at " + last + ": " + stepRow(id, step));
    }

    private static String sha(Path file) throws Exception {
        return ArtifactPublisher.sha256(file);
    }
}
