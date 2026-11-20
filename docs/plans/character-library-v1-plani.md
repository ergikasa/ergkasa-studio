# Erkasa Character System V1: auditimi, arkitektura, kontrata dhe plani i implementimit

20 nëntor 2026. Branch `plan-character-library`, mbi `proto-character-v4` (`edd3737`), që përmban `g0-advanced-engines` (W1, W2, W2-V). Vetëm plan dhe matje; asnjë ndryshim në production, asnjë merge në `main`, asnjë W3.

Shenjat: **[F]** e verifikuar në kod · **[M]** e matur në këtë makinë · **[S]** vlerësim · **[R]** rekomandim.

---

## 0. Përmbledhja

1. **Sot nuk ka asnjë karakter të pavarur nga Engine-t. [F]**
   - Identiteti i personazhit shpiket nga Director-i (LLM) për çdo film. Plani e deklaron inline: ndërtimi, ngjyrat e lëkurës dhe flokëve, stili i flokëve, mjekra.
   - Character Acting e plotëson me vlerat e veta të parazgjedhura.
   - Paketa e render-it e kopjon për çdo aktor në çdo skenë.
   - Rig-u është kod: një figurë cutout në profil (`rig.cutout.man|woman`).
   - Për një karakter të ri duhet kod i ri.
2. **Arkitektura që propozoj** ka katër pjesë. Asnjëra nuk është Engine:

| Pjesa                                        | Çfarë është                                                                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Character Library**                        | Katalog me paketa karakteresh të versionuara dhe të pandryshueshme                                                      |
| **Character Package** (`erkasa.character/1`) | Formati: skelet, pamje, pjesë vektoriale dhe tekstura mbi mesh të deformueshëm, fytyrë, duar, veshje, manifest aftësish |
| **Character Runtime**                        | Kod determinist, pa vendime, që e kthen paketën + kanalet në vizatim dhe në gjeometri                                   |
| **Character Builder**                        | Mjet autorimi offline që ndërton paketat; vjen nga prototipi v4                                                         |

Engine-t i marrin karakteret vetëm përmes paketës së render-it dhe nuk mbajnë asnjë kopje të identitetit. 3. **Formati, i zgjedhur me matje [M]:**

- Vektor + tekstura raster mbi mesh, të deformuara nga i njëjti skelet dhe morph targets.
- Disa pamje të autorizuara, pa filtra blur në runtime.
- Matjet që e mbështetin:
  - Gjeometria vektoriale e një kuadri v4 kushton 150–160 ms. Filtrat blur dhe teksturat në runtime marrin **94%** të kohës në resvg dhe 76% në Skia.
  - Një teksturë mbi mesh të deformuar vizatohet në Skia, që e kemi tashmë në repo, me **70 ms për 4 096 trekëndësha**, pa tegela të dukshme (0.2/255).
  - Skinning-u dhe morph targets kushtojnë **0.7 ms** për kuadër.
  - Kostoja rritet linearisht me numrin e karaktereve.

4. **Një SVG i vetëm nuk mjafton**, dhe as kodi procedural për çdo karakter (rruga v4). V4 bëhet mjeti që i **ndërton** paketat, jo mënyra si i **vizatojmë**.
5. **Plani ndjek gjashtë fazat e kërkesës.** Faza 1 (auditimi) është ky dokument. Fazat 2–6 kanë kritere pranimi me matje automatike dhe video.
   - Filmat ekzistues, rig-u `@1`/`@2` dhe golden-et B1–B5 nuk preken.
   - Karakteret e reja hyjnë si opsion i deklaruar.
6. **Kam nevojë për 5 vendime nga ti** (§10) para se të nis Fazën 2.

---

## 1. Faza 1: auditimi i repository-t

### 1.1 Engine-t realë dhe ku janë në kod

Emrat dhe përgjegjësitë vijnë nga `docs/standards/engines-standard-v2.md` (§4–§8). Kodi nuk është i ndarë në dosje sipas Engine-it. Harta e skedarëve **[F]**:

| Engine (standardi)            | Përgjegjësia për personazhin                                                                           | Skedarët                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **World Builder**             | Pikat e ndërveprimit (`grip`, `seat`, `surface`...), shkallët ndaj personazhit (WB-C2), zonat e ecshme | `film/src/sets.ts`, `film/src/props.ts`, `film/src/w0/world.ts`, `Affordance` në `contracts/src/asset-manifest.ts` |
| **Character Acting**          | Performanca, mekanika, gjestet, shikimi, emocionet, identiteti (CA-I) dhe veshjet (CA-W)               | `film/src/perform.ts`, `acting.ts`, `motion.ts`, `continuity.ts`, `wardrobe.ts`, `garments.ts`, `rig.ts`           |
| **Cinematic Camera**          | Kuadrimi i personazhit, ndjekja, close-up                                                              | `film/src/compose.ts`, `film/src/w0/camera.ts`                                                                     |
| **Environmental Motion & FX** | Drita mbi personazhin (`shadow`, `rim`, ende të kufizuara), era, atmosfera                             | `film/src/w0/` (drita), pak efekte                                                                                 |

Rruga e plotë, e pandryshuar nga E1 **[F]**:

```
plan (erkasa.film/1) → Stager → paketa e render-it (erkasa.render/1 + Asset Manifest erkasa.assets/1) → Gate → Renderer
```

Renderer-i i paketës ka dy rasterizues:

- **resvg** për skenat flat (`film/src/raster.ts`);
- **Skia** (`@napi-rs/canvas`) për skenat W0 (`film/src/w0/compositor.ts`, thirrur nga `film/src/package/render.ts`).

### 1.2 Si ekziston personazhi sot

