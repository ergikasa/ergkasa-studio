# E1.4: Engine-i lexon Render Package-in (raporti përfundimtar)

|         |                                                                                                                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch  | `e1-4-engine-reads-package` (nuk është bërë merge në `main`; `main` mbetet `7f8ffca`)                                                                                                                     |
| Scope   | `docs/plans/e1-4-engine-reads-package-scope.md` @ `eda5ab5`, me vendimet e PO-së gjatë implementimit (§3 më poshtë)                                                                                       |
| Statusi | K1–K9 kalojnë. K4 (iii) u miratua nga PO-ja më 2026-11-17. Boshllëku i auditimit (§5.2) u mbyll me capabilities v2 dhe G16 (§5b). Pret review-n përfundimtare. Pipeline-i i ri nuk është vënë si default. |
| Data    | 2026-11-17                                                                                                                                                                                                |

## 1. Çfarë u ndërtua

- **Evaluatori i vetëm** është te `contracts/src/evaluate.ts`: i pastër, me çelësa vetëm `linear`/`hold` (`DEFINED_EASES`). Stager-i, Gate-i dhe renderer-i e importojnë nga `@erkasa/contracts`.
- **Gate-i** ka dy kontrolle të reja:
  - `EASE_UNDEFINED`;
  - `SVG_UNSAFE`, me `saxes` 6.0.0 si varësinë e vetme të re: version i fiksuar, pa DTD, pa entitete, ndalon te problemi i parë.
- **Id-të e `kineticType` janë deterministe.** Nuk ka më numërues global: v2 përdor `kt-<shot>`, W0 `kt-w0-<shot>` dhe renderer-i `kt-<skena>-<nyja>-<rreshti>`.
- **Modulet e vizatimit kanë hyrje të qarta**, dhe i përdorin të dyja rrugët:
  - `v2frame.ts`: pamjet e kamerës, scrim-et, OTS, tranzicionet, kuadri;
  - `raster.ts`: resvg, vetëm me fontet e Engine-it;
  - `w0/compositor.ts`: kompozitori i W0, si funksion i një `W0View`.
- **Renderer-i** (`film/src/package/`) ka dy hyrje, `openPackage` dhe `renderPackage`:
  - Gate-i ekzekutohet i pari.
  - Paketa e refuzuar kthen vetëm gjetjet e Gate-it: asnjë kuadër, asnjë encoder.
  - Paketa e pranuar vizatohet vetëm nga dokumentet dhe bajtet që verifikoi Gate-i.
  - Video del pa zë (`ffmpegSink`, `-an`).

## 2. Kriteret K1–K9

