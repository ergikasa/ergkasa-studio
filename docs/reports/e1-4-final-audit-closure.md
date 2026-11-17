# E1.4 · Mbyllja e auditimit final (F1–F4)

| Fusha     | Vlera                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------ |
| Data      | 2026-11-17                                                                                             |
| Branch    | `e1-4-engine-reads-package` (`origin/main` = `7f8ffca`, i paprekur)                                    |
| Commit-et | `399eae0` (F1–F3), `14ebbd2` (F4), raporti                                                             |
| Baza      | auditimi final `e0f0efa` (NOT READY: F1–F3 dështojnë, F4 e hapur)                                      |
| Vendimet  | PO-ja, 2026-11-17: miratimi i punës për F1–F4; F4 = vendimi B; numrat e vizatuar; kontroll në çdo çast |
| Verdikti  | **READY FOR E1.4 ACCEPTANCE**                                                                          |

## 1. Përmbledhje

Të katër problemet e auditimit final janë mbyllur, secili me teste të commit-uara.

- **F1:** vlerat e parametrave statikë publikohen dhe kontrollohen. `lines: "hello"`, `y: "top"` dhe `place: "middle"` refuzohen para renderimit.
- **F2:** `facing` pranon vetëm −1 dhe 1, dhe ndryshon vetëm me `hold`.
- **F3:** rregullat e roleve të W0 janë deklaruar te capabilities. Gate-i nuk përmend asnjë rol në kod.
- **F4:** Gate-i, Stager-i dhe renderer-i përdorin një aritmetikë të vetme kamere, ajo që Engine-i vizaton realisht. Kontrolli bëhet në çdo çast, pa tolerancë.

K1–K9, të gjitha testet, typecheck, lint, format dhe determinizmi kalojnë. `golden.json`, `golden-fixtures-b.json`, fixtures B dhe pipeline-i default nuk ndryshuan. E1.5 nuk ka filluar dhe nuk u shtua asnjë veçori renderimi.

## 2. Problemet dhe zgjidhjet

### F1. Parametrat statikë: forma dhe vlerat

**Problemi.** Gate-i kontrollonte vetëm nëse një parametër statik ishte vendosur, jo vlerën e tij. Pasojat:

- `lines: "hello"` rrëzonte renderer-in;
- `y: "top"` renderohej me pozicion të pavlefshëm;
- `place: "middle"` renderohej si `top`, në heshtje.

**Zgjidhja:**

- Capabilities v2 publikon `schema` për çdo parametër statik të çdo builtin-i: 52 parametra në 19 builtin-e.
- Skema është një nënbashkësi e vogël e JSON Schema. Gate-i kupton vetëm këto fjalë kyçe (`gate/src/json-schema.ts`):
  - `type`, `enum`, `const`;
  - `properties`, `required`, `additionalProperties`;
  - `items`, `minItems`, `maxItems`;
  - `minLength`, `maxLength`, `pattern`;
  - `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`;
  - `anyOf`.
- Një fjalë kyçe tjetër, ose një lloj i panjohur, e bën dokumentin `CAPABILITIES_INVALID`, sepse Gate-i nuk mund ta zbatojë.
- Burimi i skemave është kodi që vizaton:

  | Builtin                            | Burimi                                                                                                                   |
  | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
  | `type.kinetic`, `type.w0`          | `TypeLine` (`t` i detyrueshëm; `weight` light/bold; `accent`; `size` > 0)                                                |
  | `overlay.scrim`, `type.w0` `place` | `ScrimPlace` = top/center/bottom                                                                                         |
  | `overlay.ots` `facing`             | −1 ose 1                                                                                                                 |
  | `dur`                              | > 0                                                                                                                      |
  | `template.*` `params`              | `templates.ts PARAMS` (zod → JSON Schema, me `additionalProperties: false`, sepse template-t nuk lexojnë hyrje të tjera) |
  | `template.*` `anchors`             | emër → sekonda ose null                                                                                                  |
  | `w0.wall`, `w0.mid` `world`        | `WorldParams` (seed, years, paleta me 11 ngjyra `#rrggbb`)                                                               |
  | `w0.city`                          | `seed` numër, `near` boolean                                                                                             |

- Gate-i kthen `VALUE_UNSUPPORTED` te `…/params/<id>/<shtegu brenda vlerës>`.
- Manifesti nuk ndryshon: kontrata e parametrave të tij mbetet `kind`, `id`, `range`. Gjeneratori i fixtures B kopjon vetëm këto fusha, ndaj fixtures B mbeten bajt për bajt të njëjta.

### F2. `facing`: vetëm −1 dhe 1

