# E1.4 – Engine-i lexon Render Package: scope (për miratim para kodit)

|         |                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Branch  | `e1-4-engine-reads-package`, nga `cfb6a45` (fundi i `e1-3-validation-gate`)                                                                                        |
| Data    | 2026-11-17                                                                                                                                                         |
| Statusi | Vetëm scope. Asnjë rresht kodi para miratimit. E1.3 pret ende konfirmimin formal të pranimit; nëse review-i i E1.3 kërkon ndryshime, ky branch rindërtohet mbi to. |
| Burimi  | `docs/plans/erkasa-plani-engine-e0-e4-final.md`, rreshti E1; çështjet e hapura nga raportet E1.2 dhe E1.3                                                          |

## Qëllimi

Plani për E1: "Engine-i renderon vetëm nga Render Package". Pranimi i E1 kërkon:

- 6 filmat: `film.json → stager → render package → gate → Engine`, me PSNR ≥ 50 dB;
- gate-i refuzon paketat e prishura;
- një paketë e shkruar me dorë renderohet.

E1.4 ndërton rrugën **paketë → Gate → Engine** dhe provon se jep të njëjtat kuadro si rruga e sotme. Rruga e sotme mbetet e paprekur dhe e paracaktuar. Kalimi i pipeline-it dhe heqja e kodit të vjetër janë E1.5.

## Brenda scope-it

**1. Renderer-i i paketës në Engine** (`film/src/package/`, i ri)

- `renderPackage({ package, root, out })`:
  1. thërret Gate-in me `capabilities().render` të vetë Engine-it;
  2. refuzon nëse `ok` është false, pa renderuar asnjë kuadër;
  3. renderon vetëm nga `verified`: paketa, manifesti dhe bajtet e skedarëve, pa rihapur rrugë.
- `packageFrame(verified, frame)`:
  1. vlerëson çdo kanal me evaluatorin e vetëm (pika 2);
  2. zgjedh skenën nga `edit` dhe tranzicionin;
  3. vizaton shtresat, pastaj shtresat `screen`, në rend;
  4. çdo nyje me builtin-in e saj (set-et, props, shabllonet, teksti kinetik, OTS, scrim, bota e W0) ose me SVG-në e skedarit të verifikuar;
  5. aktorët me `drawPerson`;
  6. captions sipas evaluatorit.
- **Kufiri:** renderer-i nuk lexon plan, script, `perform.ts`, `timing.ts`, `compose.ts` apo `continuity.ts`. Një test kufiri e siguron këtë.
- **Varësitë e reja:** Engine-i varet nga `@erkasa/gate` dhe `@erkasa/contracts`. Gate-i vazhdon të mos varet nga Engine-i.

**2. Një evaluator i vetëm**

- `stager/src/evaluate.ts` zhvendoset te `contracts/` si modul normativ, pa ndryshuar asnjë skemë. Stager-i, Gate-i dhe renderer-i e importojnë nga atje.
- Testet e riprodhimit të E1.2 vazhdojnë ta përdorin.

**3. Provat**

| Prova                  | Si                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1–B5, çdo kuadër      | SVG e renderer-it = SVG e `frameAt` të Engine-it të sotëm, me normalizim vetëm të id-ve të `kineticType` derisa të zgjidhen (pika 4 te vendimet) |
| B1–B5, pikselë         | Kuadrot e golden-it (451 me W0) të rasterizuar nga të dyja rrugët: identikë, ose PSNR ≥ 50 dB, sipas planit                                      |
| W0                     | Sipas vendimit 3 më poshtë                                                                                                                       |
| Fixtures B të pranimit | `prisoner-cell` dhe `office-clock` renderohen nga Engine-i: "paketa e shkruar me dorë renderohet"                                                |
| Gate-i para render-it  | Një paketë e prishur nuk prodhon asnjë kuadër dhe kthen gjetjet e Gate-it                                                                        |
| Pa regresion           | Golden 451/451 i rrugës së sotme; testet, typecheck, lint, format                                                                                |

## Jashtë scope-it