|        | Kriteri                              | Rezultati                                                                                                                                                                                                                                                                                                                                                                                                                                   | Prova                                                                                         |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **K1** | B1–B5 kuadër për kuadër              | **6 043/6 043**: SVG e renderer-it = `frameAt` pas normalizimit të id-ve `kt`; asgjë mbi vinjetë (pa captions)                                                                                                                                                                                                                                                                                                                              | `film/test/package/k1.test.ts`                                                                |
| **K2** | Golden                               | Rruga e vjetër, pas heqjes së `clipSeq`: **451/451** (`pnpm --filter @erkasa/film golden`). Renderer-i: **451/451** (`golden:package`). Në të dyja: 265 kuadro v2 me tekst SVG identik me historikun; **140** ndryshojnë vetëm te id-të, me SVG të normalizuar dhe piksele identike me provat; 46 W0 me piksele = `golden.json`. `golden.json` ka 0 bajt të ndryshuar. Lista e 140 kuadrove: `film/golden/golden-package.json` → `idsOnly`. | `golden-evidence.ts --verify`, `test/package/golden-package.ts`                               |
| **K3** | W0 ruan pamjen                       | **136/136** kuadro me piksele identike te renderer-i (bashkimi i 46 kuadrove golden me çdo të 10-in kuadër; shih §3.11 për pse jo 182)                                                                                                                                                                                                                                                                                                      | `golden-package.ts`                                                                           |
| **K4** | Fixtures B                           | (i) **0 gabime**: 240 + 150 kuadro të renderuara dhe të rasterizuara. (ii) **390/390**: çdo nyje e dukshme dhe çdo person janë në SVG; çdo nyje vizaton diçka në ndonjë kuadër; captions vetëm në kuadrot 161–233 të `prisoner-cell` (fraza 5,35–7,8 s). (iii) **Miratuar nga PO-ja (2026-11-17)**: `docs/reports/e1-4/fixtures-b-contact-sheet.png`; baseline-i `film/golden/golden-fixtures-b.json` (390 kuadro, sha256 `6bf6927a…`).     | `k4.test.ts`, `contact-sheet.ts`                                                              |
| **K5** | Paketa e refuzuar nuk prodhon kuadro | **50/50**: gjetjet e `renderPackage` = `validate()` (gabime dhe paralajmërime); 0 kuadro; `begin` i sink-ut nuk thirret, pra encoder-i nuk niset                                                                                                                                                                                                                                                                                            | `k5.test.ts` (të njëjtat 50 raste si `gate/test/negative.test.ts`, nga `gate/test/broken.ts`) |
| **K6** | Pa planner, script apo Stager        | Grafi tranzitiv (vetëm importet në ekzekutim) arrin vetëm `contracts`, `engine`, `film` dhe `gate`. Asnjë `planner`, `stager`, `ai-worker`, `timing.ts`, `perform.ts`, `continuity.ts`, `compose.ts`, `w0/composer.ts` apo director. Modulet e renderer-it nuk importojnë `node:fs`. Pas verifikimit, skedarët në disk zëvendësohen me vizatim tjetër dhe kuadrot nuk ndryshojnë.                                                           | `test/package/boundary.test.ts`                                                               |
| **K7** | Determinizmi                         | **931/931** hash identikë në dy ekzekutime të ndara, çdo pjesë në procesin e vet: 405 v2 + 136 W0 + 390 fixtures B (kuadro të ndryshëm; 46 kuadrot golden të W0 janë brenda të 136-ve)                                                                                                                                                                                                                                                      | `golden:package` kundrejt `golden-package.json`                                               |
| **K8** | Evaluatori dhe siguria e SVG-ve      | Testi i kufirit të evaluatorit + testet e zhvendosura kalojnë. `SVG_UNSAFE`: **677/677** SVG të bibliotekës pranohen pa ndryshim; 6 raste pozitive; 20 raste negative refuzohen me shtegun e saktë; ndalim te problemi i parë                                                                                                                                                                                                               | `contracts/test/evaluate*.test.ts`, `gate/test/svg.test.ts`, `negative.test.ts`               |
| **K9** | Pa regresion                         | **688 teste kalojnë** (588 para E1.4): contracts 226, gate 134, film 150, stager 70, ai-worker 35, compiler 28, engine 23, engine-worker 16, planner 6. Typecheck, lint dhe format pa gabime. `contracts:gen --check` pa diff. `golden.json` pa ndryshim.                                                                                                                                                                                   | `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`                               |

## 3. Devijimet nga scope-i (të gjitha të raportuara gjatë punës)

