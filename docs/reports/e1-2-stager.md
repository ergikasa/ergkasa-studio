# E1.2 – Stager (raport, për review)

|           |                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Branch    | `e1-2-stager`, nga `523e8570c4a39e2b949f8865941083aac7f4417e`                                                                   |
| Commit-et | `df05e23` zgjerimi aditiv i kontratës (E1.2a) · `96f3abb` raporti i E1.2a · `be092a6a141af51ed116d4cafee49c58f37aa64d` Stager-i |
| Data      | 2026-11-17                                                                                                                      |
| Statusi   | Pret review. Pa merge në `main`, pa E1.3, pa ndryshime në Engine                                                                |

## Scope

Paketa e re `stager/` (`@erkasa/stager`, 1792 rreshta me testet), plus regjistrimi në `pnpm-workspace.yaml` dhe `pnpm-lock.yaml`. `film/`, `engine/`, `compiler/`, `planner/`, `ai-worker/` dhe `contracts/` nuk preken në commit-in e Stager-it.

| Skedari           | Roli                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/legacy.ts`   | Dera e vetme drejt kodit të sotëm të staging-ut (timing, perform, compose, kompozuesi W0). Konstantet private të `compose.ts` janë kopjuar dhe shënuar `COPY`. Ky skedar zhduket në E1.5, kur kodi zhvendoset në Stager. |
| `src/recorder.ts` | Regjistron çdo vlerë për çdo kuadër. Kanal konstant → një çelës; çdo kanal tjetër → `samples` në 30/s nga kuadri i parë i skenës. Dukshmëria → ngjarje. Asnjë resampling.                                                |
| `src/v2.ts`       | B1–B5: një skenë për shot, me kuadrot e shot-it dhe kuadrot ku shot-i tjetër hyn me `fade`/`whip`, në kohët `dur + n/30` që përdor Engine-i.                                                                             |
| `src/w0.ts`       | W0: e njëjta gjë sipas renderer-it të W0 (`T = k/30`, `t = T − start`, fade 0,5 s).                                                                                                                                      |
| `src/manifest.ts` | Asetet builtin, të fiksuara te skedari burim; rig-u (lartësia dhe kufijtë) nxirret nga `rig.ts`.                                                                                                                         |
| `src/cli.ts`      | Stage-on gjashtë filmat; nxjerr madhësitë sipas kategorisë ose hash-et.                                                                                                                                                  |

**Determinizmi:** nuk ka model, rrjet, orë apo rastësi; një test e kontrollon burimin dhe varësitë. Stager-i nuk merr vendime: shkruan atë që llogarit kodi ekzistues.

## Si hartëzohet një film

- **Shot → skenë.** Montazhi: `cut`, `fade` → `dissolve` 0,45 s, `whip` 0,32 s (W0: `fade` → `dissolve` 0,5 s).
- **Aktorët:** 10 kocka + 10 kanale (9 të `Pose` + `glow`) + `root.x/y/scale`, `facing`, `turn`, një shtresë për aktor. Stager-i kontrollon që renditja sipas `x` të mos ndryshojë brenda skenës; në të gjashtë filmat nuk ndryshon.
- **Set-et, props, shabllonet, teksti kinetik, OTS, scrim, bota e W0:** builtin procedurale me hyrje të deklaruara (`param.light`, `param.t`, `param.door`; W0: `t, light, door, lamp, clockMin, binders`).
- **Objektet në dorë:** dy nyje (`_rest` në shtresën e pasme, `_held` pas aktorëve) me dukshmëri të kundërt dhe pozicionin e llogaritur nga Engine-i. `contacts` nuk përdoren: Engine-i do të duhej të zgjidhte bazamentin e dorës, kurse pozicionet e regjistruara janë të sakta.
- **Kamera:** v2 → `flat` (x, y, height); W0 → `parallax` (cx, cy, height).
- **Captions e W0:** `overlays` të nivelit të filmit, të grupuara sipas madhësisë që renderer-i i jep çdo fraze, me kohët e fjalëve të materializuara.

## Prova (52 teste)

| Prova                               | Si                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vlefshmëria                         | Gjashtë paketat dhe gjashtë manifestet kalojnë Zod dhe Ajv; `parse()` i kthen të pandryshuara (asnjë fushë e detyrueshme e anashkaluar).                                                                                                                                                                                                                                                                                                                                          |
| Integriteti                         | Manifesti fiksohet me hash; paketa nuk referon asete që mungojnë dhe manifesti nuk ka asete të papërdorura; builtin-et janë fiksuar te skedarët e Engine-it; çdo nyje procedurale vendos çdo parametër statik dhe ushqen vetëm kanale të deklaruara; çdo aktor vendos çdo slot; një track për (objektiv, kanal).                                                                                                                                                                  |
| **Riprodhimi numerik**              | Për çdo kuadër të çdo skene, vlerat lexohen nga JSON-i me rregullat e kontratës. Për çdo person, çdo kanal është **i barabartë bit për bit** me `pose(t)`/`placed(t)` të Engine-it, dhe `drawPerson` jep të njëjtin SVG si `ActorPerf.draw(t)`. B1–B5: transformimi i kamerës, set-i (back/front), props, shablloni dhe teksti ndodhen identikë në kuadrin e Engine-it. W0: kamera dhe gjendja e vendit janë të barabarta me vlerat e Engine-it, dhe teksti ndodhet në `typeSvg`. |
| Tranzicionet                        | Për kuadrot e tranzicionit, `frameAt` i Engine-it përmban saktësisht skenën e mëparshme në kohën që ruan paketa, dhe nuk e përmban më në kuadrin pas tranzicionit.                                                                                                                                                                                                                                                                                                                |
| Testi që provon se prova kap gabime | Një mostër e ndryshuar me një pjesë në një miliard kapet.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Determinizmi                        | Dy herë në të njëjtin proces dhe një herë në proces më vete → të njëjtët bajte. U provua edhe me renditje të kundërt të filmave dhe me çdo film të vetëm.                                                                                                                                                                                                                                                                                                                         |

## Rezultatet

| Komanda                                            | Rezultati                                                                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm -r test`                                     | 455/455 (contracts 213, engine 23, compiler 28, engine-worker 16, film 82, planner 6, stager 52, ai-worker 35) |
| `pnpm contracts:gen --check`                       | exit 0                                                                                                         |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | kalojnë                                                                                                        |
| `pnpm --filter @erkasa/film golden`                | 451/451, 0 ndryshime                                                                                           |

