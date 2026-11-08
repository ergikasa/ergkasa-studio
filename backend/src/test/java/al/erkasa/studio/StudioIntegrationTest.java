package al.erkasa.studio;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Every integration test uses this one configuration, so Spring starts a single application context:
 * one scheduler and one set of listeners on the shared database, using test-only queue names.
 * Needs the local Postgres and RabbitMQ (docker compose, or the CI services).
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "erkasa.mq.prefix=erkasa-test",
            "erkasa.orchestrator.tick-ms=100",
            "erkasa.orchestrator.outbox-ms=50",
            "erkasa.orchestrator.retry-base-ms=200",
            "erkasa.storage.dir=target/test-runs"
        })
@ActiveProfiles("local")
public @interface StudioIntegrationTest {}
