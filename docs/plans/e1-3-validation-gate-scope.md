# E1.3 – Validation Gate: scope (për miratim para kodit)

|         |                                                                                             |
| ------- | ------------------------------------------------------------------------------------------- |
| Branch  | `e1-3-validation-gate`, nga `e2f61f0721652f836d4c40736fb96a430aa9a01e` (E1.2 e pranuar)     |
| Data    | 2026-11-17                                                                                  |
| Statusi | Vetëm scope. Asnjë rresht kodi para miratimit.                                              |
| Burimi  | `docs/plans/erkasa-plani-engine-e0-e4-final.md` §2 dhe rreshti E1; vendimet e E1.1 dhe E1.2 |

## Qëllimi

Engine-i fillon të renderojë vetëm me një Render Package të vlefshëm. Përndryshe nuk renderon asgjë dhe kthen listën e gabimeve, secilin me shteg (plani, §2).

Gate kontrollon gjithçka që JSON Schema nuk mund ta kontrollojë, sepse kërkon manifestin, aftësitë e Engine-it ose filesystem-in. Skema mbetet kontrolli i parë.

## Brenda scope-it

**1. Paketa e re `gate/` (`@erkasa/gate`)**

- Varet vetëm nga `@erkasa/contracts`. Nuk varet nga `film`, `stager`, `planner` apo `ai-worker`, as nga ndonjë model apo rrjet.
- Aftësitë e Engine-it i merr si të dhëna (`capabilities`), jo si import.
- E pastër dhe deterministe: i njëjti input jep të njëjtin raport.

**2. API**

`validate({ package, manifest, manifestBytes, capabilities, assetRoot, budgets })` → `GateReport { ok, errors[], warnings[] }`

- Çdo gjetje: `{ code, path, message }`. `path` është JSON Pointer brenda paketës ose manifestit.
- `ok` = asnjë error. Warning-et nuk bllokojnë.
- Gjetjet renditen në mënyrë deterministe (sipas `path`, pastaj `code`).
- Kontrollet nuk ndalen te gabimi i parë: raportohen të gjitha.

**3. Kontrollet** (secili ka kod të qëndrueshëm)

| Grupi                     | Kontrolli                                                                                                                                                                                                                                                                                                  | Kodi (shembuj)                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| G1 Skema                  | Zod për paketën dhe manifestin; versioni major i njohur                                                                                                                                                                                                                                                    | `SCHEMA`, `UNKNOWN_VERSION`                                                                             |
| G2 Manifesti              | sha256 i bajteve të manifestit = `assetManifest.sha256`                                                                                                                                                                                                                                                    | `MANIFEST_HASH`                                                                                         |
| G3 Skedarët               | `realpath` brenda `assetRoot` (pa dalje me symlink), skedari ekziston, sha256 përputhet                                                                                                                                                                                                                    | `PATH_ESCAPE`, `FILE_MISSING`, `FILE_HASH`                                                              |
| G4 Aprovimi               | Çdo aset i përdorur ka `approval.status = approved`                                                                                                                                                                                                                                                        | `NOT_APPROVED`                                                                                          |
| G5 Builtin-et             | Tabela e miratuar në E1.1: i njohur dhe i mbështetur → ok; deprecated → warning; i panjohur ose i hequr → error; version/fingerprint i ndryshëm → error                                                                                                                                                    | `BUILTIN_UNKNOWN`, `BUILTIN_REMOVED`, `BUILTIN_DEPRECATED`, `BUILTIN_MISMATCH`                          |
| G6 Referencat             | Çdo `id@version` ekziston në manifest dhe është i llojit të duhur (nyje → vector, aktor → rig, font → font, audio → audio)                                                                                                                                                                                 | `ASSET_MISSING`, `ASSET_KIND`                                                                           |
| G7 Gjendjet dhe efektet   | `state` e nyjeve, ngjarjeve dhe ikonave është e deklaruar te aseti; `fx` në listën e Engine-it                                                                                                                                                                                                             | `STATE_UNDECLARED`, `FX_UNSUPPORTED`                                                                    |
| G8 Parametrat procedurale | Çdo parametër statik është vendosur dhe asnjë i panjohur; `param.*` vetëm për kanale të deklaruara, me vlera brenda `range`                                                                                                                                                                                | `PARAM_MISSING`, `PARAM_UNKNOWN`, `PARAM_RANGE`                                                         |
| G9 Track-et               | Objektivi ekziston në skenë; kanali vlen për objektivin (`bone.<id>`, `channel.<id>` nga rig-u; kanalet e nyjeve, kamerës, dritës); një track për (objektiv, kanal); vlerat e kanaleve të rig-ut brenda `range`                                                                                            | `TARGET_MISSING`, `CHANNEL_INVALID`, `TRACK_DUPLICATE`, `CHANNEL_RANGE`                                 |
| G10 Id-të                 | Unike brenda fushës së tyre (skena, nyje dhe aktorë brenda skenës, overlays)                                                                                                                                                                                                                               | `ID_DUPLICATE`                                                                                          |
| G11 Kohët                 | Çelësat rreptësisht në rritje; kohët brenda `[0, duration]`; `rate = fps` dhe `start` mbi një kuadër për `bone.*`/`channel.*` (vendim i E1.1); montazhi pa boshllëqe nga 0 deri te `duration`, me skena ekzistuese; tranzicioni jo më i gjatë se cut-i; `in < out` për overlays, frazat dhe fjalët në rend | `KEY_ORDER`, `TIME_RANGE`, `SAMPLE_RATE`, `EDIT_GAP`, `EDIT_SCENE`, `TRANSITION_LENGTH`, `OVERLAY_TIME` |
| G12 Kontaktet             | Bazamenti ekziston te rig-u; nyja ekziston; `from < to`; një mbajtës për objekt në çdo çast                                                                                                                                                                                                                | `SOCKET_MISSING`, `HOLDER_CONFLICT`                                                                     |
| G13 Aktorët               | Shtresa ekziston; çelësat e `appearance` = slotet e rig-ut                                                                                                                                                                                                                                                 | `LAYER_MISSING`, `APPEARANCE_SLOTS`                                                                     |
| G14 Buxhetet              | Kufij të konfigurueshëm: madhësia e paketës, kohëzgjatja, skena, nyje për skenë, vlera mostrash gjithsej                                                                                                                                                                                                   | `BUDGET_*`                                                                                              |
| G15 Aftësitë              | Projeksioni, llojet e dritave, `fx`, tranzicionet, formatet e rig-ut dhe builtin-et janë në aftësitë e Engine-it                                                                                                                                                                                           | `CAPABILITY_MISSING`                                                                                    |

