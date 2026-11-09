package al.erkasa.studio.runs;

import java.nio.charset.StandardCharsets;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The RabbitMQ side of the orchestrator: publishes the outbox, receives results and progress, and
 * ticks the dispatcher. Bodies are plain UTF-8 JSON validated against the contracts, never Java objects.
 */
@Component
public class RunMessaging {

    private static final Logger log = LoggerFactory.getLogger(RunMessaging.class);

    private record OutboxRow(long id, String exchange, String routingKey, String payload) {}

    private final Orchestrator orchestrator;
    private final RabbitTemplate rabbit;
    private final JdbcClient jdbc;
    private volatile boolean brokerDownLogged;

    public RunMessaging(Orchestrator orchestrator, RabbitTemplate rabbit, JdbcClient jdbc) {
        this.orchestrator = orchestrator;
        this.rabbit = rabbit;
        this.jdbc = jdbc;
    }

    /** Dispatch ready steps and expire late ones. */
    @Scheduled(fixedDelayString = "${erkasa.orchestrator.tick-ms:1000}")
    public void tick() {
        orchestrator.expireDeadlines();
        orchestrator.dispatchReady();
    }

    /** Publishes committed task commands. Rows stay unpublished (and are retried) while RabbitMQ is down. */
    @Scheduled(fixedDelayString = "${erkasa.orchestrator.outbox-ms:300}")
    @Transactional
    public void publishOutbox() {
        List<OutboxRow> rows = jdbc.sql("""
                select id, exchange, routing_key, payload from outbox
                where published_at is null order by id limit 100
                for update skip locked
                """)
                .query((rs, n) -> new OutboxRow(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4)))
                .list();
        for (OutboxRow row : rows) {
            MessageProperties props = new MessageProperties();
            props.setContentType(MessageProperties.CONTENT_TYPE_JSON);
            props.setContentEncoding("utf-8");
            props.setDeliveryMode(MessageDeliveryMode.PERSISTENT);
            try {
                rabbit.send(row.exchange(), row.routingKey(), new Message(row.payload().getBytes(StandardCharsets.UTF_8), props));
            } catch (AmqpException e) {
                if (!brokerDownLogged) {
                    log.warn("RabbitMQ unavailable, {} task(s) wait in the outbox: {}", rows.size(), e.getMessage());
                    brokerDownLogged = true;
                }
                return;
            }
            brokerDownLogged = false;
            jdbc.sql("update outbox set published_at = now() where id = :id").param("id", row.id()).update();
        }
    }

    @RabbitListener(queues = "#{@mqNames.results()}")
    public void onResult(Message message) {
        try {
            orchestrator.applyResult(new String(message.getBody(), StandardCharsets.UTF_8));
        } catch (RuntimeException e) {
            log.error("Could not apply a task result; message dropped", e);
        }
    }

    @RabbitListener(queues = "#{@mqNames.progress()}")
    public void onProgress(Message message) {
        try {
            orchestrator.applyProgress(new String(message.getBody(), StandardCharsets.UTF_8));
        } catch (RuntimeException e) {
            log.warn("Could not apply task progress: {}", e.getMessage());
        }
    }
}
