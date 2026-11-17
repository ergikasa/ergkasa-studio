# E1.4: auditimi përfundimtar teknik (2026-11-17)

**Branch:** `e1-4-engine-reads-package` @ `d76cfa1`.

**Kufizime të respektuara:** asnjë ndryshim kodi, skeme, kontrate apo golden. Proba ad hoc u ekzekutuan si skedarë të përkohshëm dhe u fshinë; nuk u bë asnjë commit kodi.

## Verdict: **NOT READY**

Tri pika kritike dështojnë (F1–F3) dhe një mbetet e hapur (F4). Të gjitha kriteret K1–K9 kalojnë, por parimi "Gate PASS ⟹ renderer-i ekzekuton sipas semantikës" nuk plotësohet ende për vlerat e parametrave dhe për një rregull të fshehur.

## 1. Parametrat e rig-ut dhe track-et e parametrave: **FAIL**

| Kontroll                                                | Rezultati                                                         | Evidenca                                                                                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Prop `held` pa `param.facing` / pa `param.rot`          | refuzohet: `TRACK_MISSING package/scenes/1/layers/2/nodes/0`      | probë ad hoc mbi bazën B3 (asnjë test i commit-uar për këtë rast; R8 e provon rregullin mbi `set_back param.t`)                        |
| Prop `resting` me track `param.facing` ose `param.rot`  | refuzohet: `VALUE_UNSUPPORTED package/scenes/1/tracks/47/channel` | probë + test Y7c                                                                                                                       |
| Aset që deklaron parametër që asnjë vizatim nuk e lexon | refuzohet: `PARAM_UNSUPPORTED manifest/assets/2/parameters/2`     | probë                                                                                                                                  |
| **Prop `held` me `facing` = 0 ose 0,5**                 | **kalon Gate-in**                                                 | probë; renderer-i e përdor `facing` si shumëzues te `scale(s·f, s)` (`props.ts:26`): me 0 prop-i del me gjerësi zero, me 0,5 i shtypur |
| **Aktor me `facing` = 0,5**                             | **kalon Gate-in**                                                 | probë; `rig.ts:182` shumëzon me `facing`                                                                                               |

**Pse ndryshimi i rregullit nga E1.3 nuk e dobëson vetë validimin:**

- E1.3 kërkonte që çdo vizatim i asetit të merrte çdo parametër. E1.4 kërkon që të paktën një ta marrë.
- Kompensimi është i plotë:
  - një track parametri mbi një nyje, vizatimi i së cilës nuk e lexon, refuzohet;
  - një parametër-kanal që vizatimi i nyjes e lexon pa track refuzohet;
  - gjendja e nyjes nuk ndryshon kurrë, sepse event-et me `state` refuzohen.
- Kështu çdo track i pranuar lexohet, dhe çdo kanal i lexuar ka track.

**Por:** diapazoni i `facing` (`[-1, 1]`) lejon vlera të vazhdueshme. Kodi, komenti i capabilities ("facing is -1 or 1") dhe lloji `1 | -1` pranojnë vetëm ±1. Kjo jep animacion të gabuar pa asnjë gabim: **F2**.

## 2. Kufijtë e kamerës: **PASS, me një pikë të hapur (F4)**