**4. Testet dhe kriteret e pranimit**

- Të gjashtë paketat e Stager-it (B1–B5, W0) dhe dy shembujt realë të kontratës kalojnë pa error.
- **Të paktën 20 paketa të prishura qëllimisht**, të paktën një për çdo grup G1–G15, refuzohen me **kodin dhe shtegun e saktë**. Plani kërkon 10; propozoj 20 që të mbulohet çdo grup.
- Kontrolli i symlink-ut provohet me një symlink real që del jashtë `assetRoot`.
- Determinizmi: dy ekzekutime → i njëjti raport, bajt për bajt.
- Testet, typecheck, lint dhe format kalojnë; golden 451/451 pa ndryshime.
- Raport në `docs/reports/e1-3-validation-gate.md`, me listën e plotë të kodeve.

## Jashtë scope-it

- Engine-i nuk lexon paketën dhe nuk thërret Gate-in (E1.4). Gate-i ndërtohet dhe testohet më vete.
- Asnjë ndryshim i kontratave. Nëse Gate-i tregon se mungon diçka, raportohet për miratim.
- Zhvendosja e `evaluate.ts` pranë kontratës, easing-u, id-të e `kineticType`, kompozimi i W0 (E1.4).
- Kamera e papërpunuar dhe heqja e `legacy.ts` (E1.5).
- Riparimi i CI-së së kuqe (çështje më vete), audio-ja, E2–E4.
- Optimizimi i madhësisë.

## Vendime që kërkojnë miratimin tënd para kodit

1. **Aftësitë e builtin-eve.** G5 dhe G15 kërkojnë që Engine-i të publikojë builtin-et (emri, versioni, fingerprint, statusi) dhe listat e `fx`, projeksioneve, dritave dhe tranzicioneve. Sot `capabilities()` publikon vetëm sets, verbs, moods, lights dhe templates.
   - **(a) E rekomanduar:** zgjerim aditiv i `capabilities()` në `film/src/capabilities.ts`. Është ndryshim në Engine, por vetëm me të dhëna: asnjë ndryshim vizual, golden 451/451.
   - **(b)** Në E1.3, Gate-i teston me një listë aftësish fixture; publikimi nga Engine-i bëhet në E1.4.
2. **Fingerprint-i i builtin-eve.** Për (a): sha256 i skedarit burim, si te paketat e sotme. Fingerprint i bazuar në daljen e vizatimit lihet për më vonë.
3. **Symlink-et.** Propozimi: lejohen vetëm nëse `realpath` mbetet brenda `assetRoot`; ndryshe `PATH_ESCAPE`.
4. **Buxhetet fillestare.** Propozimi, i bazuar në matjet e E1.2 (paketa më e madhe 688 KB):
   - paketa ≤ 16 MiB (kufiri i skemës)
   - kohëzgjatja ≤ 600 s
   - skena ≤ 200
   - nyje për skenë ≤ 2 000
   - vlera mostrash gjithsej ≤ 2 000 000

   Të gjitha të konfigurueshme.

Pas miratimit nis implementimin në këtë branch dhe ndalem me commit-in dhe raportin për review, pa merge.
