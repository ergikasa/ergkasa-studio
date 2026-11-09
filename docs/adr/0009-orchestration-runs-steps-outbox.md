# ADR 0009: Orkestrimi: run-e, hapa, outbox dhe RabbitMQ

- Statusi: pranuar
- Data: 2026-11-08

## Konteksti

Një video kalon nëpër katër hapa të ngadaltë dhe që mund të dështojnë: skenari (Claude), zëri (ElevenLabs),
plani (Claude + kompilatori) dhe render-i (motori + FFmpeg). Studio duhet t'i nisë, t'i ndjekë, t'i
rifillojë dhe t'i anulojë pa humbur punën e bërë.

## Vendimi

- **Gjendja jeton në Postgres** (`run`, `step`, `outbox`, migrimi V3). Hapat formojnë një DAG të vogël:
  `script → voice → plan → render` (pa `voice` kur run-i është "silent").
- **Spring orkestron** (`Orchestrator`): çdo sekondë dërgon hapat gati (varësitë SUCCEEDED) dhe skadon
  ata që kanë kaluar afatin. Komanda `erkasa.task/1` shkruhet në `outbox` në të njëjtin transaksion me
  ndryshimin e hapit, pastaj publikohet në RabbitMQ. Kështu një rrëzim nuk humb dhe nuk dyfishon asgjë.
- **RabbitMQ vetëm si transport** (ADR 0003): `erkasa.tasks` → `erkasa.tasks.ai` (script, voice, plan) dhe
  `erkasa.tasks.render`; `erkasa.events` → `erkasa.results` dhe `erkasa.progress`. Të dyja anët deklarojnë
  të njëjtën topologji. Çdo mesazh validohet me kontratat (`task-command`, `task-result`, `task-progress`).
- **Worker-i** (`pnpm worker`, TypeScript) ekzekuton të njëjtat funksione si `pnpm video` (`steps.ts`). Ka
  një kanal për AI dhe një për render, që një render i gjatë të mos bllokojë skenarin e videos tjetër.
  Konfirmon rezultatin (publisher confirms) para se të bëjë `ack` taskun.
- **Rifillimet:** dështimet `retryable` (429, 5xx, timeout, plan pa sukses) riprovohen me pritje
  eksponenciale deri në `max_attempts`. Të tjerat (çelës mungon, 401) ndalojnë run-in me mesazh të qartë.
  Një rezultat për një provë të vjetër injorohet. **Resume** rinis vetëm hapat që dështuan ose u anuluan.
- **Artefaktet:** dosja `out/runs/<runId>/` e përbashkët për backend-in dhe worker-in. Referencat në
  mesazhe janë `file://<runId>/<skedar>`. API shërben vetëm emrat e njohur (script.json, video.mp4...).
  SeaweedFS/S3 mbetet për kur worker-i të punojë në një makinë tjetër.

## Pasojat

- Studio ka faqet **New video** dhe **Runs** (progresi live, kosto, video, Resume/Cancel).
- Lokalisht nevojiten katër procese: docker compose (Postgres, RabbitMQ), backend-i, `pnpm worker` dhe
  `pnpm studio`. `pnpm video` mbetet si rrugë e shpejtë pa backend.
- Testi `RunFlowTest` kalon gjithë rrjedhën me Postgres dhe RabbitMQ të vërtetë, në radhë me prefiks të veçantë.