1. **Testi i kufirit të film-it.** "Lexues i script-it" u përkufizua si skedar që importon kontratën `Script`, jo çdo import i `@erkasa/contracts`. `golden-evidence.ts` iu shtua listës së ngrirë.
2. **SVG-të e bibliotekës janë 677, jo 669** (glob më i ngushtë te scope-i).
3. **Rifiksimi i `type.kinetic` (vendim i PO-së).** Heqja e `clipSeq` ndryshon `style.ts`, pra edhe gjurmën e builtin-it. Ndryshuan vetëm të dhëna: shembulli valid `office-procedural` dhe hash-i i manifestit që fikson paketa e tij; fixtures B u rigjeneruan. Asnjë skemë nuk ndryshoi.
4. **Prerjet e W0 nisin në kohën e saktë të shot-it (vendim i PO-së).** Fade-i i W0 e mat progresin nga fillimi i saktë i shot-it (33,65036 s), jo nga kuadri i parë. Pa këtë, kuadrot 1010–1024 do të dilnin ndryshe. Kjo ndryshon vetëm daljen e Stager-it për W0; testi provon që çdo kuadër i caktohet të njëjtit shot dhe merr kohën lokale bit për bit.
5. **Gjurmët ndjekin kodin.** `overlay.scrim` dhe `overlay.ots` → `v2frame.ts`; `type.w0` → `w0/compositor.ts`.
6. **Testet e Stager-it që ekzekutonin tekstin e `composer.ts`** tani krahasojnë `viewOf` me paketën: objektet, njerëzit, blur-et dhe rregullin e blur-it të largët.
7. **Varësitë.** `film` varet nga `@erkasa/gate`; testet e `film` nga `@erkasa/stager`. Gate-i ka tashmë `film` si devDependency, që krijon një cikël vetëm në nivel testesh; pnpm i ekzekuton pa paralajmërim.
8. **Mbrojtja e resvg për asetet nga skedari.** resvg 2.6 dështon (panic) me qelinë e burgut, që ka drejtkëndësha me opacitet jashtë viewBox-it. Renderer-i aplikon mbi tekstin e asetit `safeOpacity` (mbrojtjen që `rasterize` aplikon tashmë çdo kuadri), para se ta futë si `data:` URI. Bajtet e verifikuara dhe skedarët e bibliotekës nuk preken.
9. **Fontet për Skia.** Renderer-i i regjistron vetë fontet e Engine-it, siç bën CLI-ja e W0, sepse tipi dhe captions e W0 vizatohen si SVG nga Skia.
10. **Captions në skenat flat vizatohen mbi vinjetë**, si te W0, nëpërmjet `v2Frame(…, over)`. `style.ts` nuk preket.

11. **K3 ka 136 kuadro, jo 182.**
    - Kuadrot golden të W0 janë në çdo sekondë të plotë (kuadrot 0, 30, …, 1350). Të gjithë janë shumëfisha të 10-ës, pra janë tashmë brenda 136 kuadrove çdo të 10-të (0, 10, …, 1350).
    - "182" në scope-in `eda5ab5` i numëronte dy herë (46 + 136); bashkimi ka 136 kuadro të ndryshëm.
    - Asnjë kuadër nuk u hoq. E njëjta korrigjim vlen edhe për metrikën e K7 (931 kuadro të ndryshëm).
    - Vërtetuar nga `golden-evidence.json`: 136 kuadro W0, të gjithë shumëfisha të 10-ës, 46/46 golden brenda tyre. Scope-i u korrigjua me shënim të datuar.

## 4. Sjellje e Engine-it që paketa nuk e mbart (e dokumentuar te `package/draw.ts`)

- Builtin-et vektoriale vizatojnë në koordinatat e skenës; vendosja e nyjes (x, y, scale) nuk u aplikohet atyre, sepse Stager-i i shkruan neutrale.
- Kanalet e rig-ut pa track marrin pozën `STANDING`; glow 0; vendosja x 0, y 0, facing 1, turn 1, scale 1.
- Një skenë me nyje `template.*` shihet me kamerën editoriale, çdo skenë tjetër flat me kamerën e set-it. Skena `parallax` është vendi i W0.
- Captions hyjnë për 0,12 s, me opacitete 0,6/0,9.

## 5. Kriteret dhe kufijtë e pambyllur