## Madhësia reale (JSON kompakt, bajte)

| Film | Kohëzgjatja | Kocka (samples) | Kanalet e tjera të aktorëve | Kamera | Drita | Nyje    | Overlays | Struktura | **Totali**  | Manifesti |
| ---- | ----------- | --------------- | --------------------------- | ------ | ----- | ------- | -------- | --------- | ----------- | --------- |
| B1   | 50,2 s      | 104 619         | 115 323                     | 27 628 | 4     | 85 993  | 2        | 6 715     | **340 284** | 10 625    |
| B2   | 41,9 s      | 146 596         | 152 576                     | 30 919 | 4     | 149 371 | 2        | 7 816     | **487 284** | 9 173     |
| B3   | 35,0 s      | 27 199          | 30 350                      | 24 951 | 4     | 57 926  | 2        | 3 645     | **144 077** | 10 486    |
| B4   | 33,9 s      | 28 651          | 38 386                      | 32 511 | 4     | 45 409  | 2        | 4 313     | **149 276** | 8 718     |
| B5   | 40,4 s      | 55 016          | 68 846                      | 36 114 | 4     | 82 419  | 2        | 5 116     | **247 517** | 9 586     |
| W0   | 45,3 s      | 122 905         | 128 211                     | 53 766 | 4     | 366 151 | 8 495    | 8 250     | **687 782** | 8 900     |

Videoja 45-sekondëshe (W0) është 0,69 MB; B1 (50 s) është 0,34 MB. Shqetësimi për 2–3 MB nuk konfirmohet nga matjet. Nuk u bë asnjë kompresim.

Ku shkon madhësia: tek W0, "nyje" (366 KB) janë kryesisht gjashtë kanalet e gjendjes së vendit, të përsëritura mbi gjashtë nyjet e botës (sky, city, city_near, wall, mid, near), sepse kontrata nuk ka kanal të përbashkët. Kjo vetëm u mat; nuk u optimizua.

## Kufizime dhe gjetje (të ndershme)

1. **Kamera e v2 lexohet nga kuadri.** Kodi i kamerës është privat në `compose.ts`, dhe Engine-i nuk u prek. Stager-i lexon transformimin që vizaton Engine-i (i rrumbullakuar në 2 shifra nga `fmt`). Prova tregon se transformimi rindërtohet identik, por vlerat e papërpunuara të kamerës nuk janë në paketë. Zgjidhet në E1.5, kur kodi i kamerës hyn në Stager.
2. **`kineticType` numëron `clipPath` me një numërues global** (`kt1094`): i njëjti tekst i vizatuar dy herë merr id të ndryshme. Piksela janë të njëjtë, teksti SVG jo. Në prova normalizohen vetëm këto id. Për E1.4: id deterministe sipas nyjes.
3. **Kompozimi i W0 nuk shprehet.** Harta e dritës, hija me `multiply`, rim, rrezja e dritares, bloom, vinjeta dhe grain mbeten në Engine; `lights` është bosh. Për W0, prova numerike mbulon kamerën, gjendjen e vendit, njerëzit dhe tekstin, jo pikselët. Vendimi mbetet për E1.4: model drite që ndjek W0, apo ndryshim vizual i miratuar.
4. **Audio nuk është në paketë** (zëri, muzika, sfx). `mix` mban vetëm objektivat e loudness të Engine-it.
5. **Pjesa më e madhe e vizatimit është ende kod i Engine-it** (builtin procedurale). Paketa përshkruan hyrjet e tyre saktësisht; kthimi i tyre në asete është punë për E2/E3.
6. **Konstante të kopjuara:** `LIGHT`, `LIGHT_BG`, `TRANSITION_SEC`, fade 0,5 s dhe formula e blur-it të W0. Kopja e tranzicioneve verifikohet me `frameAt`; formula e blur-it të W0 jo, sepse është raster.
7. **Gjetje për kontratën (pa i ndryshuar):**
   - `referenceDistance` kërkohet edhe për `flat`, ku nuk ka kuptim; u vendos `H`.
   - Kanalet e rig-ut kërkojnë `range`, por `rig.ts` nuk kufizon `shrug`, `breath`, `hand`, `glow`; u deklarua intervali më i gjerë i fundëm.
   - Hartëzimi i projeksionit të W0 (`dolly 0.55`) është provizor.
8. **Easing** mbetet kusht i hapur para E1.4. Stager-i shkruan vetëm çelësa të vetëm ose mostra, pra asnjë easing nuk përdoret në këto paketa.

## Si riprodhohet

```
pnpm --filter @erkasa/stager test                       # 52 teste, përfshirë provën kuadër për kuadër
pnpm --filter @erkasa/stager stage --out /tmp/staged    # shkruan paketat, printon madhësitë
pnpm --filter @erkasa/stager stage --hashes             # hash-et (determinizmi)
```
