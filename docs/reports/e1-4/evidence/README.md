# E1.4 · Provat e auditimit final (mbyllja F1–F4)

Daljet e komandave që u ekzekutuan mbi `14ebbd2` (kodi i pranuar; `ac7fa9f` shton vetëm raportin) më 2026-11-17. Raporti: `docs/reports/e1-4-final-audit-closure.md` (§5). E1.4 u pranua nga PO-ja më 2026-11-17.

| Skedari                       | Komanda                                                                                                                        | Rezultati                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `k1-vitest.log`               | `cd film && npx vitest run test/package/k1.test.ts`                                                                            | 5/5 filma, 6 043/6 043 kuadro të barabartë me `frameAt` (përveç id-ve të kinetic-type) |
| `k2-k3-k7-golden-package.log` | `cd film && node --expose-gc --import tsx test/package/golden-package.ts --verify`                                             | K2/K3 0 dështime; K7 931/931 identikë                                                  |
| `default-pipeline-golden.log` | `cd film && pnpm -s golden`                                                                                                    | 405 v2 + 136 W0, 0 dështime                                                            |
| `k8-gate-files.log`           | `cd gate && npx vitest run test/svg.test.ts test/negative.test.ts test/fields.test.ts test/bounds.test.ts test/values.test.ts` | 319/319 (K8: 201 pa `values.test.ts`)                                                  |
| `k9-pnpm-test.log`            | `pnpm -r --workspace-concurrency=1 test`                                                                                       | 1 105 teste, 0 dështime, exit 0                                                        |
| `typecheck.log`               | `pnpm typecheck`                                                                                                               | OK                                                                                     |
| `lint.log`                    | `pnpm lint`                                                                                                                    | OK                                                                                     |
| `format-check.log`            | `pnpm format:check`                                                                                                            | "All matched files use Prettier code style!"                                           |
| `contracts-gen-check.log`     | `pnpm contracts:gen --check`                                                                                                   | exit 0                                                                                 |
| `baselines.log`               | `sha256sum` i golden-ëve; `git diff --quiet` kundrejt `eda5ab5` dhe `e0f0efa`; `origin/main`                                   | golden-ët identikë; `origin/main` = `7f8ffca`                                          |

Prova të tjera të E1.4 në repo: `docs/reports/e1-4/fixtures-b-contact-sheet.png`; `film/golden/golden-package.json` dhe `film/golden/golden-fixtures-b.json` (K7 dhe fixtures B); raportet `docs/reports/e1-4-engine-reads-package.md`, `e1-4-final-audit.md`, `e1-4-final-audit-closure.md`.

`typecheck.log`, `lint.log`, `format-check.log`, `contracts-gen-check.log`, `k8-gate-files.log` dhe `baselines.log` u rishkruan menjëherë pas pranimit mbi `ac7fa9f`, ku kodi është i njëjtë me `14ebbd2`.
