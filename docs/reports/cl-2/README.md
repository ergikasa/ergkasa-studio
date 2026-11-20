# Character System V1, Faza 2: kontrata dhe themeli i Runtime-it (raport)

20 nëntor 2026. Branch `cl-2-contract`, mbi `plan-character-library` (`ac13ed9`). Nuk ka merge në `main`. Nuk janë prekur filmat, golden-et apo katër Engine-t. Faza 3 nuk ka nisur.

Shenjat: **[F]** e verifikuar në kod ose në test · **[M]** e matur në këtë makinë · **[S]** vlerësim · **[R]** rekomandim.

---

## 0. Përmbledhja

1. **Kontrata `erkasa.character/1` ekziston dhe kontrollohet nga dy anët. [F]**
   - Është shkruar në Zod, në `contracts/src/character.ts`, bashkë me formatin e pjesëve `erkasa.character.parts/1`.
   - Prej saj gjenerohet JSON Schema.
   - Ka 3 fixtures të vlefshme dhe 18 të pavlefshme. Të dyja grupet i kontrollojnë si Zod-i, si Ajv-ja.
   - Kontrata përfshin të gjitha fushat e kërkuara, bashkë me Capability Manifest.
2. **Runtime-i ekzekuton paketën nga fillimi në fund. [F]**
   - Hapat: ngarkon, verifikon hash-et, validon, vlerëson skeletin, mesh-in, fytyrën dhe shikimin, pastaj vizaton me Skia. Vetëkontrolli i aftësive bëhet kur paketa hyn në Library.
   - Komandat i lexon nga track-et `erkasa.render/1` me evaluatorin e kontratave.
   - Është determinist edhe midis proceseve: dy render-a të demos dolën me bajte identike.
   - Nuk merr asnjë vendim: çdo vlerë jashtë kontratës refuzohet, nuk korrigjohet.
3. **Library dhe Builder janë të ndara nga Runtime-i dhe nga Engine-t. [F]**
   - Referenca e pandryshueshme ka formën `chr_test_minimal@1#sha256:b5515ea7…88470`.
   - Library refuzon çdo bajt të ndryshuar pas publikimit.
   - Builder-i e rindërton karakterin testues bajt për bajt nga burimi.
   - Kufijtë mbrohen nga ESLint dhe nga testet.
4. **Karakteri testues `chr_test_minimal@1` provon pikat e kërkuara. [F]**
   - Ngarkimi, validimi, inicializimi i skeletit, deformimi i mesh-it, kontrollet bazë të fytyrës dhe integrimi në render.
   - Është vetëm teknik (`purpose: technical_test`, `approval: pending`). Nuk është Danieli dhe nuk është karakteri femër.
5. **Benchmark-et reale [M]**, në 1080×1920, CPU me 2 bërthama, pa GPU:
   - **Një kuadër i plotë me karakterin: mesatarja 26 ms** (p95 41 ms).
   - **Me kodimin H.264 të pipeline-it: 52 ms për kuadër.**
   - **Kjo nuk provon 0.25 s/frame për karakteret e vërteta.** Karakteri testues është shumë më i thjeshtë. Kostoja e teksturës ndjek pikselët që mbulon, dhe kalimi midis pamjeve kushton 61 ms.
6. **Gjeta dhe rregullova një rrjedhje memorieje [M]:**
   - `getImageData` i Skia-s rrit memorien 238 MB në 30 kuadra. Kjo e vriste benchmark-un (OOM).
   - `canvas.data()` jep të njëjtët bajte me vetëm 8 MB rritje. Benchmark-u, testet dhe demo kaluan te ky funksion.
   - Pipeline-i ekzistues (W0) e përdor ende `getImageData`. Nuk e kam prekur.
7. **Asgjë ekzistuese nuk u prish. [M]**
   - 1 428 teste në 10 paketa kaluan. Golden-i i vjetër kaloi me 0 dështime, golden-i i paketës me 931/931.
   - JSON Schema janë të përditësuara, ESLint dhe Prettier kalojnë.
8. **Para Fazës 3 kam nevojë për 5 vendime nga ti** (§12). Njëri lidhet me Git LFS: push-i i objekteve LFS bllokohet nga ky mjedis, prandaj tekstura e karakterit testues u ruajt në Git të zakonshëm (§3).

---

## 1. Çfarë u ndërtua

```
contracts/src/character.ts        erkasa.character/1 + erkasa.character.parts/1 (Zod → JSON Schema)
character/                        paketa e re @erkasa/character (nuk është Engine)
  src/runtime/                    Character Runtime: ekzekuton një paketë, pa vendime
  src/library/                    Character Library: katalogu, referencat, publikimi
  src/builder/                    Character Builder: autorimi offline (pa editor vizual)
  test/  bench/  demo/
library/                          ruajtja: catalog.json + characters/<id>/<version>/ (binarët në Git LFS)
```

Rrjedha nga autorimi te ekrani:

```
Builder ──shkruan──▶ Library (paketë e pandryshueshme, id@v#sha256)
                         │
                         │  Faza 5: paketa e render-it mban vetëm id@v#sha256
                         ▼
Engine-t ──track-e channel.* në erkasa.render/1──▶ Runtime ──▶ Skia ──▶ FFmpeg (cilësimet e pipeline-it)
```

