# E1.4 – Engine-i lexon Render Package: scope përfundimtar (për miratim të implementimit)

|         |                                                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch  | `e1-4-engine-reads-package`, nga `cfb6a45` (fundi i `e1-3-validation-gate`)                                                                                                       |
| Data    | 2026-11-17                                                                                                                                                                        |
| Statusi | Vetëm scope. E1.3 u pranua formalisht më 2026-11-17. Vendimet 1–6 dhe B1–B3 të Product Owner-it janë futur më poshtë. **Një konflikt i mbetur (B4)** kërkon konfirmim para kodit. |
| Burimi  | Plani E0–E4 (rreshti E1); raportet E1.2 dhe E1.3; vendimet e PO-së më 2026-11-17                                                                                                  |

## Qëllimi

Rruga e re **paketë → Gate → Engine** jep të njëjtat kuadro si rruga e sotme. Rruga e sotme mbetet e paprekur në pamje dhe e paracaktuar. Kalimi i pipeline-it dhe heqja e kodit të vjetër janë E1.5.

## Vendimet dhe zbatimi

| #      | Vendimi i PO-së                                                                                                                                                                            | Zbatimi në këtë scope |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| 1      | ✅ Evaluatori i vetëm në `contracts/`, i pastër dhe determinist                                                                                                                            | §1                    |
| 2      | ✅ Track-et vetëm `linear` dhe `hold`; tranzicionet me formulat e Engine-it; `EASE_UNDEFINED`                                                                                              | §2                    |
| 3      | ✅ me kufi të rreptë: kompozuesi i W0 merr të dhëna vetëm nga paketa                                                                                                                       | §3                    |
| 4 + B1 | ✅ (a) Id deterministe sipas nyjes; golden-i historik i v2 nuk preket; golden i ri për renderer-in; identitet piksel për piksel dhe SVG e normalizuar; pa PSNR për ndryshime të shmangshme | §4, K1, K2, K9        |
| 5 + B3 | ✅ SVG nga bajtet e verifikuara; `SVG_UNSAFE` në Gate me parser XML të sigurt; pa ndryshuar 669 SVG-të ekzistuese                                                                          | §5, K5, K8; **B4**    |
| 6 + B2 | ❌ Pa stilin e W0 te B1–B5. ✅ (a) `prisoner-cell` mund të vizatojë captions me stilin ekzistues, vetëm kur janë në paketë, pa e bërë stilin e W0 të detyrueshëm                           | §6, K1, K4            |

**§1. Evaluatori** (`contracts/src/evaluate.ts`, zhvendosur nga `stager/src/evaluate.ts`)

- Funksione të pastra mbi të dhëna: pa I/O, pa orë, pa rastësi. Pa importe përveç tipeve të kontratës; pa varësi nga Engine-i, Gate-i, Stager-i apo filesystem-i.
- Stager-i, Gate-i dhe renderer-i e importojnë nga `@erkasa/contracts`. Nuk mbetet asnjë kopje tjetër.
- Skemat nuk ndryshojnë: `contracts:gen --check` pa diff.

**§2. Easing-u dhe tranzicionet**

- **Evaluatori:** për çelësat, vetëm `linear` dhe `hold`; çdo emër tjetër hedh gabim.
- **Gate-i:** `EASE_UNDEFINED` me shtegun `/scenes/<i>/tracks/<j>/keys/<k>/ease`.
- **Pasojë e njohur:** fixtures A të kontratës përdorin `easeInOut`, ndaj lista e gjetjeve me të cilat refuzohen rritet. Kjo përditësohet në `films.test.ts`.
- **Tranzicionet:** `dissolve` dhe `whip` me formulat e `compose.ts:356–362` (`EASES.io`), plus fade-i 0,5 s i W0. Publikohen në `capabilities().render` dhe testohen numerikisht kundrejt `frameAt`.

**§3. W0 vetëm nga paketa**

| Hyrja sot (`w0/composer.ts`)                                          | Burimi në paketë                                                              |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `P.state(T, door, light)` → `t, light, door, lamp, clockMin, binders` | kanalet `param.*` të nyjeve të botës (E1.2: të barabarta bit për bit)         |
| `P.plan.world`, `P.plan.world.seed`                                   | parametrat statikë `world` / `seed`                                           |
| `ps.cam(t)`                                                           | kamera `x`, `y`, `height`                                                     |
| `ps.perf`                                                             | aktorët; nyjet e objekteve me dukshmëri                                       |
| blur-i (`dof`, `framing`, `onWall`)                                   | `layer.blur`                                                                  |
| `ps.w.near`                                                           | prania e shtresës `near`                                                      |
| teksti, `textAt`, `textOut`                                           | `params` e nyjes `type` + `param.t`                                           |
| `P.captions`                                                          | `overlays` të tipit `captions`                                                |
| grain-i: `floor((ps.start + t) · 24) % 4`                             | `param.t` e botës, që është saktësisht `ps.start + t`                         |
| fade-i 0,5 s                                                          | `edit[].enter = dissolve 0.5`                                                 |
| harta e dritës, hija, rim, rrezja, bloom, vinjeta                     | llogariten nga gjendja e vendit dhe konstantet e Engine-it (`lightKinds: []`) |