1. **K4 (iii): miratuar nga PO-ja më 2026-11-17.**
   - Contact sheet-i i `prisoner-cell` dhe `office-clock` u miratua vizualisht.
   - `golden-fixtures-b.pending.json` u riemërtua në `golden-fixtures-b.json` pa asnjë ndryshim: sha256 `6bf6927a8e16cc9ab95634a891b974e433cc767f34625e088fb285631a068f7d`, para dhe pas.
   - Pas miratimit nuk ndryshoi asnjë renderim. Kontrolli i rishtuar (`golden:package`) dha K2/K3 me 0 dështime dhe K7 **931/931** kundrejt baseline-ve të miratuara.
   - Contact sheet-i dhe të dy baseline-t (`golden-package.json`, `golden-fixtures-b.json`) ruhen si evidencë e E1.4. `golden-package.ts --write` tani refuzon t’i rishkruajë.
2. **Auditimi i Gate-it (kërkesa e PO-së, 2026-11-17).**
   - **Pyetja:** a vizatohet çdo paketë që Gate-i pranon?
   - **Metoda:** 16 paketa, secila me një ndryshim mbi bazën e testeve negative të Gate-it (B3 + karrigia nga skedar) ose mbi W0. Gate-i u ekzekutua me `capabilities()` e Engine-it. Çdo paketë e pranuar u renderua kuadër për kuadër (për `parallax`: kuadri i parë i çdo prerjeje dhe çdo i 3-ti kuadër tranzicioni).
   - **Riprodhim:** `node --expose-gc --import tsx film/test/package/gate-audit.ts [indeksi]`.

   **A. Gate-i pranon, renderer-i dështon gjatë renderimit (10 raste).**

   | #   | Paketa                                                                                    | Gabimi i renderer-it                                                          |
   | --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
   | A1  | Gjendje aseti si element i skedarit kryesor (`element: "seat"`; elementi as nuk ekziston) | `state 'default' is an element of prop_chairfile@1's file`                    |
   | A2  | Nyje jo-W0 në skenë `parallax`                                                            | `'set.room.back' is not drawn in a parallax scene`                            |
   | A3  | Tranzicion flat → `parallax`                                                              | `a parallax scene enters only by cut or dissolve from another parallax scene` |
   | A4  | `whip` në `parallax` (W0)                                                                 | e njëjta si A3                                                                |
   | A5  | Tranzicion `parallax` → flat (W0, skena 2 flat)                                           | `'w0.sky' is not drawn in a flat scene`                                       |
   | A6  | Builtin i W0 në skenë flat                                                                | `'w0.sky' is not drawn in a flat scene`                                       |
   | A7  | Skenë `parallax` pa shtresën `mid` të W0                                                  | `a parallax scene needs W0's mid layer`                                       |
   | A8  | Parametër-kanal i deklaruar pa track (`set_back` `param.t`)                               | `0 tracks for node:set_back:param.t`                                          |
   | A9  | Kamera pa track-un e `height`                                                             | `0 tracks for camera::height`                                                 |
   | A10 | Rig me burim skedar, jo builtin                                                           | `rig_cutout_man@1 is not a builtin rig`                                       |

   **B. Gate-i pranon, renderer-i vizaton pa gabim, por jo atë që thotë paketa** (nga leximi i kodit të renderer-it; B1 edhe e provuar):

   | #   | Fusha e kontratës                                                  | Çfarë bën renderer-i                                                                                           |
   | --- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
   | B1  | `captions.style.align` (`left`/`right`) dhe `maxWidth`             | i injoron; captions dalin gjithmonë në qendër (u provua: W0 me `align: "left"` renderohet pa gabim, në qendër) |
   | B2  | `layer.blur` dhe `camera.aperture` në skena flat                   | i injoron (pa blur)                                                                                            |
   | B3  | Renditja e aktorëve sipas `y` midis nyjeve të së njëjtës shtresë   | vizaton nyjet pastaj aktorët (pa problem te B1–B5: shtresat e aktorëve nuk kanë nyje)                          |
   | B4  | `x`, `y`, `scale`, `rotation`, `opacity`, `flip` të nyjeve builtin | i injoron (dokumentuar në §4)                                                                                  |
   | B5  | `camera.referenceDistance` dhe `dolly` në `parallax`               | kompozitori i W0 përdor konstantet e veta (paketat e W0 i shkruajnë me të njëjtat vlera)                       |

   **C. Gate-i refuzon saktë (5 raste):** pivot i padeklaruar (`PIVOT_UNDECLARED`), gjendje e padeklaruar (`STATE_UNDECLARED`), skenë e munguar në edit (`EDIT_SCENE`), font që nuk është font (`ASSET_KIND`), parametër statik i munguar (`PARAM_MISSING`).

   **Korrigjim (2026-11-17).** Nga 16 rastet e `gate-audit.ts`, 11 kalojnë Gate-in: 10 dështojnë gjatë renderimit (A1–A10) dhe 1 renderohet gabim (`align: "left"`, B1). 5 refuzohen saktë. Versioni i mëparshëm shkruante "6 refuzohen": i gjashti (`TARGET_MISSING`) ishte një variant i parë i rastit A7 që nuk është në skript. Scope-i `docs/plans/e1-4-gate-executability-scope.md` përdor numërimin e korrigjuar.

   **Përfundimi.**
   - K5 kalon, por mat vetëm drejtimin "paketa e refuzuar → asnjë kuadër". Drejtimi tjetër, "paketa e pranuar → vizatohet ashtu si thotë", **nuk plotësohet** për rastet A1–A10 dhe B1–B5.
   - **Shkaku:**
     - `RenderCapabilities` i përshkruan aftësitë si lista të pavarura. Nuk mund të thotë që gjendjet-element nuk vizatohen, që `parallax` = vetëm bota e W0, që tranzicioni varet nga projeksionet e të dy skenave, që rig-u duhet të jetë builtin, apo cilat fusha stili/kamere mbështeten.
     - Gate-i nuk kërkon track për çdo kanal që një builtin dhe kamera lexojnë.

   **Ndryshimi minimal që propozoj (i paimplementuar; zgjeron kontratën `RenderCapabilities` dhe kërkon vendimin tënd).** Gate-i i refuzon para renderimit, me kode dhe shtigje të sakta:

   | Raste      | Ndryshimi                                                                                                                                                         | Kodi dhe shtegu                                                                                                   |
   | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
   | A1         | `capabilities.stateSources: ["source"]`                                                                                                                           | `CAPABILITY_MISSING` te `manifest:/assets/i/states/j/element`                                                     |
   | A1         | Gate-i kontrollon që elementi ekziston në skedarin kryesor                                                                                                        | `REF_MISSING`, i njëjti shteg                                                                                     |
   | A2, A6, A7 | `capabilities.projectionRules`: për çdo projeksion, builtin-et e lejuar dhe shtresat e detyrueshme (`parallax` = `w0.*` + `prop.*` + `type.w0`; `flat` pa `w0.*`) | `CAPABILITY_MISSING` te `package:/scenes/i/layers/j/nodes/k/asset`; `LAYER_MISSING` te `package:/scenes/i/layers` |
   | A3, A4, A5 | `projectionRules.<p>.enter` dhe `enterFrom`                                                                                                                       | `CAPABILITY_MISSING` te `package:/edit/i/enter/kind`                                                              |
   | A8, A9     | Gate-i kërkon track për çdo kanal që lexohet: parametrat-kanal të builtin-it dhe `x`/`y`/`height` të kamerës                                                      | `TRACK_MISSING` te `package:/scenes/i/tracks` (me nyjen dhe kanalin në mesazh)                                    |
   | A10        | Rig-u duhet të ketë burim builtin për `rigFormats` e Engine-it                                                                                                    | `CAPABILITY_MISSING` te `manifest:/assets/i/source`                                                               |
   | B1–B5      | `capabilities` deklaron vlerat e mbështetura (p.sh. `captionAlign: ["center"]`, pa `maxWidth`, `layerBlur: false` për flat…)                                      | `CAPABILITY_MISSING` te fusha përkatëse; alternativa është që renderer-i t’i mbështesë (E1.5)                     |

   Rastet A1–A10 dhe B1 shtohen te testet negative të Gate-it dhe te K5. Për çdo paketë që Gate-i pranon, shtohet edhe një test i kundërt: "renderohet pa gabim".