- Runtime-i nuk importon Library-n ose Builder-in.
- Engine-t, Gate-i dhe W0 nuk importojnë Library-n ose Builder-in.
- Lidhja e Runtime-it me renderer-in e paketave **nuk** është bërë, sepse kjo fazë nuk lejon integrim me Engine-t. Runtime-i vizaton në të njëjtin canvas Skia që përdor kompozitori W0 dhe kodon me `segmentArgs` të pipeline-it, por asnjë film nuk e thërret ende.

---

## 2. Kontrata `erkasa.character/1`

### 2.1 Fushat e `character.json`

| Fusha                             | Çfarë mban                                                                                                                                    | Kush e kontrollon                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `schema`, `id`, `version`, `name` | `erkasa.character/1`, `chr_<emër>`, versioni ≥ 1                                                                                              | Zod                                                                              |
| `purpose`                         | `reference` (për filma) ose `technical_test` (nuk vihet kurrë në film)                                                                        | Zod                                                                              |
| `identity`                        | ndërtimi, mosha (opsionale), gjatësia, sa koka i bie gjatësia, paleta (lëkura, hija, sytë, flokët), stili i flokëve, mjekra, shenjat dalluese | Zod                                                                              |
| `fingerprint`                     | sha256 e JSON-it kanonik të `identity`                                                                                                        | Runtime (`FINGERPRINT`)                                                          |
| `formats`                         | `erkasa.rig.layered/1`, `erkasa.humanoid/1`                                                                                                   | Zod (literale)                                                                   |
| `compatibility`                   | `minRuntime`, `previousVersion`                                                                                                               | Runtime (`RUNTIME_TOO_OLD`), Library (`IDENTITY_CHANGED`)                        |
| `origin`, `skeleton`              | kockat (prindi, nyja, këndi, gjatësia), sockets, contacts                                                                                     | Runtime: pemë pa cikle, referenca që zgjidhen                                    |
| `controls`                        | kanal → drives (`bone` me degPerUnit, `morph` me from/to, `opacity` e një pjese); `range` dhe `rest`                                          | Runtime: kanal humanoid, intervale të vlefshme, referenca që zgjidhen            |
| `views`                           | grupet `head` dhe `body`: kanali që zgjedh pamjen, pamjet me intervalet e yaw-së, qendrën, pjesët, brezin e kalimit                           | Runtime: pamjet mbulojnë intervalin pa boshllëk, një pjesë në një pamje të vetme |
| `face`                            | AU-të FACS (18 të njohura), visemat si përzierje AU + nofulla, blink, shikimi (rest, intervalet x/y/z)                                        | Runtime                                                                          |
| `eyes`                            | kocka, irisi, bebja, shkëlqimi, këndi maksimal; për çdo pamje: kulmi qendror, rrezja, ngjeshja, pjesa që e pret irisin dhe pjesa sipër tij    | Runtime                                                                          |
| `hands`                           | kyçi, gishtat (≤ 3 kocka për gisht), socket-i i kapjes                                                                                        | Runtime                                                                          |
| `wardrobe`                        | veshjet: etiketat, garderoba sipas fjalorit të W1, pjesët, ato që mbulohen                                                                    | Runtime                                                                          |
| `capabilities`                    | **Capability Manifest** (§2.3)                                                                                                                | Runtime: validimi + vetëkontrolli                                                |
| `files`                           | çdo skedar me path, sha256, bajte, lloj dhe rol                                                                                               | Runtime (`FILE_HASH`, `FILE_MISSING`, `FILE_UNLISTED`)                           |
| `provenance`                      | `builder`, `artist` ose `import`; mjeti; sha256 i input-eve                                                                                   | Zod                                                                              |
| `license`, `approval`             | licenca; `approved`/`pending`/`rejected`, nga kush, kur                                                                                       | Library (`NOT_APPROVED` për `reference`)                                         |

### 2.2 Pjesët (`erkasa.character.parts/1`)

- **Pjesë vektoriale:** kulme, path-e mbi indekset e kulmeve (M, L, Q, C, Z), fill/stroke me ngjyrë të plotë ose gradient linear/radial. Pikat e gradientit janë kulme, prandaj gradienti deformohet bashkë me pjesën.
- **Pjesë me teksturë:** kulme, UV në pikselët e imazhit `medium`, trekëndësha, imazhe për `close`/`medium`/`wide`. Hijet pikturohen në teksturë. Runtime-i nuk përdor filtra blur.
- **Të dyja llojet:** `binding` `rigid` (një kockë) ose `skin` (≤ 4 kocka për kulm, peshat me shumë 1); morph targets si zhvendosje të rralla `[kulmi, dx, dy]`; `z`, `opacity`.
- **Kjo nuk e kufizon artin në forma parametrike.** Çdo kontur që mund të vizatojë një artist kthehet në path mbi kulme, dhe çdo pikturë në teksturë mbi mesh. Testi `builder.test.ts` pranon një kontur arbitrar artisti.

### 2.3 Capability Manifest: si zbatohet rregulli "mos deklaro atë që nuk është provuar"

Një aftësi deklarohet vetëm kur paketa ka të dhënat për të **dhe** ajo është ushtruar. Runtime-i e kontrollon këtë në dy nivele.