- Kalimi i pipeline-it (ai-worker, engine-worker, Studio) te rruga e re; ruajtja e paketës në dosjen e run-it; heqja e `legacy.ts`, e kopjeve `COPY` dhe e leximit të Script-it nga Engine-i (E1.5).
- Kamera e papërpunuar e B1–B5 (E1.5, kur kodi i kamerës hyn në Stager).
- Audio në paketë; E2–E4; optimizimi i madhësisë.

## Vendime që kërkojnë miratimin tënd para kodit

1. **Zhvendosja e `evaluate.ts` te `contracts/`.** Është ndryshim në paketën e kontratave, por jo në skemat apo në semantikën e tyre. Alternativa është një paketë më vete (`@erkasa/evaluate`). Rekomandimi im: `contracts/`, pranë skemës që përshkruan.

2. **Easing-u dhe tranzicionet** (kusht i hapur që nga E1.1). Dy pjesë:
   - **(a) Tranzicionet.** Engine-i i sotëm i bën `dissolve` (fade) dhe `whip` me `EASES.io`, me formula të sakta në `compose.ts` (fade me opacitet; whip me zhvendosje ±W). Propozimi: këto formula bëhen semantika e publikuar e `dissolve` dhe `whip` në `capabilities().render` dhe në evaluator, me teste numerike.
   - **(b) Çelësat e track-eve.** Kontrata ka 10 emra easing-u (`easeIn`, `easeOutBack` etj.) pa formulë. Paketat e Stager-it dhe fixtures B përdorin vetëm `linear` dhe `hold`. Propozimi: në E1.4, evaluatori dhe Gate-i pranojnë vetëm `linear` dhe `hold`; çdo ease tjetër refuzohet me kod të ri, `EASE_UNDEFINED`, në Gate. Formulat për të tjerët shtohen kur i kërkon një rast real, me autorizim.

3. **Përputhja e W0** (e hapur që nga E1.2). Kompozimi i W0 (harta e dritës, hija me `multiply`, rim, rrezja, bloom, vinjeta, grain, blur sipas thellësisë) nuk shprehet në kontratë.
   - **(a) E rekomanduar:** renderer-i e zbaton kompozimin e W0 si sjellje të Engine-it për skenat me projeksion `parallax` dhe botë `w0.*`, duke ripërdorur kodin ekzistues të kompozuesit. Rezultati: pikselë identikë me golden-in e W0; drita mbetet brenda builtin-eve, siç i deklaron Engine-i (`lightKinds: []`).
   - **(b)** Kompozimi i W0 modelohet me dritat e kontratës (`ambient`/`point`/`shaft`). Kjo kërkon që Engine-i të vizatojë drita nga paketa, dhe sjell ndryshim vizual që duhet miratuar me golden të ri.

4. **Id-të deterministe të `kineticType`.** Sot vijnë nga një numërues global.
   - Propozimi: `kineticType` merr një prefiks id-je nga nyja (renderer-i: `kt-<skena>-<nyja>-<n>`; rruga e sotme mbetet e njëjtë).
   - Pikselët nuk ndryshojnë. Teksti SVG i rrugës së re ndryshon vetëm në id; prova e SVG-së i normalizon, kurse prova e pikselëve nuk ka nevojë.
   - Kjo prek `style.ts` në Engine, prandaj kërkon autorizim.

5. **Vizatimi i aseteve nga skedari** (për `prisoner-cell` B): SVG-ja e verifikuar vendoset në pozicionin, shkallën dhe origjinën e nyjes, sipas `geometry`. Kjo është veçori e re e Engine-it, dhe pas saj `nodeKinds: ["asset"]` mbulon edhe asetet nga skedari. A miratohet?

6. **Captions në renderer-in v2.** Sot vetëm W0 vizaton captions. Propozimi: renderer-i i vizaton captions me pamjen e W0 (e vetmja që ekziston dhe është e verifikuar në E1.2) për çdo paketë që i ka.

Pas miratimit implementoj E1.4 në këtë branch dhe ndalem te commit-i dhe raporti për review, pa merge.
