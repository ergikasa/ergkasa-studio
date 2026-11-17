# E1.1 – Kontratat `erkasa.render/1` dhe `erkasa.assets/1` (raport)

|           |                                                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| Branch    | `e1-contracts-execution`, nga `e0-engine-boundary` @ `ff66590b88c60153b957e0b428d0564a91740244`; `main` i paprekur         |
| Commit-et | `755afcaa3781218e48adfacdccd82d17a8e72b41` kontratat · `4581307e6816da3e5362a3c316edf0b58a4af9c7` korrigjimet pas review-t |
| Data      | 2026-11-17                                                                                                                 |
| Statusi   | E1.2 (Stager) nuk është autorizuar dhe nuk është nisur                                                                     |

## Scope

Vetëm `contracts/`. Asnjë ndryshim në `film/`, `engine/`, `compiler/`, `planner/`, `ai-worker/`.

| Skedari                                                                       | Përmbajtja                                                                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `contracts/src/asset-manifest.ts`                                             | `erkasa.assets/1` (Zod, burimi i së vërtetës)                                                 |
| `contracts/src/render-package.ts`                                             | `erkasa.render/1` (Zod)                                                                       |
| `contracts/json-schema/{asset-manifest,render-package}.schema.json`           | JSON Schema draft 2020-12, të gjeneruara (`pnpm contracts:gen`)                               |
| `contracts/fixtures/valid/{asset-manifest,render-package}.prisoner-cell.json` | Shembuj realë (9,6 KB dhe 14,4 KB)                                                            |
| `contracts/fixtures/invalid/`                                                 | 49 raste refuzimi (27 manifest, 22 paketë), secili një mutacion i vetëm i një shembulli valid |
| `contracts/test/render-package.test.ts`                                       | Realizmi i shembujve dhe rregulli i plotësisë                                                 |

## Parimet

- **Modeli i dëshiruar, jo kopje e implementimit.** Asnjë `shot`, `beat`, `moment`, `mark`, folje, `mood` ose `Script`. Film = skena → shtresa në thellësi → nyje (asset, tekst, formë) + aktorë me rig, të animuar me kanale numerike në kohë absolute.
- **Pa sjellje kreative.** Kontrata thotë çfarë vizatohet dhe kur. Testet: `mood` te aktori dhe kanali `"walk to door"` refuzohen.
- **Versionim.** `schema` literal; fushë opsionale e re mbetet `/1`, çdo ndryshim tjetër është `/2`. Objektet strikte (`additionalProperties: false`).
- **Plotësia (pas review-t).** Kontrata nuk ka asnjë vlerë default. Stager-i shkruan çdo vlerë; Engine-i dhe çdo lexues Java shohin saktësisht atë që është shkruar. Opsionale mbeten vetëm fushat ku mungesa do të thotë "nuk ekziston" (pa stroke, pa panel, pa highlight, pa raport Style Gate, kockë rrënjë).
- **Ndarja skemë / Validation Gate.** Skema: formë, tipe, kufij, fusha të detyrueshme, versione. Validation Gate (E1.3): referencat, gjendjet dhe kanalet e deklaruara, rendi kohor, mbulimi i montazhit, një track për (skenë, objektiv, kanal), një mbajtës për objekt, builtin-et kundrejt capabilities, kufijtë realë të filesystem-it.

## Semantika e vlerësimit (e njëjtë për çdo Engine)

- Kuadri `f` shfaqet në `t = f / fps`.
- `keys`: para çelësit të parë vlera e parë, pas të fundit vlera e fundit; mes dy çelësave vlera udhëton sipas `ease` të çelësit të dytë (`hold` e mban të parën).
- `samples`: `values[i]` është vlera në `start + i / rate`. Në kohën `t` përdoret `values[floor((t − start) · rate + 1e-6)]`, e kufizuar në `0..n−1`. Në `/1` nuk ka interpolim. `rate` është numër i plotë. Kur `rate = fps` dhe `start` bie në një kuadër, çdo kuadër lexon saktësisht një vlerë të ruajtur, pra lëvizja riprodhohet numër për numër. Stager-i i shkruan mostrat në frekuencën ku e ka vlerësuar lëvizjen, pa resampling. Për `bone.*` dhe `channel.*` Validation Gate kërkon `rate = fps` dhe `start · fps` numër të plotë.

## Builtin-et