| Shtresa                                                 | Çfarë ka **[F]**                                                                                                                                                    | Problemi për Character Library                                                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plani** `film/src/contract.ts`                        | `CastMember`: `build` (man/woman), `coat`, `hair`, `skin` (hex), `hairStyle`, `facialHair`, `era`, `profession`, `outfits[]`; maksimumi 3 për film                  | Identiteti deklarohet në çdo film. Nuk ka ID të përbashkët mes filmave                                                                                                                                            |
| **Director-i (LLM)** `planner/src/director.ts`          | Shpik cast-in: ngjyra, stil flokësh, mjekër                                                                                                                         | Identiteti krijohet nga AI-ja në çdo film, jo zgjidhet nga një katalog                                                                                                                                            |
| **Character Acting** `film/src/rig.ts`                  | `lookFor()` mbush ngjyrat e parazgjedhura sipas ndërtimit (lëkura `#E3A983`, flokët sipas ndërtimit, palltoja `#3D5A80`)                                            | **Engine-i mban kopjen e vet të identitetit**                                                                                                                                                                     |
| **Vizatimi** `rig.ts` + `garments.ts`                   | Cutout në profil, 19 kanale, pa 3/4. Flokët (10 stile), mjekra (4) dhe 39 lloje veshjesh vizatohen në kod                                                           | Çdo stil, veshje ose trup i ri kërkon kod. Pamja është e kufizuar në profil                                                                                                                                       |
| **Paketa** `contracts/src/render-package.ts`            | `Actor`: `rig` (id@version), `appearance` (ngjyrat), `wardrobe` (garments), `features` (flokë, mjekër), për çdo aktor në çdo skenë                                  | Identiteti kopjohet në çdo skenë. Gate-i e kontrollon me `IDENTITY_DRIFT` pikërisht sepse mund të ndryshojë                                                                                                       |
| **Manifesti** `contracts/src/asset-manifest.ts`         | `RigAsset` pranon rig-e nga skedarë (`erkasa.rig.<format>/N`: kocka, kanale, sockets, slots, garments), me hash, provenance, licencë, aprovim                       | **Kontrata është gati për rig-e si të dhëna**, por Engine-i deklaron vetëm `rigSources: ["builtin"]` dhe `rigFormats: ["erkasa.rig.cutout/1"]` (`film/src/capabilities.ts`). `draw.ts` refuzon çdo rig jo-builtin |
| **Gate-i** `gate/src/validate.ts`                       | `RIG_UNSUPPORTED`, `WARDROBE_UNSUPPORTED`, `OUTFIT_INVALID`, `FEATURES_UNSUPPORTED`, `IDENTITY_DRIFT`                                                               | Të ripërdorshme; duhen kontrolle për paketat e karaktereve                                                                                                                                                        |
| **Inteligjenca e veshjeve (W1)** `film/src/wardrobe.ts` | `dressFor` (profesion × rast × mot × periudhë), `resolveWardrobe` (vazhdimësi), `WARDROBE_CHANGE_*`                                                                 | **Ripërdoret.** Do të zgjedhë mes veshjeve që ofron paketa                                                                                                                                                        |
| **Acting (W2)** `perform.ts`, `acting.ts`               | Qëllimi → kanale; `then`, gjestet mbi fjalë, vazhdimësia                                                                                                            | **Ripërdoret.** Kanalet e cutout-it duhet të hartëzohen në profilin standard (§4.4)                                                                                                                               |
| **Biblioteka e vjetër** `assets/characters/`            | 14 karaktere `erkasa.asset/1` + `erkasa.rig/1` (kocka → grupe SVG, pamje përpara dhe anash, veprime sipas pamjes), stil flat. Përdoret vetëm nga `engine/` i vjetër | Modeli i katalogut (metadata, tags, licenca) vlen. Cilësia dhe cutout-i jo                                                                                                                                        |
| **Prototipet v3/v4** `prototypes/character-v4/`         | Anatomi 3D me 130 landmarks, kokë 2.5D, AU, visemes, sy, IK, duar, ecje; matjet (`docs/plans/character-v4-auditimi-animimi.md`)                                     | **Ripërdoren si Character Builder** dhe si algoritme të Character Acting. Nuk janë format runtime                                                                                                                 |

### 1.3 Ku ka kopje të identitetit sot

Identiteti ekziston në katër vende njëherësh **[F]**:

1. plani i filmit, i shpikur nga Director-i;
2. vlerat e parazgjedhura në `rig.ts`;
3. çdo aktor në çdo skenë të paketës;
4. kodi që vizaton flokët dhe mjekrën (`garments.ts`).

Me Character Library mbetet **një**: paketa e karakterit. Plani, paketa e render-it dhe Engine-t vetëm i referojnë asaj.

### 1.4 Çfarë ripërdoret dhe çfarë ndryshon

| Ripërdoret pa ndryshim                                                                | Ripërdoret me përshtatje                                                                                                      | Ndryshon ose ndërtohet                                                                     |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Rruga plan → Stager → paketa → Gate → Renderer                                        | `RigAsset` / Asset Manifest: lloj i ri aseti `character` (shtesë, `/1` mbetet)                                                | Kontrata `erkasa.character/1` (Zod + JSON Schema, si kontratat e tjera)                    |
| `ContainedUri` + `sha256` (skedarë lokalë ose `s3://`), provenance, licenca, aprovimi | `Actor`: `rig` mund t'i referojë një karakteri; shtohet `outfit`; `wardrobe`/`features` ndalohen për karakteret e bibliotekës | Character Runtime: vlerëson paketën (skinning, morph, pamje, teksturë) dhe jep gjeometrinë |
| Kanalet si gjurmë (`channel.<id>`) dhe kontrolli i tyre nga Gate-i                    | `CastMember`: fushë opsionale `character` (ID@version); kur ekziston, ngjyrat dhe tiparet ndalohen                            | Character Library: ruajtja, katalogu, versionet, validimi (CLI)                            |
| Inteligjenca e veshjeve W1, acting W2, vazhdimësia                                    | Director-i zgjedh nga katalogu në vend që të shpikë                                                                           | Character Builder (nga prototipi v4): anatomi, pamje, rig, fytyrë, duar, veshje, tekstura  |
| Skia në renderer (`w0/compositor.ts`)                                                 | Renderer-i vizaton formatin e ri në rrugën Skia                                                                               | Dy karakteret referencë dhe benchmark-u                                                    |
| Rig-u cutout `@1`/`@2`, golden-et B1–B5                                               | —                                                                                                                             | —                                                                                          |

