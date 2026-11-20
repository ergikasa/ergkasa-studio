# W1: Character Identity + Wardrobe Intelligence

| Fusha     | Vlera                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Branch-i  | `g0-advanced-engines` (nga `standards-v2` @ `0e20d88`)                                                                         |
| Standardi | Engines Standard v2.1 §5.1b: CA-I1, CA-I2, CA-W1…W4                                                                            |
| Statusi   | E implementuar dhe e testuar. **Not Verified** mbi video të plotë me zë (në këtë mjedis nuk ka çelës TTS). Pa merge në `main`. |

## Problemi

- **B2 ("The same answers")** ndante të njëjtin person në dy cast members, `alex` dhe `alex_suit`, për t'i ndërruar rrobat. Kjo shkel kërkesën B: një karakter i ri për të njëjtin person.
- "Kostumi" ishte vetëm një ngjyrë më e errët e pallto-blob-it, pa jakë, kravatë, xhaketë ose këmishë. Historia mbështetet te kostumi ("the suit changed the judge"), por kostumi nuk lexohej.
- Nuk kishte asnjë logjikë për periudhën, profesionin, motin ose vazhdimësinë e veshjeve.

## Çfarë u ndërtua

| Shtresa              | Skedari                                   | Çfarë bën                                                                                                                             |
| -------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Kontrata             | `contracts/src/wardrobe.ts`               | 40 `GarmentKind`, `HairStyle`, `FacialHair`, `Features`, `outfitProblems`, `identityFingerprint`                                      |
| Render Package       | `contracts/src/render-package.ts`         | `actors[].wardrobe`, `actors[].features` (opsionale)                                                                                  |
| Manifest             | `contracts/src/asset-manifest.ts`         | rig-u deklaron `garments`, `hairStyles`, `facialHair`                                                                                 |
| Film Plan            | `film/src/contract.ts`                    | cast: `hairStyle`, `facialHair`, `era`, `profession`, `outfits[]` (id, occasion, weather, garments?, reason); aktori: `outfit`        |
| Inteligjenca         | `film/src/wardrobe.ts`                    | `dressFor` (tabela e rregullave: profesioni × rasti → moti → periudha), `resolveWardrobe` (vazhdimësi + identitet), `contextProblems` |
| Vizatimi             | `film/src/garments.ts`                    | trupi i veshur nga brenda jashtë; flokë, mjekër, kapele, syze; ndjekja e lëvizjes (`sway`)                                            |
| Rig-u                | `film/src/rig.ts`                         | `Look.wardrobe`, `Look.features`, `swayOf`, `CLOTH_LAG` (5 kuadro); pamja e thjeshtë mbetet byte për byte e njëjtë                    |
| Stager               | `stager/src/manifest.ts`                  | `rig_cutout_*@2` vetëm për njerëzit e veshur; `actorEntry` i përbashkët për v2 dhe W0                                                 |
| Gate                 | `gate/src/validate.ts`                    | `WARDROBE_UNSUPPORTED`, `OUTFIT_INVALID`, `FEATURES_UNSUPPORTED`, `IDENTITY_DRIFT`                                                    |
| Renderer-i i paketës | `film/src/package/draw.ts`                | lexon veshjet dhe tiparet; `sway` nga `root.x` i paketës 5 kuadro më parë                                                             |
| Director-i (LLM)     | `planner/src/director.ts`                 | profesioni, periudha, outfits dhe `outfit`, pa asnjë fushë të re nullable                                                             |
| Plani B2 i migruar   | `film/plans/b2-same-answers.w1.film.json` | një Alex me `casual` → `interview_suit` (sh06 `continuity: "reset"`: interviste e dytë)                                               |

## Rregullat që zbatohen

- **Zgjedhja (CA-W1):** e njëjta hyrje jep të njëjtat rroba. Çdo copë ka arsye (`reasons`).
  - 1920s business: kostum me tri pjesë dhe fedora.
  - Ndërtim: kaskë, jelek hi-vis dhe çizme.
  - Ftohtë: pallto ose puffer dhe shall. Shi: mushama.
  - Takim formal: xhaketë.
  - Asnjë anakronizëm, sepse çdo copë që periudha nuk e kishte zëvendësohet.
  - Dy njerëz në film nuk marrin të njëjtën ngjyrë kostumi.
- **Vazhdimësia (CA-W2):**
  - Brenda një ngjarjeje (i njëjti set, vazhdimësi e bartur) rrobat nuk ndryshojnë: `WARDROBE_CHANGE_IN_EVENT`.
  - Ndryshimi mes ngjarjeve kërkon `reason`: `WARDROBE_CHANGE_NO_REASON`.
- **Identiteti (CA-I1):**
  - Një person = një cast member (`IDENTITY_SPLIT`).
  - Gate-i krahason trupin, lëkurën, flokët dhe tiparet në çdo skenë (`IDENTITY_DRIFT`). Rrobat mund të ndryshojnë, identiteti jo.
