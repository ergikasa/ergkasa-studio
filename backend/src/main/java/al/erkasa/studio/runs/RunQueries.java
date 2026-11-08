package al.erkasa.studio.runs;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** Read side of runs for the API. JSON columns are returned as plain maps and lists. */
@Service
public class RunQueries {

    private static final TypeReference<List<Object>> LIST = new TypeReference<>() {};
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};
    private static final String SUMMARY_SQL = """
            select r.id, r.title, r.topic, r.theme, r.voice, r.seconds, r.silent, r.status, r.error,
                   r.created_at, r.updated_at, r.finished_at,
                   (select coalesce(round(avg(case when s.status = 'SUCCEEDED' then 100 else s.progress end)), 0)
                      from step s where s.run_id = r.id) as progress,
                   (select s.id from step s where s.run_id = r.id and s.status <> 'SUCCEEDED'
                      order by s.position limit 1) as current_step
            from run r
            """;

    private final JdbcClient jdbc;
    private final RunStorage storage;
    private final ObjectMapper mapper = new ObjectMapper();

    public RunQueries(JdbcClient jdbc, RunStorage storage) {
        this.jdbc = jdbc;
        this.storage = storage;
    }

    public record RunSummary(
            String id,
            String title,
            String topic,
            String theme,
            String voice,
            int seconds,
            boolean silent,
            String status,
            String error,
            int progress,
            String currentStep,
            String createdAt,
            String updatedAt,
            String finishedAt) {}

    public record StepView(
            String id,
            String taskType,
            String status,
            int attempt,
            int maxAttempts,
            int progress,
            String message,
            String errorCode,
            String error,
            List<Object> outputs,
            Map<String, Object> metrics,
            String queuedAt,
            String startedAt,
            String finishedAt) {}

    public record RunDetail(RunSummary run, List<StepView> steps, List<String> files) {}

    public List<RunSummary> list(int limit) {
        return jdbc.sql(SUMMARY_SQL + " order by r.created_at desc limit :limit")
                .param("limit", Math.max(1, Math.min(limit, 200)))
                .query(this::summary)
                .list();
    }

    public Optional<RunDetail> get(String id) {
        Optional<RunSummary> run = jdbc.sql(SUMMARY_SQL + " where r.id = :id").param("id", id).query(this::summary).optional();
        if (run.isEmpty()) {
            return Optional.empty();
        }
        List<StepView> steps = jdbc.sql("""
                select id, task_type, status, attempt, max_attempts, progress, message, error_code, error,
                       outputs::text as outputs, metrics::text as metrics, queued_at, started_at, finished_at
                from step where run_id = :id order by position
                """)
                .param("id", id)
                .query((rs, n) -> new StepView(
                        rs.getString("id"),
                        rs.getString("task_type"),
                        rs.getString("status"),
                        rs.getInt("attempt"),
                        rs.getInt("max_attempts"),
                        rs.getInt("progress"),
                        rs.getString("message"),
                        rs.getString("error_code"),
                        rs.getString("error"),
                        json(rs.getString("outputs"), LIST),
                        json(rs.getString("metrics"), MAP),
                        time(rs.getTimestamp("queued_at")),
                        time(rs.getTimestamp("started_at")),
                        time(rs.getTimestamp("finished_at"))))
                .list();
        return Optional.of(new RunDetail(run.get(), steps, storage.files(id)));
    }

    private RunSummary summary(ResultSet rs, int n) throws SQLException {
        return new RunSummary(
                rs.getString("id"),
                rs.getString("title"),
                rs.getString("topic"),
                rs.getString("theme"),
                rs.getString("voice"),
                rs.getInt("seconds"),
                rs.getBoolean("silent"),
                rs.getString("status"),
                rs.getString("error"),
                rs.getInt("progress"),
                rs.getString("current_step"),
                time(rs.getTimestamp("created_at")),
                time(rs.getTimestamp("updated_at")),
                time(rs.getTimestamp("finished_at")));
    }

    private static String time(Timestamp t) {
        return t == null ? null : t.toInstant().toString();
    }

    private <T> T json(String text, TypeReference<T> type) {
        try {
            return mapper.readValue(text, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("corrupt json column: " + text, e);
        }
    }
}