**Ndryshim kundrejt W2-V:** W2-V propozonte modelin e personazhit si kod brenda Character Acting (`film/src/character/`). Kërkesa e re e zëvendëson këtë.

- Modeli bëhet të dhëna në bibliotekë.
- Vizatimi bëhet një interpretues i përgjithshëm (runtime).
- Logjika e shikimit, emocioneve dhe gjesteve e W2-V mbetet te Character Acting.

---

## 2. Arkitektura e propozuar

```
                    ┌──────────────────── AUTORIMI (offline, jo runtime) ────────────────────┐
                    │  Character Builder  (tools/character-builder, nga prototipi v4)         │
                    │  anatomi 3D parametrike → pamje, skelet, mesh, morph, duar, veshje,     │
                    │  tekstura të pjekura → Character Package → fletët e benchmark-ut        │
                    └───────────────────────────────┬────────────────────────────────────────┘
                                                    │ publish (pas benchmark-ut dhe miratimit tënd)
                                                    ▼
                    ┌──────────── CHARACTER LIBRARY (library/characters/, më vonë S3) ─────────┐
                    │  chr_<emri>/<version>/  paketë e pandryshueshme, me hash                 │
                    │  catalog.json: ID, emri, tags, mosha, ndërtimi, veshjet, aftësitë         │
                    └───────┬──────────────────────────┬──────────────────────────┬───────────┘
                            │ katalogu (lexim)          │ resolve(id@version)      │ validate
                            ▼                           ▼                          ▼
             Director / Scene Planning          Stager: e fut paketën në        CLI validate (para
             zgjedh karakterin dhe veshjen       manifest (skedarë + sha256)     publikimit): skema,
             me ID, nuk shpik identitet          dhe shkruan gjurmët             hash-et, kanalet
                            │                           │
                            ▼                           ▼
   ┌─────────────────────── KATËR ENGINE-T (të pandryshuara si përgjegjësi) ─────────────────────┐
   │ World Builder: affordances, shkalla ndaj botës, zonat  ·  Character Acting: performanca →  │
   │ kanalet standarde (pyet runtime-in për gjatësi, sockets, kontakte)  ·  Cinematic Camera:   │
   │ kuadrim nga pikat e paketës, pamjet e mbështetura, LOD  ·  Environmental FX: drita, era    │
   │ mbi flokë dhe rroba (parametrat nga paketa)                                                │
   └──────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                                  ▼
               Gate (kontrollon paketën e fiksuar në paketën e render-it, §5)
                                                  ▼
                         Renderer (rruga Skia): Character Runtime → vizatim
```

| Pjesa                 | Çfarë bën                                                                     | Çfarë **nuk** bën                             | Pse nuk është Engine i pestë                                                                                 |
| --------------------- | ----------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Character Library** | Ruan, versionon, validon dhe ofron paketat; katalogu për planifikimin         | Nuk animon, nuk vendos, nuk renderon          | Është depo asetesh, si Asset Library (`docs/asset-library.md`)                                               |
| **Character Package** | Të dhënat e karakterit                                                        | Nuk ka kod                                    | Është format                                                                                                 |
| **Character Runtime** | Funksion i pastër: paketë + vlerat e kanaleve + pamja → vizatim dhe gjeometri | Nuk zgjedh veprime, emocione, kohë ose kamerë | Është si `contracts` dhe `gate`: bibliotekë e përbashkët, determinist, pa vendime. Engine-t e përdorin       |
| **Character Builder** | Krijon paketa nga parametra anatomie dhe stili                                | Nuk ekzekutohet në prodhimin e videos         | Është mjet autorimi, para Asset Library. Më vonë mund ta thërrasë Asset Generation (Worker 5), jo një Engine |

**Rregulli kryesor:** asnjë Engine nuk lexon direkt bibliotekën. Engine-t e marrin karakterin vetëm nga paketa e render-it, që e ka të fiksuar me hash. Kjo e ruan parimin e E1: Engine-i vizaton vetëm atë që deklaron manifesti.

---

## 3. Vlerësimi i formatit (§4 i kërkesës), me matje

### 3.1 Opsionet

| Opsioni                                                        | Cilësia                                                | Karakter i ri pa kod? | Kthesat                                              | Kostoja **[M]**                                             | Vendimi                                     |
| -------------------------------------------------------------- | ------------------------------------------------------ | --------------------- | ---------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| **A. Kod procedural për çdo karakter** (v4, `rig.cutout`)      | E lartë (v4)                                           | **Jo**                | v4: ±12° nga pamja e pikturuar                       | 2.6 s resvg / 0.65 s Skia për kuadër                        | Jo si runtime. **Po si Builder**            |
| **B. Cutout SVG me kocka** (`erkasa.rig/1` i vjetër)           | Efekt kukulle në nyje (pjesë të ngurta)                | Po                    | Një skedar për pamje                                 | E ulët                                                      | **Jo**: kërkesa e ndalon efektin e kukullës |
| **C. Vektor me skinning dhe morph targets**                    | Skaje të pastra; nyje të lakuara; shprehje me deformim | Po                    | Pamje të autorizuara + deformime këndi brenda pamjes | Gjeometria: **150–160 ms** për kuadër; deformimi **0.7 ms** | **Po: bërthama**                            |
| **D. Teksturë raster mbi mesh të deformuar** (si Spine/Live2D) | Hije të buta, flokë, pëlhurë, pore, pa blur në runtime | Po                    | Si C                                                 | **70 ms** për 4 096 trekëndësha; tegela 0.2/255             | **Po: për shtresat e buta**                 |
| **E. Model 3D + render jo-fotorealist**                        | Kthesa falas                                           | Po                    | Të plota                                             | Renderer i ri dhe GPU                                       | **Jo**: ndalohet nga kërkesa dhe MA-D3      |

### 3.2 Matjet

Skripti: `prototypes/character-library/spike/formats.mjs` → `spike/out/formats.json`. Makina: 2 vCPU, pa GPU. Rasterizuesit janë ata të repo-s.

