# W2-V: Advanced Character Animation & Visual Quality Upgrade: Auditimi dhe Propozimi Teknik

| Fusha   | Vlera                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------- |
| Data    | 2026-11-20                                                                                     |
| Baza    | `g0-advanced-engines` @ `20bd059` (W1 + W2)                                                    |
| Kërkesa | "W2: Advanced Character Animation & Visual Quality Upgrade" (PO, 2026-11-20)                   |
| Statusi | **Vetëm auditim dhe propozim.** Asnjë ndryshim kodi. W3 pret. Golden references nuk preken.    |
| Prova   | `docs/reports/w2v/face-before.png` (rig-u aktual, close-up, 5 humore), `docs/reports/w2/*.png` |

## 0. Përmbledhja

1. **Pamja si kukull nuk vjen nga logjika e acting-ut (W2), por nga modeli vizual.** Personazhi vizatohet në kod si një cutout në profil me tuba (vija me fund të rrumbullakët), elipsa dhe një blob trupi. Fytyra ka 6 kanale. Syri është një elipsë e zezë 7,5 × 9 njësi, pa të bardhë dhe pa iris. Ky model nuk mund të shprehë atë që kërkon dokumenti, sado mirë ta drejtojmë.
2. **Sistemi i shikimit ka tre gabime parimore:** lëvizje të rastësishme të syve (kundër kërkesës), asnjë ndjekje e objektit që lëviz (objektivi lexohet vetëm në çastin e nisjes), dhe në profil syri ka vetëm dy drejtime (para/prapa).
3. **Trupi nuk ka shtyllë, shpatulla ose kyç.** Busti është një formë e ngurtë që rrotullohet rreth ijeve. Krahu i largët nuk ka IK. Dora është një elipsë pa gishta. Nuk ka asnjë kontroll ndërprerjeje (dora nëpër trup ose tavolinë).
4. **Propozimi: Character Model v3,** një model i ri parametrik brenda Character Acting, i versionuar si `erkasa.rig.cutout/3`:
   - kokë 3/4 me rrotullim (yaw);
   - sy të plotë (sklerë, iris, bebëz, qepalla sipër/poshtë);
   - fytyrë me njësi veprimi (FACS-lite);
   - bust me dy segmente dhe shpatulla, kyçe, duar me poza;
   - sistem shikimi me objektiva reale të skenës.

   Kalon nëpër të njëjtën rrugë: paketa → Gate → renderer. Filmat ekzistues mbeten në `@1`/`@2`, prandaj golden-et nuk preken. Pjesët vizatohen në kod, por formati lejon që një ilustrues t'i zëvendësojë më vonë pa ndryshuar drejtimin.

5. **Asnjë Engine i pestë.**
   - Pothuajse gjithçka është te Character Acting.
   - World Builder jep pikat e kapjes dhe të leximit dhe pozicionet e objekteve (për ndjekjen me sy).
   - Camera jep kornizat close-up me kritere lexueshmërie të fytyrës.
   - Director-i (Worker 4) shkruan qëllimin e performancës.
6. **Rendi:** C0 benchmark-u bazë dhe mjetet e matjes → **C1 model sheet (porta vizuale e PO-së)** → C2 ndërtimi + sytë + fytyra → C3 shikimi → C4 performanca e fytyrës + visemes → C5 mekanika e trupit + duart → C6 ndërveprimi + Director → C7 benchmark-u A–F me video.

## 1. Auditimi

### 1.1 Ndërtimi i personazhit (`film/src/rig.ts`)

