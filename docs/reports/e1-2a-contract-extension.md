# E1.2a – Zgjerim aditiv i `/1` për asetet procedurale (raport, për review)

|         |                                                                   |
| ------- | ----------------------------------------------------------------- |
| Branch  | `e1-2-stager`, nga `523e8570c4a39e2b949f8865941083aac7f4417e`     |
| Commit  | `df05e23c701d37e7c5b5afc79960f8587b3ae493` (vetëm `contracts/`)   |
| Data    | 2026-11-17                                                        |
| Statusi | Kodi i Stager-it nuk është nisur. Pret review-n e këtij zgjerimi. |

## Pse u desh

Duke përgatitur Stager-in u lexua si vizaton Engine-i i vjetër:

- **Aktorët:** `ActorPerf.draw(t)` = `drawPerson(pose(t), placed(t), look, glow)`. Ky është një funksion i pastër i 19 kanaleve `Pose` + `x, y, facing, turn, scale, glow`. Futet në kontratë pa ndryshim.
- **Set-et** (office, cage, room, interview) vizatohen në kod sipas tri vlerave: `light` (0..3, i vazhdueshëm), `t` (koha absolute, p.sh. akrepat e orës) dhe `door` (0..1). `erkasa.render/1` kishte vetëm gjendje statike.
- **12 shabllone editoriale** (25 nga 51 shot-e në B1–B5) janë grafika procedurale, funksion i kohës dhe i parametrave të tyre (`time`, etiketa, lista).
- **Teksti kinetik**, scrim-at dhe shpatulla OTS vizatohen në koordinatat e kuadrit, jashtë kamerës, por brenda shot-it: një `whip` i lëviz bashkë me skenën. Overlays e kontratës janë në nivel filmi, pra një tranzicion nuk i lëviz.

Vendimi i Product Owner-it: zgjerim aditiv i `/1`, i shqyrtuar para kodit të Stager-it.

## Çfarë u shtua

| Kontrata          | Fusha                     | Kuptimi                                                                                                                                                                    |
| ----------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `erkasa.assets/1` | `VectorAsset.parameters?` | Hyrjet e një aseti që vizatohet në kod. `channel{id, range}` = numër që animohet me track `param.<id>`; `static{id}` = vlerë JSON e fiksuar. Mungesa = aseti nuk ka hyrje. |
| `erkasa.render/1` | `AssetNode.params?`       | Vlerat statike (JSON) sipas `id` të parametrit. Mungesa = pa hyrje statike.                                                                                                |
| `erkasa.render/1` | kanali `param.<id>`       | Track mbi një nyje që ushqen hyrjen numerike të asetit procedural (`param.light`, `param.t`, `param.door`).                                                                |
| `erkasa.render/1` | `Scene.screen?`           | Shtresa në piksele kuadri, që kamera nuk i lëviz dhe drita nuk i prek, por që i përkasin skenës (tranzicioni i mbart). Mungesa = asnjë.                                    |
| `erkasa.render/1` | renditja e vizatimit      | Bëhet eksplicite: `layers` sipas rendit të listës, pastaj `screen`; nyjet sipas rendit të listës; Engine-i nuk i rirendit shtresat.                                        |

**Pse është aditiv:** çdo fushë e re është opsionale dhe mungesa e saj do të thotë "nuk ekziston", pra rregulli "pa default" mbetet. Shembujt `prisoner-cell` dhe të 49 rastet e mëparshme të refuzimit janë të pandryshuara dhe kalojnë. Renditja e vizatimit nuk ishte përcaktuar në E1.1; tani është.

**Kufiri kreativ:** parametrat përshkruajnë nga çfarë varet një vizatim (niveli i dritës, ora, sa e hapur është dera, etiketat e një grafiku), jo si tregohet historia. Asnjë `mood`, folje apo moment nuk hyn në kontratë.

## Prova

- Shembull i ri real `office-procedural`: set-i i zyrës (dy gjendje, `back` dhe `front`), shablloni `clock`, teksti kinetik në një shtresë `screen`, rig-u dhe fonti, dy skena me `whip`. Builtin-et janë fiksuar me sha256 të skedarit që i implementon (`sets.ts`, `templates.ts`, `style.ts`, `rig.ts`) dhe testi e verifikon.
- Testi i ri: çdo nyje procedurale vendos çdo parametër statik dhe ushqen vetëm kanale të deklaruara. Këtë rregull do ta zbatojë Validation Gate; këtu provohet te shembujt.
- 10 raste të reja refuzimi: lloj parametri i panjohur, `parameters` bosh, kanal pa `range`, `id` i pavlefshëm, `params` mbi një formë, çelës i pavlefshëm, `screen` me `depth`, `screen` bosh, `param.`, `param.a.b`.

| Komanda                                            | Rezultati                                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm contracts:gen --check`                       | exit 0                                                                                              |
| `pnpm -r test`                                     | 403/403 (contracts 213, engine 23, compiler 28, engine-worker 16, film 82, planner 6, ai-worker 35) |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | kalojnë                                                                                             |
| `pnpm --filter @erkasa/film golden`                | 451/451, 0 ndryshime                                                                                |

## Si do ta përdorë Stager-i (plani pas miratimit)

- Një skenë për çdo shot. Montazhi riprodhon `cut`, `fade` (dissolve) dhe `whip` me kohëzgjatjet e tyre.
- **Mostrat:** çdo kanal i aktorit ruhet në 30/s, duke filluar nga kuadri `round(start · 30)`. Gjatë tranzicionit, skena e mëparshme ka mostra edhe për kuadrot ku Engine-i i vjetër e vizaton atë, në kohën `dur + n/30` që përdor ai. Kështu çdo kuadër lexon pikërisht vlerën që shfaqej.
- **Prova numerike:** për çdo kuadër të çdo shot-i me aktorë, `drawPerson` me kanalet e dekoduara nga paketa duhet të japë SVG identik me `ActorPerf.draw(t)`. Golden 451/451 mbetet, sepse Engine-i nuk preket.
- **Determinizmi:** dy ekzekutime → paketa bajt për bajt identike.
- **Madhësia:** e matur për një film real 45 s, e ndarë në bone samples, kamera, drita, nyje, overlays. Pa kompresim.

## Pyetje dhe rreziqe për review-n

1. **Renditja e aktorëve.** Engine-i i vjetër i rendit aktorët sipas `x` në çdo kuadër. Stager-i do të vendosë çdo aktor në shtresën e vet. Nëse dy aktorë kryqëzohen brenda një shot-i, renditja statike nuk mjafton, dhe Stager-i do ta raportojë si gabim në vend që ta fshehë.
2. **W0.** Kompozuesi i W0 (Skia) ka hartë drite, hije me `multiply`, rreze me `screen`, rim, blur sipas thellësisë, grain. Të dhënat (kamera, aktorët, nivelet e dritës, thellësitë) futen në kontratë. Por që pikselët e W0 të dalin identikë në E1.4, modeli i dritave të kontratës duhet të përcaktohet numerikisht si formula e W0. Ky është vendim për E1.4: përputhje e saktë apo ndryshim vizual i miratuar me golden të ri.
3. **Fingerprint-et e builtin-eve** janë sha256 të skedarit burim derisa Engine-i t'i publikojë vetë në E1.3. Një ndryshim formatimi në `sets.ts` e ndryshon hash-in. Kjo është konservative: më mirë alarm i rremë sesa ndryshim i heshtur.
4. **Easing** (`easeInOut` etj.) ende nuk ka formulë në kontratë. Mbetet kusht i hapur para E1.4.
