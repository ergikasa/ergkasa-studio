package al.erkasa.studio.runs;

import al.erkasa.studio.contracts.ContractSchemas;
import al.erkasa.studio.contracts.ContractSchemas.ValidationResult;
import al.erkasa.studio.voices.VoiceCatalogService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Drives runs through their steps. Every state change happens in a database transaction; task commands
 * are written to the outbox in the same transaction and published afterwards, so a crash can never lose
 * or duplicate a dispatch. Results are applied idempotently: a result for an old attempt is ignored.
 */
@Service
public class Orchestrator {

    private static final Logger log = LoggerFactory.getLogger(Orchestrator.class);
    private static final Set<String> THEMES = Set.of("psychology", "money", "growth", "philosophy", "science", "decisions");
    private static final DateTimeFormatter ID_TIME = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    /** One node of the video DAG. Timeouts are generous: a 60 s render takes a few minutes on a laptop. */
    record StepDef(String id, String taskType, List<String> dependsOn, int timeoutS, int maxAttempts) {}

    /** What the Studio sends to start a video. */
    /** {@code host}: the main character chosen by the user (e.g. char_host_01); the planner decides where he appears. */
    public record NewRun(String topic, String theme, String voice, Integer seconds, String notes, Boolean silent, String host) {}

    private final JdbcClient jdbc;
    private final ContractSchemas contracts;
    private final MqNames mq;
    private final VoiceCatalogService voices;
    private final RunStorage storage;
    private final long retryBaseMs;
    private final ObjectMapper mapper = new ObjectMapper();

    public Orchestrator(
            JdbcClient jdbc,
            ContractSchemas contracts,
            MqNames mq,
            VoiceCatalogService voices,
            RunStorage storage,
            @Value("${erkasa.orchestrator.retry-base-ms:5000}") long retryBaseMs) {
        this.jdbc = jdbc;
        this.contracts = contracts;
        this.mq = mq;
        this.voices = voices;
        this.storage = storage;
        this.retryBaseMs = retryBaseMs;
    }

    static List<StepDef> videoDag(boolean silent) {
        List<StepDef> steps = new ArrayList<>();
        steps.add(new StepDef("script", "script.write", List.of(), 300, 3));
        if (!silent) {
            steps.add(new StepDef("voice", "voice.synthesize", List.of("script"), 900, 3));
        }
        steps.add(new StepDef("plan", "visual.plan", silent ? List.of("script") : List.of("script", "voice"), 900, 2));
        steps.add(new StepDef("render", "render.finalize", silent ? List.of("plan") : List.of("plan", "voice"), 3600, 2));
        return steps;
    }

    // ------------------------------------------------------------------ create

    @Transactional
    public String createRun(NewRun req) {
        String topic = req.topic() == null ? "" : req.topic().trim();
        if (topic.length() < 3 || topic.length() > 300) {
            throw new BadRunRequest("topic must be 3-300 characters");
        }
        String theme = req.theme() == null ? "" : req.theme().trim();
        if (!THEMES.contains(theme)) {
            throw new BadRunRequest("theme must be one of " + THEMES);
        }
        int seconds = req.seconds() == null ? 45 : req.seconds();
        if (seconds < 20 || seconds > 120) {
            throw new BadRunRequest("seconds must be 20-120");
        }
        String voice = req.voice() == null || req.voice().isBlank() ? voices.defaultVoice() : req.voice().trim();
        if (!voices.exists(voice)) {
            throw new BadRunRequest("unknown voice '" + voice + "'");
        }
        String notes = req.notes() == null || req.notes().isBlank() ? null : req.notes().trim();
        if (notes != null && notes.length() > 500) {
            throw new BadRunRequest("notes must be at most 500 characters");
        }
        boolean silent = Boolean.TRUE.equals(req.silent());
        String host = req.host() == null || req.host().isBlank() ? null : req.host().trim();
        if (host != null && !host.matches("^char_[a-z0-9_]{1,60}$")) {
            throw new BadRunRequest("host must be a character id like char_host_01");
        }
        String id = newRunId(topic);

        jdbc.sql("""
                insert into run (id, topic, theme, voice, seconds, notes, silent)
                values (:id, :topic, :theme, :voice, :seconds, :notes, :silent)
                """)
                .param("id", id)
                .param("topic", topic)
                .param("theme", theme)
                .param("voice", voice)
                .param("seconds", seconds)
                .param("notes", notes)
                .param("silent", silent)
                .update();

        List<StepDef> dag = videoDag(silent);
        for (int i = 0; i < dag.size(); i++) {
            StepDef s = dag.get(i);
            ObjectNode params = mapper.createObjectNode();
            switch (s.taskType()) {
                case "script.write" -> {
                    params.put("topic", topic).put("theme", theme).put("seconds", seconds);
                    if (notes != null) {
                        params.put("notes", notes);
                    }
                }
                case "voice.synthesize" -> params.put("voice", voice);
                case "visual.plan" -> {
                    params.put("voice", voice).put("projectId", id);
                    if (host != null) {
                        params.put("host", host);
                    }
                }
                case "render.finalize" -> params.put("music", true);
                default -> throw new IllegalStateException("no params for " + s.taskType());
            }
            jdbc.sql("""
                    insert into step (run_id, id, position, task_type, depends_on, params, max_attempts, timeout_s)
                    values (:run, :id, :pos, :type, :deps, cast(:params as jsonb), :max, :timeout)
                    """)
                    .param("run", id)
                    .param("id", s.id())
                    .param("pos", i)
                    .param("type", s.taskType())
                    .param("deps", String.join(",", s.dependsOn()))
                    .param("params", params.toString())
                    .param("max", s.maxAttempts())
                    .param("timeout", s.timeoutS())
                    .update();
        }
        log.info("Run {} created: \"{}\" ({}, voice {}, {} s{})", id, topic, theme, voice, seconds, silent ? ", silent" : "");
        return id;
    }