| Pjesa          | Si është                                                               | Pse duket kukull                                                    | Statusi kundrejt kërkesës §2     |
| -------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------- |
| Pamja          | vetëm profil; kthimi = shtypje horizontale (`turn`) dhe përmbysje      | asnjë 3/4, asnjë kontakt me sy me kamerën ose me partnerin përballë | Missing (view-dependent drawing) |
| Koka           | elipsë 56 × 62; hunda një gungë me ngjyrën e lëkurës; veshi një elipsë | pa ballë, harqe vetullash, faqe, nofull: fytyra nuk ka strukturë    | Broken                           |
| Qafa           | një vijë 34 px me fund të rrumbullakët                                 | qafa "tub", pa lidhje me kokën ose shpatullat                       | Broken                           |
| Bust           | një formë e vetme që rrotullohet rreth ijeve (`torso`)                 | pa shtyllë, gjoks, legen ose shpatulla: trupi nuk përkulet          | Partial                          |
| Krahët, këmbët | vija `stroke-linecap="round"` 34–52 px                                 | bërrylat dhe gjunjët duken si tuba të përkulur, pa formë muskuli    | Broken                           |
| Dora           | elipsë 19 × 19 (`hand` 0..1 e ngushton)                                | pa gisht të madh, gishta ose kyç: dora nuk "kap"                    | Missing                          |
| Proporcionet   | konstante në `RIG` (mirë); 6 koka                                      | të qëndrueshme; problemi është forma, jo masa                       | Partial                          |

### 1.2 Sytë (§3: prioritet)

| Aftësia                                 | Si është                                                                   | Statusi                      |
| --------------------------------------- | -------------------------------------------------------------------------- | ---------------------------- |
| Sklera, iris, bebëz                     | një elipsë e zezë `#1B1B2F` 7,5 × 9 (në close-up ≈ 22 × 27 px në ekran)    | Missing                      |
| Qepallat                                | `lid` vetëm e ngushton elipsën vertikalisht                                | Partial                      |
| Vetullat                                | një vijë me një parametër (`brow` −1..1); s'ka të brendshme/të jashtme     | Partial                      |
| Drejtimi i shikimit, i pavarur nga koka | `gx` ±1 zhvendos elipsën 7 njësi; në profil shihet vetëm para/prapa        | Partial                      |
| 1 Fixation                              | `gazeTo` mban një pikë                                                     | Partial                      |
| 2 Saccades                              | rampë 0,12 s; pa rregull për kokën që ndjek                                | Partial                      |
| 3 Smooth pursuit                        | objektivi lexohet vetëm në `t0` (`point(a.target, t0)`)                    | **Missing**                  |
| 4 Blinking                              | periodike 2,6–4,4 s, e njëjtë për çdo emocion                              | Partial                      |
| 5 Gaze aversion                         | W2 (`deliver`)                                                             | Partial                      |
| 6 Gaze anticipation                     | `pick_up`, `read`, `turn_to` (2–8 kuadro, e matur në W2)                   | Implemented                  |
| 7 Emotional eye behavior                | humori ndryshon `lid` dhe `gy` pak; s'ka hapje, tension ose madhësi bebëze | Missing                      |
| "Mos përdor lëvizje të rastësishme"     | micro-acting: `p.gx += shift(beat*3+1)*0.15` çdo 2,3 s                     | **Broken** (kundër kërkesës) |

### 1.3 Fytyra (§4)

- Kanalet e fytyrës janë 6: `gx`, `gy`, `lid`, `brow`, `mouth` (−1 frown..1 smile), `open` (lip-sync nga kohët e fjalëve).
- Humoret janë 8. **Mungojnë fear, anger dhe surprise.** Worry dhe anger nuk mund të dallohen: të dyja kërkojnë vetulla, por me boshte të kundërta (worry: e brendshme lart; anger: e brendshme poshtë dhe e mbledhur). Kemi vetëm një bosht.
- Faqet, buzët dhe forma e gojës mungojnë. Goja është një hark ose një elipsë e hapur. Visemes mungojnë, megjithëse ElevenLabs na jep kohët **për çdo shkronjë** (`ai-worker/src/voice.ts`, `character_start_times_seconds`): të dhënat ekzistojnë, por nuk përdoren.
- Prova: `face-before.png`. `neutral`, `anxious` dhe `determined` ndryshojnë vetëm me disa px të vetullës.

### 1.4 Mekanika e trupit (§5)