**M1: Sa kushton gjeometria dhe sa filtrat.** Kuadrot v4 200 dhe 450, 389–391 elemente me filtër:

| Rasterizuesi | Me filtrat (si v4) | Pa filtrat (vetëm gjeometria) | Pjesa e filtrave |
| ------------ | ------------------ | ----------------------------- | ---------------- |
| resvg        | 2 632–2 675 ms     | 151–160 ms                    | **94%**          |
| Skia         | 625–703 ms         | 149–162 ms                    | **76%**          |

**M2: Teksturë mbi mesh të deformuar në Skia.** Rajoni 760×1520 px, me pattern për çdo trekëndësh:

| Mesh-i | Trekëndësha | Koha për kuadër | Tegelat (kundrejt teksturës së plotë) |
| ------ | ----------- | --------------- | ------------------------------------- |
| 16×32  | 1 024       | 71 ms           | 0.18/255; 0.13% > 8/255               |
| 32×64  | 4 096       | 71 ms           | 0.21/255; 0.15% > 8/255               |
| 64×128 | 16 384      | 135 ms          | 0.29/255; 0.38% > 8/255               |

Deri te 4 096 trekëndësha kostoja varet nga sipërfaqja, jo nga numri. Rezultati vizual është në `spike/out/mesh-deformed-32x64.png`: pa tegela të dukshme.

**M3: Disa karaktere në të njëjtin kuadër.** Shkallëzimi është linear:

| Karaktere | resvg (me filtra) | Skia (me filtra) | Skia (pa filtra) |
| --------- | ----------------- | ---------------- | ---------------- |
| 1         | 2 486 ms          | 669 ms           | 157 ms           |
| 2         | 4 989 ms          | 1 285 ms         | 294 ms           |
| 3         | 7 406 ms          | 1 888 ms         | 409 ms           |

**M4: Skinning + morph targets në JS.** 24 000 pika kontrolli, 60 kocka (4 për pikë) dhe 40 morph targets (15% e pikave secili): **0.67 ms për kuadër.**

### 3.3 Përfundimi

**[R]** Formati `erkasa.character/1`:

- **Pjesë vektoriale** (C) për gjithçka që duhet të jetë e mprehtë dhe e deformueshme: silueta, vijat, sytë, buzët, gishtat, skajet e rrobave.
- **Pjesë me teksturë** (D) për gjithçka që sot bëhet me blur dhe turbulencë në runtime: hijet e buta, flokët, poret, pëlhura.
  - Teksturat **piqen** nga Builder-i në kohën e autorimit, kështu kostoja kalon nga çdo kuadër te një herë për paketë.
- **E njëjta deformim për të dyja:** skelet me pesha + morph targets (shprehje, visemes, deformime këndi).
- **Pamje të autorizuara** (§4.3), jo ri-projektim i një pamjeje të vetme. Ri-projektimi v4 u prish jashtë ±12°.
- **Pa filtra blur ose turbulencë në runtime** brenda karakterit. Gate-i i refuzon.
- **Vizatimi në rrugën Skia** që ekziston tashmë në renderer. Resvg mbetet për filmat ekzistues.

**Vlerësimi i kostos [S]:** gjeometria rreth 150 ms + teksturat rreth 70 ms + deformimi dhe acting-u nën 15 ms ≈ **0.25 s për karakter në kuadër për bërthamë**. Kundrejt 4.1 s të v4, kjo është rreth 16 herë më pak. Do të provohet në Fazën 4 me karakteret e vërteta.

**Rreziku i formatit:** teksturat kanë rezolucion të kufizuar.

- Builder-i i pjek në 2× madhësinë maksimale në ekran për close-up (koka rreth 1 400 px).
- Paketa ka nivele LOD: close-up, medium, wide.
- Madhësia e paketës vlerësohet 20–60 MB për karakter [S] dhe matet në Fazën 3.

---

## 4. Character Package: formati

### 4.1 Struktura e skedarëve

```
library/characters/chr_daniel/3/
  character.json          erkasa.character/1: identiteti, metadata, aftësitë, lista e skedarëve me sha256
  skeleton.json           kockat (hierarkia, gjatësitë, kufijtë), zinxhirët IK, sockets, pikat e kontaktit,
                          kapsulat e trupit (për përplasjet me rrobat dhe objektet)
  channels.json           profili standard erkasa.humanoid/1 → deformuesit e këtij karakteri
  views/
    front/  q3_left/  q3_right/  profile_left/  profile_right/  back/   (+ pamjet e ndërmjetme)
      parts.json          pjesët: lloji (vector | texture), rendi i vizatimit, mesh-i, peshat, morph targets
      vector/*.json       konturet si pika kontrolli (jo SVG i lirë): path-e, mbushje, gradientë
      texture/*.webp      tekstura të pjekura sipas LOD (close/medium/wide)
  face/
    aus.json              Action Units → morph targets për çdo pamje
    eyes.json             qendra e syrit, rrezja, irisi, bebëza, konturet e qepallave, kufijtë e shikimit
    visemes.json          15 visemes → kombinime AU (të kalibruara për këtë fytyrë)
    expressions.json      opsionale: nuanca të veçanta të këtij personazhi (p.sh. buzëqeshja e tij)
  hands/
    poses.json            gishtat si kocka (3 për gisht) + poza bazë: e hapur, e çlodhur, grusht, tregon,
                          kap (letër, filxhan, dorezë), pëllëmbë lart; pamjet e pëllëmbës dhe të shpinës
  hair/
    dynamics.json         parametrat e lëvizjes sekondare (spring) për grupe flokësh
  wardrobe/
    casual_01/  business_01/  formal_01/ ...
      outfit.json         garments (GarmentKind i W1), etiketat, ngjyrat e lejuara, rendi i shtresave,
                          pjesët e trupit që fsheh, parametrat e pëlhurës, kapsulat e përplasjes
      views/<view>/...    pjesë vektoriale dhe tekstura, të lidhura me të njëjtin skelet
  preview/                turnaround, shprehjet, duart, veshjet (fletët e benchmark-ut A dhe E)
  benchmark.json          rezultatet e benchmark-ut dhe referenca e raportit
```