    static String newRunId(String topic) {
        String slug = topic.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        if (slug.length() > 30) {
            slug = slug.substring(0, 30).replaceAll("-$", "");
        }
        String rand = UUID.randomUUID().toString().substring(0, 4);
        String time = LocalDateTime.now(ZoneOffset.UTC).format(ID_TIME);
        return (time + "-" + (slug.isEmpty() ? "video" : slug) + "-" + rand);
    }

    // ------------------------------------------------------------------ dispatch

    private record Pending(String runId, String stepId, String taskType, String dependsOn, String params, int attempt, int timeoutS) {}

    private record Dep(String status, String outputs) {}

    /** Queues every step whose dependencies have succeeded. Returns how many were dispatched. */
    @Transactional
    public int dispatchReady() {
        List<Pending> pending = jdbc.sql("""
                select s.run_id, s.id, s.task_type, s.depends_on, s.params::text as params, s.attempt, s.timeout_s
                from step s join run r on r.id = s.run_id
                where s.status = 'PENDING' and r.status = 'RUNNING'
                  and (s.not_before is null or s.not_before <= now())
                order by r.created_at, s.position
                limit 50
                for update of s skip locked
                """)
                .query((rs, n) -> new Pending(
                        rs.getString("run_id"),
                        rs.getString("id"),
                        rs.getString("task_type"),
                        rs.getString("depends_on"),
                        rs.getString("params"),
                        rs.getInt("attempt"),
                        rs.getInt("timeout_s")))
                .list();
        int dispatched = 0;
        for (Pending p : pending) {
            Map<String, Dep> steps = new HashMap<>();
            jdbc.sql("select id, status, outputs::text as outputs from step where run_id = :run")
                    .param("run", p.runId())
                    .query(rs -> {
                        steps.put(rs.getString("id"), new Dep(rs.getString("status"), rs.getString("outputs")));
                    });
            ArrayNode inputs = mapper.createArrayNode();
            boolean ready = true;
            for (String dep : p.dependsOn().isBlank() ? new String[0] : p.dependsOn().split(",")) {
                Dep d = steps.get(dep);
                if (d == null || !"SUCCEEDED".equals(d.status())) {
                    ready = false;
                    break;
                }
                read(d.outputs()).forEach(inputs::add);
            }
            if (!ready) {
                continue;
            }
            dispatch(p, inputs);
            dispatched++;
        }
        return dispatched;
    }

    private void dispatch(Pending p, ArrayNode inputs) {
        int attempt = p.attempt() + 1;
        JsonNode params = read(p.params());
        Instant deadline = Instant.now().truncatedTo(ChronoUnit.SECONDS).plusSeconds(p.timeoutS());
        ObjectNode cmd = mapper.createObjectNode();
        cmd.put("schema", "erkasa.task/1");
        cmd.put("messageId", UUID.randomUUID().toString());
        cmd.put("taskType", p.taskType());
        cmd.put("runId", p.runId());
        cmd.put("stepId", p.stepId());
        cmd.put("attempt", attempt);
        cmd.put("idempotencyKey", sha256(p.runId() + "|" + p.stepId() + "|" + p.taskType() + "|" + params + "|" + inputs));
        cmd.set("inputs", inputs);
        cmd.set("params", params);
        cmd.put("deadline", deadline.toString());
        ValidationResult valid = contracts.validate("task-command", cmd);
        if (!valid.valid()) {
            throw new IllegalStateException("built an invalid task command: " + valid.errors());
        }
        jdbc.sql("insert into outbox (exchange, routing_key, payload) values (:ex, :key, :payload)")
                .param("ex", mq.tasksExchange())
                .param("key", p.taskType())
                .param("payload", cmd.toString())
                .update();
        jdbc.sql("""
                update step set status = 'QUEUED', attempt = :attempt, deadline = :deadline, queued_at = now(),
                    started_at = null, finished_at = null, progress = 0, message = 'waiting for a worker',
                    not_before = null
                where run_id = :run and id = :id
                """)
                .param("attempt", attempt)
                .param("deadline", java.sql.Timestamp.from(deadline))
                .param("run", p.runId())
                .param("id", p.stepId())
                .update();
        touchRun(p.runId());
        log.info("Run {} step {} queued (attempt {})", p.runId(), p.stepId(), attempt);
    }

