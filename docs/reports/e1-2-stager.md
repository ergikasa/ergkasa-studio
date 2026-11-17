# E1.2 – Stager (raport përfundimtar, i pranuar)

|           |                                                                                                                                                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch    | `e1-2-stager`, nga `523e8570c4a39e2b949f8865941083aac7f4417e`                                                                                                                                                              |
| Commit-et | `df05e23` zgjerimi aditiv i kontratës (E1.2a) · `96f3abb` raporti E1.2a · `be092a6` Stager-i · `886ffc0` raporti i parë · `bd6ed0d` korrigjimet e review-t · `c0572520aae8bab255d14d744f1590b94138cd7f` testet e auditimit |
| Data      | 2026-11-17                                                                                                                                                                                                                 |
| Statusi   | **Pranuar nga Product Owner më 2026-11-17.** Pa merge në `main`. Pa ndryshime në Engine, as në kontrata pas E1.2a.                                                                                                         |

## Scope

Paketa `stager/` (`@erkasa/stager`), plus regjistrimi në `pnpm-workspace.yaml` dhe `pnpm-lock.yaml`. Në asnjë commit të Stager-it nuk preken `film/`, `engine/`, `compiler/`, `planner/`, `ai-worker/` dhe `contracts/`.

| Skedari                         | Roli                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/legacy.ts`                 | Dera e vetme drejt kodit të sotëm të staging-ut. Konstantet dhe vizatimet private të Engine-it janë kopjuar dhe shënuar `COPY` (`LIGHT`, `LIGHT_BG`, `TRANSITION_SEC`, fade-i i W0, `otsShoulder`, scrim-i, pjesa e tekstit e `typeSvg` të W0). Testet rindërtojnë kuadro të plota me to dhe i krahasojnë me Engine-in, kështu që një kopje që ndryshon nga Engine-i kapet. Skedari zhduket në E1.5. |
| `src/evaluate.ts`               | **Interpretimi i vetëm i kontratës:** `keys`, `samples`, dukshmëria dhe kohët e captions. Testet e lexojnë paketën vetëm përmes tij.                                                                                                                                                                                                                                                                 |
| `src/recorder.ts`               | Regjistrimi kuadër për kuadër. Kanal konstant → një çelës; çdo kanal tjetër → `samples` në 30/s. Asnjë resampling.                                                                                                                                                                                                                                                                                   |
| `src/v2.ts`, `src/w0.ts`        | Hartëzimi i B1–B5 dhe i W0: një skenë për shot, me kuadrot e tranzicionit në kohët e Engine-it.                                                                                                                                                                                                                                                                                                      |
| `src/manifest.ts`, `src/cli.ts` | Asetet builtin të fiksuara te skedarët burim; CLI për madhësitë dhe hash-et.                                                                                                                                                                                                                                                                                                                         |

## Çfarë është provuar realisht

Çdo provë lexon paketën e serializuar në JSON, vetëm përmes `evaluate.ts`, për **çdo kuadër** të çdo skene. Asnjë tolerancë. I vetmi normalizim: id-të `kt…` të `kineticType` (pika 3 më poshtë).

| Element                      | B1–B5                                                                                                                 | W0                                                                                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personat**                 | Çdo kanal është i barabartë bit për bit me `pose(t)`/`placed(t)`/`glow`, dhe SVG-ja identike me `ActorPerf.draw(t)`   | E njëjta                                                                                                                                                                                                                                                      |
| **Kamera**                   | Transformimi i vizatuar rindërtohet identik (shih pikën 2)                                                            | `cx, cy, height` të barabarta me vlerat e Engine-it                                                                                                                                                                                                           |
| **Set-i / vendi**            | `back` dhe `front` brenda trupit të rindërtuar                                                                        | Gjashtë kanalet e gjendjes (koha, drita, dera, llamba, ora, dosjet) të barabarta mbi të gjashtë nyjet e botës                                                                                                                                                 |
| **Props**                    | Pushimi/në dorë, pozicioni, drejtimi, rrotullimi dhe vizatimi brenda trupit të rindërtuar                             | Mbajtësi (dukshmëria `_rest`/`_held`), pozicioni, drejtimi dhe vizatimi që bën kompozuesi i W0                                                                                                                                                                |
| **Shabllonet editoriale**    | Brenda trupit të rindërtuar, me ankorat e zgjidhura nga paketa                                                        | –                                                                                                                                                                                                                                                             |
| **OTS**                      | Rindërtuar në 128 kuadro (B2)                                                                                         | –                                                                                                                                                                                                                                                             |
| **Scrim**                    | Rindërtuar në 1 883 kuadro (B1–B5)                                                                                    | Pjesë e tekstit të W0                                                                                                                                                                                                                                         |
| **Teksti**                   | Rindërtuar në 3 363 kuadro                                                                                            | Rindërtuar në 527 kuadro dhe i krahasuar me `typeSvg`                                                                                                                                                                                                         |
| **Captions**                 | –                                                                                                                     | 37 fraza: çdo fjalë e Engine-it është në paketë me kohët e veta; madhësia sipas frazës; fonti Montserrat 800 i fiksuar te skedari; SVG-ja e rindërtuar nga overlays (teksti, madhësia, ngjyrat, stroke, theksi, kohët) e barabartë me `typeSvg` në çdo kuadër |
| **Kuadri i plotë i shot-it** | **Trupi i plotë rindërtohet nga paketa dhe është identik bajt për bajt me atë të Engine-it**                          | Jo; kompozimi është raster (pika 4)                                                                                                                                                                                                                           |
| **Tranzicionet**             | Kuadrot e tranzicionit: `frameAt` përmban skenën e mëparshme në kohën e paketës dhe nuk e përmban më pas tranzicionit | Gjatë fade-it, teksti i shot-it të mëparshëm fshihet, siç bën W0                                                                                                                                                                                              |
| **Koha e mostrave**          | Çdo kuadër lexon pikërisht mostrën e regjistruar për të (pa gabim ±1 kuadër)                                          | E njëjta                                                                                                                                                                                                                                                      |
| **Prova kap gabime**         | Një mostër e ndryshuar me 1e-9 dhe një parametër OTS i ndryshuar kapen                                                | –                                                                                                                                                                                                                                                             |

**Teste të tjera:**

- **Vlefshmëria:** Zod + Ajv; `parse()` i kthen dokumentet të pandryshuara.
- **Integriteti:** manifesti fiksohet me hash; nuk ka asete që mungojnë apo të papërdorura; builtin-et fiksohen te skedarët e Engine-it; parametrat procedurale janë të plotë; çdo slot vendoset; një track për kanal.
- **Determinizmi:** në të njëjtin proces, në proces më vete, me çdo renditje të filmave.
- **Burimi i Stager-it:** pa model, rrjet, orë apo rastësi.

## Auditimi final dhe testet që e mbyllin

Auditimi i 17 nëntorit gjeti logjikë të përbashkët midis Stager-it dhe testeve: dy anët e krahasimit përdornin të njëjtin kod, pra një gabim i përbashkët nuk do të kapej. Commit-i `c057252` shton vetëm teste (+ `typescript` si devDependency për to). `stager/src`, Engine-i dhe kontratat nuk preken.

| Rreziku i gjetur                                                    | Si mbyllet tani                                                                                                                                                                                                                                | Testi                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Koha e kuadrove të B1–B5 merrej nga `sceneFrames()` në të dyja anët | Çdo trup i vizatuar në kohën e Stager-it gjendet në `frameAt` të Engine-it, që e llogarit vetë kohën `n / FPS`; intervalet e kuadrove ndjekin `shotFrames` të Engine-it                                                                        | `reproduction.test.ts` › "own frames" |
| Indeksi i kuadrove të W0 ishte kopje e `frameIndex` privat          | `frameIndex` i `w0/cli.ts` ekzekutohet **tekstualisht siç është** dhe jep të njëjtin shot dhe të njëjtën kohë, bit për bit, për çdo kuadër                                                                                                     | › "frame index"                       |
| Rregulli i fade-it të W0 ishte kopje                                | Rregulli i `renderFrame` (shenjë tekstuale në burim) vendos shot-in e mëparshëm pikërisht në kuadrot e bishtit të Stager-it, në `prev.dur + t`                                                                                                 | › "fades"                             |
| Mbledhja e props-ve të W0 ishte kopjuar në të dyja anët             | Blloku i `drawShot` ekzekutohet tekstualisht siç është; props në dorë/në pushim dhe "personat + props në dorë" duhet të dalin identikë me paketën në çdo kuadër                                                                                | › "props"                             |
| Blur-i i W0 ishte kopje e paverifikuar                              | Shprehjet e blur-it nxirren nga `composer.ts` dhe ekzekutohen; çdo shtresë e paketës ka atë vlerë                                                                                                                                              | › "depth of field"                    |
| `evaluate.ts` nuk kishte teste                                      | Teste unitare: clamp, `linear`, `hold`, refuzimi i easing-ut pa përkufizim dhe i interpolimit të ngjyrave, indeksi i mostrave për 18 000 kuadro nga disa fillime, kërkimi i track-ut, dukshmëria me ngjarje në çfarëdo rendi, kohët e captions | `evaluate.test.ts`                    |

Mekanizmi (`test/engine-source.ts`): kodi privat i Engine-it pritet nga skedari me shenja fillimi/fundi, tipet hiqen me kompajlerin e TypeScript dhe kodi ekzekutohet. Nëse teksti i Engine-it ndryshon, shenjat nuk gjenden më dhe testi dështon, kështu që kopja duhet rishikuar. Engine-i nuk modifikohet.

**Ende e paprovuar pas auditimit:**

- **Pikselët e W0:** kompozimi raster (harta e dritës, hija, rim, rrezja, bloom, vinjeta, grain).
- **Dega "në dorë" e props në W0:** në W0 filxhani nuk mbahet kurrë në dorë, prandaj ushtrohet vetëm dega "në pushim". Dega "në dorë" provohet te B1–B5.
- **Kamera e papërpunuar e B1–B5:** vlerat në paketë **nuk janë** ato që llogarit `compose.ts`. Shembull i matur: në shot-in statik, `compose.ts` llogarit lartësinë 1250, paketa mban 1246,753 (3,247 px bote). Kufiri: 0,54 % në lartësi, 0,005 px në x/y.
- **Interpolimi me shumë çelësa** provohet vetëm me teste unitare, sepse paketat e Stager-it kanë vetëm çelësa të vetëm.

## Pikat e review-t

1. **OTS dhe scrim (B1–B5):** ✅ Rindërtohen si pjesë e trupit të plotë të çdo kuadri dhe krahasohen bajt për bajt.
2. **Props të W0:** ✅ Mbajtësi, pozicioni, drejtimi dhe vizatimi vlerësohen në çdo kuadër, dhe krahasohen me mbledhjen e vetë kompozuesit (`drawShot`), të ekzekutuar tekstualisht siç është. Pikselët nuk krahasohen; dega "në dorë" nuk ushtrohet në W0.
3. **Captions të W0:** ✅ Teksti, fonti, madhësia, kohët dhe stili, SVG identike me Engine-in në çdo kuadër. Tri pjesë të pamjes nuk janë fusha të kontratës, por rregulla të renderer-it që W0 duhet t'i ndjekë: hyrja me opacitet në 0,12 s, fjalët e pa-arritura me opacitet 0,6 dhe stroke-opacity 0,9.
4. **Një interpretim i vetëm i kontratës:** ✅ `src/evaluate.ts` është i vetmi lexues dhe ka tani teste unitare; testet e kontrollojnë edhe kundrejt kuadrove të Engine-it. `recorder.ts` (ana që shkruan) zbaton të njëjtat rregulla në drejtim të kundërt; përputhja provohet nga cikli i plotë shkrim-lexim. Renderer-i ende nuk ekziston (E1.4). Kusht për E1.4: renderer-i duhet të përdorë këtë modul dhe jo të shkruajë një tjetër. Moduli duhet të zhvendoset pranë kontratës, me autorizimin tënd, që Engine-i ta importojë pa varësi nga Stager-i. Easing-u (përveç `linear` dhe `hold`) hedh gabim derisa të përcaktohet.
5. **Kamera e B1–B5:** ✅ dokumentuar, edhe në kod (`src/v2.ts`).
   - Paketa mban kamerën me të cilën **u vizatua** kuadri, jo kamerën që llogariti `compose.ts`. `fmt()` rrumbullakon në 0,01: x dhe y janë brenda 0,005 px bote nga vlera e llogaritur; shkalla është brenda 0,005, që në B1–B5 (shkalla 0,93–3,36) do të thotë lartësia brenda 0,54 % (maksimumi 11,1 px bote).
   - **Vlerat e papërpunuara të kamerës nuk janë në paketë.**
   - Zgjidhja në E1.5: kodi i kamerës hyn në Stager, që i regjistron pa rrumbullakim; renderer-i aplikon të njëjtin formatim 0,01 kur shkruan transformimin, kështu golden mbetet i pandryshuar.
6. **Id-të e `kineticType`:** ⏳ mbetet e hapur para E1.4. Numëruesi global jep id të ndryshme `clipPath` për të njëjtin tekst; provat normalizojnë vetëm këto id.
7. **Kompozimi i W0:** ⏳ mbetet i hapur për E1.4. Efektet vizuale nuk u ndryshuan.

## Çfarë mbetet e shtyrë

| Çështja                                                                                                                                                                                                                                                                                           | Faza                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Renderer-i që lexon paketën; pikselët nga paketa; golden nga paketa                                                                                                                                                                                                                               | E1.4                        |
| Përputhja e kompozimit të W0 (harta e dritës, hija, rim, rrezja, bloom, vinjeta, grain): model drite apo ndryshim vizual i miratuar                                                                                                                                                               | E1.4                        |
| Formulat numerike të easing-ut                                                                                                                                                                                                                                                                    | Para E1.4                   |
| Id deterministe për `kineticType`                                                                                                                                                                                                                                                                 | Para E1.4                   |
| Zhvendosja e `evaluate.ts` pranë kontratës (kërkon autorizim)                                                                                                                                                                                                                                     | E1.4                        |
| Teksti i W0 vizatohet mbi tranzicionin (në nivel filmi), kurse paketa e vendos në skenë. Në këto filma nuk ka dallim të dukshëm, sepse W0 e fsheh tekstin e shot-it të mëparshëm dhe fade-i hyn para se teksti i ri të shfaqet; testi e verifikon për çdo kuadër. Por si semantikë mbetet hendek. | E1.4                        |
| Kamera e papërpunuar e B1–B5 dhe kopjet `COPY`                                                                                                                                                                                                                                                    | E1.5                        |
| Validation Gate (referencat, rregullat e builtin-eve, kufijtë realë të filesystem-it)                                                                                                                                                                                                             | E1.3                        |
| Audio në paketë                                                                                                                                                                                                                                                                                   | Pas E1 (pa fazë të caktuar) |
| Asetet në vend të builtin-eve procedurale                                                                                                                                                                                                                                                         | E2/E3                       |
| Gjetjet për kontratën (`referenceDistance` për `flat`, `range` për kanale të pakufizuara, projeksioni i W0)                                                                                                                                                                                       | Për review, pa ndryshim     |

## Rezultatet (në `c057252`)

| Komanda                                            | Rezultati                                                                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm -r test`                                     | 484/484 (contracts 213, engine 23, compiler 28, engine-worker 16, film 82, planner 6, stager 81, ai-worker 35) |
| `pnpm contracts:gen --check`                       | exit 0                                                                                                         |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | kalojnë                                                                                                        |
| `pnpm --filter @erkasa/film golden`                | 451/451, 0 ndryshime                                                                                           |

