# E1.6 · Nënfaza 3: Package Pipeline Default (raport)

| Fusha     | Vlera                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------ |
| Statusi   | **E implementuar; pret dëgjimin tënd** (kriter pranimi i planit).                                      |
| Commit-et | `8797501` (worker), `a80498e` (backend + Studio), `5880181` (testet)                                   |
| Rollback  | `ERKASA_PIPELINE=legacy` në `.env`: e lexojnë si backend-i ashtu edhe worker-i; e menjëhershme, pa kod |

## Çfarë u ndryshua

- **Worker dhe CLI.** Pa zgjedhje të shprehur, filmi renderohet nga rruga e paketës. `ERKASA_PIPELINE=legacy` ose `--pipeline legacy` zgjedh legacy. Çdo vlerë tjetër refuzohet; nuk ka fallback.
- **Backend.**
  - `erkasa.render.pipeline` (`ERKASA_PIPELINE`, default `package`) shënohet në çdo run, në kolonën e re `run.pipeline` (migrimi V6).
  - Vlera i kalon hapit `render` si `params.pipeline`, kështu çdo run tregon me cilën rrugë u renderua.
  - Një vlerë e panjohur e ndal backend-in që në nisje.
- **Studio.** Faqja e run-it tregon "render: package" ose "render: legacy (rollback)". `package/gate.json` dhe `package/film.render.json` shfaqen dhe shërbehen bashkë me run-in, vetëm për lexim. Asgjë tjetër nga `package/` nuk shërbehet.

## Testet

| Testi                                                                                                   | Lloji                |
| ------------------------------------------------------------------------------------------------------- | -------------------- |
| `pipelineOf()`: `package` si default; `ERKASA_PIPELINE=legacy` zgjedh legacy; `fast` refuzohet          | pozitiv dhe negativ  |
| Pa pipeline: **i njëjti MP4** (sha256) si me `pipeline=package`                                         | pozitiv              |
| `ERKASA_PIPELINE=legacy` pa parametër (rollback-u): **i njëjti MP4** si me `pipeline=legacy`, pa paketë | rollback             |
| P1–P8 e E1.5, me referencat legacy tani të shprehura (`pipeline: "legacy"`)                             | regresion            |
| `film-worker.test.ts`: run i plotë pa flamur, tani nga paketa; kohëzgjatja përputhet                    | pozitiv              |
| Backend: run-i i ri ka `pipeline = package`, edhe hapi `render`                                         | pozitiv              |
| Backend: `package/gate.json` shërbehet; `package/secret.txt` jo (404)                                   | pozitiv dhe negativ  |
| Backend: `erkasa.render.pipeline=fast` ndal nisjen; `legacy` pranohet                                   | negativ dhe rollback |

## Provat

| Prova                                                                   | Skedari                             |
| ----------------------------------------------------------------------- | ----------------------------------- |
| E2E dhe worker, emër për emër, lokalisht (19 teste)                     | `worker-e2e-local.txt`              |
| Backend në CI (135 teste, përfshirë `RenderPipelineTest`)               | `backend-tests.txt`                 |
| Video demo nga rruga e re default, gate `ok: true`, 8,03 s, H.264 + AAC | dërguar në bisedë; sha256 më poshtë |

sha256 i videos demo: `7c29ece7f0e71d4a065a1a6f635adf0af4ca3b6b89f7eb5aa38f420b92253404`. Kujdes: zëri është sintetik (jo ElevenLabs) dhe muzika është ende bed-i sintetik, që hiqet në nënfazën 4.

## Devijimet

- **D-3.1:** E2E-ja e E1.5 kishte testin "the default stays legacy". Me default-in e ri u kthye në "the default is package". Referencat legacy (L, LV, LB, LS) tani e emërtojnë `pipeline: "legacy"`, sepse default-i ndryshoi. Pohimet e tyre mbetën të njëjta, dhe u shtuan dy teste të reja të barazisë sha256.
- **D-3.2:** rollback-u kalon nga `.env`, që e lexojnë të dyja proceset, jo vetëm nga mjedisi i worker-it siç thoshte plani. Kështu çdo run tregon saktë me cilën rrugë u renderua.

## Pranimi (kërkon ty)

Kohëzgjatja e MP4-së është e barabartë me `output.duration`, dhe golden-ët nuk ndryshuan (CI). **Mbetet dëgjimi yt i një run-i**: videon demo e ke në bisedë, dhe mund ta bësh edhe me një run nga Studio.