- Kompozimi i W0 dhe pjesët e vizatimit të v2 (`frame()`, `SCRIMS`, OTS, scrim) nxirren në module me hyrje të qarta, që nuk importojnë plan, timing, perform, continuity, script apo Stager. Rruga e sotme thërret të njëjtat module.
- Testi i kufirit ndjek importet tranzitive.
- Nëse del një hyrje që nuk është në paketë, ndalem dhe e raportoj.

**§4. Id-të e `kineticType`** (vendimi 4 + B1a)

- `clipSeq` (`style.ts:64`, `:120`) hiqet. `kineticType` merr identitetin nga thirrësi:
  - renderer-i: `kt-<skena>-<nyja>-<rreshti>`;
  - rruga e sotme: identitet determinist nga indeksi i shot-it, për të njëjtin kuadër.
- **Golden-i historik i v2** (`film/golden/golden.json`, 405 hash të tekstit SVG) **nuk ndryshohet asnjëherë**. Mbetet baseline historik.
- **Provat e baseline-it** (`film/golden/golden-evidence.json`, e re). Kapen **para çdo ndryshimi kodi**, në commit-in `1e3f592` (Engine-i i njëjtë me `cfb6a45`). Për secilin nga 451 kuadrot golden:
  - (i) hash-i i tekstit SVG, që duhet të jetë i barabartë me golden-in historik; skripti e verifikon;
  - (ii) hash-i i SVG-së së normalizuar;
  - (iii) hash-i i pikselëve RGBA të rasterizimit (`resvg` për v2; pikselët ekzistues për W0).
- **Normalizimi:** çdo `id` i krijuar nga `kineticType` (forma e vjetër `kt\d+` dhe e reja `kt-…`) dhe çdo referencë e tij (`url(#…)`, `href="#…"`, `clip-path`) zëvendësohet me `kt#n`, sipas rendit të shfaqjes së parë në kuadër. Asgjë tjetër nuk preket.
- **Golden-i i ri i renderer-it** (`film/golden/golden-package.json`, i ri): hash-et e tekstit SVG dhe të pikselëve të renderer-it me id deterministe, për 451 kuadrot. Krijohet vetëm pasi kalojnë K1–K3. Kontrollet e mëvonshme të renderer-it krahasohen me të.
- **Metoda e krahasimit për çdo kuadër me ndryshim në SVG:** SVG e normalizuar e re = (ii), **dhe** pikselët e rinj = (iii), bajt për bajt. Çdo ndryshim vizual e rrëzon testin. PSNR nuk përdoret për të justifikuar dallime.

**§5. Asetet nga skedari dhe siguria e SVG-ve** (vendimi 5 + B3)

- Renderer-i merr vetëm `verified.files`, bajtet që Gate-i hash-oi. Nuk rihap asnjë rrugë.
- SVG futet si `data:` URI te nyja, sipas `geometry`. `resvg` dhe Skia konfigurohen pa direktori burimesh dhe pa ngarkim burimesh të jashtme.
- **`SVG_UNSAFE` në Gate (G3),** mbi bajtet e verifikuara, me **parser XML** (jo regex si mekanizëm kryesor). Refuzohen:
  - `DOCTYPE`, `ENTITY` dhe çdo DTD; entitetet e jashtme dhe të brendshme përveç pesë të paracaktuarave të XML;
  - instruksionet e përpunimit përveç deklaratës `<?xml …?>`, përfshirë `xml-stylesheet`;
  - `<script>`, `<foreignObject>`, atributet `on*`;
  - çdo `href` / `xlink:href` / `src` që nuk është referencë e brendshme `#id`, përfshirë `data:`, `http:`, `file:` dhe rrugët;
  - te `style` (atribut ose element): `@import`, `url(...)` që nuk është `url(#id)`, `expression(`, `javascript:`.
- **Lejohen** referencat e brendshme (`url(#clip)`, `href="#grad"`) **vetëm kur `id`-ja ekziston në të njëjtin dokument**; një referencë e brendshme pa objektiv refuzohet.
- **Biblioteka:** 669 SVG-të ekzistuese nuk ndryshohen. Një test i kalon të gjitha nëpër `SVG_UNSAFE` dhe pret zero refuzime. Kontrolli paraprak me regex gjeti 0 konstrukte të rrezikshme; parser-i do ta konfirmojë.