    // ------------------------------------------------------------------ timeouts

    private record Active(String runId, String stepId, int attempt, int maxAttempts) {}

    /** Steps that got no result before their deadline count as a failed, retryable attempt. */
    @Transactional
    public int expireDeadlines() {
        List<Active> late = jdbc.sql("""
                select run_id, id, attempt, max_attempts from step
                where status in ('QUEUED', 'RUNNING') and deadline < now()
                for update skip locked
                """)
                .query((rs, n) -> new Active(rs.getString(1), rs.getString(2), rs.getInt(3), rs.getInt(4)))
                .list();
        for (Active a : late) {
            fail(a, "TIMEOUT", "no result before the deadline (is `pnpm worker` running?)", true);
        }
        return late.size();
    }

    // ------------------------------------------------------------------ results and progress

    /** Applies a worker's result message. Returns false when it was invalid, unknown or stale. */
    @Transactional
    public boolean applyResult(String json) {
        JsonNode result = parse(json);
        if (result == null || !valid("task-result", result)) {
            return false;
        }
        String runId = result.path("runId").asText();
        String stepId = result.path("stepId").asText();
        int attempt = result.path("attempt").asInt();
        List<Active> found = jdbc.sql("""
                select run_id, id, attempt, max_attempts from step
                where run_id = :run and id = :id and status in ('QUEUED', 'RUNNING')
                for update
                """)
                .param("run", runId)
                .param("id", stepId)
                .query((rs, n) -> new Active(rs.getString(1), rs.getString(2), rs.getInt(3), rs.getInt(4)))
                .list();
        if (found.isEmpty() || found.getFirst().attempt() != attempt) {
            log.info("Ignoring stale or unknown result for {}/{} attempt {}", runId, stepId, attempt);
            return false;
        }
        Active step = found.getFirst();
        if ("SUCCEEDED".equals(result.path("status").asText())) {
            jdbc.sql("""
                    update step set status = 'SUCCEEDED', outputs = cast(:outputs as jsonb),
                        metrics = cast(:metrics as jsonb), progress = 100, message = 'done',
                        started_at = coalesce(started_at, queued_at), finished_at = now(), error_code = null, error = null
                    where run_id = :run and id = :id
                    """)
                    .param("outputs", result.path("outputs").toString())
                    .param("metrics", result.path("metrics").toString())
                    .param("run", runId)
                    .param("id", stepId)
                    .update();
            if ("script".equals(stepId)) {
                storage.title(runId).ifPresent(title -> jdbc.sql("update run set title = :t where id = :id")
                        .param("t", title)
                        .param("id", runId)
                        .update());
            }
            Integer open = jdbc.sql("select count(*) from step where run_id = :run and status <> 'SUCCEEDED'")
                    .param("run", runId)
                    .query(Integer.class)
                    .single();
            if (open == 0) {
                jdbc.sql("update run set status = 'SUCCEEDED', finished_at = now(), updated_at = now() where id = :id and status = 'RUNNING'")
                        .param("id", runId)
                        .update();
                log.info("Run {} succeeded", runId);
            } else {
                touchRun(runId);
            }
            log.info("Run {} step {} succeeded (attempt {})", runId, stepId, attempt);
        } else {
            JsonNode error = result.path("error");
            fail(step, error.path("code").asText("WORKER_ERROR"), error.path("message").asText("worker failed"),
                    error.path("retryable").asBoolean(false));
        }
        return true;
    }

    /** Progress is best effort: it marks the step RUNNING and stores the percentage and note. */
    @Transactional
    public boolean applyProgress(String json) {
        JsonNode p = parse(json);
        if (p == null || !valid("task-progress", p)) {
            return false;
        }
        int updated = jdbc.sql("""
                update step set status = 'RUNNING', started_at = coalesce(started_at, now()),
                    progress = :pct, message = :msg
                where run_id = :run and id = :id and attempt = :attempt and status in ('QUEUED', 'RUNNING')
                """)
                .param("pct", (int) Math.round(p.path("pct").asDouble()))
                .param("msg", p.path("message").asText(""))
                .param("run", p.path("runId").asText())
                .param("id", p.path("stepId").asText())
                .param("attempt", p.path("attempt").asInt())
                .update();
        return updated > 0;
    }