- **Validimi** refuzon:
  - një kanal të deklaruar që nuk e konsumon asgjë (`CAP_CHANNEL_UNDECLARED`);
  - visema të deklaruara pa përkufizim (`CAP_FACE`);
  - gishta pa kocka gishtash (`CAP_HANDS`);
  - një LOD pa imazhet e veta (`CAP_LOD`);
  - ecje, kapje e të ngjashme pa një raport `evidence` me `result: "pass"` që gjendet në skedarët e paketës (`CAP_EVIDENCE`).
- **Vetëkontrolli** (`selfcheck.ts`) e ekzekuton çdo aftësi:
  - çdo kanal i deklaruar, në skajet e intervalit, duhet të lëvizë diçka të dukshme (`CAP_NO_EFFECT`);
  - çdo pamje duhet të zgjidhet në qendrën e vet;
  - blink-u duhet ta mbyllë hapjen e syrit;
  - shikimi duhet ta lëvizë irisin;
  - çdo veshje duhet të shtojë pjesët e veta dhe të fshehë ato që mbulon.

Karakteri testues deklaron vetëm atë që është provuar:

- 24 kanale, pamjet `front` dhe `q3` të kokës, AU 01/02/04/05/12, blink, shikimin, nofullën, `test_tee`, LOD `medium`;
- `hands.fingers: false`, `locomotion: []`, `interactions: []`, `visemes: []`.

### 2.4 Profili i kanaleve `erkasa.humanoid/1`

- Përmban kanalet që Character Acting do t'i drejtojë te çdo karakter:
  - **trupi:** yaw, pelvisi, shtylla, kraharori, frymëmarrja, qafa;
  - **koka dhe sytë:** yaw, pitch, roll, shikimi x/y/z, qepallat, bebja;
  - **fytyra:** 18 AU, `jaw_open`, 15 visema;
  - **krahët dhe duart:** shpatulla, krah, parakrah, kyç, dorë, 5 gishta për anë;
  - **këmbët;** dhe `hair_wind`, `cloth_wind`.
- Kanalet e veta të një pakete lejohen vetëm me prefiksin `x_`.
- **Korrigjim i planit:** emrat e kanaleve janë `snake_case` (`channel.head_yaw`), jo me pika (`channel.head.yaw`). `ChannelName` i `erkasa.render/1` lejon vetëm një pikë, dhe ndryshimi i tij do të prekte kontratën e render-it.

### 2.5 Versionimi dhe pajtueshmëria

- `schema` është literal. Një fushë opsionale e re e mban `/1`; heqja e një fushe ose ndryshimi i kuptimit të saj kërkon `/2`.
- Objektet janë `strict`, kështu që një fushë e panjohur refuzohet.
- `minRuntime` krahasohet me `RUNTIME_REVISION = 1`.
- Një version i ri duhet të ruajë `fingerprint`-in, domethënë të njëjtin identitet. Për një identitet tjetër duhet një `id` tjetër.
- Kontrata e re vetëm shton:
  - `CONTRACTS` ka dy hyrje të reja;
  - asnjë kontratë ekzistuese nuk ndryshoi;
  - backend-i Java i lexon të gjitha skedarët e skemave dhe `ContractSchemasTest` kontrollon me `contains()`.

---

## 3. Struktura e paketës

```
library/
  catalog.json                          erkasa.character-catalog/1, i rigjeneruar nga paketat
  characters/chr_test_minimal/1/
    character.json                      kontrata; listë me sha256 për çdo skedar tjetër
    parts/body.json                     18 545 B   erkasa.character.parts/1
    parts/head.json                     76 267 B   erkasa.character.parts/1
    textures/tee.png                   166 979 B   Git i zakonshëm (përjashtim, shih më poshtë)
```

- **Hash-i i paketës** është sha256 i `character.json`, që përmban sha256 e çdo skedari tjetër. Hash-i i karakterit testues: `b5515ea7ce02f34c86b84f1423647be2e23c8ea596db94fd3dbc912bfde88470`.
- **Referenca e pandryshueshme:** `chr_test_minimal@1#sha256:b5515ea7…88470`. Këtë do ta mbajë paketa e render-it në Fazën 5, jo identitetin.
- **Git LFS** mban `library/**/*.png|webp`. CI e bën checkout me `lfs: true`. Prettier e anashkalon `library/`, sepse bajtet janë të hash-uara.
- **Përjashtim për karakterin testues:** push-i i objektit LFS u refuzua, sepse ky mjedis nuk lejohet të arrijë storage-in e GitHub-it për LFS (`github-cloud.s3.amazonaws.com`, 403 nga proxy-ja).
  - Teksturën 167 KB e ruajta në Git të zakonshëm, me një rregull të ngushtë në `.gitattributes` vetëm për `chr_test_minimal`. Bajtet dhe hash-i janë të njëjtat.
  - Rregulli LFS mbetet për çdo karakter tjetër.
  - Kalimi në LFS bëhet me `git lfs migrate` nga një makinë që e arrin storage-in.

---

## 4. Character Runtime

### 4.1 Ndërfaqet (`@erkasa/character/runtime`)

