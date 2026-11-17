# E1.3 – Validation Gate (raport i përditësuar, për review)

|           |                                                                                                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch    | `e1-3-validation-gate`, nga `e2f61f0` (E1.2 e pranuar)                                                                                                                                                |
| Commit-et | `33e4680` scope · `3478322` capabilities të Engine-it (vetëm të dhëna) · `f2890d1` Gate-i · `16e4754` raporti i parë · `f219793` korrigjimi i intervaleve në Stager · `78651f3` ndarja e fixtures A/B |
| Data      | 2026-11-17                                                                                                                                                                                            |
| Statusi   | Pret review. Pa merge, pa E1.4. Kontratat të pandryshuara; Stager-i vetëm me korrigjimin e autorizuar të intervaleve.                                                                                 |

## Çfarë u ndërtua

**1. `capabilities().render` në Engine** (`film/src/capabilities.ts`, aditiv te `erkasa.capabilities/1`)

Përmban:

- kontratën që lexon Engine-i;
- projeksionet, llojet e dritave, `fx`, tranzicionet, llojet e nyjeve dhe të overlays, formatet e rig-ut;
- **çdo builtin** që Engine-i vizaton në kod: emri, versioni, fingerprint-i (sha256 i skedarit që e implementon, e njëjta semantikë si në manifestet e Stager-it), statusi, lloji, dhe hyrjet (statike / kanal me interval) ose përshkrimi i rig-ut.

Vetëm deklarata: asnjë ndryshim vizatimi, golden 451/451, prompt-i i planner-it i pandryshuar.

Engine-i deklaron vetëm atë që vizaton sot:

- projeksionet `flat`, `parallax`;
- `fx: none`;
- tranzicionet `cut`, `dissolve`, `whip`;
- nyje `asset`;
- overlay `captions`;
- **asnjë** lloj drite.

Intervalet deklarohen vetëm aty ku i përcakton kodi: drita 0..3, `facing` ±1, koha ≥ 0. Hyrjet e pakufizuara marrin intervalin më të gjerë të fundëm: dera (kalon përtej 1 kur hapet), rrotullimi, llamba, ora, dosjet.

**2. Paketa `gate/` (`@erkasa/gate`)**

`validate({ package, root, capabilities, budgets }) → { ok, errors, warnings, verified }`

- Varësia e vetme në runtime: `@erkasa/contracts`. Aftësitë vijnë si të dhëna; Gate-i nuk importon Engine-in. Testi i kufirit e kontrollon.
- Çdo gjetje ka: kod të qëndrueshëm, dokumentin (`package` / `manifest` / `capabilities`), JSON Pointer dhe mesazh. Renditja është totale: dokument → pointer segment pas segmenti (numrat si numra) → kod → mesazh.
- Të gjitha kontrollet ekzekutohen. Vetëm nëse skema dështon, kontrollet që varen nga struktura anashkalohen.
- Kur `ok`, kthen `verified`: paketën, manifestin dhe **bajtet e verifikuara** të çdo skedari. Renderer-i do të përdorë këto bajte, jo të rihapë rrugën.

## Kontrollet dhe kodet

