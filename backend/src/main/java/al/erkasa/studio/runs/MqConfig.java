package al.erkasa.studio.runs;

import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Declares the exchanges, queues and bindings (idempotent; the worker declares the same ones). */
@Configuration
@EnableScheduling
public class MqConfig {

    static final String[] AI_TASKS = {"script.write", "world.design", "voice.synthesize", "visual.plan"};
    static final String[] RENDER_TASKS = {"render.finalize"};

    @Bean
    public Declarables erkasaTopology(MqNames n) {
        DirectExchange tasks = new DirectExchange(n.tasksExchange(), true, false);
        DirectExchange events = new DirectExchange(n.eventsExchange(), true, false);
        Queue ai = new Queue(n.aiQueue(), true);
        Queue render = new Queue(n.renderQueue(), true);
        Queue results = new Queue(n.results(), true);
        Queue progress = new Queue(n.progress(), true);
        return new Declarables(
                tasks,
                events,
                ai,
                render,
                results,
                progress,
                BindingBuilder.bind(ai).to(tasks).with(AI_TASKS[0]),
                BindingBuilder.bind(ai).to(tasks).with(AI_TASKS[1]),
                BindingBuilder.bind(ai).to(tasks).with(AI_TASKS[2]),
                BindingBuilder.bind(ai).to(tasks).with(AI_TASKS[3]),
                BindingBuilder.bind(render).to(tasks).with(RENDER_TASKS[0]),
                BindingBuilder.bind(results).to(events).with(MqNames.RESULT_KEY),
                BindingBuilder.bind(progress).to(events).with(MqNames.PROGRESS_KEY));
    }
}
