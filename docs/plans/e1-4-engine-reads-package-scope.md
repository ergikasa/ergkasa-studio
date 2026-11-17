# E1.4 – Engine-i lexon Render Package: scope i rishikuar (për miratim para kodit)

|         |                                                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch  | `e1-4-engine-reads-package`, nga `cfb6a45` (fundi i `e1-3-validation-gate`)                                                                                                       |
| Data    | 2026-11-17                                                                                                                                                                        |
| Statusi | Vetëm scope. **E1.3 u pranua formalisht më 2026-11-17.** Vendimet 1–6 të Product Owner-it janë futur më poshtë. Para kodit duhen zgjidhur **3 bllokues** (seksioni "Bllokuesit"). |
| Burimi  | Plani E0–E4 (rreshti E1); raportet E1.2 dhe E1.3; vendimet e PO-së më 2026-11-17                                                                                                  |

## Qëllimi

Rruga e re **paketë → Gate → Engine** jep të njëjtat kuadro si rruga e sotme. Rruga e sotme mbetet e paprekur në pamje dhe e paracaktuar. Kalimi i pipeline-it dhe heqja e kodit të vjetër janë E1.5.

## Vendimet e PO-së dhe si zbatohen

| #   | Vendimi                                                                                                                            | Zbatimi                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ✅ Evaluatori i vetëm në `contracts/`, i pastër dhe determinist                                                                    | Shih më poshtë                                                                                                                         |
| 2   | ✅ Track-et vetëm `linear` dhe `hold`; tranzicionet me formulat e Engine-it; Gate-i refuzon easing të panjohur me `EASE_UNDEFINED` | Shih më poshtë                                                                                                                         |
| 3   | ✅ me kufi të rreptë: kompozuesi i W0 ripërdoret, por merr të dhëna vetëm nga paketa                                               | Shih më poshtë; nuk gjeta bllokues                                                                                                     |
| 4   | ✅ Id deterministe për `kineticType`, pa numërues global, pa ndryshim vizual                                                       | **Bllokuesi B1**                                                                                                                       |
| 5   | ✅ me kërkesa sigurie: SVG nga bajtet e verifikuara, pa rihapje, pa scripts, pa burime të jashtme                                  | **Bllokuesi B3** (ku zbatohet politika)                                                                                                |
| 6   | ❌ Stili i captions të W0 nuk aplikohet te B1–B5                                                                                   | B1–B5 nuk kanë captions (Stager-i shkruan `overlays: []`), pra pamja e tyre nuk preket. **Bllokuesi B2** (fixture-i B `prisoner-cell`) |

**1. Evaluatori** (`contracts/src/evaluate.ts`, zhvendosur nga `stager/src/evaluate.ts`)

- Funksione të pastra mbi të dhëna: pa I/O, pa orë, pa rastësi.
- Pa importe përveç tipeve të kontratës. Pa varësi nga Engine-i, Gate-i, Stager-i apo filesystem-i.
- Një test kufiri në `contracts` e kontrollon këtë.
- Stager-i, Gate-i dhe renderer-i e importojnë nga `@erkasa/contracts`. Nuk mbetet asnjë kopje tjetër.
- Skemat nuk ndryshojnë: `contracts:gen --check` mbetet pa diff.

**2. Easing-u dhe tranzicionet**

- **Evaluatori:** për çelësat, vetëm `linear` dhe `hold`; çdo emër tjetër hedh gabim.
- **Gate-i:** kod i ri, `EASE_UNDEFINED`, me shtegun `/scenes/<i>/tracks/<j>/keys/<k>/ease`. Paketat e Stager-it dhe fixtures B përdorin vetëm `linear`, pra nuk preken.
- **Pasojë e njohur:** fixtures A të kontratës përdorin `easeInOut`, ndaj lista e gjetjeve me të cilat refuzohen rritet me këto raste. Testi në `films.test.ts` përditësohet me listën e plotë.
- **Tranzicionet:**
  - `dissolve`: `p = EASES.io(t / d)`, me skenën e re mbi të vjetrën me opacitet `fmt(p)`.
  - `whip`: e vjetra zhvendoset `−W·p`, e reja `W·(1 − p)`.
  - Formulat kopjohen nga `compose.ts:356–362` (v2). Për W0 kopjohet fade-i 0,5 s nga `renderFrame`.
  - Publikohen në `capabilities().render` (`transitions`, me formulën të përshkruar) dhe testohen numerikisht kundrejt `frameAt`.