| Grupi                   | Kodet                                                                                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1 Skema                | `PACKAGE_PARSE`, `UNKNOWN_VERSION`, `SCHEMA`, `MANIFEST_PARSE`                                                                                                                                  |
| G2 Manifesti            | `MANIFEST_HASH` (+ kodet e skedarëve për `assetManifest.uri`)                                                                                                                                   |
| G3 Skedarët             | `PATH_TRAVERSAL`, `PATH_ABSOLUTE`, `FILE_REMOTE`, `PATH_ESCAPE`, `SYMLINK_BROKEN`, `SYMLINK_LOOP`, `FILE_MISSING`, `NOT_A_FILE`, `FILE_CHANGED`, `FILE_UNREADABLE`, `FILE_HASH`, `ROOT_INVALID` |
| G4 Aprovimi             | `NOT_APPROVED`; `ASSET_UNUSED` (warning)                                                                                                                                                        |
| G5 Builtin-et           | `BUILTIN_UNKNOWN`, `BUILTIN_REMOVED`, `BUILTIN_DEPRECATED` (warning), `BUILTIN_MISMATCH` (versioni, fingerprint-i, fonti), `BUILTIN_KIND`, `RIG_UNSUPPORTED`                                    |
| G6 Referencat           | `ASSET_MISSING`, `ASSET_KIND`                                                                                                                                                                   |
| G7 Gjendjet dhe efektet | `STATE_UNDECLARED`, `PIVOT_UNDECLARED`, `FX_UNSUPPORTED`                                                                                                                                        |
| G8 Parametrat           | `PARAM_UNSUPPORTED`, `PARAM_NOT_DECLARED`, `PARAM_MISSING`, `PARAM_UNKNOWN`                                                                                                                     |
| G9 Track-et             | `TARGET_MISSING`, `CHANNEL_INVALID`, `TRACK_DUPLICATE`, `VALUE_TYPE`, `VALUE_RANGE` (një gjetje për track, te vlera e parë, me numrin, min dhe max)                                             |
| G10 Id-të               | `ID_DUPLICATE`                                                                                                                                                                                  |
| G11 Kohët               | `TIME_RANGE`, `KEY_ORDER`, `TIME_ORDER`, `SAMPLE_RATE`, `EDIT_GAP`, `EDIT_SCENE`, `TRANSITION_LENGTH`, `OVERLAY_TIME`                                                                           |
| G12 Kontaktet           | `SOCKET_MISSING`, `HOLDER_CONFLICT`                                                                                                                                                             |
| G13 Aktorët             | `LAYER_MISSING`, `APPEARANCE_SLOTS`                                                                                                                                                             |
| G14 Buxhetet            | `BUDGET_PACKAGE_BYTES`, `BUDGET_DURATION`, `BUDGET_SCENES`, `BUDGET_SCENE_NODES`, `BUDGET_NODES`, `BUDGET_TRACKS`, `BUDGET_SAMPLES`, `BUDGET_ASSETS`, `BUDGET_ASSET_BYTES`                      |
| G15 Aftësitë            | `CAPABILITY_MISSING`, `CAPABILITIES_INVALID`                                                                                                                                                    |

## Vendimet e miratuara, si u zbatuan

1. **Capabilities:** shih më lart. `gate/` nuk importon Engine-in, as në runtime, as në burim.
2. **Fingerprint-i:** semantika e pandryshuar (sha256 i skedarit burim). Testet verifikojnë që:
   - çdo fingerprint = hash-i i skedarit përkatës;
   - versionet janë 1;
   - dy thirrje japin të njëjtin dokument;
   - çdo builtin që përdorin gjashtë filmat publikohet me të njëjtin version, fingerprint dhe lloj.
3. **Symlink-et dhe TOCTOU** (`gate/src/files.ts`, `readContained`):
   - **Leksikisht** refuzohen: `..`, `.`, segmentet bosh ose të fshehura, backslash, `%`, rrugët absolute dhe `file:`.
   - **`realpath`:** symlink-u lejohet vetëm nëse skedari përfundimtar mbetet brenda rrënjës reale. Dalja nga rrënja, symlink-u i prishur dhe cikli refuzohen.
   - **Hapja:** skedari hapet **një herë** me `O_NOFOLLOW`. Mbi deskriptorin e hapur kontrollohen: (a) ku tregon ai (`/proc/self/fd`; jashtë Linux-it, `dev/ino`), (b) që është skedar i rregullt, (c) madhësia, para leximit.
   - **Leximi:** hash-i llogaritet mbi bajtet e lexuara nga ai deskriptor, dhe po ato bajte kthehen. Asgjë nuk rilexohet sipas rrugës.
   - S3 nuk mund të verifikohet lokalisht: `FILE_REMOTE`.
4. **Buxhetet** (`gate/src/budgets.ts`, të gjitha të konfigurueshme):

| Kufiri               | Vlera       | Burimi                                           |
| -------------------- | ----------- | ------------------------------------------------ |
| Paketa               | 16 MiB      | PO                                               |
| Kohëzgjatja          | 100 s       | PO                                               |
| Skena                | 200         | PO                                               |
| Nyje për skenë       | 2 000       | PO                                               |
| Nyje gjithsej        | 2 400       | 10 × 2,36 nyje/s (W0) × 100 s                    |
| Track-e              | 21 000      | 10 × 20,4 track/s (W0) × 100 s                   |
| Vlera mostrash       | 830 000     | 10 × 823 vlera/s (W0) × 100 s                    |
| Asete                | 110         | 10 × 11 (më së shumti në një film)               |
| Madhësia e një aseti | 2 200 000 B | 10 × 214 242 B (SVG-ja më e madhe në bibliotekë) |

Rregulli i derivimit: 10 × vlera maksimale e matur për sekondë në gjashtë filmat, për 100 s, e rrumbullakuar lart në dy shifra domethënëse. Paketa më e madhe reale (W0) zë 688 KB dhe 45,3 s.

## Testet (104 në `gate/`)