| Aftësia                      | Si është                                                                           | Statusi     |
| ---------------------------- | ---------------------------------------------------------------------------------- | ----------- |
| Weight, balance, COG         | ecja me foot planting (IK), animi; në këmbë pa zhvendosje ijesh mbi këmbën që mban | Partial     |
| Anticipation, follow-through | në ecje, ngritje, `react`, gjeste (W2)                                             | Partial     |
| Overlapping action           | krahu i largët pak më vonë; asnjë "successive breaking" nëpër zinxhir              | Partial     |
| Easing                       | kurba `io`, `out`, `back`                                                          | Implemented |
| Shpatull–bërryl–kyç          | pa shpatull (vetëm `shrug`), pa kyç; IK vetëm për krahun e afërt                   | Missing     |
| Artikulimi i dorës           | Missing                                                                            | Missing     |
| Kalime pa kërcime            | W2 + `fix-shot-first-frame` (pret miratimin)                                       | Partial     |
| Secondary motion             | rrobat (W1), micro-acting                                                          | Partial     |
| Duar nëpër objekte/trupa     | **asnjë kontroll** (`CA-D4` nuk është i implementuar)                              | Missing     |

### 1.5 Ndërveprimi me objektin (§6)

Nga 9 hapat e kërkesës, W2 ka:

- 1 (sytë), 2 (koka), 4 (krahu me IK), 6 (objekti ndjek dorën, nga socket-i), 7 (pozicioni i leximit), 8 (sytë skanojnë rreshtat) dhe 9 (`react`).

Mungojnë:

- **3** (trupi përgatitet: përkulje, zhvendosje peshe);
- **5** (dora merr formën e kapjes në kuadrin e kontaktit);
- kontrolli që dora nuk kalon nëpër tavolinë.

Hapat janë ende veprime të lidhura me `then`, jo një "ndërveprim" me një plan të vetëm kohor.

### 1.6 Renderer-i dhe pipeline-i

- **Nuk është pengesa.**
  - Renderer-i vizaton SVG me resvg, determinist, me anti-aliasing të mirë.
  - Paketa mban çdo kanal të rig-ut si mostër për çdo kuadër.
  - Gate-i kontrollon kanalet sipas deklarimit të rig-ut.
  - Një rig i ri me më shumë kanale hyn pa ndryshuar kontratën.
- Video pa zë mund të renderohet që tani me kohë të vlerësuara (`timing.ts`, ~165 fjalë/min). Benchmark-u nuk pret ElevenLabs.
- Kufizim i vogël: `shadow` dhe `rim` janë `false` (restricted). Hija e kontaktit dhe drita mbi personazhin vijnë te W5 (FX).

### 1.7 Çfarë NUK është shkaku

- Logjika e W2 (`how`, `then`, gjestet mbi fjalë, vazhdimësia e intent-it) është e shëndoshë dhe mbetet. Ajo e drejton modelin e ri pa ndryshim konceptual.
- Pipeline-i, kontratat dhe Gate-i nuk kanë nevojë për ristrukturim.

## 2. Çfarë bëhet me rig-un aktual dhe çfarë kërkon model të ri

| Kërkesa                                            | Me rig-un aktual (profil, v1/v2)                                  | Kërkon modelin v3                                 |
| -------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| Sy me sklerë/iris/bebëz                            | po, por vetëm një sy në profil: iris i ngjeshur në skajin e syrit | **po**: dy sy në 3/4, iris që lëviz lirshëm       |
| Gaze i pavarur nga koka                            | vetëm para/prapa, lart/poshtë                                     | **po**: shikim drejt partnerit, kamerës, objektit |
| Pursuit, saccade, blink sipas emocionit, aversion  | **po** (logjikë, jo vizatim)                                      | —                                                 |
| Heqja e lëvizjeve të rastësishme                   | **po**                                                            | —                                                 |
| Fear, anger, surprise të dallueshme                | pjesërisht (vetullat me 2 boshte)                                 | **po** (faqe, qepalla, gojë)                      |
| Visemes                                            | pjesërisht (3–4 forma në profil)                                  | **po** (8 forma)                                  |
| Shtyllë, shpatulla, kyç, IK për të dy krahët       | po (kanale të reja, i njëjti vizatim)                             | forma më e mirë në v3                             |
| Duar me gishta                                     | jo                                                                | **po**                                            |
| Kthesa trupore ose ndryshim pamjeje (profil ↔ 3/4) | jo                                                                | **po**                                            |
| Kontrolli i ndërprerjeve                           | **po** (gjeometri e rig-ut)                                       | —                                                 |