| Kontroll                                                | Rezultati                                                                                                                          | Evidenca                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Formula flat / editorial / W0                           | e dokumentuar dhe e provuar; editoriali kërkon x = 540 (X11); W0 në planin e aktorëve                                              | scope §V2; `contracts/test/camera-view.test.ts`      |
| I gjithë intervali, me interpolim dhe overshoot         | 12/12 teste të pastra: sample në mes, sample-i i fundit, overshoot i ruajtur, `linear`, `hold`, fundi i kapur, track-e të përziera | `pnpm --filter @erkasa/contracts test`               |
| Kontrolli i dendur i pavarur (nuk përdor `cameraViews`) | 0 shkelje në 905 620 çaste (çdo 1/3000 s, ±0,5 s përtej track-eve) mbi tetë paketat; 13 698 pamje analitike, 0 jashtë              | probë ad hoc me `numberAt`                           |
| Kufiri ekzakt dhe shkelja minimale                      | prekja ekzakte pranohet; një hap float brenda refuzohet (`VALUE_RANGE`) për set, editorial dhe W0                                  | `gate/test/bounds.test.ts` (3), rastet V2a–V2c       |
| Rrumbullakim                                            | asnjë; `enclose` rrit `w`/`h` me ulp derisa testi i Gate-it të kalojë                                                              | kodi `contracts/src/camera-view.ts`; testi `enclose` |
| prisoner-cell `h` 1920 → 1970 nuk ndryshon kuadrot      | 240/240 hash identikë me `golden-fixtures-b.json` (pjesë e K7)                                                                     | `golden:package`                                     |

**F4 (e hapur, jo e fshehur):** për W0, aritmetika float e vetë Engine-it (`project(cam, 0)`) ndryshon nga formula e kontratës në bitet e fundit.

- Mbi `bounds` të ngushta të Stager-it, pamja e llogaritur nga Engine-i del jashtë **me deri në 1,7·10⁻¹³ njësi bote** në 3 000 nga 179 305 çastet e dendura të W0. Kjo është rreth 10⁻¹³ piksel.
- Sipas formulës (përkufizimi në scope) nuk ka shkelje.
- Kërkohet vendimi yt:
  - (a) pranohet formula si përkufizim i kontratës;
  - (b) Gate-i dhe Stager-i përdorin për parallax aritmetikën e Engine-it;
  - (c) Stager-i lë një hapësirë kufiri.

## 3. Capabilities v2: **FAIL**

| Rregulli                             | Deklaruar në capabilities?                                                                                                                                                                                                                           | Test negativ | Test pozitiv |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------ |
| Kamera editoriale x = 540            | po: `projections.flat.camera.editorial`                                                                                                                                                                                                              | X11          | P1 (B1–B5)   |
| Gjendja e W0 nga `sky`               | po: `projections.parallax.stateFrom`                                                                                                                                                                                                                 | X12a         | P1 (W0)      |
| Bota nga `wall`                      | po: `stateFrom.statics.world`                                                                                                                                                                                                                        | X12b         | P1 (W0)      |
| **Props në pushim në `mid`**         | **jo: i shkruar në kod** (`gate/src/executable.ts:476`, `/^prop\..*\.resting$/` dhe `"mid"`)                                                                                                                                                         | Y8           | P1 (W0)      |
| **Sjellja e roleve `actors`/`held`** | **pjesërisht:** rolet janë të deklaruara, por kodi vendos vetë që `actors` caktohet nga prania e aktorit, që `actors` dhe `held` mund të përsëriten, dhe që blur-i i aktorëve barazohet me shtresën e parë (`executable.ts:424, 445, 487, 500, 518`) | Y2, Y6       | P1 (W0)      |

**F3:** kushti "asnjë kufizim vetëm si logjikë e fshehur në Gate" nuk plotësohet për këto dy rreshta.

## 4. Gjetje shtesë gjatë auditimit: **FAIL (F1)**

Vlerat e parametrave statikë (`params`) nuk validohen; validohet vetëm prania e tyre.

| Probë                                | Gate      | Renderer                                       |
| ------------------------------------ | --------- | ---------------------------------------------- |
| `type.kinetic` me `lines: "hello"`   | **kalon** | **dështon:** `lines.forEach is not a function` |
| `type.kinetic` me `y: "top"`         | **kalon** | renderohet me pozicion të pavlefshëm           |
| `overlay.scrim` me `place: "middle"` | **kalon** | renderohet si `top`, në heshtje                |

Kjo është shkelje e drejtpërdrejtë e parimit "Gate PASS ⟹ renderer-i ekzekuton".

## 5. Auditimi i rezultateve