| Skedari                | Çfarë provon                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `films.test.ts`        | Gjashtë filmat kalojnë pa asnjë gjetje; fixtures e pranimit (B) kalojnë pa asnjë gjetje dhe janë identike me daljen e gjeneratorit; fixtures e kontratës (A) kalojnë skemën dhe refuzohen nga Gate-i pikërisht për veçoritë që Engine-i nuk vizaton                                                              |
| `negative.test.ts`     | **48 paketa të prishura**, secila me një defekt, refuzohen me **saktësisht** kodet dhe shtigjet e pritura dhe asgjë tjetër (**45 kode të ndryshme**). Baza e pastër kalon. Builtin-i deprecated jep warning, jo error.                                                                                           |
| `files.test.ts`        | Lexuesi i mbyllur: 17 raste refuzimi (traversal, rrugë absolute, i fshehur, backslash, escape, S3, symlink që del nga rrënja si skedar dhe si direktori, symlink i prishur, cikël, mungesë, direktori), symlink-e të lejuara brenda rrënjës, buxheti i madhësisë, bajtet e mbajtura pas zëvendësimit të skedarit |
| `capabilities.test.ts` | Aftësitë: të plota, deterministe, të fiksuara te skedarët; 6 raste të aftësive të pabesueshme                                                                                                                                                                                                                    |
| `determinism.test.ts`  | I njëjti raport bajt për bajt; renditja totale (`/scenes/2` para `/scenes/10`)                                                                                                                                                                                                                                   |
| `boundary.test.ts`     | Varësitë dhe importet e `gate/`                                                                                                                                                                                                                                                                                  |

## Rezultatet (lokale, në `78651f3`)