**3. W0 vetëm nga paketa.** Çdo hyrje që kompozuesi i W0 lexon sot ka burim në paketë:

| Hyrja sot (`w0/composer.ts`)                                          | Burimi në paketë                                                                                           |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `P.state(T, door, light)` → `t, light, door, lamp, clockMin, binders` | kanalet `param.*` të nyjeve të botës (E1.2: të barabarta bit për bit)                                      |
| `P.plan.world`, `P.plan.world.seed`                                   | parametrat statikë `world` / `seed` të nyjeve `wall`, `mid`, `city`                                        |
| `ps.cam(t)`                                                           | kanalet e kamerës `x`, `y`, `height`                                                                       |
| `ps.perf` (personat, objektet, dera)                                  | aktorët me kanalet e rig-ut; nyjet e objekteve me dukshmëri                                                |
| blur-i (`dof`, `framing`, `onWall`)                                   | `layer.blur` (E1.3: i barabartë me shprehjet e kompozuesit)                                                |
| `ps.w.near`                                                           | prania e shtresës `near`                                                                                   |
| teksti, `textAt`, `textOut`                                           | `params` e nyjes `type` + `param.t`                                                                        |
| `P.captions`                                                          | `overlays` të tipit `captions`                                                                             |
| grain-i: `Math.floor((ps.start + t) * 24) % 4`                        | `param.t` e botës, që është saktësisht `ps.start + t` (`state()` kthen `t: T`)                             |
| fade-i 0,5 s                                                          | `edit[].enter = dissolve 0.5`                                                                              |
| harta e dritës, hija, rim, rrezja, bloom, vinjeta                     | llogariten nga gjendja e vendit dhe konstantet e Engine-it; asnjë fushë drite në paketë (`lightKinds: []`) |

**Kufiri si garanci teknike:**

- Pjesa e kompozimit të W0 dhe pjesët e vizatimit të v2 (`frame()`, `SCRIMS`, OTS, scrim) nxirren nga `w0/composer.ts` dhe `compose.ts` në module që marrin hyrje të qarta. Këto module nuk importojnë plan, timing, perform, continuity, script apo Stager.
- Rruga e sotme i thërret të njëjtat module, prandaj golden-i i saj mbetet i pandryshuar.
- Një test kufiri ndjek **importet tranzitive** të renderer-it.
- Nëse gjatë implementimit del një hyrje që nuk është në paketë, ndalem dhe e raportoj, pa improvizuar.

**4. Id-të e `kineticType`**

- `kineticType` merr një identitet nga thirrësi; numëruesi global `clipSeq` (`style.ts:64`) hiqet.
- Renderer-i jep `kt-<skena>-<nyja>-<rreshti>`.
- Pikselët nuk ndryshojnë: ndryshojnë vetëm emrat e `clipPath`. Shih B1.

**5. Asetet nga skedari**

- Renderer-i merr vetëm `verified.files` (bajtet që Gate-i hash-oi). Nuk rihap asnjë rrugë.
- SVG-ja futet si `data:` URI te nyja, sipas `geometry` (`viewBox`, `size`, `origin`).
- `resvg` (v2) dhe Skia (W0) konfigurohen pa direktori burimesh.
- Politika e përmbajtjes: shih B3.

## Bllokuesit (konflikte me arkitekturën aktuale; nuk improvizoj)

**B1. Id-të deterministe ndryshojnë golden-in e v2.**