Përfundimi: përmirësimet e logjikës (shikimi, emocionet, kontrolli i ndërprerjeve, IK) kanë vlerë edhe me rig-un aktual. **Hapi vizual që kërkon dokumenti nuk arrihet pa modelin v3.**

## 3. Arkitektura e propozuar

### 3.1 Character Model v3 (brenda Character Acting)

```
film/src/character/
  model.ts       model sheet si të dhëna: proporcionet, gjatësitë, format, paleta e personazhit (i bllokuar nga testet)
  head.ts        koka me yaw (profil · 3/4 · ballë): ballë, harqe vetullash, hundë, faqe, nofull, vesh, flokë
  eyes.ts        sklerë, iris, bebëz (madhësia), qepalla sipër/poshtë, vetulla të brendshme/të jashtme
  face.ts        njësi veprimi (FACS-lite) → format e vetullave, qepallave, faqeve, gojës
  mouth.ts       8 visemes + forma emocionale e buzëve
  body.ts        legen + gjoks (shtylla me 2 segmente), shpatulla, krahë/këmbë me formë (pa tuba)
  hands.ts       poza: e hapur, e çlodhur, grusht, tregon, kap (letër/filxhan), pëllëmbë lart, në gjoks
  gaze.ts        fixation, saccade, pursuit, blink, aversion, anticipation, emotional eyes (planifikim)
  expression.ts  emocionet → njësi veprimi + sjellja e syve + qëndrimi; përzierje dhe kalime
  contact.ts     kapsula të trupit dhe sipërfaqe objektesh: kontrolli i ndërprerjeve
```

- **Rig-u** `rig_cutout_*@3`, formati `erkasa.rig.cutout/3`. ~38 kanale (sot 19), të deklaruara në manifest.
  - Koka: `yaw`, `roll`.
  - Sytë: `irisX`, `irisY`, `pupil`, `lidUp`, `lidLow`, `eyeWide`.
  - Vetullat: `browIn`, `browOut`, `browKnit`.
  - Fytyra: `cheek`, `noseWrinkle`, `lipUp`, `lipDown`, `lipPress`, `jaw`, `mouthWide`, `mouthRound`.
  - Trupi: `chest`, `pelvis`, `shoulderN`, `shoulderF`, `wrist`, `wristF`, `handPose`, `handPoseF`; plus kanalet ekzistuese.
- **Pa ndryshim kontrate:** stager-i regjistron kanalet; Gate-i i kontrollon me rregullat ekzistuese (`channels`, `slots`, `garments`); renderer-i thërret vizatimin e rig-ut sipas versionit.
- **Filmat ekzistues** mbeten në `@1`/`@2`. Golden-et e B1–B5 nuk preken. Kalimi i tyre në `@3` është një vendim më vete, me miratimin tënd.
- **I zëvendësueshëm nga artisti:** çdo pjesë (koka sipas yaw, sytë, gojët, duart) ka një ndërfaqe të vizatimit me kanale. Një ilustrues mund të japë pjesët si SVG dhe logjika nuk ndryshon. Ky është parimi i `rig.ts` sot, i zgjeruar.
- **Veshjet (W1)** kalojnë në modelin v3: lista e `GarmentKind` mbetet kontrata, format vizatohen mbi trupin e ri.

### 3.2 Kufijtë mes Engine-ve