**Problemi.** Prop-et `held` (`param.facing`) dhe aktorët (`facing`) pranonin 0, 0,5 dhe çdo vlerë tjetër brenda [−1, 1]. Renderer-i shumëzon me këtë vlerë, ndaj këto vlera jepnin figura të ngushtuara ose të zhdukura.

**Zgjidhja:**

- Një parametër kanali mund të deklarojë `values`:
  - `prop.*.held`: `param.facing: values [-1, 1]`;
  - rig-u: `channelValues: { facing: [-1, 1] }`.
- Gate-i kontrollon çdo sample dhe çdo çelës. Midis dy çelësave me vlera të ndryshme lejohet vetëm `hold`, sepse `linear` kalon nëpër vlera të ndërmjetme.
- Aktori pa track `facing` mbetet i lejuar: rig-u e vizaton me vlerën e pushimit, 1.
- Prop-i `held` pa track `facing` ose `rot` refuzohet me `TRACK_MISSING`. Ky rast tani ka test të commit-uar.

### F3. Rolet e W0: deklarata, jo kod i fshehur

**Problemi.** `executable.ts` kishte rregulla që nuk ishin deklaruar:

- props në pushim në `mid`;
- emrat `actors` dhe `held` të shkruar në kod;
- burimi i blur-it të aktorëve.

**Zgjidhja.** Çdo rol i W0 deklaron sjelljen e vet:

| Fusha          | Kuptimi                                                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assign`       | si e merr shtresa rolin: `node` (nga nyja e builtin-it) ose `actor` (nga aktori që vizatohet në të)                                                                                                |
| `repeat`       | a mund të ketë më shumë se një shtresë me këtë rol                                                                                                                                                 |
| `members`      | çfarë vizatohet si pjesë e rolit, kudo që të jetë nyja: `mid` = `w0.mid` + `prop.*.resting`; `held` = `prop.*.held`                                                                                |
| `blur`/`depth` | `own`; `first` (shtresa e parë e rolit, si te aktorët); emri i një roli tjetër (held → actors për blur, → mid për depth; city → sky); `absent` (vlera kur roli burim mungon: actors `{ blur: 0 }`) |

`checkRoles` lexon vetëm deklaratën. Një test e skanon kodin e tij dhe provon se nuk përmban asnjë emër roli ose builtin-i.

## 3. F4 (vendimi B): aritmetika që Engine-i vizaton

**Gjetja gjatë punës.** Engine-i nuk vizaton formulën e V2. Ai shkruan në SVG numrat e transformit të rrumbullakosur:

- **set dhe editorial:** 2 shifra dhjetore (`fmt`);
- **W0:** shkalla me 5 shifra dhe qendra me 3 (`toFixed`).

Te tetë paketat pamja e vizatuar ndryshonte nga formula me ≤ 0,005 njësi bote. Te W0 ajo dilte nga `bounds` e Stager-it në 10 çaste, deri në 0,0017. Kjo prekte kontratën V2, ndaj ndalova dhe pyeta. PO-ja zgjodhi "numrat e vizatuar" dhe "çdo çast".

**Zgjidhja.** Një implementim i vetëm në `contracts/src/camera-view.ts`:

| Funksioni                | Roli                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `drawn`, `transformAttr` | numrat dhe teksti i transformit që shkruan renderer-i                                                                                 |
| `project`, `projected`   | projeksioni i W0 dhe transformi i tij; `w0/camera.ts project` dhe `svgTransform` janë tani këto funksione, me REF dhe GAMMA           |
| `viewOf`                 | pjesa e botës që numrat (si tekst, `Number`) e vendosin te kuadri [0, W] × [0, H]                                                     |
| `sceneLens`              | set, editorial ose parallax, nga capabilities (`camera.parallax = { reference, gamma, plane: "w0.mid" }`)                             |
| `cameraViews`            | çdo pamje, në çdo çast: midis pikave të thyerjes numrat janë monotonë në t, dhe ndryshimet gjenden me bisektim deri te float-e fqinjë |
| `enclose`, `outside`     | të pandryshuara: pa tolerancë dhe pa rrumbullakim                                                                                     |

- **Renderer-i:**
  - `package/draw.ts` shkruan pamjet flat me `drawn`;
  - teksti është identik me `setView`/`editorialView`;
  - `v2frame.ts` dhe `w0/compositor.ts` nuk u prekën, ndaj gjurmët e tyre mbeten të njëjta;
  - `w0/camera.ts` u ndryshua vetëm për të deleguar te funksioni i përbashkët. Dalja e tij është identike: `pnpm golden` jep 136 kuadro W0 dhe 0 dështime.
- **Gate-i:** zgjedh lenten me `sceneLens` dhe kontrollon `cameraViews`.
- **Stager-i dhe gjeneratori i fixtures B:** zgjedhin të njëjtën lente nga capabilities e Engine-it.
- **Pasojat:**
  - pesë filmat B: asnjë `bounds` nuk ndryshon;
  - W0: tri skena ndryshojnë, vetëm si të dhëna, dhe kuadrot mbeten të njëjtë (K7 931/931):
    - s08: x −250 → −250,00189;
    - s12: y −67,94391 → −67,94337;
    - s14: x −49,32154 → −49,32012;
  - fixtures B: të pandryshuara.
- **Dokumentimi:** `docs/plans/e1-4-gate-executability-scope.md` §V2-B dhe B.1. Pika 1 e V2-së (formula) shënohet si e zëvendësuar.

## 4. Testet e reja dhe rezultatet

| Testi                                           | Çfarë provon                                                                                                                                                                                                                                                                                                                                                            | Rezultati |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `gate/test/value-cases.ts` → `negative.test.ts` | 60 paketa me një gabim, me gjetjet ekzakte (kod + shteg): F1 46, F2 9, F3 5                                                                                                                                                                                                                                                                                             | 60/60     |
| ↳ F1                                            | çdo builtin me parametra statikë: lloj i gabuar, strukturë e gabuar dhe vlerë jashtë bashkësisë. Përfshihen `lines: "hello"`, `y: "top"`, `place: "middle"` (type.w0 dhe scrim), `lines: [{text}]`, `weight: "heavy"`, `dur: 0`, ora `"25"`, hyrje të panjohura për template-t, paleta pa ngjyrë ose me ngjyrë jo `#rrggbb`, si dhe 12 template-t me `params` të gabuar | ✓         |
| ↳ F2                                            | held `facing` 0, 0,5 dhe −1→1 `linear`; held pa `facing` dhe pa `rot` (`TRACK_MISSING`); aktori me 0 dhe 0,5 në keys dhe samples, dhe 1→−1 `linear`                                                                                                                                                                                                                     | ✓         |
| ↳ F3                                            | held në shtresën e mobiljeve; blur i held ≠ i aktorit; depth i held ≠ i mid; aktori i dytë me blur tjetër (`first`); held i turbullt pa asnjë person (`absent`)                                                                                                                                                                                                         | ✓         |
| `gate/test/values.test.ts`                      | 52 parametra: secili ka skemë të kuptueshme; vlerat e tetë paketave e plotësojnë; secili ka të paktën një rast refuzimi. Tri vlerat e auditimit refuzohen. Skema ose `camera.parallax` e prishur → `CAPABILITIES_INVALID`. 5 paketa pozitive kalojnë. `facing` deklarohet diskret. `checkRoles` nuk përmend role                                                        | 118/118   |
| `film/test/package/k5.test.ts`                  | 164 rastet (103 + 60 + V2d): 0 kuadro, encoder-i nuk niset                                                                                                                                                                                                                                                                                                              | 165/165   |
| `film/test/package/executable.test.ts`          | 5 paketat pozitive (held −1; held −1→1 `hold`; aktori −1→1 `hold`; aktori pa `facing`; held pa person me blur 0) kalojnë Gate-in dhe renderohen                                                                                                                                                                                                                         | ✓         |
| `film/test/package/roles.test.ts`               | deklarata = renderer-i (`w0Scene`): blur/depth jo-`own` nuk lexohen nga shtresa e vet, por nga burimi; `first`; `absent` = 0; `repeat` (dy persona); `members` (prop në pushim nga `wall` vizatohet me mobiljet; held nga `mid` me personat); builtin pa rol → nuk vizatohet                                                                                            | 16/16     |
| `contracts/test/camera-view.test.ts`            | numrat e Engine-it; pamja nga numrat; ndryshimi nga formula. Ekstremi brenda intervalit gjendet në një çast real, i njëjtë me evaluatorin e renderer-it. `bounds` vetëm rreth skajeve refuzohen; `enclose` mbi të gjitha kalon; një hap float më pak dështon; ndryshimet gjenden deri te float-e fqinjë; rezultati është determinist                                    | 18/18     |
| `film/test/package/camera-arithmetic.test.ts`   | `drawn` = `setView`/`editorialView` dhe `project`/`svgTransform` = funksionet e përbashkëta, mbi 2 012 kamera (përfshi pragjet e rrumbullakimit); çdo kuadër i pesë filmave B, edhe të dy skenat e një tranzicioni, mban transformin që kontrollon Gate-i                                                                                                               | 8/8       |
| `gate/test/executable-cases.ts` V2d             | `bounds` e W0 s08 sipas formulës së vjetër → `VALUE_RANGE`                                                                                                                                                                                                                                                                                                              | ✓         |
| `gate/test/bounds.test.ts`                      | `bounds` që prekin saktësisht pamjen e vizatuar kalojnë (set, editorial, parallax); V2a–c: një hap float brenda → refuzohen                                                                                                                                                                                                                                             | 3/3 + 3/3 |