**§6. Captions** (vendimi 6 + B2a)

- Renderer-i vizaton captions **vetëm kur paketa ka overlays `captions`**.
- B1–B5 nuk kanë (Stager-i shkruan `overlays: []`). K1 provon se kuadrot e tyre nuk përmbajnë asnjë shenjë captions dhe se pamja e tyre nuk ndryshon.
- Stili **nuk është i ngulitur**: fonti, madhësia, ngjyra, stroke, theksi dhe pozicioni lexohen nga `style`, `at` dhe `highlight` e overlay-t. Pamja e W0 del sepse paketa e W0 dhe `prisoner-cell` mbartin vlerat e W0, jo sepse Engine-i i imponon.
- Mbeten sjellje e Engine-it, e njëjtë me kodin e sotëm: hyrja 0,12 s dhe opacitetet 0,6/0,9. Dokumentohen në `capabilities().render`.

## Konflikt i mbetur

**B4. Parser-i XML dhe kufiri i varësive të Gate-it.** Vendimi E1.3 është që `gate/` të varet **vetëm** nga `@erkasa/contracts` (testi i kufirit e kontrollon). B3 kërkon një parser XML të sigurt, që Node nuk e ka të integruar.

Opsionet:

- **(a) E rekomanduar:** lejohet **një** varësi e vetme, e fiksuar në version, e shqyrtuar: `saxes`. Parser streaming pa DOM. Nuk zgjeron entitete të jashtme; DTD-të i raporton si ngjarje që Gate-i i refuzon. Testi i kufirit përditësohet në `["@erkasa/contracts", "saxes"]`.
- **(b)** Gate-i shkruan parser-in e vet minimal të XML-së. Pa varësi, por me kod parsimi të ri dhe më të rrezikshëm për t'u mirëmbajtur.

Nuk e zgjedh vetë, sepse prek një vendim të pranuar të E1.3.

## Kufijtë e tjerë (për dijeni)

- **Audio:** paketa nuk ka audio. Renderer-i prodhon kuadro dhe video pa zë; zëri dhe muzika mbeten në rrugën e vjetër.
- **Encoder-i i v2** shton zhurmë kohore në FFmpeg (`render.ts:74`). Paritia dhe determinizmi maten në **kuadrot e papërpunuara** (SVG dhe RGBA), jo në MP4.
- **Kamera e papërpunuar** e B1–B5 dhe heqja e `legacy.ts`: E1.5.

## Kriteret e pranimit K1–K9

**Rregull i përbashkët:** çdo kuadër krahasohet për identitet. PSNR nuk është kriter kalimi. Ai raportohet vetëm si diagnostikë për një kuadër që tashmë ka dështuar.

**K1. B1–B5, kuadër për kuadër**

- **Baseline:** `frameAt(composed, i, n)` i rrugës së sotme, në të njëjtin commit, për 6 043 kuadro (B1 1 506, B2 1 258, B3 1 051, B4 1 016, B5 1 212).
- **Metrika:** SVG e normalizuar (§4) e renderer-it = SVG e normalizuar e `frameAt`; teksti jashtë id-ve `kt` identik; asnjë shenjë captions.
- **Kalon kur:** 6 043/6 043.

**K2. Golden**

- **Baseline:** (1) `golden.json` historik, i pandryshuar (451); (2) `golden-evidence.json` (§4), i kapur te `1e3f592` para kodit.
- **Metrika:**
  - për kuadrot pa tekst kinetik: hash-i i tekstit SVG = historik;
  - për kuadrot me tekst kinetik: hash-i i normalizuar = (ii) dhe hash-i i pikselëve = (iii);
  - W0: hash-i i pikselëve = historik.
  - E njëjta gjë për rrugën e sotme pas heqjes së `clipSeq` dhe për renderer-in.
- **Kalon kur:** 451/451 për të dyja rrugët. Pastaj krijohet `golden-package.json`. Lista e kuadrove ku teksti ndryshoi vetëm në id dorëzohet në raport.

**K3. W0 ruan pamjen**

- **Baseline:** 46 kuadrot golden të W0, plus çdo i 10-ti kuadër i W0 (136), të renderuar nga rruga e sotme para kodit dhe të ruajtur në `golden-evidence.json`.
- **Metrika:** hash-i i pikselëve RGBA të renderer-it.
- **Kalon kur:** 182/182 identikë.

**K4. Fixtures B renderohen nga paketa**

