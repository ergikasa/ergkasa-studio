# E1.3 – Validation Gate (raport, për review)

|           |                                                                                           |
| --------- | ----------------------------------------------------------------------------------------- |
| Branch    | `e1-3-validation-gate`, nga `e2f61f0` (E1.2 e pranuar)                                    |
| Commit-et | `33e4680` scope · `3478322` capabilities të Engine-it (vetëm të dhëna) · `f2890d1` Gate-i |
| Data      | 2026-11-17                                                                                |
| Statusi   | Pret review. Pa merge, pa E1.4. Kontratat dhe Stager-i të pandryshuar.                    |

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

## Testet (103 në `gate/`)

| Skedari                | Çfarë provon                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `films.test.ts`        | Gjashtë filmat dhe dy shembujt e kontratës, me aftësitë reale të Engine-it (pranimi, më poshtë)                                                                                                                                                                                                                  |
| `negative.test.ts`     | **48 paketa të prishura**, secila me një defekt, refuzohen me **saktësisht** kodet dhe shtigjet e pritura dhe asgjë tjetër (**45 kode të ndryshme**). Baza e pastër kalon. Builtin-i deprecated jep warning, jo error.                                                                                           |
| `files.test.ts`        | Lexuesi i mbyllur: 17 raste refuzimi (traversal, rrugë absolute, i fshehur, backslash, escape, S3, symlink që del nga rrënja si skedar dhe si direktori, symlink i prishur, cikël, mungesë, direktori), symlink-e të lejuara brenda rrënjës, buxheti i madhësisë, bajtet e mbajtura pas zëvendësimit të skedarit |
| `capabilities.test.ts` | Aftësitë: të plota, deterministe, të fiksuara te skedarët; 6 raste të aftësive të pabesueshme                                                                                                                                                                                                                    |
| `determinism.test.ts`  | I njëjti raport bajt për bajt; renditja totale (`/scenes/2` para `/scenes/10`)                                                                                                                                                                                                                                   |
| `boundary.test.ts`     | Varësitë dhe importet e `gate/`                                                                                                                                                                                                                                                                                  |

## Rezultatet (lokale, në `f2890d1`)

| Komanda                                            | Rezultati                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pnpm -r test`                                     | 587/587 (contracts 213, engine 23, compiler 28, engine-worker 16, film 82, planner 6, stager 81, gate 103, ai-worker 35) |
| `pnpm contracts:gen --check`                       | exit 0                                                                                                                   |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | kalojnë                                                                                                                  |
| `pnpm --filter @erkasa/film golden`                | 451/451, 0 ndryshime                                                                                                     |

CI në GitHub mbetet i kuq për dy shkaqe që ekzistonin para E0 (ffmpeg mungon te runner-i; `AssetApiTest`), siç u dokumentua në E1.2.

## Pranimi: ku plotësohet dhe ku jo

| Kriteri                                                     | Statusi                                                |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| Gjashtë filmat kalojnë Gate-in                              | ❌ **Jo, siç i shkruan Stager-i sot.** Shih më poshtë. |
| Të dy shembujt e kontratës kalojnë                          | ❌ **Jo.** Shih më poshtë.                             |
| ≥ 20 raste negative me kod dhe shteg të saktë               | ✅ 48 raste, 45 kode                                   |
| Filesystem, symlink-e, fingerprint-e, capabilities, buxhete | ✅                                                     |
| Determinizmi dhe renditja                                   | ✅                                                     |
| Teste, golden, typecheck, lint, format                      | ✅ lokalisht                                           |

**Gjashtë filmat.** Gate-i gjen **vetëm** `VALUE_RANGE`; çdo kontroll tjetër kalon. Manifestet e Stager-it deklarojnë intervale që vlerat e vetë Stager-it i kalojnë:

| Film | Track-e jashtë intervalit                                         |
| ---- | ----------------------------------------------------------------- |
| B1   | `channel.gx` 9, `param.door` 2, `channel.brow` 2                  |
| B2   | `channel.gx` 12                                                   |
| B3   | `channel.gx` 3, `channel.gy` 1                                    |
| B4   | `channel.gx` 1, `channel.gy` 1                                    |
| B5   | `channel.gx` 6, `channel.lid` 2, `channel.gy` 1                   |
| W0   | `channel.gx` 13, `channel.gy` 2, `channel.brow` 2, `param.door` 5 |

Shkaqet:

- **`gx/gy/brow/lid`:** Stager-i deklaroi si interval kufijtë ku `drawPerson` i ngjesh vlerat gjatë vizatimit, por shkruan vlerat e papërpunuara të `pose(t)` (për riprodhimin bit për bit). `rig.ts` i ngjesh edhe `shrug` dhe `hand`, të cilat Stager-i i deklaroi të pakufizuara.
- **`param.door`:** dera kalon pak përtej 1 kur hapet (deri në 1,10), por Stager-i deklaroi [0, 1].

Testi `films.test.ts` provon dy gjëra:

- me paketat e sotme, gjetjet janë vetëm këto;
- me intervalet që deklaron Engine-i, **pa ndryshuar asnjë vlerë**, të gjashtë filmat kalojnë me zero gjetje.

Zgjidhja është në Stager (deklarimi i intervaleve në `src/manifest.ts`, `src/v2.ts`, `src/w0.ts`) dhe kërkon autorizimin tënd, sepse E1.3 ndalon ndryshimin e Stager-it. Gate-in nuk e zbuta: kontrata thotë që vlerat duhet të jenë brenda intervalit të deklaruar.

**Dy shembujt e kontratës.** Skedarët, hash-et, skema dhe aprovimet janë në rregull. Refuzohen për gjëra që Engine-i nuk i vizaton ende, ose për builtin-e që nuk i ka:

- **`prisoner-cell`:** drita `ambient/shaft/point`, nyje `shape`, overlays `text` dhe `icon`, `fx: glow`, `dip_to_black`, `rig.cutout`, `font.montserrat-700` (11 gjetje).
- **`office-procedural`:** hyrjet e `template.clock` (shembulli: `time` statik + kanal `dur`; Engine-i: `params`, `anchors`, `dur` statike + kanal `t`), `rig.cutout`, `font.montserrat-700` (6 gjetje).

Shembujt u shkruan në E1.1/E1.2a para se Engine-i të publikonte aftësitë. Opsionet (kërkojnë vendimin tënd):

- **(a)** përditësim i shembujve te builtin-et reale; prek `contracts/fixtures/`;
- **(b)** mbeten shembuj të skemës, të validuar kundrejt një profili aftësish "të synuara";
- **(c)** do të kalojnë kur E1.4+ t'i implementojë këto veçori.

## Çështje të hapura

- Intervalet në manifestet e Stager-it (kriteri 1): kërkon autorizim për Stager-in.
- Shembujt e kontratës (kriteri 2): vendim (a), (b) apo (c).
- E1.4: Engine-i duhet ta thërrasë Gate-in para çdo render-i dhe të përdorë `verified.files` (bajtet), jo rrugët.
- Fingerprint-i i bazuar në skedarin burim: ndryshimet vetëm të formatimit alarmojnë. Fingerprint i bazuar në daljen e vizatimit mbetet për më vonë, si u vendos.
- Mbrojtja TOCTOU është e plotë në Linux (`/proc/self/fd`). Në sisteme të tjera, kontrolli `dev/ino` mbulon zëvendësimin e skedarit, por jo çdo ndryshim të direktorive ndërmjet.
