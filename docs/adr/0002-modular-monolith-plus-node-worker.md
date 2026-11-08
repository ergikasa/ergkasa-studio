# ADR 0002: Monolit modular në Spring + një worker në Node

- Statusi: pranuar
- Data: 2026-11-08

## Konteksti

Specifikimi kërkon modularitet pa microservices të panevojshme. Remotion kërkon Node dhe Chromium.

## Vendimi

Një aplikacion Spring Boot me paketa sipas domain-it (project, orchestration, workers, asset, artifact). Një proces Node (`engine-worker`) për kompilimin dhe render-in.

## Pasojat

Dy procese për t'u mirëmbajtur. Çdo worker mund të nxirret më vonë si proces më vete, sepse komunikon vetëm me kontrata.