### 4.2 `character.json` (skica e kontratës)

Vlerat janë ilustruese.

```jsonc
{
  "schema": "erkasa.character/1",
  "id": "chr_daniel",
  "version": 3,
  "name": "Daniel Vos",
  "identity": {
    // i pandryshueshëm mes versioneve; ndryshimi = karakter i ri
    "build": "man",
    "age": 44,
    "heightCm": 181,
    "proportions": { "heads": 7.4, "shoulderWidthCm": 46, "hipWidthCm": 36 },
    "skin": { "base": "#C99A7A", "shadow": "#9C6E55" },
    "eyes": { "iris": "#5B4632" },
    "hair": { "style": "side_part", "color": "#2B2118", "density": "full" },
    "facialHair": "beard",
    "marks": ["asymmetric_brow_left"],
    "anatomyHash": "sha256:…", // hash i landmarks dhe masave nga Builder-i
  },
  "fingerprint": "sha256:…", // nga identity: e njëjta për çdo version të këtij karakteri
  "formats": { "rig": "erkasa.rig.layered/1", "channels": "erkasa.humanoid/1" },
  "views": [{ "id": "q3_right", "yaw": [10, 40], "pitch": [-15, 20], "mirrorOf": null }],
  "capabilities": {
    "face": {
      "aus": [
        "AU1",
        "AU2",
        "AU4",
        "AU5",
        "AU6",
        "AU7",
        "AU9",
        "AU10",
        "AU12",
        "AU15",
        "AU17",
        "AU20",
        "AU23",
        "AU25",
        "AU26",
      ],
      "visemes": 15,
      "eyes": "independent",
      "blink": true,
    },
    "body": { "locomotion": ["walk", "stop", "turn"], "run": false, "sit": true, "bend": true },
    "hands": {
      "fingers": "articulated",
      "poses": ["open", "relaxed", "fist", "point", "pinch", "grip_cylinder", "palm_up"],
    },
    "interactions": ["reach", "grasp", "hold", "lift", "release", "point", "touch"],
    "lod": ["close", "medium", "wide"],
  },
  "wardrobe": [
    { "id": "casual_01", "tags": ["casual", "contemporary"], "garments": ["sweater", "jeans", "sneakers"] },
  ],
  "files": [{ "path": "skeleton.json", "sha256": "…" }],
  "provenance": { "origin": "builder", "by": "character-builder@1.0.0", "inputsSha256": "…" },
  "license": "LicenseRef-Erkasa-Original",
  "approval": { "status": "approved", "by": "Ergi Kasa", "at": "…" },
}
```

### 4.3 Pamjet dhe kthesat

- **Pamjet e parazgjedhura:**
  - ballë (0°);
  - 3/4 majtas dhe djathtas (rreth 25°);
  - gjysmë-profil (rreth 50°);
  - profil majtas dhe djathtas (90°);
  - nga pas.
- **Pamje të ndërmjetme:** Builder-i mund të shtojë të tjera, p.sh. çdo 15°, sepse i gjeneron nga e njëjta anatomi 3D. Dendësia e pamjeve është e dhënë e paketës, jo kod.
- **Brenda një pamjeje:** morph targets këndi (`yaw±`, `pitch±`) mbulojnë ±7–15°.
- **Ndërrimi i pamjes:** bëhet në kufi, me një kalim të shkurtër (2–3 kuadro) të deklaruar në paketë. QC-ja kontrollon që të mos ketë kërcim.
- **Pasqyrimi:** një pamje mund të deklarohet `mirrorOf` vetëm nëse personazhi është simetrik. Daniel nuk është (vetulla, ndarja e flokëve), ndaj ka pamje të veçanta majtas dhe djathtas.
- **Koka dhe trupi kanë pamje të veçanta.** Koka mund të jetë 3/4 ndërsa trupi është në profil.

### 4.4 Profili standard i kanaleve `erkasa.humanoid/1`

Character Acting drejton çdo karakter me të njëjtat kanale. Paketa i hartëzon te deformuesit e vet. Kështu një karakter i ri hyn pa ndryshuar Engine-in.

| Grupi     | Kanalet                                                                                       |
| --------- | --------------------------------------------------------------------------------------------- |
| Rrënja    | `root.x`, `root.y`, `root.scale`, `body.yaw` (zgjedh pamjen e trupit)                         |
| Shtylla   | `pelvis.tilt`, `pelvis.rot`, `spine.1–3` (përkulje, rrotullim), `breath`                      |
| Koka      | `neck`, `head.yaw`, `head.pitch`, `head.roll` (zgjedh pamjen e kokës)                         |
| Sytë      | `gaze.x`, `gaze.y`, `gaze.z` (objektivi 3D; çdo sy veç), `lid.L`, `lid.R`, `pupil`            |
| Fytyra    | `au.<FACS>` (0–1), `jaw`, `viseme.<id>` (0–1, i përzier nga Character Acting)                 |
| Krahët    | `shoulder.L/R` (lart, përpara), `arm.L/R` (2 kocka), `wrist.L/R`; IK nga objektivi i dorës    |
| Duart     | `hand.L/R.pose` (përzierje e pozave të paketës), `finger.L/R.<gisht>.curl`, `hand.L/R.spread` |
| Këmbët    | `leg.L/R` (2 kocka), `ankle.L/R`, `toe.L/R`; IK nga pika e këmbës                             |
| Sekondare | `hair.wind`, `cloth.wind` (nga Environmental FX); springs-at i llogarit Runtime-i nga lëvizja |

**Mbështetja për filmat ekzistues:** kanalet e sotme të cutout-it (`torso`, `head`, `gx`, `gy`, `lid`, `brow`, `mouth`, `arm`...) mbeten për `rig.cutout@1/@2`. Nuk ka përkthim të detyrueshëm.

### 4.5 Fytyra, sytë dhe duart