Shtesa në teste ekzistuese:

- Fixture A `office-procedural` merr dy gjetje të reja dhe të ligjshme: `lines: [{text}]` në vend të `{t}`.
- X12b kufizohet te rregulli i përsëritjes (`seed + 1`). Hyrja e panjohur tani ka rastin e vet F1.

## 5. Evidenca e komandave

Të gjitha komandat u ekzekutuan mbi `14ebbd2`, 2026-11-17.

| Pika                      | Komanda                                                                                                                  | Rezultati                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| K1                        | `cd film && npx vitest run test/package/k1.test.ts`                                                                      | 5/5 filma; çdo kuadër (405) i barabartë me `frameAt`, me përjashtim të id-ve të kinetic-type                                                |
| K2/K3, K7                 | `cd film && node --expose-gc --import tsx test/package/golden-package.ts --verify`                                       | "K2/K3: 0 failures; 140 v2 frames differ from golden.json only in kinetic-type ids" · "K7: 931/931 frames identical to golden-package.json" |
| Pipeline-i default        | `cd film && pnpm -s golden`                                                                                              | "405 v2 frames (140 changed only in ids) + 136 W0, 0 failures"                                                                              |
| K5                        | `k5.test.ts`                                                                                                             | 164 raste, kod dhe shteg ekzakt, 0 kuadro, sink-u nuk niset                                                                                 |
| K8                        | `cd gate && npx vitest run test/svg.test.ts test/negative.test.ts test/fields.test.ts test/bounds.test.ts`               | 28 + 167 + 3 + 3 = 201/201                                                                                                                  |
| K9                        | `pnpm -r --workspace-concurrency=1 test`                                                                                 | contracts 244, engine 23, compiler 28, engine-worker 16, film 304, stager 70, gate 379, planner 6, ai-worker 35 = **1 105, 0 dështime**     |
| Typecheck / lint / format | `pnpm typecheck`; `pnpm lint`; `pnpm format:check`; `pnpm contracts:gen --check`                                         | 0 gabime; pa gabime; "All matched files use Prettier code style!"; exit 0                                                                   |
| Determinizmi              | K7 (procese të veçanta)                                                                                                  | 931/931 identikë                                                                                                                            |
| Golden-ët historikë       | `git diff --quiet eda5ab5 HEAD -- film/golden/golden.json`; `git diff --quiet e0f0efa HEAD -- film/golden gate/fixtures` | identikë; sha256 `e18b5e8d…`; `golden-fixtures-b.json` dhe fixtures B janë të pandryshuara që nga auditimi                                  |
| Branch-i                  | `git rev-parse --short origin/main`                                                                                      | `7f8ffca` (i paprekur); të gjitha ndryshimet janë në `e1-4-engine-reads-package`                                                            |

## 6. Problemet e mbetura

Asnjë problem nuk bllokon pranimin. Për transparencë, mbeten këto:

1. **Monotonia në `cameraViews`.** Bisektimi mbështetet te monotonia e numrave të shkruar midis dy pikave të thyerjes. Ajo është provuar matematikisht për të tri lentet (§V2-B.3). Në float, zhurma e rendit të një ulp-i pranë një pragu rrumbullakimi mund, teorikisht, të shtojë një ndryshim që bisektimi nuk e sheh. Kjo ndodh vetëm kur një skaj i intervalit bie brenda ~10⁻¹³ nga pragu. Nuk është vërejtur në asnjë paketë.
2. **`lit` i roleve.** `lit` deklarohet dhe kontrollohet si më parë (Y3a/b). `roles.test.ts` provon `assign`, `repeat`, `members`, `blur`, `depth` dhe `absent` kundrejt renderer-it. `lit` nuk ka një test sjelljeje më vete, sepse nuk kalon nëpër hyrjen e compositor-it. Ai mbetet përputhje e lexuar nga kodi, si në E1.4.
3. **`w0/camera.ts`** përdoret edhe nga pipeline-i default W0. Ndryshimi është vetëm delegim, me dalje identike bajt për bajt; `pnpm golden` (136 W0, 0 dështime) dhe `camera-arithmetic.test.ts` e provojnë këtë.

## 7. Verdikti

**READY FOR E1.4 ACCEPTANCE.**

F1–F4 janë mbyllur me teste të commit-uara. Çdo paketë që kalon Gate-in plotëson kontratën dhe renderohet. Çdo paketë e refuzuar jep 0 kuadro dhe encoder-i nuk niset. K1–K9 kalojnë, ashtu si kontrollet e plota. Golden-ët historikë dhe pipeline-i default janë të pandryshuar.

Ndalem këtu dhe pres miratimin tënd. Nuk bëj merge dhe nuk filloj E1.5.