**Kufiri i këtyre rezultateve:** janë lokale, me ffmpeg të instaluar.

**CI në GitHub** (`.github/workflows/ci.yml`) është i kuq në çdo commit nga E0 deri në E1.2, për dy shkaqe që ekzistonin para E0:

- `ai-worker/test/film-worker.test.ts` jep `spawn ffmpeg ENOENT`, sepse runner-i nuk ka ffmpeg.
- Backend-i: `AssetApiTest.listsAndFiltersAssets:49` pret 6 personazhe.

I njëjti dështim duket te run-et `44009034545` (w0-world-first) dhe `43666174750` (studio-v2); edhe `main` është i kuq që nga `43520544941`. Në CI kalojnë: format, lint, typecheck, kontrolli i JSON Schema, stager, contracts, film dhe gjithë paketat e tjera TypeScript. Riparimi i CI-së ndiqet më vete, jashtë E1.2.

## Madhësia reale (JSON kompakt, bajte; pa kompresim)

| Film | Kohëzgjatja | Kocka   | Kanalet e tjera të aktorëve | Kamera | Drita | Nyje    | Overlays | Struktura | **Totali**  |
| ---- | ----------- | ------- | --------------------------- | ------ | ----- | ------- | -------- | --------- | ----------- |
| B1   | 50,2 s      | 104 619 | 115 323                     | 27 628 | 4     | 85 993  | 2        | 6 715     | **340 284** |
| B2   | 41,9 s      | 146 596 | 152 576                     | 30 919 | 4     | 149 371 | 2        | 7 816     | **487 284** |
| B3   | 35,0 s      | 27 199  | 30 350                      | 24 951 | 4     | 57 926  | 2        | 3 645     | **144 077** |
| B4   | 33,9 s      | 28 651  | 38 386                      | 32 511 | 4     | 45 409  | 2        | 4 313     | **149 276** |
| B5   | 40,4 s      | 55 016  | 68 846                      | 36 114 | 4     | 82 419  | 2        | 5 116     | **247 517** |
| W0   | 45,3 s      | 122 905 | 128 211                     | 53 766 | 4     | 366 151 | 8 495    | 8 250     | **687 782** |

Videoja 45-sekondëshe (W0) është 0,69 MB. Te W0, pjesa më e madhe e "nyjeve" janë gjashtë kanalet e gjendjes së vendit, të përsëritura mbi gjashtë nyjet e botës. Vetëm u mat; nuk u optimizua.

## Si riprodhohet

```
pnpm --filter @erkasa/stager test                       # 81 teste, përfshirë rindërtimin kuadër për kuadër
pnpm --filter @erkasa/stager stage --out /tmp/staged    # shkruan paketat, printon madhësitë
pnpm --filter @erkasa/stager stage --hashes             # hash-et (determinizmi)
```

## Pranimi

Kushtet e pranimit të E1.2 të plotësuara:

- 6 filma realë → Render Package;
- golden 451/451 pa ndryshime;
- riprodhim numerik bit për bit i lëvizjes;
- asnjë fushë e detyrueshme e anashkaluar;
- determinizëm;
- testet, typecheck, lint dhe format kalojnë;
- dokumentimi;
- testet që mbyllin gjetjet e auditimit (`c057252`).

**E1.2 u pranua nga Product Owner më 2026-11-17.** Nuk është autorizuar merge në `main`.