3. Kamera e papërpunuar e B1–B5 dhe heqja e `legacy.ts` (me kopjet e Stager-it): E1.5, siç ishte planifikuar.
4. Pipeline-i i ri nuk është default. Audio mbetet në rrugën e vjetër.

## 5b. Gate PASS ⟹ renderer-i ekzekuton (capabilities v2, G16)

Implementuar sipas scope-it `docs/plans/e1-4-gate-executability-scope.md`, të miratuar me kushtet A–F dhe me vendimet V1 (a), V2 (a) dhe V3. Skemat e paketës dhe të manifestit, renderer-i, golden-at dhe baseline-t nuk u ndryshuan.

### Capabilities v2 (`erkasa.capabilities/2`)

| Pjesa              | Vlera që publikon Engine-i                                                                                                                                                                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dalja              | 1080×1920, 30 FPS, pa audio                                                                                                                                                                                                                                                                                                                                  |
| `flat`             | bota: `set.*`, `prop.*`, `template.*`, skedarë; ekrani: `type.kinetic`, `overlay.scrim`, `overlay.ots`. Kamera: track-e `x`, `y`, `height`; aperture 0; `referenceDistance`/`dolly` pa efekt sipas kontratës; skenat me `template.*` me qendër x = 540. Shtresat: blur 0, `lit` false. Aktorët: rim/shadow false.                                            |
| `parallax`         | bota: `w0.*`, `prop.*`; ekrani: `type.w0`. Kamera: aperture 0, `referenceDistance` 2140, `dolly` 0,55. Rolet: `sky`, `city`, `city_near`, `wall`, `mid` (të detyrueshme), `near`, `actors`, `held`, me blur, depth dhe `lit` sipas rolit. Gjendja e vendit lexohet nga `sky`, bota nga `wall`; nyjet e tjera duhet t'i përsërisin. Aktorët: rim/shadow true. |
| Tranzicionet       | `cut` midis çdo projeksioni; `dissolve` flat→flat dhe parallax→parallax; `whip` flat→flat                                                                                                                                                                                                                                                                    |
| Event-et, contacts | vetëm dukshmëri (`fx: none`, `duration: 0`); asnjë ndërrim gjendjeje; asnjë contact                                                                                                                                                                                                                                                                          |
| Captions           | pozicion në ekran (skema), `center`, pa `maxWidth`; semantika e publikuar: hyrje 0,12 s, opacitetet 0,6 dhe 0,9, mbi vinjetë                                                                                                                                                                                                                                 |
| Asetet             | llojet vector, rig, font; gjendjet me burim të vetin; rig-e dhe fonte vetëm builtin                                                                                                                                                                                                                                                                          |
| Builtin-et         | vendosja që zbatojnë (props: `x`, `y`; të tjerët: asnjë); rig: poza e pushimit (`STANDING`, glow 0, root 0/0/1, facing 1, turn 1) dhe lartësia (780,768…)                                                                                                                                                                                                    |
| Fushat             | klasa e secilës nga 243 fushat e skemave                                                                                                                                                                                                                                                                                                                     |