| Përgjegjësia                                                                     | Engine / Worker         | Hyrja                                      | Dalja                                       |
| -------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------ | ------------------------------------------- |
| Modeli, fytyra, sytë, trupi, duart, shikimi, ndërprerjet                         | **Character Acting**    | qëllimi, objektivat, pikat e World Builder | kanalet e rig-ut për çdo kuadër             |
| Pikat e kapjes, pozicioni i leximit, sipërfaqet, pozicioni i objektit në kohë    | **World Builder**       | seti, props                                | pikat dhe gjurmët e objekteve (për pursuit) |
| Close-up dhe medium që e lexojnë fytyrën (madhësia e kokës, headroom, look room) | **Cinematic Camera**    | subjekti, drejtimi i shikimit              | korniza                                     |
| Qëllimi emocional dhe fizik, objektivi i shikimit, sekuenca                      | **Director (Worker 4)** | skenari                                    | plani (`erkasa.film/1` i zgjeruar)          |

### 3.3 Sistemi i shikimit (§3)

**Çdo lëvizje e syrit ka një objektiv me ID në skenë:** person, prop, mark, target ose kamera. Asnjë lëvizje e rastësishme; micro-acting-u i syve hiqet për modelin v3.

| Sjellja        | Rregulli                                                                                                                   | Matja                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Fixation       | sytë mbeten te objektivi edhe kur koka ose trupi lëvizin (kompensim)                                                       | gabimi i drejtimit ≤ 3°   |
| Saccade        | kërcim 3–5 kuadro; koka ndjek pas 4–8 kuadrove, vetëm nëse këndi > 15°                                                     | kohëzgjatja dhe vonesa    |
| Smooth pursuit | objektivi lexohet në çdo kuadër (pozicioni i objektit nga World Builder); vonesa ≤ 3 kuadro                                | gabimi në kuadër          |
| Blink          | rrallësia sipas emocionit (i qetë ~15/min, i shqetësuar ~30/min, i fokusuar ~8/min); një shkelje syri me saccade-t e mëdha | shpeshtësia, sinkronizimi |
| Aversion       | sipas intent-it (W2), drejt një objektivi real (dyshemeja, letra, dritarja), pastaj rikthim                                | kohëzgjatja, objektivi    |
| Anticipation   | sytë 2–8 kuadro para kokës ose dorës (W2, i shtrirë te çdo veprim)                                                         | vonesa                    |
| Emotional eyes | hapja (`eyeWide`), tensioni i qepallës së poshtme, madhësia e bebëzës sipas emocionit                                      | vlerat sipas tabelës      |

### 3.4 Fytyra dhe emocionet (§4)

- Tabela e emocioneve në njësi veprimi: **worry, convince, reassure, fear, anger, sadness, surprise, joy, neutral, thinking**. Për secilin: vetullat (e brendshme, e jashtme, e mbledhur), qepallat, faqet, buzët, nofulla, sjellja e syve (blink, aversion, bebëza) dhe qëndrimi.
- Kontrata `Mood` zgjerohet me `fear`, `angry` dhe `surprised`, pa hequr asgjë.
- **Një komandë emocionale ndikon gjithë performancën:** fytyrën, sytë, qëndrimin, amplitudën dhe ritmin e gjesteve (W2) dhe ecjen (`GAIT`).
- **Dallueshmëria matet:**
  - [A]: distanca mes çdo çifti emocionesh në hapësirën e njësive të veprimit ≥ prag.
  - [H]: nga një close-up pa zë, vlerësuesi e njeh emocionin në ≥ 4 nga 5 raste.
- **Visemes:** 8 forma nga kohët e shkronjave të ElevenLabs. Pa zë real, nga vlerësimi i fjalëve.

### 3.5 Mekanika e trupit (§5)

- Shtylla me dy segmente (legen dhe gjoks) dhe shpatulla që ngrihen dhe dalin përpara.
- IK për të dy krahët, me pol bërryli. Kyçi është kanal më vete.
- **Successive breaking:** zinxhiri ndjek me vonesë, si rregull i vetëm:
  - bust → krah +2 kuadro → parakrah +3 → dorë +4.
  - Kjo shmang lëvizjen e njëkohshme dhe identike të të gjitha pjesëve.
