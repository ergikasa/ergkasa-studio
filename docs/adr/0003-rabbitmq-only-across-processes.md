# ADR 0003: RabbitMQ vetëm midis proceseve, DAG në Postgres

- Statusi: pranuar
- Data: 2026-11-08

## Konteksti

Duhet retry, timeout, idempotencë dhe DLQ, por pa kompleksitet të tepërt për një përdorues.

## Vendimi

Gjendja e workflow-it jeton në Postgres (DAG). Mesazhet kalojnë me Outbox Pattern. Retry-t i planifikon orkestruesi në DB, jo redelivery i RabbitMQ. DLQ mban vetëm mesazhet poison.

## Pasojat

Gjendja dhe historia shihen me SQL. RabbitMQ mbetet i thjeshtë.