### Klasifikimi i 243 fushave

| Skema                  | applied | restricted | refused | validated | metadata |
| ---------------------- | ------- | ---------- | ------- | --------- | -------- |
| `render-package` (180) | 40      | 36         | 86      | 16        | 2        |
| `asset-manifest` (63)  | 18      | 6          | 3       | 22        | 14       |

- Lista e plotë, me semantikën ose rregullin e secilës fushë, është te Shtojca 1 e scope-it.
- Nuk ka klasë "injorohet".
- `gate/test/fields.test.ts` i lexon fushat nga skemat JSON në kohën e testit. Dështon për:
  - çdo fushë pa klasë;
  - çdo klasë pa fushë;
  - çdo fushë `restricted`/`refused` pa rastin e vet negativ.

### Testet negative (K5 i ri)

**103 paketa të refuzuara:**

- 48 të E1.3;
- `EASE_UNDEFINED` dhe `SVG_UNSAFE`;
- 16 të auditimit (R1–R16, siç ishin);
- 37 me një defekt (G16).

Për secilën:

- lista e plotë e gjetjeve (kod + shteg) është e barabartë me pritjen;
- `renderPackage` = `validate()`;
- **0 kuadro**;
- `begin`, `frame` dhe `end` të sink-ut nuk thirren, pra encoder-i nuk niset.