- **Baseline:** nuk ka baseline vizual të mëparshëm. Krijohet: (i) renderim i plotë (`prisoner-cell` 240 kuadro, `office-clock` 150); (ii) çdo kuadër përmban vizatimin e çdo nyjeje të dukshme dhe, në `prisoner-cell`, captions vetëm brenda kohëve të frazave; (iii) contact sheet për miratimin tënd, që pas miratimit bëhet golden i fixtures B.
- **Metrika:** (i) gabime; (ii) përmbajtja e SVG-së; (iii) hash-et, pas miratimit.
- **Kalon kur:** (i) 0; (ii) 390/390; (iii) pas miratimit, hash-et identikë.

**K5. Paketa e refuzuar nuk prodhon kuadro**

- **Baseline:** 48 paketat e prishura të E1.3, plus 1 me `EASE_UNDEFINED`, plus 1 me një SVG `SVG_UNSAFE` si aset skedari.
- **Metrika:** gjetjet e `renderPackage` = gjetjet e `validate()`; kuadrot e shkruara; nisja e encoder-it.
- **Kalon kur:** 50/50: gjetje të barabarta, 0 kuadro, encoder-i nuk niset.

**K6. Pa varësi nga planner, script apo Stager**

- **Metrika:** grafi i importeve tranzitive të renderer-it, i ndërtuar nga burimi; leximet e filesystem-it.
- **Kalon kur:** asnjë import i `planner`, `stager`, `ai-worker`, `timing.ts`, `perform.ts`, `continuity.ts`, `director`, script-it apo i `film.json`; asnjë lexim përtej `verified`.

**K7. Determinizmi**

- **Metrika:** hash-et e kuadrove nga dy procese të ndara: 451 kuadrot golden, 136 kuadrot shtesë të W0, të gjithë kuadrot e fixtures B.
- **Kalon kur:** identikë.

**K8. Evaluatori i pastër dhe siguria e SVG-ve**

- **Metrika:**
  - testi i kufirit të evaluatorit në `contracts` (importet, `node:fs`, `Date`, `Math.random`) dhe testet unitare të E1.2, të zhvendosura;
  - `SVG_UNSAFE`, raste pozitive: 669 SVG-të e bibliotekës, referencat e brendshme `url(#id)` dhe `href="#id"` me objektiv;
  - `SVG_UNSAFE`, raste negative, nga një për secilin: `DOCTYPE`, `ENTITY` e jashtme, `xml-stylesheet`, `<script>`, `<foreignObject>`, `onload=`, `href` i jashtëm (`http:`, `file:`, rrugë, `data:`), `@import`, `url(http…)`, `javascript:`, referencë e brendshme pa objektiv.
- **Kalon kur:** të gjitha kalojnë; 669/669 SVG pranohen pa u ndryshuar; çdo rast negativ refuzohet me `SVG_UNSAFE` dhe shtegun e saktë.

**K9. Pa regresion**

- **Baseline:** 588 testet ekzistuese; golden-i sipas K2.
- **Kalon kur:** testet, typecheck, lint dhe format kalojnë; `contracts:gen --check` pa diff; `golden.json` historik pa asnjë bajt të ndryshuar.

## Ndryshimet nga versioni i mëparshëm i scope-it (`1e3f592`)

1. B1, B2 dhe B3 u zgjidhën sipas vendimeve të PO-së dhe u hoqën si bllokues.
2. §4: shtohen golden-i historik i paprekshëm, provat e baseline-it të kapura para kodit, normalizimi i përcaktuar, golden-i i ri i renderer-it dhe metoda e krahasimit me identitet pikselësh.
3. §5: `SVG_UNSAFE` me parser XML, lista e plotë e refuzimeve (shtohen DTD/entitetet, instruksionet e përpunimit, `src`, `data:`, `javascript:`, referencat e brendshme pa objektiv), testi mbi 669 SVG-të pa i ndryshuar.
4. §6 (i ri): captions vetëm kur janë në paketë, stili lexohet nga paketa dhe nuk imponohet.
5. Kriteret:
   - PSNR hiqet si kriter kalimi kudo, sepse kërkohet identitet;
   - K1 kalon në SVG të normalizuar plus kontrollin e mungesës së captions;
   - K2 kalon në tre baseline-e;
   - K3 merr baseline të kapur para kodit;
   - K4 shton captions;
   - K5 rritet në 50 raste;
   - K8 shton testet e sigurisë së SVG-ve;
   - K9 shton paprekshmërinë e `golden.json`.
6. Shtohet B4 (parser-i XML kundrejt kufirit të varësive të Gate-it nga E1.3).

Pas konfirmimit të B4 dhe miratimit të implementimit, implementoj E1.4 në këtë branch dhe ndalem te commit-i dhe raporti për review, pa merge.
