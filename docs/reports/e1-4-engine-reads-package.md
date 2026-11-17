# E1.4: Engine-i lexon Render Package-in (raporti përfundimtar)

|         |                                                                                                                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch  | `e1-4-engine-reads-package` (nuk është bërë merge në `main`; `main` mbetet `7f8ffca`)                                                                                                                                   |
| Scope   | `docs/plans/e1-4-engine-reads-package-scope.md` @ `eda5ab5`, me vendimet e PO-së gjatë implementimit (§3 më poshtë)                                                                                                     |
| Statusi | K1, K2, K3, K5, K6, K7, K8 dhe K9 kalojnë. **K4 (iii) pret miratimin e contact sheet-it.** **Hapur:** Gate-i pranon katër lloje paketash që renderer-i nuk i vizaton (§5.2). Pipeline-i i ri nuk është vënë si default. |
| Data    | 2026-11-17                                                                                                                                                                                                              |

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
| **K4** | Fixtures B                           | (i) **0 gabime**: 240 + 150 kuadro të renderuara dhe të rasterizuara. (ii) **390/390**: çdo nyje e dukshme dhe çdo person janë në SVG; çdo nyje vizaton diçka në ndonjë kuadër; captions vetëm në kuadrot 161–233 të `prisoner-cell` (fraza 5,35–7,8 s). (iii) **Pret miratimin:** `docs/reports/e1-4/fixtures-b-contact-sheet.png`; hash-et janë te `golden-fixtures-b.pending.json`.                                                      | `k4.test.ts`, `contact-sheet.ts`                                                              |
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

1. **K4 (iii):** contact sheet-i pret miratimin. Pas miratimit, `golden-fixtures-b.pending.json` bëhet `golden-fixtures-b.json`; kontrolli K7 e përdor automatikisht.
2. **Katër kufizimet e renderer-it: Gate-i i pranon (problem kontrate, i hapur).** I verifikova më 2026-11-17 me katër paketa, secila me një ndryshim mbi bazën e testeve negative të Gate-it (B3 + karrigia nga skedar) ose mbi W0. Gate-i u ekzekutua me `capabilities()` e Engine-it:

   | Paketa                                                                                  | Gate-i           | Renderer-i                                                                                     |
   | --------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
   | Gjendje e asetit si element i skedarit kryesor (`{ name: "default", element: "seat" }`) | **ok, 0 gabime** | gabim: `chairfile: state 'default' is an element of prop_chairfile@1's file…`                  |
   | Nyje jo-W0 në skenë `parallax` (B3, `s02_sh02` me `projection: "parallax"`)             | **ok, 0 gabime** | gabim: `s02_sh02/set_back: 'set.room.back' is not drawn in a parallax scene`                   |
   | Tranzicion flat → `parallax` (B3, `edit/1` dissolve 0,45 s, skena e dytë `parallax`)    | **ok, 0 gabime** | gabim: `s02_sh02: a parallax scene enters only by cut or dissolve from another parallax scene` |
   | `whip` në `parallax` (W0, dissolve-i i `s12_sh12` → whip 0,32 s)                        | **ok, 0 gabime** | gabim: e njëjta si më sipër                                                                    |
   - **Shkaku.** `RenderCapabilities` (`gate/src/capabilities.ts`) i përshkruan aftësitë si lista të pavarura: `projections`, `transitions`, `builtins`… Ato nuk mund të thonë:
     - që gjendjet-element nuk vizatohen;
     - që `parallax` vizaton vetëm botën e W0 dhe objektet e saj;
     - që një tranzicion varet nga projeksionet e dy skenave.

     Kështu Gate-i i lë të kalojnë, dhe dështimi ndodh vetëm gjatë renderimit, pas kalimit të Gate-it. Kjo bie ndesh me parimin "çfarë kalon Gate-in, vizatohet". K5 nuk e kap, sepse mat vetëm paketat që Gate-i i refuzon.

   - **Gjetje shtesë.** Për një gjendje-element, Gate-i nuk kontrollon që id-ja e elementit ekziston në skedarin kryesor ("seat" nuk ekziston te karrigia).
   - **Ndryshimi minimal që propozoj (pa e implementuar; kërkon vendimin e PO-së, sepse zgjeron kontratën `RenderCapabilities`):** Gate-i i refuzon para renderimit, me kode dhe shtigje të sakta.
     - `capabilities` fiton dy fusha:
       - `stateSources` (Engine-i sot: `["source"]`);
       - `projectionRules.parallax = { builtins: ["w0.*", "prop.*"], screenBuiltins: ["type.w0"], enter: ["cut", "dissolve"], enterFrom: ["parallax"] }`.
     - Gate-i nxjerr:
       - `CAPABILITY_MISSING` te `manifest:/assets/i/states/j/element`;
       - `CAPABILITY_MISSING` te `package:/scenes/i/layers/j/nodes/k/asset` për nyjen jo-W0 në `parallax`;
       - `CAPABILITY_MISSING` te `package:/edit/i/enter/kind` për whip në `parallax` ose për tranzicion midis projeksioneve të ndryshme;
       - `REF_MISSING` te `manifest:/assets/i/states/j/element` kur elementi nuk ekziston në skedar.
     - Katër paketat më sipër shtohen te rastet negative (50 → 54+) dhe te K5.
     - Mbështetja e tyre nga renderer-i (alternativa) është punë e E1.5 dhe nuk e kam nisur.

3. Kamera e papërpunuar e B1–B5 dhe heqja e `legacy.ts` (me kopjet e Stager-it): E1.5, siç ishte planifikuar.
4. Pipeline-i i ri nuk është default. Audio mbetet në rrugën e vjetër.

## 6. Commit-et

| Commit                          | Përmbajtja                                                                 |
| ------------------------------- | -------------------------------------------------------------------------- |
| `7f70112`, `1e3f592`, `eda5ab5` | Scope                                                                      |
| `4e957e1`                       | (1) Provat e baseline-it nga Engine-i i pandryshuar                        |
| `33967e0`                       | (2) Evaluatori te `contracts`                                              |
| `25e8290`                       | (3) Testi i kufirit të film-it                                             |
| `3b8ddea`                       | (4) Gate: `EASE_UNDEFINED`, `SVG_UNSAFE`, saxes 6.0.0                      |
| `8d172bc`                       | (5) Verifikimi pa tolerancë kundrejt provave                               |
| `f9253eb`                       | (6) Id-të deterministe; rifiksimi i `type.kinetic`                         |
| `fef5d3a`                       | (7) Prerjet e W0 në kohën e saktë                                          |
| `7dac46f`                       | (8) Modulet e vizatimit me hyrje të qarta                                  |
| `d8f225a`                       | (9) Renderer-i nga paketa + testet K1, K4, K5, K6                          |
| `ea5cc3c`                       | (10) `golden-package.json`, hash-et pending të fixtures B, contact sheet-i |

## 7. Si riprodhohet

```
pnpm test && pnpm typecheck && pnpm lint && pnpm format:check && pnpm contracts:gen --check
pnpm --filter @erkasa/film golden            # K2: rruga e vjetër kundrejt provave
pnpm --filter @erkasa/film golden:package    # K2, K3 dhe K7 për renderer-in
node --expose-gc --import tsx film/test/package/contact-sheet.ts out.png   # K4 (iii)
```