Të 11 paketat e auditimit që kalonin më parë tani refuzohen.

### Testet pozitive

- **P1/P3:** tetë paketat kalojnë Gate-in pa asnjë gjetje dhe renderohen.
  - Flat: çdo kuadër.
  - Parallax: kuadri i parë i çdo prerjeje dhe çdo kuadër tranzicioni.
- **P2:** një `cut` midis një skene flat dhe një skene W0, në të dy drejtimet, kalon dhe renderohet.
- **P5:** vlerat e capabilities provohen kundrejt kodit:
  - madhësia e daljes;
  - `REF.height` dhe `GAMMA`;
  - qendra editoriale;
  - konstantet e captions;
  - poza e pushimit dhe lartësia e rig-ut;
  - vendosja.

  Dokumentet v1 dhe ato të prishura refuzohen.

- **T9:** renderer-i nuk lexon asnjë fushë `refused`, `validated` ose `metadata`.
- **V2 (`bounds`):**
  - 12 teste të pastra mbi `cameraViews`:
    - sample i vetëm jashtë;
    - sample-i i fundit;
    - overshoot i ruajtur;
    - `linear` brenda;
    - `hold` jashtë;
    - fundi i kapur;
    - track-e të përziera;
    - prekje e saktë kundrejt një hapi brenda;
    - `enclose`.
  - Në Gate:
    - kufijtë që prekin saktësisht pamjen pranohen për skenë set, editoriale dhe W0;
    - një hap float brenda refuzohet (V2a–V2c).

### Provat e identitetit vizual (pas të gjitha ndryshimeve)

| Prova                                                         | Rezultati                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| K1: B1–B5 nga paketa kundrejt `frameAt`                       | 6 043/6 043                                                                                             |
| K2/K3: renderer-i kundrejt `golden.json` dhe provave          | 0 dështime (405 v2, nga të cilët 140 ndryshojnë vetëm te id-të; 136 W0)                                 |
| K7: kundrejt `golden-package.json` + `golden-fixtures-b.json` | **931/931** hash identikë                                                                               |
| Rruga e vjetër kundrejt provave (`pnpm golden`)               | 405 + 136, 0 dështime                                                                                   |
| Golden-at                                                     | `golden.json`, `golden-evidence.json`, `golden-package.json`, `golden-fixtures-b.json`: 0 bajt ndryshim |

`bounds` e rishkruara te B1–B5, W0 dhe prisoner-cell (prisoner-cell: `h` 1920 → 1970) nuk ndryshojnë asnjë kuadër, sepse renderer-i nuk e lexon `bounds`.

### Devijime dhe gjetje gjatë implementimit

1. **X6 hiqet.** Skema e captions e kufizon tashmë `at` në `{x, y}` (`ScreenAnchor`), kështu që captions që ndjekin një nyje nuk mund të shkruhen fare. Fushat `at.node`, `at.actor` dhe `at.offset` u përkasin overlay-ve jo-captions, që refuzohen nga lloji. Analiza ime e scope-it ishte e gabuar.
2. **Tri gjetje të reja të të njëjtit lloj, të mbyllura me të njëjtin mekanizëm, pa efekt në tetë paketat:**
   - **X11:** te skenat editoriale renderer-i injoron `camera.x`, ndaj kërkohet x = 540.
   - **X12:** kompozitori i W0 lexon gjendjen e vendit vetëm nga `sky` dhe botën vetëm nga `wall`; nyjet e tjera duhet t'i përsërisin.
   - **Y8:** props në pushim në W0 vizatohen në planin e mobiljeve, ndaj duhet të jenë te shtresa `mid`.