`{kind: "builtin", name, version, fingerprint}`. Engine-i publikon në capabilities çdo builtin me të njëjtat tri vlera dhe statusin. Rregullat e Validation Gate (E1.3), siç u miratuan:

| Gjendja                                                | Vendimi  |
| ------------------------------------------------------ | -------- |
| Njihet nga Engine-i, version dhe fingerprint përputhen | Pranohet |
| Nuk njihet                                             | Error    |
| Deprecated por ende i mbështetur                       | Warning  |
| Hequr nga runtime                                      | Error    |
| Emri njihet, por versioni ose fingerprint ndryshojnë   | Error    |

Në shembull, deri sa Engine-i të publikojë fingerprint-et e veta (E1.3), fingerprint-i i rig-ut është sha256 i `film/src/rig.ts` (`e27fab0f…`) dhe testi e verifikon: çdo ndryshim i atij skedari e prish testin, pra varësia nuk ndryshon në heshtje. Fingerprint-i i fontit është sha256 i `Montserrat_700Bold.ttf` nga `@expo-google-fonts/montserrat@0.4.2` (`7fa93d7d…`); ky nuk verifikohet nga testi, sepse skedari është në `node_modules`.

## URI-t

`ContainedUri`: rrugë relative brenda rrënjës së paketës ose `s3://bucket/key`. Çdo segment fillon me shkronjë, shifër ose `_`. Refuzohen (me teste): `../`, `a/../../`, `./`, segmente të fshehura (`.git`), rrugë absolute, `file://`, backslash, segmente bosh, `%`-escape, `..` brenda S3. Vlen edhe për `assetManifest.uri` të paketës. Validation Gate duhet të zgjidhë rrugën kundrejt rrënjës reale (symlink) para leximit.

## Komandat dhe rezultatet (në `4581307`)

| Komanda                             | Rezultati                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm contracts:gen --check`        | exit 0, skemat në sinkron                                                                          |
| `pnpm -r test`                      | 371/371: contracts 181, engine 23, compiler 28, engine-worker 16, film 82, planner 6, ai-worker 35 |
| `pnpm typecheck`                    | exit 0                                                                                             |
| `pnpm lint`                         | exit 0                                                                                             |
| `pnpm format:check`                 | kalon                                                                                              |
| `pnpm --filter @erkasa/film golden` | 451 kuadro të krahasuara, 0 ndryshime                                                              |

Testet e kontratave: çdo fixture kontrollohet me Zod dhe me Ajv 2020 kundrejt JSON Schema (2 valid, 49 invalid). Shtatë teste realizmi: skedarët ekzistojnë me hash-in e deklaruar; rig-u i fiksuar te kodi; paketa fikson manifestin me hash; çdo `id@version` ekziston; mostrat e kockave në 30/s = fps; `parse()` kthen dokumentin të pandryshuar; skemat nuk kanë `default`.

## Çfarë nuk u testua

- Paketa nuk është renderuar: Engine-i e lexon vetëm në E1.4.
- Mostrat e ecjes në shembull janë sintetike (sinus në 30/s), jo dalje e `perform.ts`; riprodhimi numër për numër provohet në E1.2 kundrejt golden.
- Shembulli nuk ka audio: asnjë skedar audio nuk është në git dhe nuk u shpik hash.
- Style Gate nuk ka ekzekutuar mbi asnjë aset (`style.gate` mungon).
- Formulat e easing (`easeInOut` etj.) nuk janë të fiksuara në kontratë; duhen fiksuar numerikisht para E1.4, që dy Engine të japin të njëjtin rezultat.

## Vendime që ndikojnë E1.2–E2

1. `samples` për kockat në frekuencën e vlerësimit (miratuar); `keys` për kamerën, dritat, nyjet.
2. Stager-i materializon çdo vlerë; Engine-i nuk plotëson asgjë.
3. Builtin-et të fiksuara me version + fingerprint; rregullat e tabelës më lart në E1.3; zëvendësohen me skedarë në E2.
4. `container` dhe `switch` nuk shtohen pa një skenë reale që i kërkon (vendim i review-t).
5. Manifesti fiksohet me hash; çdo ndryshim aseti jep manifest dhe paketë të re.
6. Madhësia nuk optimizohet: shembulli është 14,4 KB për 8 s me dy track-e me mostra në 30/s. Madhësia e filmave realë 45 s matet në E1.2 para çdo vendimi për kompresim.