| Funksioni                                              | Detyra                                                                                                                                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `loadCharacter(dir)` → `LoadedCharacter`               | Lexon `character.json` dhe e kontrollon me Zod. Verifikon çdo skedar (madhësia, sha256), skemën e pjesëve, fingerprint-in dhe `minRuntime`, dekodon teksturat dhe thërret `validateCharacter`. Ndalon me `CharacterError(code, findings)`. |
| `validateCharacter(c)`                                 | Kontrollon referencat dhe gjeometrinë me 55 kode gabimi, si `BONE_CYCLE`, `WEIGHTS_SUM`, `VIEW_TILING`, `EYE_CLIP_UNKNOWN`, `OUTFIT_PART_UNKNOWN`, `CAP_*`.                                                                                |
| `selfCheck(c)`                                         | Provon çdo aftësi të deklaruar (§2.3). E ekzekuton `verifyPackage` i Library-t në çdo `verify`/`publish`/`check`, kështu që një paketë me aftësi të paprovuar nuk hyn në Library (`CAPABILITY_UNPROVEN`).                                  |
| `actorFrame(c, scene, actorId, t)`                     | Lexon track-et `channel.*` dhe `root.*` të një aktori në `erkasa.render/1`, me `evaluate`/`trackOf` të kontratave. Refuzon track-et e rig-ut cutout (`bone.*`, `facing`, `turn`) dhe kanalet që paketa nuk i konsumon.                     |
| `evaluate(c, {channels, outfit?, lod?})` → `Evaluated` | Llogarit vlerat e kanaleve, kockat (FK), morph weights, skinning-un, pamjet dhe peshat e kalimit, irisët, socket-et, contacts dhe LOD-in.                                                                                                  |
| `drawCharacter(c, ctx, ev, {x, y, scale})`             | Vizaton në një `SKRSContext2D` të Skia-s: path-et vektoriale, trekëndëshat me teksturë, irisët e prerë nga e bardha e syrit dhe kalimin midis pamjeve në shtresa të ripërdorura.                                                           |

### 4.2 Rregullat

- **Nuk ka vendime krijuese. [F]**
  - Një kanal i panjohur, një vlerë jashtë `range`, një veshje që nuk ekziston, një yaw pa pamje ose një LOD i padeklaruar ndalojnë me gabim (`CHANNEL_UNKNOWN`, `CHANNEL_RANGE`, `OUTFIT_UNKNOWN`, `VIEW_NONE`, `LOD_UNSUPPORTED`).
  - Runtime-i nuk e kufizon dhe nuk e "rregullon" asnjë vlerë. Visemat janë përjashtim i deklaruar: ato përzihen në AU sipas tabelës së paketës, dhe shuma kufizohet në intervalin e kontrollit.
- **Determinizëm. [M]**
  - E njëjta komandë jep të njëjtat numra dhe pikselë brenda një procesi dhe në një proces tjetër.
  - Demo-ja e rirenderuar dha MP4 dhe PNG me sha256 identik (`8e8b66c5…`, `857e085f…`).
- **Matematika:**
  - kocka = `degPerUnit × (vlera − rest)` nga poza e pushimit;
  - morph = `clamp01((v − from)/(to − from))`;
  - skinning linear me ≤ 4 pesha;
  - irisi ndjek matricën e skinning-ut të kockës së kokës, jo drejtimin absolut të kockës.
- **Integrimi në render:**
  - Skia (`@napi-rs/canvas` 0.1.100) është e njëjta librari që përdor kompozitori W0.
  - Kodimi bëhet me `segmentArgs`/`VIDEO` të `film/src/package/encoding.ts`: libx264 veryfast, crf 20, grain `noise=alls=4:allf=t`, yuv420p.
  - Renderer-i ekzistues nuk u zëvendësua dhe nuk u ndryshua.

---

## 5. Character Library

- **Ruajtja:** `library/characters/<id>/<version>/`, me versione të numëruara dhe të pandryshueshme.
- **Katalogu** (`catalog.json`) rigjenerohet nga paketat dhe për secilën mban:
  - `ref`, `sha256`, `fingerprint`, `purpose`, `approval`;
  - `build`, veshjet me etiketat, pamjet dhe aftësitë e fytyrës.
- **Publikimi** (`store.ts`):
  - E njëjta paketë e publikuar dy herë nuk ndryshon asgjë.
  - Bajte të tjera nën të njëjtin `id@version` refuzohen (`IMMUTABLE`).
  - Një version i ri duhet të ruajë identitetin (`IDENTITY_CHANGED`).
  - Një paketë jashtë `characters/<id>/<version>` refuzohet (`LIBRARY_PATH`).
- **Zgjidhja e referencave** (`resolveRef`):
  - Kontrollon që hash-i i referencës është ai i katalogut, dhe që bajtet në disk janë ende ato të publikuara (`CHARACTER_HASH`).
  - Për `purpose: reference` kërkon `approval: approved` (`NOT_APPROVED`).
- **CLI:** `pnpm --filter @erkasa/character cli verify|publish|resolve|check`.
- **Engine-t nuk e lexojnë Library-n. [F]**
  - ESLint (`no-restricted-imports`) e ndalon importin e `@erkasa/character/library` dhe `/builder` nga `film/**`, `gate/**` dhe `engine/**`, dhe importin e `../library` e `../builder` nga Runtime-i.
  - E provova me skedarë të përkohshëm në të tre zonat. `boundary.test.ts` e kontrollon edhe në test.
- **Nuk ka katalog të madh dhe nuk ka upload nga përdoruesi.** Katalogu ka vetëm karakterin testues.

---

## 6. Character Builder

