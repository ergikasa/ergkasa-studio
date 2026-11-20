# W2: Acting Direction + Performance Sequencing

| Fusha     | Vlera                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Branch-i  | `g0-advanced-engines` (pas W1)                                                                                                        |
| Standardi | Engines Standard v2.1 §5.1b: CA-P1, CA-P2, CA-P4; plus CA-A4, CA-B1, CA-B2, CA-B3, CA-C4, CA-E3; testi D4 i kërkesave për personazhet |
| Statusi   | E implementuar dhe e testuar. **Not Verified** mbi video të plotë me zë (këtu nuk ka çelës TTS). Pa merge në `main`.                  |

## Problemi

- `talk` ishte një lak me katër poza krahu, njësoj për çdo emocion. Plani nuk kishte asnjë mënyrë për të thënë **çfarë do** personazhi kur flet.
- Veprimet ankoroheshin vetëm te fjalët ose te sekondat. Një sekuencë si "ecën → ndalon → shikon → merr → lexon → reagon → kthehet" duhej llogaritur me dorë, dhe veprimi i ri mbishkruante të vjetrin.
- Mungonin foljet `read`, `turn_to` dhe `react`.

## Çfarë u ndërtua

| Shtresa          | Skedari                                        | Çfarë bën                                                                                                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kontrata         | `film/src/contract.ts`                         | `Delivery` (explain, convince, worry, question, reassure, defend, confess, announce), `how` + `intensity` te `talk`, ankorimi `then`, foljet `read`, `turn_to`, `react`                                                                                                                        |
| Acting direction | `film/src/acting.ts`                           | tabela e intent-eve dhe fjalori i gjesteve. Çdo gjest ka përgatitje (më e gjatë kur lëvizja e krahut është më e madhe), goditje mbi një fjalë me peshë, mbajtje dhe lëshim. Koka bën beat-in, shikimi mbahet ose largohet sipas intent-it, dhe qëndrimi dhe fytyra janë në një shtresë më vete |
| Sekuencimi       | `film/src/perform.ts`                          | `then` nis veprimin kur mbaron i mëparshmi (me 3 kuadro mbivendosje). `read` ngre letrën dhe e lexon rresht pas rreshti. `turn_to`: sytë shkojnë të parët, trupi kthehet nëse objektivi është prapa. `react`: anticipim → goditje → follow-through → humor                                     |
| Vazhdimësia      | `film/src/continuity.ts`                       | intent-i kalon nëpër prerje: një folës i shqetësuar mbetet i shqetësuar në kuadrin e parë të shot-it tjetër, pa u çlodhur dhe tensionuar sërish                                                                                                                                                |
| Veshjet          | `film/src/wardrobe.ts`                         | rregulli i W1 u zgjerua: asnjë ngjyrë kryesore (kostum ose bluzë) nuk përsëritet mes personazheve. U gjet nga testi i pranimit, ku Mira dhe Ben dolën të dy me vjollcë                                                                                                                         |
| Director-i (LLM) | `planner/src/director.ts`                      | `how` (pa fushë nullable), `then`, foljet e reja dhe udhëzimet                                                                                                                                                                                                                                 |
| Filmi i pranimit | `film/acceptance/w2-acting.{script,film}.json` | shembulli i dokumentit, 7 shot-e, 28 s                                                                                                                                                                                                                                                         |

## Provat

Testet (`film/test/acting.test.ts`, 13/13) masin performancën kuadër për kuadër:

