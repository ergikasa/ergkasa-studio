# E0 – Kufiri i Engine-it (raport)

|           |                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------- |
| Branch    | `e0-engine-boundary` (nga `w0-world-first`), pa merge në `main`                                    |
| Commit-et | `9effcfe` golden baseline · `3a2274b` formatim · `ff66590b88c60153b957e0b428d0564a91740244` kufiri |
| Data      | 2026-11-17                                                                                         |

## Scope

| Commit    | Përmbajtja                                                                                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `9effcfe` | Golden renders para çdo ndryshimi: 451 shenja kuadrosh (B1–B5: hash i SVG çdo 0,5 s; W0: piksele çdo 1 s). `pnpm --filter @erkasa/film golden` krahason; `--write` regjistron bazë të re vetëm për ndryshim vizual të miratuar. |
| `3a2274b` | Vetëm hapësira në `film/w0/plan.json`, `film/w0/story.json` dhe dokumentin e planit; `film/golden/` u përjashtua nga Prettier. Të dhënat JSON të pandryshuara.                                                                  |
| `ff66590` | Director-i del nga Engine-i në paketën `planner/` (`@erkasa/planner`); Engine-i publikon `capabilities()` (`erkasa.capabilities/1`); rregull ESLint + `film/test/boundary.test.ts`.                                             |

Arkitektura pas E0:

- `film/` (Engine) nuk ka director, prompt ose kod modeli; eksporton `capabilities()`: set-et me marka, objekte dhe objektiva, foljet, gjendjet emocionale, dritat, shabllonet.
- `planner/` përmban `director.ts`, `examples.ts`, `describe.ts`. Brief-i i director-it ndërtohet nga `capabilities()`. Prompt-i, skema dhe shembulli janë bajt për bajt identikë me para.
- `ai-worker` merr `direct`, `directorExample`, `encode` nga `@erkasa/planner`.
- Drejtimi i varësive: planner → film. `film` nuk varet kurrë nga planner, ai-worker, studio ose SDK modelesh.

## Si mbrohet kufiri

1. ESLint `no-restricted-imports` për `film/**` (planner, ai-worker, studio, `@anthropic-ai/*`, `openai`, `**/llm`).
2. `film/test/boundary.test.ts`: importet, varësitë në `package.json`, mungesa e kodit të director-it, lista e ngrirë e skedarëve që lexojnë ende Script-in (11), një plan i shkruar vetëm nga `capabilities()` është i vlefshëm, golden renders.

## Komandat dhe rezultatet (në `ff66590`)

| Komanda                             | Rezultati                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @erkasa/film golden` | 451 kuadro të krahasuara, 0 ndryshime (B1 101, B2 84, B3 71, B4 68, B5 81, W0 46)                                   |
| `pnpm test`                         | 262/262: contracts 72, engine 23, compiler 28, engine-worker 16, film 82, planner 6, ai-worker 35 (studio pa teste) |
| `pnpm typecheck`                    | kalon                                                                                                               |
| `pnpm lint`                         | kalon                                                                                                               |
| `pnpm format:check`                 | kalon                                                                                                               |

## Çfarë nuk u testua

- `pnpm video` me shërbime reale (Claude, ElevenLabs) nuk u ekzekutua: mjedisi nuk kishte çelësa API. Rruga e plotë e worker-it (script → director me riparim → render real me Engine dhe FFmpeg) kalon testin e saj me model fals dhe pa zë.
- Studio nuk ka teste automatike; nuk u provua manualisht.

## Kufizime

- Engine-i lexon ende Script-in për kohët (`timing.ts` dhe 10 skedarë të tjerë). Lista është e ngrirë me test dhe largohet në E1.5. Plani fillestar thoshte "0 importe të `Script`" në E0; kjo nuk ishte e mundur pa Stager-in e E1.
- `ai-worker/src/catalog.ts` përdor ende `describeSets` të compiler-it të vjetër (rruga v1); nuk prek Engine-in e ri.

## Vendime arkitekturore

- Golden para refactor-it: çdo hap i E0–E2 duhet të lërë 451/451 të pandryshuar, përveç ndryshimeve vizuale të miratuara.
- Engine-i i deklaron aftësitë e tij (`capabilities()`), planifikimi i lexon. Kjo e bën planifikimin të zëvendësueshëm pa prekur Engine-in.