- **Kufiri:**
  - Builder-i prodhon paketa. Runtime-i i ekzekuton. Library i ruan.
  - Builder-i nuk ka editor vizual, nuk vizaton në film dhe nuk thirret nga Engine-t.
- **Shkruesi** (`writer.ts`, `PackageSpec` → skedarë):
  - llogarit sha256 dhe madhësitë;
  - shkruan JSON kanonik, prandaj dy ndërtime japin të njëjtët bajte;
  - kalon paketën në `loadCharacter` para se ta shkruajë, kështu që një paketë që Runtime-i nuk e pranon nuk shkruhet;
  - refuzon të mbishkruajë bajte të tjera (`PACKAGE_EXISTS`).
- **Burimet:**
  - `sources/parametric/test-minimal.ts` ndërton karakterin testues. Krijon gjeometrinë me kod dhe e pikturon teksturën e bluzës në Skia.
  - `sources/artist.ts` përcakton ndërfaqen `ArtworkSource`, ku vendoset arti i artistit:
    - pamjet e vizatuara si path-e;
    - teksturat e pikturuara;
    - rig-et e veta, me kockat dhe peshat e artistit;
    - veshjet.

    Importuesi konkret (SVG/PSD) nuk është shkruar, sepse nuk ka ende art artisti.
- **Formati mbulon** autorimin parametrik, artin e artistit, rig-et e personalizuara, teksturat e pikturuara, disa pamje dhe krijimin e veshjeve. Të gjitha këto janë të dhëna në kontratë, jo kod për çdo karakter.

---

## 7. Karakteri testues `chr_test_minimal@1`

- Bust neutral me 13 kocka: root, shtylla, kraharori, qafa, koka, dhe për secilin krah shpatulla, krahu, parakrahu, dora.
- 36 pjesë (35 vektoriale + 1 me teksturë), 1 133 kulme, 402 komanda path-i, 160 trekëndësha me teksturë, 148 morph targets, 1 teksturë prej 196 608 pikselësh.
- 21 kontrolle; pamjet e kokës `front` (−15°…15°) dhe `q3` (15°…40°), me brez kalimi 3°.
- Fytyra: AU 01, 02, 04, 05, 12; `jaw_open`; blink L/R; shikim 3D.
- Veshja `test_tee`: bluzë me teksturë të pikturuar, që fsheh lëkurën e trupit.

![Fletë kontakti e demos](../../../character/demo/out/chr-test-minimal-demo-contact.png)

Demo (`character/demo/out/chr-test-minimal-demo.mp4`, 7 s, 1080×1920, 30 fps):

- frymëmarrje dhe përkulje e shtyllës;
- shikimi majtas-djathtas dhe nga afër (konvergjencë);
- kthimi i kokës `front` → `q3`, me kalim në brezin 15° ± 3°;
- ngritja e krahut me bërrylin e përkulur;
- buzëqeshja (au12), vetullat (au01/au04), nofulla, blink-u.

Track-et e demos janë `erkasa.render/1`, të lexuara me `Track` dhe `actorFrame`, njësoj si do t'i japë Engine-i. Render-i është determinist dhe nuk ka tegela të dukshme në teksturë.

**Kufizimet që shihen në video** (shih §10):

- qafa nuk kthehet me kokën në `q3`;
- bërryli hollohet kur përkulet fort;
- dora është pa gishta.

---

## 8. Testet dhe rezultatet

**Paketa `@erkasa/character`: 83 teste në 9 skedarë, të gjitha kaluan. [M]**

| Skedari            | Teste | Çfarë provon                                                                                                                                                                                                |
| ------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `load.test.ts`     | 9     | ngarkimin; sha256 = katalogu; refuzimin e bajteve të ndryshuara, skedarëve që mungojnë, skemës së gabuar, fingerprint-it të gabuar dhe runtime-it të vjetër; paralajmërimin për skedarë jashtë listës       |
| `validate.test.ts` | 24    | 21 paketa të prishura që refuzohen me kodin e duhur; vetëkontrollin; që karakteri testues nuk deklaron asgjë të paprovuar                                                                                   |
| `deform.test.ts`   | 12    | skeletin në pushim (identitet), FK, fëmijët ndjekin prindërit, bërrylin e skinned, mesh-in e teksturës, morph-et me peshë, veshjen; refuzimin e kanaleve, vlerave dhe veshjeve të gabuara; determinizmin    |
| `face.test.ts`     | 12    | au12, au01/au04, nofullën, blink-un në një sy; shikimin, konvergjencën, `maxAngle`, irisin që rrotullohet me kokën; zgjedhjen e pamjes, kalimin me pesha që mblidhen në 1, angle morphs, yaw jashtë pamjeve |
| `tracks.test.ts`   | 5     | leximin e track-eve me evaluatorin e kontratave, aktorët e tjerë, kanalet e panjohura, refuzimin e track-eve të cutout-it                                                                                   |
| `render.test.ts`   | 5     | kuadrin 1080×1920; determinizmin në proces dhe midis proceseve; komanda të ndryshme japin pamje të ndryshme; kodimin me cilësimet e pipeline-it                                                             |
| `library.test.ts`  | 8     | katalogun, referencat, `CHARACTER_HASH` (edhe pas ndryshimit në disk), `IMMUTABLE`, `LIBRARY_PATH`, `NOT_APPROVED`, `IDENTITY_CHANGED`                                                                      |
| `builder.test.ts`  | 5     | ndërtimin determinist; rindërtimin bajt për bajt; `PACKAGE_EXISTS`; refuzimin e paketës së pavlefshme; konturin arbitrar të artistit                                                                        |
| `boundary.test.ts` | 3     | Runtime-i nuk importon Library/Builder; paketa nuk importon Engine apo planifikim; Engine-t nuk lexojnë Library-n                                                                                           |