    private void fail(Active step, String code, String message, boolean retryable) {
        String msg = message.length() > 2000 ? message.substring(0, 2000) : message;
        if (retryable && step.attempt() < step.maxAttempts()) {
            long delay = retryBaseMs * (1L << Math.max(0, step.attempt() - 1));
            jdbc.sql("""
                    update step set status = 'PENDING', error_code = :code, error = :msg,
                        message = :note, not_before = now() + make_interval(secs => :delaySec)
                    where run_id = :run and id = :id
                    """)
                    .param("code", code)
                    .param("msg", msg)
                    .param("note", "retrying (attempt " + (step.attempt() + 1) + " of " + step.maxAttempts() + ")")
                    .param("delaySec", delay / 1000.0)
                    .param("run", step.runId())
                    .param("id", step.stepId())
                    .update();
            touchRun(step.runId());
            log.warn("Run {} step {} attempt {} failed ({}), retrying: {}", step.runId(), step.stepId(), step.attempt(), code, msg);
            return;
        }
        jdbc.sql("""
                update step set status = 'FAILED', error_code = :code, error = :msg, message = 'failed', finished_at = now()
                where run_id = :run and id = :id
                """)
                .param("code", code)
                .param("msg", msg)
                .param("run", step.runId())
                .param("id", step.stepId())
                .update();
        jdbc.sql("update step set status = 'CANCELLED', message = 'not run: an earlier step failed' where run_id = :run and status in ('PENDING', 'QUEUED')")
                .param("run", step.runId())
                .update();
        jdbc.sql("update run set status = 'FAILED', error = :err, finished_at = now(), updated_at = now() where id = :id")
                .param("err", step.stepId() + ": " + msg)
                .param("id", step.runId())
                .update();
        log.warn("Run {} failed at step {} ({}): {}", step.runId(), step.stepId(), code, msg);
    }

    // ------------------------------------------------------------------ user actions

    /** Stops a running run. A worker that is mid-step finishes, but its result is ignored. */
    @Transactional
    public boolean cancel(String runId) {
        int n = jdbc.sql("update run set status = 'CANCELLED', finished_at = now(), updated_at = now() where id = :id and status = 'RUNNING'")
                .param("id", runId)
                .update();
        if (n == 0) {
            return false;
        }
        jdbc.sql("update step set status = 'CANCELLED', message = 'cancelled', finished_at = now() where run_id = :run and status in ('PENDING', 'QUEUED', 'RUNNING')")
                .param("run", runId)
                .update();
        return true;
    }

    /** Resumes a failed or cancelled run from where it stopped; succeeded steps are kept. */
    @Transactional
    public boolean retry(String runId) {
        int n = jdbc.sql("update run set status = 'RUNNING', error = null, finished_at = null, updated_at = now() where id = :id and status in ('FAILED', 'CANCELLED')")
                .param("id", runId)
                .update();
        if (n == 0) {
            return false;
        }
        jdbc.sql("""
                update step set status = 'PENDING', attempt = 0, not_before = null, progress = 0, message = null,
                    error_code = null, error = null, finished_at = null
                where run_id = :run and status in ('FAILED', 'CANCELLED', 'QUEUED', 'RUNNING')
                """)
                .param("run", runId)
                .update();
        return true;
    }

    // ------------------------------------------------------------------ helpers

    private void touchRun(String runId) {
        jdbc.sql("update run set updated_at = now() where id = :id").param("id", runId).update();
    }

    private boolean valid(String contract, JsonNode node) {
        ValidationResult r = contracts.validate(contract, node);
        if (!r.valid()) {
            log.warn("Dropping invalid {} message: {}", contract, r.errors());
        }
        return r.valid();
    }

    private JsonNode parse(String json) {
        try {
            return mapper.readTree(json);
        } catch (JsonProcessingException e) {
            log.warn("Dropping message that is not JSON: {}", e.getOriginalMessage());
            return null;
        }
    }

    private JsonNode read(String json) {
        try {
            return mapper.readTree(json);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("corrupt json column: " + json, e);
        }
    }

    static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** A request the user can fix (bad topic, unknown voice...). */
    public static class BadRunRequest extends RuntimeException {

        private static final long serialVersionUID = 1L;

        public BadRunRequest(String message) {
            super(message);
        }
    }
}