- **Pesha:** në këmbë, legeni zhvendoset mbi këmbën që mban. Ndryshimet e peshës kanë arsye (gjest, kthim), jo zhurmë.
- **Ndërprerjet (`contact.ts`):** kapsula për kokën, bustin dhe krahët, plus sipërfaqet e props dhe tavolinave. Dora nuk hyn në trup ose në objekt përveç kontakteve të deklaruara. Matet në çdo kuadër.
- **Deformimi:** gjatësitë e kockave dhe madhësia e kokës janë konstante (testi i modelit). Asnjë formë nuk ndryshon përmasë gjatë animimit.

### 3.6 Ndërveprimi si një veprim i vetëm (§6)

`interact(pick_up | read | give | open)` planifikon 9 hapat në një kohë të përbashkët, jo si veprime të lidhura:

| Hapi                                                            | Koha                              |
| --------------------------------------------------------------- | --------------------------------- |
| 1 sytë                                                          | t0                                |
| 2 koka                                                          | +3 kuadro                         |
| 3 përgatitja e trupit (përkulje, peshë)                         | +5                                |
| 4 krahu                                                         | +6                                |
| 5 forma e kapjes së dorës                                       | në kuadrin e kontaktit            |
| 6 objekti lidhet me dorën                                       | në të njëjtin kuadër              |
| 7 afrimi në pozicion leximi                                     | —                                 |
| 8 sytë ndjekin rreshtat (të sinkronizuara me rreshtat e letrës) | —                                 |
| 9 reagimi                                                       | në fjalën ose beat-in e deklaruar |

Pikat vijnë nga World Builder.

### 3.7 Director-i (§7)

Plani merr për çdo personazh në çdo beat:

- emocionin dhe intensitetin;
- qëllimin fizik (foljet ekzistuese);
- objektivin e shikimit;
- një shprehje të veçantë, kur duhet;
- qëndrimin.

Vlerat e paracaktuara dalin nga emocioni, kështu që plani mbetet i shkurtër. Kufiri i 16 fushave nullable të API-së ruhet si në W1/W2 (enum me "").

## 4. Fazat

Çdo fazë: branch-i i vet, teste, video para/pas, contact sheet, miratim para merge. Golden-et e B1–B5 nuk preken në asnjë fazë.

| Faza   | Objektivi                          | Dalja                                                                                                                                                                                              | Porta                                                           |
| ------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **C0** | Benchmark-u bazë dhe mjetet        | Skenat A–F si plane; video MP4 (pa zë, kohë e vlerësuar) me rig-un **aktual**; contact sheets; kontrollet automatike për kuadër (snapping, ndërprerje, deformim, identitet, prerje jashtë kuadrit) | raporti i defekteve "para"                                      |
| **C1** | Model sheet v3                     | Pamjet profil/3-4/ballë, fleta e shprehjeve (10 emocione), e duarve (7 poza) dhe e gojës (8 visemes), si stills nga kodi                                                                           | **porta vizuale e PO-së**: pa miratimin e modelit, nuk animohet |
| **C2** | Ndërtimi + sytë + fytyra (statike) | `character/` model, head, eyes, face, mouth, body, hands; rig `@3`; Gate dhe paketa                                                                                                                | teste modeli (proporcione, gjatësi, siluetë), skena A statike   |
| **C3** | Sistemi i shikimit                 | `gaze.ts`: 7 sjelljet; heqja e lëvizjeve të rastësishme                                                                                                                                            | skenat B dhe C, matjet e §3.3                                   |
| **C4** | Performanca e fytyrës              | `expression.ts` me 10 emocione, kalime, visemes                                                                                                                                                    | skena A (video), [A] + [H]                                      |
| **C5** | Mekanika e trupit + duart          | shtylla, shpatulla, IK për të dy krahët, kyçi, successive breaking, pesha, `contact.ts`                                                                                                            | skena F; 0 ndërprerje                                           |
| **C6** | Ndërveprimi + Director             | `interact`; kontrata e performancës; director-i                                                                                                                                                    | skenat D dhe E                                                  |
| **C7** | Benchmark-u final A–F              | video, contact sheets, matje, rubrika [H], krahasim me C0                                                                                                                                          | **pranimi i W2-V**                                              |