- **Animacioni (CA-W4):**
  - Mëngët ndjekin krahun. Për mëngë të shkurtra, parakrahu del me lëkurë. Manshetat e këmishës duken nën xhaketë.
  - Pallto dhe fundi shtyhen nga gjunjët dhe nuk hyjnë kurrë brenda këmbëve.
  - Kravata dhe shalli varen nga graviteti, kundër animit të trupit.
  - Gjithçka ndjek lëvizjen me vonesë dhe qetësohet pas ndalimit.
  - Kravata nuk vizatohet mbi pallto të mbyllur.
  - Rrobat e bardha marrin kontur të hollë, që të mos humbin te muret krem (WB-F2).

## Provat

| Prova                                                  | Rezultati                                                                                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Testet W1 (`film/test/wardrobe.test.ts`)               | 18/18. Përfshin 5 400 kombinime (6 × 15 × 6 × 5 × 2) pa problem veshjeje dhe pa anakronizëm, plus çdo `GarmentKind` i vizatuar në këmbë dhe ulur pa NaN     |
| D1 + D6 nëpër gjithë rrugën (stager → Gate → renderer) | Alex në ≥ 5 skena, Alex dhe Maria me 1 identitet secili, Alex me 2 veshje, Maria me 1                                                                       |
| D2 / D3                                                | sh01–sh05 identike (`casual`); sh06–sh11 identike (`interview_suit`); ndryshimi vetëm në sh06, me arsye                                                     |
| Paketa ⇄ motori                                        | veshjet dhe tiparet në paketë = ato që vizatoi motori, për çdo shot dhe aktor                                                                               |
| Gate                                                   | ndryshimi i fytyrës mes skenave refuzohet (`IDENTITY_DRIFT`); garment në rig `@1` refuzohet (`WARDROBE_UNSUPPORTED`, rast negativ në `gate/test/broken.ts`) |
| Director-i                                             | round-trip i B2 W1 nëpër formën e përgjigjes së LLM-së; kufiri i 16 union-eve ruhet (`ai-worker/test/schema-unions.test.ts`)                                |
| **Asnjë regresion vizual**                             | `pnpm golden`: B1–B5 405 kuadro + W0 136, 0 dështime. `pnpm golden:package`: **K7 931/931 kuadro identike**, K2/K3 0 dështime                               |
| Gjithë workspace-i                                     | lint, typecheck; contracts 264, engine 23, compiler 28, planner 7, gate 423, stager 86, film 365, engine-worker 16, ai-worker 77 (+1 skip)                  |

Pamjet (gjenerohen me `cd film && node --import tsx test/w1-evidence.ts`):

- `w1-b2-before-after.png`: B2 para (dy cast members, ngjyrë më e errët) dhe pas (një Alex, `casual` → kostum me këmishë, kravatë dhe manshetë).
- `w1-contextual-wardrobe.png`: të njëjtat rregulla për 8 kontekste (1920s në dimër, 1920s business, ndërtim, mjeke, kuzhinier, studente në borë, zyrë në shi, ekzekutive formale).
- `w1-coat-walk.png`: pallto e gjatë dhe shall gjatë një ecjeje: sway 0 → 0,51 → 0 pas ndalimit; pallto mbetet jashtë këmbëve.

## Ndryshime që duhen ditur

- **Fingerprint-i i rig-ut** tani mbulon `rig.ts` + `garments.ts`, sepse rig-u i veshur vizatohet nga të dyja. Pa këtë, një ndryshim në `garments.ts` do të kalonte Gate-in pa u vënë re.
  - Fixtures A (`contracts/fixtures`) dhe fixtures B (`gate/fixtures/acceptance`, me `pnpm --filter @erkasa/gate fixtures:acceptance`) u ri-pin-uan.
  - Ndryshon **vetëm** rreshti i fingerprint-it dhe sha-ja e manifestit. Kuadrot janë identike (K7).
- `golden-package.json`, `golden.json` dhe `golden-evidence.json` **nuk** u prekën.
- `film/plans/b2-same-answers.film.json` mbetet i pandryshuar, sepse është golden. B2 i ri është `b2-same-answers.w1.film.json`. Zëvendësimi i golden-it të B2 kërkon miratimin tënd.

## Kufizimet

- Vizatimi i veshjeve është në stilin e rig-ut placeholder (profil, cutout). Kur të vijë rig-u i artistit, lista e `GarmentKind` është kontrata që artisti duhet të vizatojë. Logjika mbetet e njëjtë.
- Ende pa erë: `sway` është hyrja e gatshme për W5.
- CA-I3 (fleta e identitetit për gjenerim AI) dhe CA-W5 (veshje të gjeneruara nga Workers) vijnë me G1.
- Video e plotë me zë: Not Verified. Duhet një run `pnpm video` me çelësat e tu.