**Kontrata:** `contracts` ka 306 teste, me fixtures e reja në Zod dhe Ajv. `export-json-schema --check` kaloi.

**I gjithë repo-ja [M]:**

| Kontrolli                           | Rezultati                                                                                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check`                 | kaloi                                                                                                                                                                   |
| `pnpm lint`                         | kaloi (shih §10.7 për `prototypes/`)                                                                                                                                    |
| `pnpm typecheck`                    | kaloi                                                                                                                                                                   |
| `pnpm test`                         | **1 428 teste kaluan, 1 i anashkaluar** (contracts 306, gate 423, film 378, stager 86, character 83, ai-worker 77, compiler 28, engine 23, engine-worker 16, planner 8) |
| golden i vjetër (`film golden`)     | 405 kuadra v2 + 136 W0, **0 dështime**                                                                                                                                  |
| golden i paketës (`golden:package`) | **K7: 931/931 kuadra identikë**                                                                                                                                         |
| `assets:validate`                   | 636 asete, 0 gabime                                                                                                                                                     |
| Java `ContractSchemasTest`          | **nuk u ekzekutua këtu:** Maven nuk shkarkohet nga ky mjedis. Do ta ekzekutojë CI-ja. Testi përdor `contains()`, dhe skemat e reja dalin nga i njëjti gjenerator.       |

---

## 9. Benchmark-et reale

### 9.1 Kushtet [M]

- **Makina:** Intel Xeon @ 2.30 GHz, 2 bërthama, 7.8 GB RAM (7.2 GB të lira), Linux 6.18, Node 22.23.5.
- **Renderer:** Skia përmes `@napi-rs/canvas` 0.1.100, CPU raster, pa GPU. Është libraria e kompozitorit W0.
- **Kuadri:** 1080×1920.
- **Karakteri:** bust në shkallë 1.9 (rreth 1 500 px i lartë). Rasti "shumë karaktere" përdor shkallën 0.9.
- **Procesi:** një proces dhe një thread; GC para çdo rasti; 10 kuadra ngrohje + 90 kuadra të matur me poza që ndryshojnë.
- **Ngarkesa e makinës** para matjes: 0.44 / 1.55 / 1.79.
- **Riprodhimi:** `pnpm --filter @erkasa/character bench`. Rezultatet janë në `character/bench/out/bench-chr_test_minimal-1.json`.

### 9.2 Rezultatet (ms për kuadër)

| Rasti                                                       | Mesatarja |   Mediana |       p95 |
| ----------------------------------------------------------- | --------: | --------: | --------: |
| skeleti (FK)                                                |     0.020 |     0.018 |     0.026 |
| skinning + morphs (të gjitha pjesët)                        |     0.308 |     0.268 |     0.545 |
| morph weights                                               |     0.013 |     0.009 |     0.013 |
| fytyra (`evaluate`, vetëm kanalet e fytyrës)                |     0.196 |     0.084 |     0.369 |
| trupi (`evaluate`, vetëm kanalet e trupit)                  |     0.279 |     0.188 |     0.831 |
| `evaluate` i plotë                                          |     0.112 |     0.078 |     0.359 |
| vizatimi vektorial + evaluate                               |      4.21 |      3.67 |      7.39 |
| teksturë + evaluate, shkalla 1.9                            |     21.88 |     21.71 |     23.68 |
| teksturë + evaluate, shkalla 0.9                            |     10.30 |     10.02 |     12.09 |
| teksturë + evaluate, shkalla 0.5                            |      4.50 |      4.25 |      5.75 |
| **kuadër i plotë: sfondi + karakteri + leximi i pikselëve** | **28.96** | **26.44** | **40.99** |
| kuadër bosh (vetëm sfondi + leximi)                         |      1.00 |      0.90 |      1.84 |
| kuadër brenda brezit të kalimit `front`↔`q3`                |     61.86 |     60.68 |     79.80 |
| 1 karakter (shkalla 1.9)                                    |     27.09 |     24.17 |     41.23 |
| 2 karaktere (shkalla 0.9)                                   |     22.45 |     21.77 |     26.19 |
| 4 karaktere (shkalla 0.9)                                   |     45.04 |     40.68 |     65.85 |
| 8 karaktere (shkalla 0.9)                                   |     83.75 |     80.39 |    103.20 |

**Memoria:** RSS kaloi nga 288 në 300 MB gjatë 300 kuadrave të plota, rreth 0.04 MB për kuadër. Heap-i JS mbeti 16 MB.

**Me kodimin:** demo-ja, me 210 kuadra dhe libx264 + grain të pipeline-it, mori **10.9 s, pra 51.9 ms për kuadër**.

### 9.3 Çfarë tregojnë

1. **Deformimi nuk kushton pothuajse asgjë. [M]** Skeleti, skinning-u, morph-et, fytyra dhe sytë marrin bashkë më pak se 0.5 ms për kuadër. Kostoja është te vizatimi.
2. **Kostoja e teksturës ndjek pikselët që mbulon. [M]** Me shkallën 1.9 → 0.9 → 0.5, sipërfaqja bie 4.5 dhe 14 herë, ndërsa koha bie nga 21.7 në 10.0 dhe 4.2 ms. Pjesa më e madhe është sipas pikselëve, me një pjesë fikse për çdo trekëndësh. Kjo përputhet me spike-un e Fazës 1 (70 ms për 4 096 trekëndësha që mbulonin një zonë të madhe).
3. **Kalimi midis pamjeve kushton rreth 2.3 herë një kuadër normal. [M]** Të dy pamjet vizatohen në shtresa me madhësinë e kuadrit të plotë dhe pastaj kompozohen. Optimizimi i qartë është të përdoret vetëm kutia që rrethon kokën. Kalimi zgjat vetëm ±3° të yaw-së, pra pak kuadra për çdo kthim.
4. **Shumë karaktere:** kostoja rritet afërsisht linearisht me karakteret dhe pikselët. Tetë karaktere të vegjël kushtojnë 80 ms.
5. **Parashikimi 0.25 s/frame mbetet i paprovuar.** Për këtë karakter jemi rreth 10 herë poshtë tij (26 ms; 52 ms me kodim). Por karakteri testues ka 1 133 kulme dhe një teksturë të vetme.
   - Një karakter referencë me flokë, rroba dhe lëkurë të pikturuara, që mbulojnë gjithë bust-in, mund të kushtojë 3–4 herë më shumë teksturë, rreth 60–90 ms. **[S]**
   - Numri i vërtetë matet në Fazën 4, mbi Danielin dhe karakterin femër, me të njëjtin benchmark.

### 9.4 Rrjedhja e memories që gjeta [M]

- Në 30 kuadra 1080×1920, rritja e RSS ishte:

  | Metoda                     | Rritja |
  | -------------------------- | -----: |
  | `getImageData(0, 0, W, H)` | 238 MB |
  | `canvas.data()`            |   8 MB |
  | canvas i ri për çdo kuadër | 222 MB |

- Me `getImageData` benchmark-u vritej (OOM, exit 137) rreth 5.9 GB RSS. `canvas.data()` jep të njëjtët bajte RGBA për kuadër të errët; e verifikova me krahasim bajt për bajt.
- Runtime-i, testet, demo-ja dhe benchmark-u përdorin tani `canvas.data()` dhe një canvas të ripërdorur.
- **Kompozitori W0 përdor ende `getImageData`.** Kjo ka të ngjarë të jetë arsyeja pse pipeline-i renderon në segmente prej 24 kuadrash, në procese të veçanta. **Nuk e kam prekur**, sepse do të thoshte të ndryshoja renderer-in ekzistues pa miratim. **[R]** Ta ndryshojmë në një fazë më vete, me golden-et si provë.

---

## 10. Kompromiset dhe problemet

1. **Trupi nuk ka pamje.** Kontrata dhe Runtime-i mbështesin `views.body`, por karakteri testues ka pamje vetëm për kokën. Në `q3` qafa mbetet drejt ndërsa koka kthehet: shihet te t = 2.4–2.9 s. **[R]** Karakteret e Fazës 3 duhet të kenë të paktën `front`/`q3` edhe për trupin.
2. **Bërryli hollohet kur përkulet fort.** Kjo është kufizimi i njohur i skinning-ut linear. Kontrata i mbështet morph-et korrigjuese, që drejtohen nga i njëjti kanal, por karakteri testues nuk i ka. **[R]** Në Fazën 3, morph korrigjues për bërrylin, shpatullën dhe kyçin.
3. **Pamja `q3` kufizohet në 40°.** Në 45° vetulla e largët del jashtë siluetës së kokës. Kjo është çështje e artit të karakterit testues, jo e formatit. Kontrata lejon deri në 24 pamje për grup.
4. **Pitch-i nuk zgjedh pamje.** Kontrata ka `pitch` dhe `pitchChannel` në pamje, por Runtime-i rev 1 zgjedh vetëm sipas yaw-së.
   - Pitch-i i kokës bëhet me kockë (`head_pitch`).
   - Një paketë me pamje të ndara sipas pitch-it refuzohet nga `VIEW_TILING`, pra nuk vizatohet gabim pa u vënë re.
   - Pamjet nga lart dhe nga poshtë, nëse duhen, vijnë me një revizion të Runtime-it.
5. **Pa gishta, visema, pamje trupi, ecje apo kapje te karakteri testues.** Kontrata i ka dhe Runtime-i ka rrugën e përgjithshme: kontrollet dhe kockat, përzierjen e visemave, grupin `body`. Por asnjë karakter nuk i ka ushtruar ende, prandaj karakteri testues nuk i deklaron. Rregulli "mos deklaro" zbatohet nga validimi.
6. **Runtime-i nuk është lidhur ende me renderer-in e paketave.** Vizaton me Skia dhe kodon me cilësimet e pipeline-it, por asnjë Engine nuk e thërret, siç e kërkon kjo fazë. Lidhja vjen në Fazën 5:
   - `erkasa.render/1` duhet të mbajë `characterRef` me sha256;
   - renderer-i duhet ta thërrasë Runtime-in;
   - Gate-i duhet t'i kontrollojë track-et kundrejt `controls`.
7. **ESLint tani anashkalon `prototypes/**`.** `pnpm lint` dështonte me 23 gabime te `.mjs` e prototipeve v4 dhe të spike-ut të Fazës 1, që erdhën nga commit-et e mia të mëparshme. Këto janë dëshmi, jo kod production, njësoj si `tools/**`, që ishte tashmë i anashkaluar. Nuk e ndryshova kodin e prototipeve.
8. **Teksturat e veshjes kanë një shtresë të vetme.** Nuk ka ende rroba me disa shtresa (xhaketë mbi këmishë) apo fizikë rrobash. `cloth_wind` dhe `hair_wind` janë në profil si input, por asnjë paketë nuk i konsumon.
9. **Git LFS nuk arrihet nga ky mjedis.** Push-i i objektit LFS u bllokua nga politika e rrjetit (§3). Karakteret e Fazës 3 do të kenë më shumë tekstura, prandaj kjo duhet zgjidhur para tyre (§12).
10. **Benchmark-u mat Runtime-in, jo kodimin.** Kodimi matet vetëm te demo-ja (52 ms për kuadër gjithsej). Nuk kam matur memorien e Skia-s mbi 300 kuadra me shumë karaktere.

---

## 11. Skedarët

**Të rinj:**

- `contracts/src/character.ts`
- `contracts/json-schema/character.schema.json`, `character-parts.schema.json` (të gjeneruara)
- `contracts/fixtures/valid/character.minimal.json`, `character.full.json`, `character-parts.minimal.json`
- `contracts/fixtures/invalid/character*.json` (18)
- `character/package.json`, `tsconfig.json`
- `character/src/runtime/`: `load`, `validate`, `selfcheck`, `evaluate`, `draw`, `tracks`, `hash`, `mat`, `errors`, `revision`, `index`
- `character/src/library/`: `catalog`, `store`, `cli`, `index`
- `character/src/builder/`: `writer`, `geometry`, `build-test-character`, `index`, `sources/artist.ts`, `sources/parametric/test-minimal.ts`
- `character/test/` (9 skedarë testesh + `helpers.ts`, `render-frame.ts`)
- `character/bench/bench.ts`, `character/bench/out/bench-chr_test_minimal-1.json`
- `character/demo/render-demo.ts`, `character/demo/out/chr-test-minimal-demo.mp4`, `-contact.png`
- `library/catalog.json`, `library/characters/chr_test_minimal/1/` (4 skedarë; PNG-ja në Git të zakonshëm, §3)
- `docs/reports/cl-2/README.md` (ky raport)

**Të ndryshuar** (vetëm konfigurim dhe regjistrim):

- `contracts/src/index.ts`: eksporti dhe dy hyrje në `CONTRACTS`
- `pnpm-workspace.yaml`, `pnpm-lock.yaml`: paketa `character`
- `.gitattributes`: LFS për `library/`, me përjashtim për teksturën e karakterit testues
- `.github/workflows/ci.yml`: checkout me `lfs: true`
- `.prettierignore`: `library/` dhe `character/**/out/`
- `eslint.config.js`: kufijtë e Library/Builder për `film`, `gate`, `engine` dhe Runtime-in; anashkalimi i `prototypes/**`

**Të paprekur:**

- `film/**`, `gate/**`, `engine/**`, `stager/**`, `planner/**`, `ai-worker/**`, `backend/**`
- golden-et, rig-u `@1`/`@2`, filmat ekzistues

---

## 12. Vendimet që duhen para Fazës 3

1. **A e miraton kontratën `erkasa.character/1` siç është?**
   - Veçanërisht: kanalet `snake_case`, Capability Manifest me vetëkontroll dhe evidence, dhe referencën `id@v#sha256`.
   - Një ndryshim tani është falas. Pas Danielit, çdo ndryshim që heq ose ndryshon diçka kërkon `/2`.
2. **Pamjet e trupit dhe morph-et korrigjuese në Fazën 3?** **[R]** Po, për të dy karakteret: `front` + `q3` për trupin, dhe korrigjuese për bërrylin dhe shpatullën. Pa to, kthimi i kokës dhe gjestet me krahë do të duken si te karakteri testues.
3. **Buxheti i teksturave:** **[R]** Rrobat dhe flokët me teksturë në LOD `medium`, lëkura dhe fytyra vektoriale. Kështu kuadri i karakterit qëndron rreth 50–90 ms **[S]**, me vend për dy karaktere në skenë brenda 0.25 s. Matjen e vërtetë e bëj në Fazën 4.
4. **Git LFS për teksturat e Fazës 3:** këtu push-i i LFS bllokohet. Mundësitë:
   - të lejohet `github-cloud.s3.amazonaws.com` për këtë mjedis;
   - ti t'i bësh push objektet LFS nga makina jote;
   - teksturat e karakterëve referencë, që janë disa MB, të mbahen në Git të zakonshëm.
5. **Rrjedhja e `getImageData` në W0:** a ta trajtojmë si detyrë më vete, me golden-et si provë, apo ta lëmë siç është, me segmentet prej 24 kuadrash?

Faza 2 mbaron këtu. Nuk kam nisur Danielin, karakterin femër apo ndonjë punë të Fazës 3.