Rendi niset nga sytë dhe fytyra sepse aty është dobësia më e dukshme dhe më e shpejtë për t'u ndrequr. Porta C1 ekziston sepse një model i keq i animuar mirë mbetet model i keq.

## 5. Benchmark-u vizual (§10)

| Skena | Përmbajtja                                                                        | Matjet automatike                                                                     | [H]                              |
| ----- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------- |
| A     | Close-up, 5+ emocione (worry, fear, anger, sadness, surprise, reassure) me kalime | distanca e njësive të veprimit mes emocioneve; kalimet ≥ 0,5 s; asnjë kërcim          | njohja pa zë ≥ 4/5               |
| B     | Sytë ndjekin një objekt që lëviz (letër që bie, filxhan që shtyhet)               | gabimi i ndjekjes ≤ 3°, vonesa ≤ 3 kuadro; koka ndjek pas 15°                         | "sytë janë te objekti"           |
| C     | Shmang shikimin, pastaj rikthehet te bashkëbiseduesi                              | objektivat e shikimit për kuadër; rikthimi; blink në saccade                          | "e lexoj turpin ose shqetësimin" |
| D     | Merr dhe lexon një letër, me 9 hapat                                              | renditja dhe vonesat e §3.6; 0 ndërprerje dorë/tavolinë; kapja në kuadrin e kontaktit | "veprim i integruar"             |
| E     | Dialog me dy personazhe me karaktere të ndryshme                                  | identiteti (fingerprint), dallimi i performancave (W2), eyeline mes tyre              | "dy njerëz të ndryshëm"          |
| F     | Ecje, ndalim, kthim, reagim, vazhdim                                              | foot sliding ≤ 2 px, asnjë kërcim, pesha mbi këmbë                                    | "peshë, jo kukull"               |

Për çdo skenë:

- video MP4;
- contact sheet;
- raport për çdo kuadër: snapping, ndërprerje, deformim, prerje jashtë kuadrit, identitet;
- rubrika [H] (Standard §10.2);
- krahasim me C0.

W2-V pranohet vetëm kur benchmark-u vizual tregon përmirësim të dukshëm. Testet teknike nuk mjaftojnë.

## 6. Rreziqet dhe kufijtë e sinqertë

1. **Tavani i një modeli të vizatuar në kod.** Mund të arrijmë një stil 2D editorial i pastër vektorial, me sy dhe fytyrë ekspresive. Cilësia e dizajnit të personazhit varet nga syri i art direction-it. Prandaj ekziston porta C1. Nëse modeli nuk të bind, alternativa është që një ilustrues të vizatojë pjesët sipas të njëjtit format. Logjika nuk humbet.
2. **3/4 kundrejt profilit.** Kalimi në 3/4 është ndryshimi më i madh vizual dhe më i rëndësishmi për sytë. Kërkon kokë dhe bust të rinj. Këmbët dhe ecja mbeten profil/3-4 (zgjidhje e zakonshme në animacionin editorial).
3. **Kompleksiteti.** ~38 kanale dhe 10 module të vogla. Çdo modul ka testet e veta. Asnjë abstraksion pa përdorim.
4. **Gjenerimi AI i imazheve** (MA-O1) nuk zgjidh këtë problem, sepse një imazh statik nuk ka rig. Mund të përdoret vetëm si referencë për model sheet.
5. **Zëri.** Visemes të sakta kërkojnë ElevenLabs. Benchmark-u mund të renderohet pa zë. Lip-sync-u i plotë verifikohet kur të bësh run-in me çelësat.

## 7. Vendimet që kërkohen nga PO-ja

1. **Drejtimi:** Character Model v3 parametrik, me kokë 3/4 dhe pjesë të zëvendësueshme nga artisti. Alternativa: pritja e një ilustruesi para çdo pune vizuale.
2. **Fillimi i C0 dhe C1** (benchmark-u bazë + model sheet si stills). Asnjë animim para miratimit të model sheet.
3. **Benchmark-u pa zë** (kohë e vlerësuar) për C0–C6, dhe me ElevenLabs vetëm te C7.
4. **E hapur nga më parë:** miratimi i golden-eve të `fix-shot-first-frame`.