- Golden-i i v2 ruan **hash-in e tekstit SVG** të `frameAt` (`golden.ts:54`), për 405 kuadro të B1–B5.
- Heqja e numëruesit global ndryshon tekstin e çdo kuadri me tekst kinetik edhe në rrugën e sotme, ndonëse pikselët mbeten të njëjtë. Kështu kriteri "golden 451/451 identik" nuk mund të plotësohet për këto kuadro në formën tekstuale.

Opsionet:

- **(a) E rekomanduar:** hiqet numëruesi kudo, dhe golden-i i v2 rishkruhet me `golden --write` vetëm pasi të provohet se **çdo kuadër golden që ndryshon jep pikselë identikë** (rasterizimi `resvg` i vjetër dhe i ri, bajt për bajt). Rishkrimi kërkon miratimin tënd.
- **(b)** Numëruesi mbetet vetëm në rrugën e vjetër deri në E1.5, kurse renderer-i jep id deterministe. Golden-i nuk preket, por numëruesi global mbijeton deri në E1.5.

**B2. Captions te një paketë `flat` (fixture-i B `prisoner-cell`).** Fixture-i ka captions. I vetmi vizatim captions që ekziston në Engine është ai i W0. Vendimi 6 e ndalon atë stil te B1–B5, që s'kanë captions, por nuk thotë asgjë për paketat e reja `flat`.

Opsionet:

- **(a)** Renderer-i vizaton captions me pamjen ekzistuese të W0 për çdo paketë që i ka. Asnjë pamje ekzistuese nuk ndryshon, por kjo është përdorim i ri i atij stili.
- **(b)** Captions hiqen nga fixture-i B `prisoner-cell`, dhe Engine-i i deklaron captions të mbështetur vetëm me projeksion `parallax`. Kjo kërkon që `capabilities().render` të shprehë këtë kufizim, pra një fushë e re në aftësi, dhe Gate-i ta zbatojë.

Nuk kam rekomandim të fortë: (a) është më i thjeshtë, (b) më konservator.

**B3. Ku zbatohet politika e sigurisë së SVG-ve.** Gate-i sot nuk e shqyrton përmbajtjen e skedarëve. Propozimi:

- **Kod i ri në Gate, `SVG_UNSAFE`** (G3), mbi bajtet e verifikuara, me listë të lejuar të rreptë. Refuzohen:
  - `<script>`, `<foreignObject>`, atributet `on*`;
  - çdo `href` / `xlink:href` që nuk fillon me `#` ose me `data:image/png|jpeg`;
  - çdo `url(...)` jashtë `#`, si dhe `@import`.
- **Ndikimi në bibliotekë:** 0 nga 669 SVG-të aktuale preken (u kontrollua).
- **Renderer-i** pranon vetëm paketa që Gate-i i ka miratuar dhe i fut bajtet vetëm si `data:` URI.
- Kjo është kontroll i ri në Gate (shtesë, jo zbutje) dhe kërkon miratimin tënd.

## Kufijtë e tjerë (për dijeni)

- **Audio:** paketa nuk ka audio (E1.2). Renderer-i i E1.4 prodhon kuadro dhe video pa zë. Zëri dhe muzika mbeten në rrugën e vjetër deri sa audio të hyjë në paketë.
- **Zhurma e encoder-it:** encoder-i i v2 shton zhurmë kohore në FFmpeg (`render.ts:74`, `noise=alls=4:allf=t`). Determinizmi dhe paritia maten në **kuadrot e papërpunuara** (SVG dhe RGBA), jo në MP4.
- **Kamera e papërpunuar** e B1–B5 dhe heqja e `legacy.ts` mbeten për E1.5.

## Kriteret e pranimit, të matshme, me baseline