- **Fytyra:** 15 AU nga prototipi v4, si morph targets për çdo pamje.
  - Builder-i i nxjerr nga fushat Gaussian të v4; runtime-i vetëm i përzien.
  - Rrudhat dhe hijet e shprehjes janë shtresa teksture që shfaqen sipas AU-ve, jo blur.
- **Sytë:**
  - sklera, irisi dhe bebëza janë vektor;
  - irisi shkurtohet sipas këndit të shikimit;
  - qepallat janë konture të veçanta që ndjekin shikimin vertikal (si te v4);
  - kufiri i shikimit është në `eyes.json`.
- **Visemet:** 15 kombinime AU të kalibruara për çdo fytyrë. Lip-sync-u vazhdon nga `TimedWord` i pipeline-it.
- **Duart:**
  - 3 kocka për gisht;
  - pamje të veçanta për pëllëmbën dhe për shpinën e dorës;
  - pozat e kapjes kanë pikën `grip` që përputhet me `Affordance.grip` të World Builder.

### 4.6 Veshjet (§6 i kërkesës)

- **Një outfit është pjesë e paketës, jo karakter i ri.** Ka ID, etiketa (`casual`, `business`, `formal`, `historical`, `uniform`, periudha, profesioni) dhe listën e garments me `GarmentKind` të W1. Kështu rregullat e W1 (`outfitProblems`, periudha, profesioni, moti) vlejnë pa ndryshim.
- **Përshtatja:**
  - Builder-i ka modele veshjesh (një bibliotekë garments) dhe i përshtat sipas trupit të karakterit, si offset i sipërfaqes së trupit (mënyra e guaskave v4).
  - Veshja lidhet me të njëjtin skelet dhe me të njëjtat pesha, kështu ndjek lëvizjen pa kod të veçantë.
- **Pa clipping:**
  - çdo garment deklaron pjesët e trupit që fsheh;
  - pëlhura ka kapsula përplasjeje kundrejt trupit;
  - lëvizja sekondare (follow-through, era) ka parametra në paketë.
- **Ngjyrat:** një outfit mund të deklarojë ngjyrat e lejuara për garments brenda paletës. Lëkura, flokët dhe sytë nuk ndryshojnë kurrë.
- **Zgjedhja:** Character Acting (W1, `wardrobe.ts`) zgjedh mes veshjeve që ofron paketa, sipas kontekstit dhe vazhdimësisë. Director-i mund ta kërkojë ose ta sugjerojë me ID.

### 4.7 Versionimi dhe kompatibiliteti

| Rregulli                       | Detaji                                                                                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paketat janë të pandryshueshme | `chr_daniel@3` ka gjithmonë të njëjtat bajte (sha256 për çdo skedar dhe për `character.json`). Filmat e fiksojnë versionin                                                               |
| Version i ri                   | Rregullim arti, pamje e re, veshje e re, AU e re. **Identiteti nuk ndryshon:** `fingerprint` mbetet i njëjtë dhe kontrollohet nga CLI-ja dhe nga krahasimi vizual i turnaround-it (§9.A) |
| Identitet tjetër               | ID tjetër (`chr_daniel_young`), jo version i ri                                                                                                                                          |
| Formati                        | `erkasa.character/1`. Fusha opsionale të reja e mbajnë `/1`; ndryshimi i kuptimit kalon në `/2`. Renderer-i publikon formatet që vizaton (`characterFormats`), si `rigFormats` sot       |
| Kanalet                        | `erkasa.humanoid/1`. Shtesat e mbajnë `/1`; riemërtimi kalon në `/2`                                                                                                                     |
| Filmat ekzistues               | Plani pa `character` → rruga e sotme (`rig.cutout@1/@2`), byte për byte. Golden-et nuk preken                                                                                            |

---

## 5. Kontrata që konsumojnë Engine-t

Ndryshimet janë vetëm shtesa; asnjë fushë ekzistuese nuk ndryshon kuptim.

| Kontrata                            | Ndryshimi                                                                                                                                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contracts/src/character.ts` (e re) | `CharacterPackage`, `Skeleton`, `View`, `Part`, `Outfit`, `Capabilities` (Zod → JSON Schema, me fixtures)                                                                                                                                               |
| `erkasa.assets/1` (Asset Manifest)  | Lloji i ri `character`: `id`, `version`, `format: "erkasa.character/1"`, burimi (skedarët me sha256, lokalë ose `s3://`), `fingerprint`, provenance, licenca, aprovimi                                                                                  |
| `erkasa.render/1` (paketa)          | `Actor.rig` mund t'i referojë një aseti `character`. Shtohet `outfit` (ID e veshjes në paketë) dhe `colorway` opsional. Për karakteret e bibliotekës: `appearance` bosh, `wardrobe` dhe `features` të ndaluar (identiteti dhe veshjet vijnë nga paketa) |
| `erkasa.film/1` (plani)             | `CastMember.character` opsional (`chr_daniel@3`). Kur ekziston, ndalohen `coat`, `hair`, `skin`, `hairStyle`, `facialHair`, dhe `outfits[]` i referojnë veshjeve të paketës                                                                             |
| Capabilities e Engine-it            | `characterFormats: ["erkasa.character/1"]`, `channelProfiles: ["erkasa.humanoid/1"]`                                                                                                                                                                    |

**Kontrollet e reja të Gate-it:**

| Kodi                 | Kur refuzohet                                                               |
| -------------------- | --------------------------------------------------------------------------- |
| `CHARACTER_UNKNOWN`  | Referencë që nuk është në manifest                                          |
| `CHARACTER_HASH`     | Bajtet nuk përputhen me sha256                                              |
| `CHARACTER_FORMAT`   | Format që renderer-i nuk e vizaton                                          |
| `CHANNEL_UNDECLARED` | Kanal jashtë profilit ose jashtë kufijve të paketës                         |
| `VIEW_UNSUPPORTED`   | Kënd koke ose trupi jashtë pamjeve të paketës                               |
| `CAPABILITY_MISSING` | Veprim që paketa nuk e deklaron (p.sh. `run`)                               |
| `OUTFIT_UNKNOWN`     | Veshje që nuk është në paketë (ekziston sot për planin; zgjerohet)          |
| `IDENTITY_FIELDS`    | Ngjyra ose tipare identiteti në një aktor që përdor karakter nga biblioteka |
| `RUNTIME_FILTER`     | Filtër blur ose turbulence brenda pjesëve të karakterit                     |