| Pika                                     | Rezultati | Komanda → rezultati                                                                                                                                                                                                                              |
| ---------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| K1                                       | **PASS**  | `npx vitest run test/package/k1.test.ts` → 6 043/6 043 (pjesë e 129 testeve të ekzekutuara veçmas)                                                                                                                                               |
| K2/K3                                    | **PASS**  | `node --expose-gc --import tsx test/package/golden-package.ts --verify` → "K2/K3: 0 failures; 140 v2 frames differ from golden.json only in kinetic-type ids"; `pnpm -s golden` → "405 v2 frames (140 changed only in ids) + 136 W0, 0 failures" |
| K5                                       | **PASS**  | `k5.test.ts` → 103/103 + numërimi; kod dhe shteg ekzakt; 0 kuadro; sink-u nuk niset                                                                                                                                                              |
| K7                                       | **PASS**  | "K7: 931/931 frames identical to golden-package.json"                                                                                                                                                                                            |
| K8                                       | **PASS**  | `gate/test/svg.test.ts` + `negative.test.ts` + `fields.test.ts` + `bounds.test.ts` → 140/140                                                                                                                                                     |
| K9                                       | **PASS**  | `pnpm test` → contracts 238, engine 23, compiler 28, engine-worker 16, stager 70, film 214, planner 6, gate 200, ai-worker 35 (830, 0 dështime)                                                                                                  |
| Typecheck / lint / format                | **PASS**  | `pnpm typecheck` 0 gabime; `pnpm lint` pa gabime; `pnpm format:check` "All matched files use Prettier code style!"; `pnpm contracts:gen --check` exit 0                                                                                          |
| Renderer-i nuk lexon fusha të pazbatuara | **PASS**  | `film/test/package/boundary.test.ts` (T9)                                                                                                                                                                                                        |
| `golden.json` historik                   | **PASS**  | i krijuar në E0 (`9effcfe`), i pandryshuar që atëherë; `git diff --quiet eda5ab5 HEAD -- film/golden/golden.json` → identik; sha256 `e18b5e8d…`                                                                                                  |
| Ndryshimet vetëm në branch               | **PASS**  | `origin/main` = `7f8ffca`; 56 commit-e vetëm në `e1-4-engine-reads-package`                                                                                                                                                                      |

## 6. Problemet e mbetura (për vendimin tënd)

| #   | Problemi                                                                                         | Ndikimi                                                       | Mbyllja e propozuar (pa e implementuar)                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Vlerat e parametrave statikë nuk validohen                                                       | paketë që kalon Gate-in dhe rrëzon ose shtrembëron renderimin | `capabilities` publikon formën e çdo parametri statik (JSON Schema e vogël për builtin); Gate-i e kontrollon me `VALUE_UNSUPPORTED` te `…/params/<id>`      |
| F2  | `facing` (prop dhe aktor) pranon vlera jo ±1                                                     | animacion i gabuar pa gabim                                   | vlera të lejuara diskrete në deklaratën e kanalit (`values: [-1, 1]`), të kontrolluara mbi çdo sample dhe çelës; me çelësa `linear` midis −1 dhe 1, refuzim |
| F3  | Rregulli "props në pushim në `mid`" dhe sjellja e roleve `actors`/`held` janë në kodin e Gate-it | kufizim i padeklaruar                                         | deklarohen te `roles` (p.sh. `builtins` të lejuara për rol; `repeat: true`; `from: "actors"`) dhe Gate-i lexon vetëm deklaratën                             |
| F4  | W0: aritmetika e Engine-it kundrejt formulës, ≤ 1,7·10⁻¹³                                        | asnjë efekt i dukshëm; pyetje përkufizimi                     | vendim (a), (b) ose (c)                                                                                                                                     |
| —   | Asnjë test i commit-uar për prop `held` pa `facing`/`rot`                                        | mbulim                                                        | test negativ                                                                                                                                                |

Pres miratimin tënd. Nuk e deklaroj E1.4 të përfunduar dhe nuk nis E1.5.