| Komanda                                            | Rezultati                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pnpm -r test`                                     | 588/588 (contracts 213, engine 23, compiler 28, engine-worker 16, film 82, planner 6, stager 81, gate 104, ai-worker 35) |
| `pnpm contracts:gen --check`                       | exit 0                                                                                                                   |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | kalojnë                                                                                                                  |
| `pnpm --filter @erkasa/film golden`                | 451/451, 0 ndryshime                                                                                                     |

CI në GitHub mbetet i kuq për dy shkaqe që ekzistonin para E0 (ffmpeg mungon te runner-i; `AssetApiTest`), siç u dokumentua në E1.2.

## Pranimi

| Kriteri                                                     | Statusi                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| Gjashtë filmat kalojnë Gate-in                              | ✅ zero gabime, zero warning, siç i shkruan Stager-i    |
| Fixtures e kontratës kalojnë skemën                         | ✅ Zod + Ajv (testet e `contracts` dhe `films.test.ts`) |
| Fixtures e pranimit kalojnë validimin e plotë               | ✅ zero gjetje                                          |
| ≥ 48 raste negative me kod dhe shteg të saktë               | ✅ 48 raste, 45 kode                                    |
| Filesystem, symlink-e, fingerprint-e, capabilities, buxhete | ✅                                                      |
| Determinizmi dhe renditja                                   | ✅                                                      |
| Teste, golden 451/451, typecheck, lint, format              | ✅ lokalisht                                            |

## Vendimi 1: korrigjimi i Stager-it (`f219793`)

Gate-i i refuzoi gjashtë filmat vetëm me `VALUE_RANGE`: manifestet deklaronin intervale që vlerat e ruajtura i kalonin.

**`gx`, `gy`, `brow`, `lid`: intervali përshkruan vlerat e ruajtura, jo kufijtë e vizatimit.**

- Kodi i staging-ut mbivendos gjendjen emocionale, veprimin dhe lëvizjen e lehtë kur personi rri në vend. Për shembull, `perform.ts:338` i shton shikimit të plotë ±1 një lëkundje deri në 0,15.
- Vlerat e matura në gjashtë filmat: `gx` −1,14..1,12, `gy` −1,47..1,50, `brow` −2,00..0,80, `lid` 0..1,08.
- `drawPerson` i ngjesh vetëm kur vizaton: `gx`/`gy` ±1, `brow`/`mouth` ±1,2, `lid`/`open` 0..1, `shrug` −0,8..1,2, `hand` 0..1.
- Paketa ruan vlerat e plota, kështu që numrat dhe pamja mbeten saktësisht ato të Engine-it. Prandaj intervali i deklaruar duhet t'i përmbajë.
- `rig.ts` pranon çdo numër në çdo kanal, ndaj çdo kanal i rig-ut deklaron intervalin më të gjerë të fundëm.
- Kufijtë e vizatimit janë dokumentuar në `stager/src/manifest.ts`. Asnjë vlerë nuk u shkurtua.

**`param.door`: 1,12 është overshoot i qëllimshëm.**

- Dera hapet me ease-in `back` të Engine-it (`motion.ts`: "Overshoots the target and settles back: follow-through"). Maksimumi analitik i tij, 1 + 4c1³/(27c3²) me c1 = 1,9, është **1,12082**; i njëjti me maksimumin e matur në filma (1,120818).
- Vizatimi i set-it pranon çdo vlerë, dhe Engine-i e deklaron derën pa kufi. Stager-i deklaron tani të njëjtën gjë.

**Prova se asgjë tjetër nuk ndryshoi:** për të gjashtë filmat, paketa është identike përveç hash-it të manifestit, dhe manifesti është identik përveç intervaleve. Testet e Stager-it (81, përfshirë riprodhimin kuadër për kuadër) dhe golden 451/451 kalojnë pa ndryshim.

## Vendimi 2: ndarja e fixtures (`78651f3`)

|                                     | Contract fixtures (A)                                    | Gate acceptance fixtures (B)                                               |
| ----------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Ku                                  | `contracts/fixtures/valid/` (të pandryshuara)            | `gate/fixtures/acceptance/` (të reja)                                      |
| Provojnë                            | strukturën dhe shprehshmërinë e kontratës                | që një paketë e ndërtuar vetëm nga aftësitë e Engine-it kalon çdo kontroll |
| Veçori që Engine-i nuk vizaton      | lejohen                                                  | jo                                                                         |
| E ekzekutueshme nga Engine-i aktual | nuk pretendohet                                          | po                                                                         |
| Kontrollohen nga                    | skema (Zod + Ajv); Gate-i i refuzon dhe testi fiksoi pse | Gate-i i plotë, pa asnjë gjetje                                            |

- **`prisoner-cell` (B):** dy SVG reale nga biblioteka (qelia, karrigia) si skedarë të verifikuar, një person (`rig.cutout.man`) me lëvizje kamere dhe ecje (mostra në 30/s), një ngjarje dukshmërie, captions me fontin e Engine-it (Montserrat 800).
- **`office-clock` (B):** set-i procedural i zyrës (`light`/`t`/`door`), një person, tekst kinetik në shtresë `screen`, pastaj `whip` te shablloni `clock` me hyrjet siç i merr Engine-i (`params`, `anchors`, `dur`, kanali `t`).
- Gjenerohen nga `capabilities().render` dhe nga skedarët realë (`gate/test/acceptance/generate.ts`; `pnpm --filter @erkasa/gate fixtures:acceptance`). Testi kërkon që skedarët në disk të jenë identikë me daljen e gjeneratorit.
- Builtin-et janë të fiksuara me fingerprint, ndaj një ndryshim në kodin e Engine-it i rrëzon qëllimisht. Rigjenerohen vetëm pas rishikimit.
- Nuk u krijua asnjë profil aftësish fiktiv. Gate-i nuk u ndryshua. Ndarja është e dokumentuar në `gate/fixtures/README.md`.

Arsyet pse refuzohen fixtures A (të fiksuara në `films.test.ts`):

- **`prisoner-cell`:** drita `ambient/shaft/point`, nyje `shape`, overlays `text` dhe `icon`, `fx: glow`, `dip_to_black`, builtin-et `rig.cutout` dhe `font.montserrat-700`.
- **`office-procedural`:** hyrjet e `template.clock` dhe të njëjtat dy builtin.

## Çështje të hapura

- E1.4: Engine-i duhet ta thërrasë Gate-in para çdo render-i dhe të përdorë `verified.files` (bajtet), jo rrugët.
- Fixtures B duhet të rigjenerohen sa herë ndryshon një skedar i Engine-it që ato fiksojnë. Kjo është sjellja e pritur e fingerprint-it të bazuar në skedarin burim; edhe ndryshimet vetëm të formatimit alarmojnë. Fingerprint i bazuar në daljen e vizatimit mbetet për më vonë, si u vendos.
- Mbrojtja TOCTOU është e plotë në Linux (`/proc/self/fd`). Në sisteme të tjera, kontrolli `dev/ino` mbulon zëvendësimin e skedarit, por jo çdo ndryshim të direktorive ndërmjet.
- CI mbetet i kuq vetëm për dy shkaqe që ekzistonin para E0 (ffmpeg mungon te runner-i, ai-worker 1/35; `AssetApiTest` në backend). Në run-in `44042269048` (commit `d73bd3b`), CI ekzekutoi edhe `gate` 104/104 dhe `stager` 81/81, që kaluan; po ashtu format, lint, typecheck dhe skemat.