**Si e përdor çdo Engine paketën:**

| Engine               | Merr nga paketa (përmes Runtime-it)                                                                     | Jep                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Character Acting** | Gjatësitë e kockave, kufijtë, zinxhirët IK, sockets, pikat e kontaktit, pamjet, AU-të, visemet, veshjet | Gjurmët e kanaleve `erkasa.humanoid/1`, veshjen e zgjedhur, event-et e mbajtjes |
| **World Builder**    | Lartësinë dhe kapsulat (për shkallën dhe zonat e ecshme), pikat e kapjes së dorës                       | Pozicionet, affordances, kufizimet                                              |
| **Cinematic Camera** | Kutitë e kokës, syve dhe trupit për çdo pamje; pamjet e mbështetura; LOD-et                             | Kuadrimin; LOD-in sipas madhësisë së personazhit në kuadër                      |
| **Environmental FX** | Parametrat e flokëve dhe pëlhurës ndaj erës; zonat ku bie drita (rim, hija)                             | Kanalet `hair.wind`, `cloth.wind`, dritën                                       |

---

## 6. Ruajtja dhe Character Library

- **Vendi në fillim:** `library/characters/<id>/<version>/` në repo, me teksturat në Git LFS, plus `library/catalog.json` (gjenerohet nga paketat).
- **Më vonë:** pasqyrë në S3. `ContainedUri` e mbështet tashmë `s3://` me sha256.
- **CLI** `character-library` me komandat:
  - `validate` (skema, hash-et, pamjet, kanalet, mungesa e filtrave në runtime);
  - `catalog` (rindërton katalogun);
  - `preview` (fletët e benchmark-ut);
  - `publish` (shton versionin vetëm me `approval` tënd).
- **Katalogu** është ajo që sheh Director-i: ID, emri, mosha, ndërtimi, tags, veshjet, aftësitë kryesore. Nuk përmban art.
- **Brenda fushës së këtij versioni:** vetëm karakteret e katalogut zyrtar. Nuk ka ngarkime nga përdoruesi dhe nuk ka auto-rig.

---

## 7. Performanca (§10 i kërkesës)

**Buxheti i standardit** (§13): ≤ 10 min render për 60 s video në makinën referencë. Në 2 bërthama kjo jep rreth **0.67 s për kuadër për bërthamë për gjithë kuadrin**.

**Objektivat e propozuara për karakterin, në rrugën Skia, për bërthamë [S]** (të kalibruara pas Fazës 4):

| Rasti                        | Objektivi për kuadër | Bazuar te                                   |
| ---------------------------- | -------------------- | ------------------------------------------- |
| 1 karakter, close-up         | ≤ 0.35 s             | M1 pa filtra (150 ms) + M2 (70–135 ms) + JS |
| 1 karakter, medium           | ≤ 0.30 s             | idem                                        |
| 1 karakter, wide             | ≤ 0.20 s             | LOD wide                                    |
| 2 karaktere, medium          | ≤ 0.60 s             | M3: linear                                  |
| Deformimi (skinning + morph) | ≤ 15 ms/karakter     | M4: 0.7 ms për 24 000 pika                  |
| Fytyra (AU + sytë + visemet) | ≤ 5 ms/karakter      | M4                                          |
| Memoria për proces           | ≤ 600 MB             | v4: 337 MB pa tekstura                      |

**Çfarë matet në Fazën 4:**

- koha për kuadër (min, mediana, p95) sipas planit (close, medium, wide);
- CPU% dhe GPU (nuk ka);
- memoria maksimale dhe trendi i saj;
- kostoja e deformimit, e fytyrës dhe e trupit veç e veç;
- 1, 2 dhe 3 karaktere në të njëjtën skenë;
- madhësia e paketës dhe koha e ngarkimit.

Çdo optimizim (LOD, cache i pjesëve që nuk deformohen, madhësia e teksturave) pranohet vetëm me matje para/pas dhe me ndryshimin e figurës të matur, si në auditimin v4.

---

## 8. Plani i implementimit (§11 i kërkesës)

Çdo fazë:

- ka branch-in e vet, testet, before/after dhe video reale;
- kërkon miratimin tënd në fund;
- nuk prek `main`, golden-et B1–B5 ose filmat ekzistues;
- nuk përfshin W3;
- nuk merr GPU pa benchmark (MA-D3).