| Kriteri                 | Matja                                                                                                                                                          | Rezultati                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| D4 / CA-P4              | filmi i pranimit pa asnjë gabim editorial; çdo `then` nis kur mbaron veprimi i mëparshëm (mbivendosje 0–0,15 s, asnjë boshllëk)                                | kalon                                         |
| CA-E3                   | asnjë kërcim pozë në një kuadër (≥ 3× fqinjët dhe > 10° / 0,25), asgjë mbi 25° në kuadër, për çdo personazh në çdo shot                                        | kalon (nga kuadri 1; shih defektin më poshtë) |
| CA-B3                   | shikimi është te objektivi 2–8 kuadro para se të lëvizë dora (marrja e letrës, ngritja për lexim)                                                              | kalon                                         |
| CA-A4                   | `react`: anticipim ≥ 3 kuadro në drejtimin e kundërt, goditje, follow-through ≥ 4 kuadro, pastaj humori                                                        | kalon                                         |
| `turn_to` prapa         | sytë kthehen para trupit; pastaj trupi kthehet                                                                                                                 | kalon                                         |
| CA-P2                   | të njëjtat fjalë me `worry` dhe me `convince` japin dy performanca të ndryshme: supet, vetullat, animi, numri i gjesteve, fjalori dhe sa herë largohet shikimi | kalon                                         |
| CA-B2 + CA-C4 + CA-B1   | çdo gjest ka 4 faza dhe zgjat 0,4–2,5 s; goditja bie brenda 6 kuadrove nga një fjalë; ≥ 1 gjest për 4 s; asnjë gjest > 2 herë brenda 10 s                      | kalon                                         |
| Tranzicionet emocionale | ndryshimi i fytyrës zgjat ≥ 0,5 s dhe kurrë > 0,18 në kuadër; intent-i ruhet nëpër prerje (diferenca < 0,05)                                                   | kalon                                         |
| Përputhshmëria          | asnjë personazh i B1–B5 nuk ka shtresë intent-i                                                                                                                | kalon                                         |
| Paketa                  | filmi i pranimit kalon stager-in dhe Gate-in; `bone.torso` në paketë = poza e motorit                                                                          | kalon                                         |

Regresioni:

- `pnpm golden`: 0 dështime (B1–B5 405 kuadro + W0 136).
- `pnpm golden:package`: **K7 931/931 kuadro identike**.
- Gjithë workspace-i është jeshil: contracts 264, gate 423, stager 86, film 378, planner 8, compiler 28, engine 23, engine-worker 16, ai-worker 77 (+1 skip).

Pamjet (`cd film && node --import tsx test/w2-evidence.ts`):

- `w2-sequence.png`: 12 momentet e performancës, nga hyrja te "merr frymë sërish".
- `w2-worry-vs-convince.png`: të njëjtat fjalë në të njëjtat momente. Lart `worry`: koka poshtë, supet lart, duart afër trupit, shikimi te dyshemeja. Poshtë `convince`: animi përpara, të dy krahët drejt dëgjuesit me beat-e, vetullat të vendosura, shikimi te ai.

## Defekt i gjetur gjatë W2, më i vjetër se W1/W2

**Kuadri 0 i çdo shot-i vizatohet para gjendjes fillestare të trupit.** Gjendja fillestare (humori, krahu që mban CV-në, koka sipas shikimit) vendoset me një rampë 0,01 s që nis në t = 0. Prandaj kuadri 0 tregon pozën bazë, dhe kuadri 1 kërcen te poza e vërtetë.

- Matur te filmat e benchmark-ut: **30 nga 39 personazh-shot-e** kanë këtë kërcim në kuadrin e parë, deri në 31°. P.sh. B2: krahu i Alex-it 6°/10° → 22°/84°; B1: koka e Dritan-it +9°.
- Është një dridhje e një kuadri pothuajse në çdo prerje (CA-E3 / CA-E2: **Broken**).
- Rregullimi ndryshon kuadrin e parë të shot-eve në golden-et. Golden-et ndryshohen vetëm me miratimin tënd, prandaj rregullimi është në një branch më vete: `fix-shot-first-frame`.

## Kufizimet

- Fjalori i gjesteve është i kufizuar nga rig-u placeholder (profil, një dorë pa gishta, pa rrotullim të kyçit). Kur të vijë rig-u i artistit, tabelat e `acting.ts` mbeten kontrata: ndryshojnë format, jo logjika.
- Viseme për lip-sync mungojnë (CA-P3: Partial).
- Ndërveprimi fizik mes dy personazheve (prekje, përqafim) nuk është pjesë e W2.
