# E1.6 · Nënfaza 1: CI Recovery (raport)

| Fusha           | Vlera                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Statusi         | **E përfunduar.** CI e gjelbër në GitHub për herë të parë që nga 2026-11-13.                                                                 |
| Commit-et       | `66f2218`, `ee52632`, `aa4932c`, `055cada`, `83e9c9a`, `92f0215`                                                                             |
| Run-i i gjelbër | [44383809103](https://github.com/ergikasa/ergkasa-studio/actions/runs/44383809103) në `92f0215` (3 punë: TypeScript, Asset library, Backend) |

## Çfarë u ndryshua

1. **FFmpeg i përcaktuar në CI (C3).**
   - Puna TypeScript ekzekutohet në `ubuntu-24.04`, i fiksuar në vend të `ubuntu-latest`.
   - Instalohen paketat Debian `7:6.1.1-3ubuntu5`: `ffmpeg` dhe të gjitha `libav*`/`libsw*`, me version të saktë. Ky është i njëjti build si në makinën e zhvillimit.
   - Versioni del në log (`ffmpeg -version`, `ffprobe -version`). Nëse rreshti i parë nuk është `ffmpeg version 6.1.1-3ubuntu5`, puna dështon.
   - Hapi instalon nga një arkiv i vetëm i shpejtë dhe i mban `.deb`-të në cache midis run-eve. Apt i krahason me hash-et e arkivit. Hapi kufizohet në 15 min, puna në 45 min.
2. **`AssetApiTest` pa tautologji (C1).**
   - Vlerat e pritura vijnë nga `backend/src/test/resources/assets/inventory.json`: lista e ID-ve sipas kategorisë, e rishikuar dhe e versionuar me testet. Nuk llogariten nga `manifest.json` që lexon indeksuesi.
   - `listsExactlyTheInventoryPerCategory`: API-ja jep **të njëjtën bashkësi ID-sh** dhe të njëjtin `total` për çdo kategori. `/stats` është i barabartë me numrat e inventarit, dhe totali i përgjithshëm po ashtu.
   - `inventoryMatchesTheLibraryOnDisk`: çdo `asset.json` në disk, sipas `assetId` dhe `category`, përputhet me inventarin.
   - Testi i vjetër priste 6 personazhe dhe 11 sfonde. Biblioteka ka 15 dhe 62 që nga `4c5fea5`; inventari i ka 636 asete.
   - Filtrat e testit të vjetër (`char_drini_01`, `char_host_01`, `met_snowball_01`, pa ikona) mbeten në `filtersAssets`.
3. **Golden baselines në CI:** `pnpm --filter @erkasa/film golden` dhe `golden:package` ekzekutohen pas `pnpm test`.
4. `pom.xml` e mban `src/test/resources` në classpath-in e testeve.

## Provat

| Prova                                                           | Skedari                |
| --------------------------------------------------------------- | ---------------------- |
| Versioni i FFmpeg dhe ffprobe në CI                             | `ffmpeg-version.txt`   |
| Testet TypeScript në CI (9 paketa, 1 192 teste, 0 dështime)     | `typescript-tests.txt` |
| Testet e backend-it në CI (109, 0 dështime)                     | `backend-tests.txt`    |
| Golden-ët në CI: 405 + 136 kuadro, K2/K3 0 dështime, K7 931/931 | `goldens.txt`          |
| Testet negative: dy branch-e provë që e bëjnë CI-në të kuqe     | `negative-probes.txt`  |

**Testet negative:**

- `e1-6-ci-probe-ffmpeg`: versioni i pritur u ndryshua në `7.0.0`. CI dështon te hapi FFmpeg me `expected 'ffmpeg version 7.0.0 '`.
- `e1-6-ci-probe-inventory`: `char_era_01` u hoq nga inventari. CI dështon me dy teste: `inventoryMatchesTheLibraryOnDisk` dhe `listsExactlyTheInventoryPerCategory [asset ids of category character]`.

## Devijimet

- **D-1.1:** inventari ndodhet te `backend/src/test/resources/assets/inventory.json`, jo te `assets/inventory.json` siç thoshte plani. Biblioteka `assets/` mbetet e paprekur, dhe skedari rri pranë testeve që e përdorin.
- **D-1.2:** dy branch-et provë nuk mund të fshihen nga kjo sesion: GitHub kthen 403 për fshirje. **Të lutem fshiji ti** (`e1-6-ci-probe-ffmpeg`, `e1-6-ci-probe-inventory`).
- **D-1.3:** kontrollet e detyrueshme në GitHub (branch protection) nuk u konfiguruan. Ishin opsionale dhe kërkojnë vendimin tënd.
- Asnjë test nuk u hoq, u anashkalua ose u zbut.