| Faza                                                      | Puna                                                                                                                                                                                                                                                                                                                         | Kriteret e pranimit                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Repository Audit**                                   | Ky dokument + matjet e formatit                                                                                                                                                                                                                                                                                              | **Pret miratimin tënd**                                                                                                                                                                                                                                                                               |
| **2. Architecture & Character Package** (`cl-2-contract`) | `contracts/src/character.ts` + JSON Schema + fixtures. Character Runtime (paketë + kanale → vizatim dhe gjeometri) mbi rrugën Skia. CLI `character-library validate`. Një **karakter test sintetik** (forma të thjeshta, 2 pamje, 1 veshje) që provon çdo pjesë të formatit. Asnjë ndryshim i renderer-it të filmave         | Skemat validojnë fixtures dhe refuzojnë 20+ raste të gabuara. Runtime-i vizaton karakterin test në 2 pamje, me skinning, morph dhe teksturë, deterministikisht (dy run-e = të njëjtat piksele). Kosto e matur për karakterin test. Të gjitha testet ekzistuese kalojnë. B1–B5 bajt për bajt të njëjta |
| **3. Master Characters** (`cl-3-masters`)                 | Character Builder nga prototipi v4. **Mashkulli referencë** (Daniel, identiteti v4 i rindërtuar në format) dhe **femra referencë** (brief në §10). Pamjet (§4.3), skeleti, fytyra, sytë, duart me gishta, 3 veshje secili, teksturat e pjekura, LOD-et. **Para animimit:** fletët e modelit (benchmark A) për miratimin tënd | Benchmark A kalon (§9). Paketat kalojnë `validate`. Identiteti: raportet e landmarks mes pamjeve brenda 2%, ngjyra e lëkurës dhe flokëve ΔE ≤ 2. Rubrika jote ≥ 4 për pamjen, anatominë dhe trupin në nivelin e fytyrës. Madhësia e paketave e matur                                                  |
| **4. Animation Validation** (`cl-4-validation`)           | Character Acting (W2 + algoritmet v4) drejton kanalet `erkasa.humanoid/1` në skena prototip: ecje, ndalim, kthim, ulje/ngritje, gjeste, fytyrë, shikim, objekte, veshje, dy karaktere. Matjet e performancës (§7)                                                                                                            | Benchmark B–E kalon me video, contact sheet dhe matje automatike. Performanca brenda objektivave të §7 ose devijimi i dokumentuar me shkakun dhe planin                                                                                                                                               |
| **5. Integration** (`cl-5-integration`)                   | Lloji `character` në manifest; `Actor.outfit`; `CastMember.character`; Stager-i fut paketat; Gate-i me kodet e §5; renderer-i vizaton `erkasa.character/1` në rrugën Skia; Director-i zgjedh nga katalogu; W1 zgjedh nga veshjet e paketës; vlerat e parazgjedhura të identitetit në `rig.ts` mbeten vetëm për `@1/@2`       | Të gjitha testet ekzistuese kalojnë. B1–B5 dhe W0 bajt për bajt të njëjta (hash). Një plan i ri me dy karaktere të bibliotekës kalon gjithë rrugën: plan → Stager → paketa → Gate → video. Asnjë Engine nuk lexon direkt bibliotekën (test importesh). Asnjë Engine i pestë                           |
| **6. Benchmark & Approval** (`cl-6-benchmark`)            | Benchmark-u i plotë A–E + performanca për të dy karakteret, në skena reale; raport me video, contact sheet, matje dhe rubrikë                                                                                                                                                                                                | Të gjitha kriteret hard-pass kalojnë. Rubrika [H] ≥ 4 për P0. **Ndalim për miratimin tënd** para fazës pasuese (p.sh. karaktere të tjera)                                                                                                                                                             |

---

## 9. Benchmark-u i pranimit (§9 i kërkesës), me kritere të matshme

| Pjesa                     | Testi                                                                    | Kriteri                                                                                                                                                                                                                                                         | Matja       |
| ------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **A. Visual Quality**     | Ballë, 3/4, profil, trupi i plotë, close-up i fytyrës; turnaround 0→180° | Raportet e landmarks (distanca e syve / lartësia e fytyrës, hunda / fytyra) brenda 2% mes pamjeve. ΔE ≤ 2 për lëkurën dhe flokët. Turnaround pa kërcime (diferenca mes kuadrove ≤ 2× mesatarja). Rubrika ≥ 4                                                    | [A]+[V]+[H] |
| **B. Facial Performance** | ≥ 5 emocione; ndjekja me sy; pulitja; rrotullimi i kokës; të folurit     | Test i verbër: ≥ 4 nga 5 emocione të njohura nga ti dhe 2 vlerësues. Gabimi i shikimit ≤ 3°; syri para kokës 2–8 kuadro (CA-B3). Pulitja 100–250 ms. Goja hapet vetëm brenda fjalëve ±2 kuadro (CA-P3), me audio reale ElevenLabs (ti e ekzekuton `pnpm video`) | [A]+[H]     |
| **C. Body Mechanics**     | Ecje, ndalim, kthim, transferim peshe, ulje dhe ngritje, gjeste          | Rrëshqitja e këmbës ≤ 2 px/kuadër (CA-A3). Kthimi pa kërcim pamjeje. Legeni mbi këmbën mbështetëse. Ijet në `seat` ±4 px (CA-A2). Gjestet me 3 faza, 0.4–2.5 s (CA-B2)                                                                                          | [A]+[V]     |
| **D. Object Interaction** | Arrij, kap, mbaj, ngre, lësho                                            | Pika `grip` ≤ 3 px nga socket-i i dorës në çdo kuadër (CA-D1). Gishtat nuk hyjnë në objekt > 2 px                                                                                                                                                               | [A]         |
| **E. Wardrobe**           | 3 veshje për secilin karakter, në lëvizje                                | `fingerprint` i njëjtë. 0 piksele lëkure ose trupi përmes rrobave (maskë debug mbi kuadrot e testit). Ndjekja ≤ 0.12/kuadër, qetësimi ≤ 0.4 s (CA-W4)                                                                                                           | [A]+[V]     |
| **P. Performanca**        | §7                                                                       | Objektivat e §7                                                                                                                                                                                                                                                 | [M]         |

Çdo test prodhon video të renderuar, contact sheet dhe JSON me matjet, si në auditimin v4.

---

## 10. Vendimet që kërkohen nga ti

1. **Formati:** vektor + tekstura mbi mesh, me skelet, morph targets dhe pamje të autorizuara, i vizatuar në rrugën Skia (§3). Alternativa është të vazhdojmë me vektor të pastër me filtra: cilësi e njëjtë, por rreth 4–16 herë më e shtrenjtë sipas matjeve.
2. **Autorimi:**
   - Character Builder parametrik (kod, nga v4) si rruga kryesore.
   - Formati mbetet i hapur për një artist, që mund të japë pjesë për çdo pamje. Importuesi për artistin nuk është pjesë e këtij versioni.
3. **Mashkulli referencë:** a e vazhdojmë Daniel Vos (identiteti v4) apo do një personazh tjetër?
4. **Femra referencë:** propozoj një grua 35–40 vjeç, profesioniste, flokë deri te supet, pa syze, në të njëjtin stil. Ndrysho çfarë të duash: mosha, pamja, profesioni.
5. **Ruajtja:** `library/characters/` në repo me Git LFS për teksturat, dhe S3 më vonë. Alternativa është S3 që në fillim.

**Ndalem këtu.** Pres miratimin tënd të këtij plani para Fazës 2.