| #   | Kriteri                                  | Baseline                                                                                                                                                                                                                                                                                                                                                          | Metrika                                                                                                            | Kalon kur                                                                                                                                                                           |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | B1–B5 kuadër për kuadër                  | `frameAt(composed, i, n)` i Engine-it të sotëm, në të njëjtin commit, për **6 043 kuadro** (B1 1 506, B2 1 258, B3 1 051, B4 1 016, B5 1 212)                                                                                                                                                                                                                     | barazi e tekstit SVG të kuadrit                                                                                    | 6 043/6 043 të barabarta. Pas B1(a): identike. Me B1(b): identike përveç id-ve `kt`                                                                                                 |
| K2  | Golden                                   | `film/golden/golden.json` (451: 405 hash SVG v2 + 46 hash pikselësh W0)                                                                                                                                                                                                                                                                                           | hash-i i renderer-it për të njëjtin kuadër; nëse ndryshon, PSNR kundrejt rasterizimit të vjetër                    | 451/451 identik. Ose, për çdo dallim, PSNR ≥ 50 dB dhe një listë e plotë e dallimeve (kuadri, PSNR, pikselët që ndryshojnë)                                                         |
| K3  | W0 ruan pamjen                           | 46 kuadrot golden të W0, plus çdo i 10-ti kuadër i W0 (136) i renderuar nga rruga e sotme                                                                                                                                                                                                                                                                         | hash-i i pikselëve; PSNR nëse ndryshon                                                                             | 182/182 identikë, ose PSNR ≥ 50 dB me listë dallimesh                                                                                                                               |
| K4  | Fixtures B renderohen nga paketa         | Nuk ka baseline vizual të mëparshëm (janë paketa të reja). Baseline-i krijohet: (i) renderim i plotë pa gabim (`prisoner-cell` 240 kuadro, `office-clock` 150); (ii) çdo kuadër përmban vizatimin e çdo nyjeje të dukshme, të rindërtuar me funksionet e Engine-it; (iii) një contact sheet për miratimin tënd vizual, që pas miratimit bëhet golden i fixtures B | (i) gabime; (ii) përmbajtja e SVG-së; (iii) hash-et pas miratimit                                                  | (i) 0 gabime; (ii) 390/390; (iii) pas miratimit, testi krahason hash-et                                                                                                             |
| K5  | Paketa e refuzuar nuk prodhon kuadro     | 48 paketat e prishura të E1.3 + 1 me `EASE_UNDEFINED`                                                                                                                                                                                                                                                                                                             | gjetjet e `renderPackage` = gjetjet e `validate()`; numri i kuadrove të shkruara; a nisi encoder-i                 | 49/49: gjetje të barabarta, 0 kuadro, encoder-i nuk niset                                                                                                                           |
| K6  | Pa varësi nga planner, script apo Stager | —                                                                                                                                                                                                                                                                                                                                                                 | importet tranzitive të renderer-it (graf i ndërtuar nga burimi)                                                    | asnjë import i `planner`, `stager`, `ai-worker`, `timing.ts`, `perform.ts`, `continuity.ts`, `director`, script-it apo i `film.json`; asnjë lexim i filesystem-it përtej `verified` |
| K7  | Determinizmi                             | —                                                                                                                                                                                                                                                                                                                                                                 | hash-et e kuadrove nga dy procese të ndara: 451 kuadrot golden + të gjithë kuadrot e fixtures B                    | identikë                                                                                                                                                                            |
| K8  | Evaluatori i pastër                      | —                                                                                                                                                                                                                                                                                                                                                                 | test kufiri në `contracts` (importet, `node:fs`, `Date`, `Math.random`) dhe testet unitare të E1.2, të zhvendosura | kalojnë                                                                                                                                                                             |
| K9  | Pa regresion                             | golden 451/451 i rrugës së sotme (pas B1, sipas opsionit); 588 testet ekzistuese                                                                                                                                                                                                                                                                                  | —                                                                                                                  | testet, typecheck, lint, format kalojnë; `contracts:gen --check` pa diff                                                                                                            |

Pas vendimeve për B1, B2 dhe B3 implementoj E1.4 në këtë branch dhe ndalem te commit-i dhe raporti për review, pa merge.
