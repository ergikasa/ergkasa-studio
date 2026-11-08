package al.erkasa.studio.runs;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * RabbitMQ names shared with the TypeScript worker (ai-worker/src/mq.ts). The prefix lets tests use
 * their own queues without touching a developer's real ones.
 *
 * <pre>
 * exchange {prefix}.tasks  (direct): script.write, voice.synthesize, visual.plan -> {prefix}.tasks.ai
 *                                    render.finalize                              -> {prefix}.tasks.render
 * exchange {prefix}.events (direct): result   -> {prefix}.results
 *                                    progress -> {prefix}.progress
 * </pre>
 */
@Component("mqNames")
public class MqNames {

    public static final String RESULT_KEY = "result";
    public static final String PROGRESS_KEY = "progress";

    private final String prefix;

    public MqNames(@Value("${erkasa.mq.prefix:erkasa}") String prefix) {
        this.prefix = prefix;
    }

    public String tasksExchange() {
        return prefix + ".tasks";
    }

    public String eventsExchange() {
        return prefix + ".events";
    }

    public String aiQueue() {
        return prefix + ".tasks.ai";
    }

    public String renderQueue() {
        return prefix + ".tasks.render";
    }

    public String results() {
        return prefix + ".results";
    }

    public String progress() {
        return prefix + ".progress";
    }
}