3. **Parametrat e aseteve.** Një parametër i asetit tani mjafton t'i përkasë njërës nga vizatimet e tij (`facing`/`rot` lexohen vetëm nga gjendja `held`). Kjo zbut rregullin e E1.3. Në vend të tij, Gate-i refuzon çdo track parametri që vizatimi i nyjes nuk e lexon (`VALUE_UNSUPPORTED` te `tracks/t/channel`). `prop.*.resting` nuk deklaron më `facing`/`rot`.
4. **Rregullat e reja shtojnë gjetje legjitime në raste ekzistuese.** E1.3: `contacts` në dy raste, track-e që mungojnë në dy raste. Fixtures A: rregullat v2. Të gjitha janë shkruar saktë te testet.
5. **K5 ka 103 raste, jo 88 të scope-it.** Gjashtë raste u shtuan që çdo fushë `restricted`/`refused` të ketë provën e vet (fps, overlay text, nyje text, dritë, format rig-u, familje fonti); tri të tjera janë rastet kufitare V2.
6. **Rasti me 24 FPS sjell edhe gjetjet `SAMPLE_RATE`,** sepse track-et janë të mostruara në 30/s. Nuk ka paketë me një defekt të vetëm për këtë rast.

## 6. Commit-et

| Commit                          | Përmbajtja                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `7f70112`, `1e3f592`, `eda5ab5` | Scope                                                                                            |
| `4e957e1`                       | (1) Provat e baseline-it nga Engine-i i pandryshuar                                              |
| `33967e0`                       | (2) Evaluatori te `contracts`                                                                    |
| `25e8290`                       | (3) Testi i kufirit të film-it                                                                   |
| `3b8ddea`                       | (4) Gate: `EASE_UNDEFINED`, `SVG_UNSAFE`, saxes 6.0.0                                            |
| `8d172bc`                       | (5) Verifikimi pa tolerancë kundrejt provave                                                     |
| `f9253eb`                       | (6) Id-të deterministe; rifiksimi i `type.kinetic`                                               |
| `fef5d3a`                       | (7) Prerjet e W0 në kohën e saktë                                                                |
| `7dac46f`                       | (8) Modulet e vizatimit me hyrje të qarta                                                        |
| `d8f225a`                       | (9) Renderer-i nga paketa + testet K1, K4, K5, K6                                                |
| `ea5cc3c`                       | (10) `golden-package.json`, hash-et pending të fixtures B, contact sheet-i                       |
| `32246a1`                       | (12) Gjetjet e para të auditimit të Gate-it; korrigjimi i numërimit te K3/K7                     |
| `d06d7bc`                       | (13) Miratimi i K4 (iii): `golden-fixtures-b.json`; auditimi i plotë i Gate-it (`gate-audit.ts`) |
| `0858fa9`, `c01981e`, `0863f46` | Scope-i i ekzekutueshmërisë (v2), kushtet A–F, V1–V3                                             |
| `e5ccb4f`                       | (14) Capabilities v2, G16, `bounds` (Stager + fixtures B)                                        |
| `91c5185`                       | (15) Testet e G16: 103 paketa të refuzuara, matrica e fushave, `bounds`                          |
| (ky commit)                     | (16) Raporti                                                                                     |

## 7. Si riprodhohet

```
pnpm test && pnpm typecheck && pnpm lint && pnpm format:check && pnpm contracts:gen --check
pnpm --filter @erkasa/film golden            # K2: rruga e vjetër kundrejt provave
pnpm --filter @erkasa/film golden:package    # K2, K3 dhe K7 për renderer-in (refuzon --write pas miratimit)
node --expose-gc --import tsx film/test/package/contact-sheet.ts out.png   # K4 (iii)
```
