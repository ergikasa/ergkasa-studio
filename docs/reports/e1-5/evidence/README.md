# E1.5 · Provat e auditimit

Daljet e komandave mbi `35a4e8f` (branch `e1-5-pipeline-integration`), 2026-11-18.

| Skedari                                                                    | Komanda                                                                            | Rezultati                                                                                                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `k9-pnpm-test.log`                                                         | `pnpm -r --workspace-concurrency=1 test`                                           | 1 192 teste, 0 dështime, exit 0 (përfshin E2E-në e E1.5)                                                                            |
| `k1-vitest.log`                                                            | `cd film && npx vitest run test/package/k1.test.ts`                                | 5/5 filma; 6 043/6 043 kuadro = `frameAt`                                                                                           |
| `k2-k3-k7-golden-package.log`                                              | `cd film && node --expose-gc --import tsx test/package/golden-package.ts --verify` | K2/K3 0 dështime; K7 931/931 identikë                                                                                               |
| `default-pipeline-golden.log`                                              | `cd film && pnpm -s golden`                                                        | pipeline-i default (legacy): 405 v2 + 136 W0, 0 dështime                                                                            |
| `b1-b5-legacy-vs-package.log`                                              | `cd film && node --import tsx test/package/e15-bench.ts`                           | B1–B5 (me bed-in v2, pa zë): çdo kuadër i dekoduar identik; PCM identike (B2–B4) ose identike mbi stream-in më të shkurtër (B1, B5) |
| `typecheck.log`, `lint.log`, `format-check.log`, `contracts-gen-check.log` | `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm contracts:gen --check`   | OK                                                                                                                                  |
| `baselines.log`                                                            | `sha256sum` dhe `git diff --quiet` kundrejt `eda5ab5` dhe `757464a`                | golden-ët, fixtures dhe kodi i renderimit legacy janë identikë; `origin/main` = `7f8ffca`                                           |

Zëri në testet E2E është sintetik (`ai-worker/test/synthetic-voice.ts`). Nuk është provë e integrimit me ElevenLabs; propozimi për smoke test-in me TTS real: `docs/plans/e1-5-tts-smoke-test.md`.
