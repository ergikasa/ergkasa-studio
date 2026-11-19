# Erkasa Studio — 4 Core Engines, Advanced Capability Standard v2.0

| Fusha | Vlera |
| ----- | ----- |
| Versioni | **2.0 — Draft për miratim** (zëvendëson v1.0 pas miratimit) |
| Data | 2026-11-19 |
| Fusha | Vetëm 4 Core Visual Engines. Workers kanë standardin e tyre (`workers-standard-v2.md`). |
| Natyra | **Specifikim i gjendjes së synuar.** Nuk përshkruan implementimin aktual. Gjendja aktuale vërtetohet me auditin e Fazës 2. |
| Çfarë shton v2 | prioritete P0/P1/P2, kritere të matshme dhe mënyrën e matjes për çdo aftësi, varësitë mes Engine-ve, pronësinë e timeline-it, Style Bible, licencat, buxhetin, QC-në, statuset e auditit dhe rregullin e provës end-to-end |

**Asnjë aftësi e v1.0 nuk hiqet dhe asnjë nuk zbutet.** Çdo aftësi e v1.0 ka këtu një ID, një prioritet dhe një kriter. Shtesat e v2 shënohen *(v2)*.

---

## 1. Qëllimi

Erkasa Studio prodhon **video editoriale të animuara, vertikale (9:16, 1080×1920, 30 fps), që shpjegojnë një ide** për platformat sociale. Objektivi final mbetet ai i v1.0: ambiente me logjikë hapësinore, personazhe me acting të besueshëm, kamera me gjuhë kinematografike dhe mjedise me lëvizje e atmosferë.

V2 shton atë që i mungonte v1: **çfarë ka rëndësi më shumë për këtë lloj videoje** dhe **si e dimë, me numra, nëse një aftësi është arritur**.

## 2. Parimet e përbashkëta (nga v1.0, të pandryshuara)

- **Narrative intent first:** çdo vendim vizual i shërben kuptimit dhe ritmit të historisë.
- **Explicit structure:** Engine-t punojnë me përfaqësime të strukturuara të skenës, jo me përshkrime tekstuale.
- **Spatial and temporal continuity:** pozicionet, identitetet, lëvizjet dhe kushtet mbeten koherente.
- **Deterministic control:** të njëjtat input-e prodhojnë të njëjtin rezultat, aq sa e lejon teknologjia.
- **Composable outputs:** output-i i një Engine përdoret nga të tjerët pa interpretime të fshehta.
- **Graceful degradation:** kur një aftësi nuk mbështetet, Engine e raporton dhe përdor fallback të kontrolluar.
- **Evidence-based completion:** asnjë Engine nuk shpallet i përfunduar pa prova vizuale, teste dhe benchmark-e.

## 3. Prioritetet, statuset dhe rregulli i provës *(v2)*

### 3.1 Prioritetet

| Prioriteti | Kuptimi | Pasoja |
| ---------- | ------- | ------ |
| **P0** | Pa të, një video shpjeguese nuk ka cilësi profesionale ose nuk lexohet. | Bllokon dorëzimin te klienti. Implementohet e para (Faza 4). |
| **P1** | E bën videon dukshëm më të mirë ose më të larmishme. Mungesa kufizon temat dhe skenat, por nuk e prish videon. | Pas të gjitha P0-ve. |
| **P2** | Zgjeron botën: lloje të reja ambientesh ose efektesh. E vlefshme për disa tema. | Vetëm pas P1-ve, ose kur një temë konkrete e kërkon. |

Prioriteti përcakton **rendin**, jo nivelin e cilësisë. Një aftësi P2, kur implementohet, duhet të kalojë të njëjtat kritere si një P0.

### 3.2 Statuset e auditit

| Statusi | Kuptimi | Prova e kërkuar |
| ------- | ------- | --------------- |
| **Implemented** | Aftësia kalon kriterin e saj në rrugën e plotë, në një video reale. | Kodi + testi + video ose kuadrot + matja |
| **Partial** | Ekziston dhe kalon kriterin në disa raste, jo në të gjitha; ose kalon vetëm një pjesë të kriterit. | Si më sipër, plus rastet ku dështon |
| **Missing** | Nuk ekziston rruga që e prodhon. | Kodi ku do të ishte, ose mungesa e kontratës |
| **Broken** | Ekziston, por në video prodhon rezultat të gabuar ose të dëmshëm. | Video ose kuadrot ku duket gabimi, dhe matja |
| **Not Verified** | Ekziston, por nuk u prodhua dot provë në auditim (p.sh. kërkon bibliotekë ose çelës që mungon). | Arsyeja dhe çfarë duhet për ta provuar |

### 3.3 Rregulli i provës end-to-end

Një aftësi shënohet **Implemented** vetëm kur provohet në gjithë rrugën:

> **Input** (skenar ose plan) → **Engine** (output i strukturuar) → **Paketa e render-it** (kalon Gate-in) → **Renderer** → **Video finale**, ku aftësia shihet ose matet.

**Nuk mjaftojnë:** ekzistenca e një klase, funksioni, interface-i ose moduli me emrin përkatës; një test njësie që nuk kalon nga renderer-i; një kuadër i vetëm pa matje.

### 3.4 Llojet e matjes

| Kodi | Metoda | Shembull |
| ---- | ------ | -------- |
| **[A]** | Automatike, nga të dhënat e Engine-it ose të paketës (transforme, kohë, ID) | rrëshqitja e këmbës në px nga pika e kontaktit |
| **[V]** | Automatike, nga kuadrot e renderuar | luminanca kuadër pas kuadri, kutia e subjektit në kuadër |
| **[H]** | Vlerësim njerëzor me rubrikë (§10.2) | "a lexohet emocioni pa zë?" |

Kriteret [A] dhe [V] janë **hard-pass**: një dështim mjafton. Kriteret [H] vlerësohen 1–5. Pragu është **≥ 4** për P0 dhe **≥ 3** për P1/P2. Një mesatare e lartë nuk fsheh një dështim hard-pass (v1 §8).

Pragjet numerike janë **vlera fillestare**. Kalibrohen një herë pas Fazës 3 (benchmark-u). Çdo ndryshim pragu kërkon arsye të dokumentuar dhe miratim, si golden baselines.

Njësitë: px në kuadrin 1080×1920; kohë në sekonda ose kuadro (30 fps); kënde në gradë.

---

## 4. World Builder Engine

**Misioni (v1.0):** të ndërtojë botë vizuale të strukturuara dhe të përdorshme për storytelling: hapësirë, thellësi, objekte, marrëdhënie fizike, zona veprimi dhe identitet të qëndrueshëm. Nuk është background generator.

### 4.1 Aftësitë

| ID | Aftësia | P | Kriteri i matshëm | Matja |
| -- | ------- | - | ----------------- | ----- |
| **A. Environment construction** |||||
| WB-A1 | Ambiente të brendshme (dhoma, zyra, shtëpi, kafene) | **P0** | Çdo ambient i brendshëm ka të deklaruara: dysheme, mure, ≥ 1 hyrje/dalje, kufij. Të gjitha objektet kanë transform, shkallë dhe shtresë thellësie. | [A] skema e ambientit |
| WB-A2 | Ambiente të jashtme (rrugë, shesh, park) | P1 | Si WB-A1, me tokë, horizont dhe ≥ 3 shtresa thellësie | [A] |
| WB-A3 | Ambiente historike, urbane, industriale, peizazhe | P2 | Si WB-A1/A2 | [A] |
| WB-A4 | Ambiente me disa zona të lidhura (jo një ilustrim i vetëm) | P1 | ≥ 2 zona me lidhje të deklaruar (derë, korridor, rrugë); kamera ose personazhi kalon nga njëra te tjetra pa ndërprerje gjeometrike | [A]+[V] |
| **B. Spatial representation and layout** |||||
| WB-B1 | Pozicion, orientim, shkallë relative dhe marrëdhënie mes objekteve | **P0** | Brenda një shot-i, asnjë objekt statik nuk ndryshon transform më shumë se 0,5 px pa event të deklaruar | [A] |
| WB-B2 | Foreground, midground, background dhe occlusion | **P0** | Çdo element ka shtresë thellësie. Rendi i vizatimit përputhet me thellësinë në 100% të kuadrove. Asnjë personazh nuk shfaqet mbi një objekt që e mbulon sipas thellësisë. | [A]+[V] |
| WB-B3 | Walkable surfaces, obstacles, boundaries, interaction zones | **P0** | Çdo ambient ku vepron një personazh ka zona të ecshme dhe pengesa të deklaruara. Pozicionet e këmbëve bien brenda zonës së ecshme në 100% të kuadrove. | [A] |
| WB-B4 | Marrëdhëniet hapësinore ruhen kur ndryshon këndi ose framing-u | P1 | Për dy shot-e të të njëjtit ambient: rendi majtas-djathtas dhe i thellësisë i objekteve kryesore është i njëjtë, përveç kur kamera kalon boshtin me arsye të deklaruar (CC-D1) | [A] |
| **C. Object and prop intelligence** |||||
| WB-C1 | Objekte sipas funksionit dhe kontekstit | **P0** | Çdo objekt që përmend plani gjendet në ambient. Asnjë objekt pa funksion në skenë nuk zë > 15% të kuadrit. | [A]+[H] |
| WB-C2 | Madhësi të qëndrueshme ndaj personazheve dhe ambientit | **P0** | Raporti lartësi-personazhi / lartësi-dere është 0,80–0,90; tavolina 0,40–0,50; karrigia (ndenjësja) 0,22–0,28. Shmangia maksimale ±5% mes shot-eve të të njëjtit ambient. | [A] |
| WB-C3 | Gjendje dhe pika ndërveprimi (dorezë, sipërfaqe, ndenjëse, objekt që merret) | **P0** | Çdo objekt që përdoret nga një veprim ka pikën përkatëse (`grip`, `seat`, `surface`, `stand`, `openable`…). Gjendjet ndërrohen vetëm nga një event i deklaruar. | [A] |
| **D. World continuity and reuse** |||||
| WB-D1 | I njëjti ambient në disa skena dhe plane | **P0** | Me të njëjtin ID ambienti, layout-i (transformet e objekteve statike) është identik mes skenave, përveç ndryshimeve të deklaruara si event | [A] |
| WB-D2 | Rikthim në ambient pa ndryshime arbitrare | **P0** | Si WB-D1, edhe pas skenave në ambiente të tjera | [A] |
| WB-D3 | Ripërdorim i world assets dhe environment templates | P1 | Një template përdoret në ≥ 2 filma pa ndryshim kodi; çdo ndryshim është parametër i deklaruar | [A] |
| **E. Scene readiness** |||||
| WB-E1 | Të dhëna për Character Acting (zona, pika ndërveprimi, pengesa) | **P0** | Character Acting nuk kërkon asnjë të dhënë hapësinore jashtë output-it të World Builder | [A] kontrata |
| WB-E2 | Thellësi dhe layout për Cinematic Camera | **P0** | Kamera merr kufijtë e ambientit dhe thellësinë e shtresave nga output-i i World Builder | [A] |
| WB-E3 | Sipërfaqe, rajone dhe kontekst për Environmental FX | P1 | FX merr burimet dhe zonat (dritare, oxhak, tokë) nga output-i i World Builder | [A] |
| WB-E4 | Kufizimet raportohen para animacionit | P1 | Një kërkesë që ambienti nuk e mbështet refuzohet me kod gabimi para render-it, jo pas | [A] Gate |
| **F. Pamja *(v2)*** |||||
| WB-F1 | Ambienti ndjek Style Bible (§9) | **P0** | Ngjyrat brenda paletës (ΔE ≤ 3 nga token-at), drita sipas humorit të deklaruar, pa kontur ose me kontur sipas rregullit | [V]+[H] |
| WB-F2 | Ambienti lexohet në telefon | **P0** | Subjekti dallohet nga sfondi: kontrasti i luminancës subjekt/sfond ≥ 3:1 te kutia e subjektit | [V] |

### 4.2 Output-i i pritshëm (v1.0)

- Përfaqësim i strukturuar dhe i versionuar i ambientit.
- Scene layout me transforme, dimensione relative, shtresa thellësie dhe referenca asetesh.
- Zona të ecshme, pengesa, kufij dhe pika ndërveprimi.
- ID të qëndrueshme për ambientet dhe objektet që ripërdoren.
- Kontrolle ose raporte për konsistencën hapësinore.

### 4.3 Testet (v1.0, me ID)

| Testi | Aftësitë | Kriteri |
| ----- | -------- | ------- |
| WB-T1 Ambient i brendshëm me disa objekte, hyrje/dalje dhe zona ndërveprimi | A1, B2, B3, C3 | kriteret e tyre |
| WB-T2 Ambient i jashtëm me foreground, midground, background | A2, B2 | idem |
| WB-T3 Personazh pranë tavolinës, karriges dhe derës | C2, B3 | raportet WB-C2 |
| WB-T4 Kamera në disa kënde pa ndryshuar botën | B1, B4 | idem |
| WB-T5 I njëjti ambient në skena të ndryshme pa drift | D1, D2 | drift = 0 |

### 4.4 Dështimet që nuk pranohen (v1.0)

Objekte që notojnë, përplasen ose ndryshojnë madhësi/pozicion; hapësira që duken bindëse në një kuadër, por nuk mbështesin veprim ose kamera; ndryshim i paarsyeshëm i arkitekturës ose identitetit mes planeve; mungesë e të dhënave për lëvizje, occlusion ose ndërveprim.

---

## 5. Character Acting Engine

**Misioni (v1.0):** performancë e besueshme e personazheve: qëllimi i veprimit, mekanika e trupit, gjestet, reagimet, ndërveprimi me botën dhe vazhdimësia e identitetit.

**Varësi e jashtme e deklaruar *(v2)*:** cilësia e acting-ut kufizohet nga materiali i animacionit (rig-u, pozat kyçe, klipet). Kodi i përzien dhe i drejton klipet, por nuk e zëvendëson një animator ose kapjen e lëvizjes. Auditi shënon veçmas nëse një dështim vjen nga **Engine-i** apo nga **materiali** (shih `erkasa-artist-brief-phase0.md`).

### 5.1 Aftësitë

| ID | Aftësia | P | Kriteri i matshëm | Matja |
| -- | ------- | - | ----------------- | ----- |
| **A. Locomotion and body mechanics** |||||
| CA-A1 | Ecje, ndalim, nisje, kthim, ndryshim drejtimi | **P0** | Një personazh ecën, ndalon, kthehet dhe rifillon pa kërcime: zhvendosja e rrënjës ≤ 25 px/kuadër dhe pa ndryshim drejtimi > 45° brenda 1 kuadri | [A] |
| CA-A2 | Ulje dhe ngritje | **P0** | Ijet bien në pikën `seat` (±4 px) në kuadrin e uljes; asnjë kuadër me ijet nën ndenjëse | [A] |
| CA-A3 | Cikël ecjeje me contact, weight transfer, push-off, swing | **P0** | Gjatë fazës së kontaktit, pika e kontaktit të këmbës zhvendoset ≤ 2 px/kuadër dhe ≤ 4 px gjithsej (**foot sliding**) | [A] |
| CA-A4 | Ekuilibër, qendër graviteti, anticipation, follow-through | P1 | Çdo veprim me ndryshim të madh poze ka fazë anticipation ≥ 3 kuadro dhe follow-through ≥ 4 kuadro; [H] ≥ 3 te "pesha" | [A]+[H] |
| CA-A5 | Vrap dhe lëvizje në nivele të ndryshme (shkallë) | P2 | Si CA-A1/A3 | [A] |
| CA-A6 | Pa teleportim dhe pa lëvizje pa peshë | **P0** | Brenda një shot-i, asnjë kërcim i rrënjës > 25 px/kuadër pa event të deklaruar | [A] |
| **B. Acting and gesture vocabulary** |||||
| CA-B1 | Gjeste gjatë të folurit (shpjegim, pyetje, tregim) | **P0** | Në shot-et ku personazhi flet: ≥ 1 gjest për 4 s narracioni; asnjë gjest i njëjtë > 2 herë brenda 10 s | [A] |
| CA-B2 | Gjeste me fillim, kulm dhe përfundim | **P0** | Çdo gjest ka 3 faza; kohëzgjatja 0,4–2,5 s; asnjë gjest ciklik pa fund | [A] |
| CA-B3 | Koordinim kokë–shikim–bust–krahë–duar | **P0** | Gjatë një "shiko te X", drejtimi i kokës është brenda 15° nga objektivi në ≥ 80% të kohës së veprimit; shikimi para trupit (gaze lead) 2–8 kuadro | [A] |
| CA-B4 | Performanca të qeta, të tensionuara, energjike, dramatike | P1 | [H] ≥ 3: vlerësuesi e njeh gjendjen pa zë në ≥ 3 nga 4 klipe | [H] |
| **C. Emotional and intentional performance** |||||
| CA-C1 | Emocion përmes qëndrimit, ritmit, gjesteve | **P0** | [H] ≥ 4: emocioni i deklaruar i beat-it lexohet pa zë | [H] |
| CA-C2 | Dallim qëllimesh (bindje, frikë, pasiguri, habi, refuzim, vendim) | P1 | [H] ≥ 3 për çdo qëllim në benchmark | [H] |
| CA-C3 | Reagim ndaj ngjarjeve të skenës | P1 | Pas një eventi të deklaruar (derë, zhurmë, objekt), personazhi reagon brenda 3–12 kuadrove | [A] |
| CA-C4 | Lidhja dialog – beat – performancë | **P0** | Gjestet dhe ndryshimet e gjendjes bien brenda ±6 kuadrove nga fjala ose beat-i që i shkakton | [A] |
| **D. Object and character interaction** |||||
| CA-D1 | Arrij, kap, mbaj, lësho, vendos objekte | **P0** | Gjatë mbajtjes, pika `grip` e objektit është ≤ 3 px nga pika e dorës në çdo kuadër; asnjë objekt nuk shkëputet pa event `release` | [A] |
| CA-D2 | Mobilie dhe elemente të ambientit (ulje, derë, sipërfaqe) | **P0** (ulje, sipërfaqe), P1 (derë) | Si CA-A2 dhe CA-D1; dera hapet vetëm kur dora është te doreza (≤ 4 px) | [A] |
| CA-D3 | Dy ose më shumë personazhe me distancë, orientim dhe reagim të koordinuar | P1 | Distanca mes trupave 0,6–2,0 lartësi koke gjatë bisedës; drejtimi i shikimit drejt partnerit ≤ 20° | [A] |
| CA-D4 | Respekton pikat e ndërveprimit dhe kufijtë e World Builder | **P0** | Asnjë mbivendosje e kutisë së trupit me një pengesë > 5 px, përveç kontakteve të deklaruara | [A] |
| **E. Character identity and continuity** |||||
| CA-E1 | Siluetë, proporcione, veshje, ngjyra, identitet | **P0** | I njëjti ID personazhi: të njëjtat asete dhe ngjyra pjesësh në çdo shot (diff = 0, përveç ndryshimeve të deklaruara të kostumit) | [A] |
| CA-E2 | Pozicion dhe orientim në vazhdimësi mes shot-eve | **P0** | Në një prerje brenda së njëjtës kohë dhe vendi, pozicioni në botë ndryshon ≤ 30 px dhe orientimi nuk përmbyset pa arsye | [A] |
| CA-E3 | Veprime të njëpasnjëshme pa reset poze | **P0** | Mes dy veprimeve, poza kalon me tranzicion ≥ 4 kuadro; asnjë kërcim poze në 1 kuadër | [A] |
| CA-E4 | Kontakt i vazhdueshëm me objektin gjatë ndërveprimit | **P0** | Si CA-D1 | [A] |

### 5.2 Output-i i pritshëm (v1.0)

Plan veprimi/acting-u me qëllim, objektiv, kohëzgjatje dhe faza; të dhëna animacioni ose ekuivalent i ekzekutueshëm; transforme, poza, gjendje dhe event-e ndërveprimi; referenca te objektet e botës dhe pikat e ndërveprimit; raport për veprimet e pambështetura ose konfliktet.

### 5.3 Testet (v1.0, me ID)

| Testi | Aftësitë |
| ----- | -------- |
| CA-T1 Ecje, ndalim, kthim, rifillim pa rrëshqitje | A1, A3, A6 |
| CA-T2 Fjalim me gjeste që lidhen me kuptimin | B1, B2, C4 |
| CA-T3 Ulje, ngritje, ndërveprim me objekt | A2, D1, D2 |
| CA-T4 Dy personazhe shkëmbejnë një objekt ose reagojnë | D1, D3, C3 |
| CA-T5 Ndryshim emocional pa humbur identitetin | C1, E1 |
| CA-T6 Veprime në disa plane pa reset ose teleportim | E2, E3, A6 |

### 5.4 Dështimet që nuk pranohen (v1.0)

Paper-doll movement; foot sliding, penetrim në objekte, kapje që nuk prek objektin ose objekt që shkëputet; gjestikulim i përsëritur, i rastësishëm ose pa lidhje me narracionin; ndryshim i fytyrës, trupit, veshjes ose siluetës; veprime pa fillim/përfundim ose që nuk respektojnë kohën e skenës.

---

## 6. Cinematic Camera Engine

**Misioni (v1.0):** të drejtojë mënyrën si shikuesi e përjeton historinë përmes planeve, kompozimit, lëvizjes së kamerës, thellësisë dhe vazhdimësisë filmike, me arsye narrative.

### 6.1 Aftësitë

| ID | Aftësia | P | Kriteri i matshëm | Matja |
| -- | ------- | - | ----------------- | ----- |
| **A. Shot grammar and coverage** |||||
| CC-A1 | Establishing, wide, full, medium, close-up, insert | **P0** | Çdo ambient i ri hapet me wide/establishing ≥ 1,5 s. Një film ≥ 30 s përdor ≥ 3 madhësi plani. Asnjë madhësi nuk zë > 50% të kohës. | [A] |
| CC-A2 | Extreme wide, extreme close-up, over-the-shoulder | P1 | Përdoren kur plani i kërkon; OTS ruan shpatullën në kuadër (≥ 8% e gjerësisë) | [A] |
| CC-A3 | Plani zgjidhet sipas informacionit dhe emocionit | **P0** | Çdo shot ka qëllim narrativ të deklaruar; [H] ≥ 4 te "plani i shërben momentit" | [A]+[H] |
| CC-A4 | Subject size, headroom, look room, safe framing | **P0** | Kutia e subjektit brenda zonës së sigurt në ≥ 95% të kuadrove; headroom 4–15% e lartësisë së kuadrit për medium dhe close; look room ≥ 1,5× nga ana e shikimit | [V] |
| **B. Camera movement** |||||
| CC-B1 | Pan, tilt, zoom, push-in, pull-back, dolly | **P0** | Çdo lëvizje ka fazë përshpejtimi dhe ngadalësimi ≥ 0,3 s; shpejtësia ndryshon ≤ 10% e maksimumit mes dy kuadrove (pa kërcime) | [A] |
| CC-B2 | Tracking dhe follow | P1 | Subjekti në lëvizje mbetet brenda zonës së sigurt në ≥ 95% të kuadrove | [V] |
| CC-B3 | Orbit dhe parallax i kontrolluar | P1 (parallax), P2 (orbit) | Parallax: shtresat lëvizin proporcionalisht me thellësinë (gabim ≤ 5%); pa çarje mes shtresave | [A]+[V] |
| CC-B4 | Pa lëvizje të panevojshme; zoom jo si zëvendësim i veprimit | **P0** | Asnjë lloj lëvizjeje > 40% e shot-eve; push-in pa motiv narrativ ≤ 1 për 20 s | [A] |
| CC-B5 | Kamera statike kur është zgjedhja më e mirë | **P0** | Në shot-et ku plani e deklaron "hold", kamera lëviz ≤ 1 px/kuadër | [A] |
| **C. Composition and visual hierarchy** |||||
| CC-C1 | Rule of thirds, balance, negative space, depth | **P0** | Për subjektin kryesor jashtë qendrës së deklaruar, qendra e kutisë së tij ≤ 6% e gjerësisë nga një vijë e të tretave; [H] ≥ 4 | [V]+[H] |
| CC-C2 | Subjekti i lexueshëm, vëmendja e drejtuar | **P0** | Kutia e subjektit ≥ 8% e sipërfaqes së kuadrit në medium dhe close; asnjë element tjetër me kontrast më të lartë në të njëjtën zonë | [V] |
| CC-C3 | Pa tangencies, crop të paqëllimshëm, mbivendosje konfuze | P1 | Asnjë prerje e kokës ose duarve te skaji i kuadrit, përveç close-up të deklaruar | [V] |
| CC-C4 | Kompozimi merr parasysh titrat dhe grafikën | **P0** | Brezi i titrave (§8.2) nuk mbulon kurrë fytyrën ose duart e subjektit (mbivendosje = 0 px) | [V] |
| **D. Continuity and editorial logic** |||||
| CC-D1 | Screen direction, eyeline, axis of action | **P0** | Në shot-et e njëpasnjëshme të të njëjtit veprim, drejtimi i lëvizjes në ekran nuk ndryshon shenjë, përveç një plani neutral ose kthimi të deklaruar | [A] |
| CC-D2 | Cut/transition sipas ritmit | **P0** | Prerjet bien brenda ±4 kuadrove nga kufiri i frazës ose i beat-it; shot-et 1,5–8 s, përveç "hold" të deklaruar | [A] |
| CC-D3 | Pa jump cuts aksidentale | **P0** | Dy shot-e të njëpasnjëshme të të njëjtit subjekt ndryshojnë madhësinë e planit ose këndin ≥ 30° | [A] |
| CC-D4 | Koordinim me veprimet e personazheve dhe event-et e ambientit | P1 | Lëvizja e kamerës nis brenda ±6 kuadrove nga veprimi që e motivon | [A] |
| **E. Cinematic timing** |||||
| CC-E1 | Hold, reveal, anticipation, reframing | **P0** | Pas çdo reveal-i, plani mbahet ≥ 0,8 s | [A] |
| CC-E2 | Sinkronizim me beats, jo me intervale fikse | **P0** | Variacioni i gjatësisë së shot-eve ≥ 25% (jo ritëm metronom) dhe kriteri CC-D2 | [A] |
| CC-E3 | Kur të mbajë një plan dhe kur ta ndryshojë | P1 | [H] ≥ 3 te "ritmi" | [H] |

### 6.2 Output-i i pritshëm (v1.0)

Shot list ose camera plan me qëllim narrativ për çdo plan; transforme/keyframes të kamerës, objektiv dhe kohë; framing metadata dhe vendime prerjeje; referenca te subjektet dhe koordinatat e botës; kontrolle vazhdimësie për drejtimin, orientimin dhe pozicionet.

### 6.3 Testet (v1.0, me ID)

| Testi | Aftësitë |
| ----- | -------- |
| CC-T1 Establishing që prezanton ambientin dhe thellësinë | A1, B3 |
| CC-T2 Tracking që ndjek personazhin pa humbur framing-un | B2, A4 |
| CC-T3 Push-in ose close-up i motivuar nga një beat | B1, A3, B4 |
| CC-T4 Wide → medium → close që ruan screen direction dhe eyeline | D1, D3 |
| CC-T5 Lëvizje në ambient me disa shtresa pa artefakte parallax/occlusion | B3, WB-B2 |
| CC-T6 Kamera statike sepse i shërben historisë | B5 |

### 6.4 Dështimet që nuk pranohen (v1.0)

Kamera pa motiv ose zoom i përsëritur si efekt i vetëm; humbje e subjektit, framing i prerë gabim ose disorientim; shkelje e screen direction/eyeline pa arsye; kërcime, easing i dobët ose lëvizje mekanike; kamera që fsheh probleme të tjera në vend që pipeline-i t'i raportojë.

---

## 7. Environmental Motion & FX Engine

**Misioni (v1.0):** lëvizje, atmosferë dhe efekte të integruara në ambient, që e bëjnë botën të gjallë dhe të besueshme. Jo dekor.

### 7.1 Aftësitë

| ID | Aftësia | P | Kriteri i matshëm | Matja |
| -- | ------- | - | ----------------- | ----- |
| **A. Natural motion systems** |||||
| FX-A1 | Erë mbi vegjetacion dhe objekte të lehta | P1 | Amplituda proporcionale me intensitetin e deklaruar (gabim ≤ 10%); drejtimi i njëjtë për të gjitha elementet e shtresës | [A] |
| FX-A2 | Shi, borë | P1 | Këndi i rënies me shmangie ≤ 5° brenda shot-it; dendësia ndryshon vetëm sipas kurbës së deklaruar | [A] |
| FX-A3 | Tym, mjegull, pluhur | P1 | Pa popping (§7.2, FX-D2); ngritje/shpërndarje e vazhdueshme | [A]+[V] |
| FX-A4 | Ujë, valë, re, gjethe që bien | P2 | Si FX-A1/A3 | [A] |
| FX-A5 | Zjarr | P2 | Lëvizje organike: asnjë cikël i dukshëm < 2 s | [V] |
| FX-A6 | Intensitet i ndryshueshëm dhe kalime graduale | P1 | Ndryshimet e intensitetit ndjekin kurbë me kohëzgjatje ≥ 0,5 s | [A] |
| FX-A7 | Lëvizje e ndryshme në foreground, midground, background | P1 | Shpejtësia dhe madhësia e grimcave proporcionale me thellësinë (gabim ≤ 10%) | [A] |
| **B. Atmospheric depth and lighting** |||||
| FX-B1 | Drejtim dhe intensitet drite, humori ditë/natë | **P0** | Çdo shot ka humor drite të deklaruar (sipas Style Bible §9); drita nuk ndryshon pa event të deklaruar | [A] |
| FX-B2 | Haze, shtresa mjegulle, rreze drite, atmosferë | P1 | Lexueshmëria e subjektit ruhet: kontrasti subjekt/sfond ≥ 3:1 (WB-F2) edhe me efektin aktiv | [V] |
| FX-B3 | Hije | P1 | Drejtimi i hijeve përputhet me drejtimin e dritës (≤ 15°) | [A] |
| FX-B4 | Flicker i kontrolluar (llambë, ekran) | P1 | Flicker vetëm kur deklarohet; jashtë tij, luminanca mesatare e rajonit ndryshon ≤ 2/255 mes kuadrove | [V] |
| FX-B5 | Koherenca e dritës me ambientin dhe kamerën | **P0** | E njëjta skenë, i njëjti humor drite në të gjitha shot-et, përveç ndryshimit të deklaruar | [A] |
| **C. Physical and spatial plausibility** |||||
| FX-C1 | Respekton erën, gravitetin, sipërfaqet, burimin | P1 | Grimcat lindin nga burimi i deklaruar (WB-E3) dhe nuk kalojnë nëpër sipërfaqe të ngurta | [A] |
| FX-C2 | Respekton occlusion | P1 | Efekti pas një objekti nuk vizatohet përpara tij | [A]+[V] |
| **D. Temporal continuity and layering** |||||
| FX-D1 | Vazhdimësi gjatë shot-it dhe mes shot-eve | **P0**, nëse efekti përdoret | Me kushte të pandryshuara, parametrat e efektit (dendësia, drejtimi, intensiteti) janë të njëjtë mes shot-eve | [A] |
| FX-D2 | Pa flicker, popping ose ndryshime të rastësishme | **P0**, nëse efekti përdoret | Asnjë shtresë nuk ndryshon opacitet > 0,25 mes dy kuadrove, përveç në prerje ose event; luminanca e rajonit ≤ 2/255 jashtë eventeve | [V] |
| FX-D3 | Shtresa të shumta pa konflikt | P1 | Asnjë efekt nuk mbulon > 20% të kutisë së subjektit | [V] |
| **E. Narrative responsiveness** |||||
| FX-E1 | Ndryshim i dukshëm i atmosferës në kohën e duhur (dritë që fiket, shi që fillon) | **P0** (dritë), P1 (të tjerat) | Event-i bie brenda ±3 kuadrove nga beat-i ose fjala që e shkakton | [A] |
| FX-E2 | Sinkronizim me action beats dhe camera timing | P1 | Si FX-E1 | [A] |

**Shënim për P0 *(v2)*:** një video shpjeguese mund të jetë profesionale pa shi ose zjarr, por **jo** me dritë jokoherente ose efekte që dridhen. Ndaj P0 te FX janë drita dhe vazhdimësia, jo larmia e efekteve.

### 7.2 Output-i i pritshëm (v1.0)

FX plan me llojin, burimin, zonën, intensitetin dhe kohëzgjatjen; të dhëna animacioni/grimcash/shtresash; parametra drite/hijeje dhe kurba kohore; referenca hapësinore te objektet e botës dhe thellësia e kamerës; raport për efektet e pambështetura ose konfliktet.

### 7.3 Testet (v1.0, me ID)

| Testi | Aftësitë |
| ----- | -------- |
| FX-T1 Pemë që reagojnë ndaj erës me intensitet të ndryshueshëm | A1, A6 |
| FX-T2 Shi ose borë me drejtim dhe thellësi | A2, A7 |
| FX-T3 Tym ose mjegull pa popping | A3, D2 |
| FX-T4 Dritë dhe hije që ndryshojnë në mënyrë të kontrolluar | B1, B3, E1 |
| FX-T5 Disa efekte njëkohësisht pa mbuluar subjektin, pa flicker | D3, D2 |
| FX-T6 Event narrativ që ndryshon atmosferën në kohë | E1 |

### 7.4 Dështimet që nuk pranohen (v1.0)

Efekte që shfaqen ose zhduken papritur; lëvizje pa drejtim fizik; flicker ose shtresa që dridhen; efekte që mbulojnë subjektin ose shkatërrojnë kompozimin; mospërputhje e dritës, hijes dhe atmosferës.

---

## 8. Varësitë mes Engine-ve dhe pronësia e timeline-it *(v2)*

### 8.1 Rendi i ekzekutimit dhe varësitë

```
Scene Planning (Worker 4)
      │  kërkesat e strukturuara për çdo Engine
      ▼
World Builder ──► layout, thellësi, zona, pika ndërveprimi
      │                 │                    │
      ▼                 ▼                    ▼
Character Acting   Cinematic Camera ◄─── gjendjet e personazheve (pozicione, veprime, kohë)
      │                 │
      └────────┬────────┘
               ▼
Environmental FX ◄── sipërfaqet e World Builder + thellësia dhe koha e kamerës
               ▼
Scene Composition (Worker 6) ──► Paketa e render-it ──► Gate ──► Renderer
```

| Engine | Merr nga (v1 §7) | Varet nga | U jep | Konflikt i mundshëm dhe kush e zgjidh |
| ------ | ---------------- | --------- | ----- | ------------------------------------- |
| World Builder | brief, scene plan, asete | — | layout, kufizime, objekte, thellësi, zona | — |
| Character Acting | qëllimi, layout-i, pikat e ndërveprimit | World Builder | transforme, poza, veprime, event-e ndërveprimi | veprim i pamundur në ambient → **refuzohet para render-it** (WB-E4); nuk "korrigjohet" në heshtje |
| Cinematic Camera | beats, layout, gjendjet e personazheve | World Builder, Character Acting | plan kamere, transforme, framing, kohë | subjekti del nga kuadri → kamera rikuadron brenda rregullave; nëse nuk mundet, raporton (v1 §5.4) |
| Environmental FX | sipërfaqet, humori, kamera dhe timeline-i | World Builder, Camera | shtresa FX, gjendje drite/atmosfere | efekti mbulon subjektin → FX ul intensitetin (FX-D3); jo kamera |

**Rregull:** asnjë Engine nuk rillogarit output-in e një Engine tjetër. Nëse ka nevojë për ndryshim, e kërkon përmes kontratës dhe planit, jo duke e mbishkruar.

### 8.2 Pronësia e timeline-it

| Shtresa kohore | Pronari | Burimi |
| -------------- | ------- | ------ |
| Kohët e synuara të beats dhe skenave | Scene Planning (Worker 4) | plani |
| Kohët reale të fjalëve dhe të segmenteve të zërit (e vërteta kohore e narracionit) | Voice (Worker 7) + Caption & Sync (Worker 10) | alignment-i i zërit |
| Kohët e veprimeve, kamerës dhe FX brenda skenës | secili Engine, mbi kohët reale të fjalëve | output-et e Engine-ve |
| **Timeline-i përfundimtar i ekzekutueshëm** | **Scene Composition (Worker 6)**, si **paketa e render-it** | e vetmja e vërtetë kohore që sheh renderer-i |
| Muzika dhe SFX | Music (8) dhe Sound Design (9), mbi kohët reale | planet audio, brenda paketës |

Renderer-i nuk ndryshon asnjë kohë. Gate-i e refuzon paketën nëse kohët kundërshtojnë njëra-tjetrën. Kjo është e njëjta ndarje si në arkitekturën aktuale: plani → Stager → paketa → Gate → Engine.

---

## 9. Style Bible *(v2)*

Style Bible është standardi vizual i përbashkët i katër Engine-ve dhe i Asset Generation. Ruhet si dokument dhe si të dhëna (token-a) në repository. Ndryshohet vetëm me miratim.

| Fusha | Rregulli | Matja |
| ----- | -------- | ----- |
| Formati | 1080×1920, 9:16, 30 fps; zona e sigurt: 90 px anash, 260 px sipër, 400 px poshtë | [A] |
| Paleta | Token-at e miratuar (night `#14213D`, deep `#0C1529`, cream `#F4EBDD`, wall `#E4D6BF`, ochre `#F4A261`, coral `#E76F51`, sun `#FFD27D`, slate `#264653`, coat `#3D5A80`). Çdo ngjyrë e asetit ΔE ≤ 3 nga një token, përveç tonaliteteve të dritës. | [V] |
| Konturi | Pa kontur, ose kontur ≤ 2 px në 1080 px | [V] |
| Drita | Humoret e lejuara: ditë, artë, muzg, natë. Burimi i dritës është i deklaruar për çdo skenë. | [A] |
| Personazhet | Proporcioni 6–6,5 koka; pamja kryesore 3/4; asnjë logo | [A]+[H] |
| Tipografia | Montserrat (300/500/800/900); madhësitë minimale: titra 54 px, tekst kinetik 66 px | [A] |
| Brezi i titrave | 1450–1720 px, 900 px i gjerë (E-D2); i rezervuar | [A] Gate |
| **Konflikt për t'u vendosur** | Brezi aktual i titrave hyn 120 px në zonën e poshtme të sigurt (UI e platformave mbi 1520 px). Auditi i Fazës 2 e mat mbi pamje reale të TikTok/Reels/Shorts; vendimi merret në Fazën 4. | [V] |
| Grain dhe teksturë | Grain i lehtë i njëjtë në gjithë filmin | [A] |
| Asetet AI | Ndjekin të njëjtat rregulla. Asnjë aset nuk hyn në prodhim pa kaluar kontrollin e paletës dhe pa miratim. | [V]+[H] |

## 10. Vlerësimi dhe Definition of Done

### 10.1 Pesha (nga v1.0) dhe roli i tyre

| Dimensioni | Pesha | Çfarë provohet |
| ---------- | ----- | -------------- |
| Functional capability | 20% | aftësitë kryhen (kriteret [A]) |
| Visual quality | 30% | rubrika [H] + kriteret [V] |
| Spatial/temporal consistency | 20% | drift, popping, vazhdimësi (kriteret [A]/[V]) |
| Integration | 15% | punon me tre Engine-t e tjera në benchmark |
| Robustness and repeatability | 15% | i njëjti input → i njëjti output; edge cases |

Peshat japin vetëm një pamje të përgjithshme. **Vendimi merret nga kriteret hard-pass dhe nga pragjet [H]**, jo nga mesatarja (v1 §8).

### 10.2 Rubrika njerëzore [H] *(v2)*

Vlerësohet nga PO-ja, dhe kur është e mundur nga 2 vlerësues të tjerë, mbi të njëjtën video, me nota 1–5:

1. A kuptohet ideja e skenës pa zë?
2. A lexohet emocioni ose qëllimi i personazhit?
3. A i shërben kamera momentit (plani, lëvizja, ritmi)?
4. A duket ambienti si vend i vërtetë dhe koherent?
5. A ka gabime të dukshme (rrëshqitje, kërcime, dridhje, objekte që notojnë)? (5 = asnjë)
6. A e ndjek stili Style Bible?
7. A do ta shihje deri në fund?

Çdo notë ruhet me timestamp-in e momentit që e justifikon.

### 10.3 Definition of Done për çdo Engine (v1.0 + v2)

- Të gjitha aftësitë **P0** janë **Implemented** sipas §3.3. P1 dhe P2 janë Implemented, ose kufizimi është dokumentuar dhe miratuar.
- Kontratat input/output janë të qarta, të versionuara dhe të validuara nga Gate-i.
- Ka teste automatike për logjikën dhe integrimin, dhe matje automatike për çdo kriter [A]/[V].
- Ka prova video para/pas për skenarët e benchmark-ut, me contact sheet.
- Asnjë dështim kritik i njohur në testet e pranimit.
- Rezultati është vlerësuar me scorecard dhe evidencë.
- Engine punon me tre Engine-t e tjera në një skenë reale.
- Dokumentacioni, testet dhe rezultatet ruhen në repository.

## 11. Benchmark-u i përbashkët (v1.0) dhe hapat e ndërmjetëm *(v2)*

### 11.1 Hapat e ndërmjetëm

| Hapi | Përmbajtja | Engine-t | Aftësitë që provon |
| ---- | ---------- | -------- | ------------------ |
| BM-0 | Personazh i vetëm në ambient të brendshëm statik: flet me gjeste, kamera wide → medium → close | WB, CA, CC | WB-A1/B/C2/F, CA-B/C1/E1, CC-A/C/D2 |
| BM-1 | Si BM-0, plus ecje deri te tavolina, ulje dhe marrje e një objekti | + CA-A/D | CA-A1–A3, CA-D1/D2, WB-B3/C3 |
| BM-2 | Si BM-1, plus ndryshim drite i shkaktuar nga një beat dhe rikthim në të njëjtin ambient | + FX | FX-B1/B5/E1, WB-D1/D2 |

### 11.2 Benchmark-u final (v1.0)

1. Ambient i brendshëm: personazhi hyn, ecën te tavolina, merr një objekt dhe ulet; kamera kalon nga wide në medium; drita dhe ambienti ruajnë vazhdimësinë.
2. Ambient i jashtëm: personazhi ecën në rrugë me pemë, erë dhe pluhur; kamera e ndjek; layout-i dhe lëvizjet mbeten koherente.
3. Ndërveprim mes dy personazheve: njëri i jep tjetrit një objekt; acting, distanca, kontakti, eyeline dhe coverage-i duhet të jenë të besueshme.
4. Skenë atmosferike: mjegull/shi/dritë e kontrolluar, me subjekt të lexueshëm, pa flicker ose efekt të tepruar.
5. Sekuencë multi-shot: i njëjti ambient dhe personazhe në disa plane, pa ndryshim identiteti, pozicioni të pashpjeguar ose humbje orientimi.

Çdo benchmark ruan: prompt-in ose skenarin, scene data dhe paketën, versionet e Engine-ve dhe të kodit (commit), asetet, parametrat, videon finale, contact sheet-in, matjet automatike, notat [H] dhe raportin e defekteve. Krahasimi para/pas bëhet gjithmonë me të njëjtin input.

## 12. Licencat dhe provenance *(v2)*

- Çdo aset (vizual, audio, font) ka licencë të regjistruar dhe të drejta për përdorim komercial. Pa këtë, Gate-i e refuzon.
- **Asetet e gjeneruara nga AI** regjistrojnë: modelin dhe versionin, licencën e modelit, prompt-in, seed-in, parametrat, imazhet referencë dhe datën. Licenca e modelit duhet të lejojë përdorim komercial.
- Asnjë aset nuk imiton një personazh, markë ose vepër të mbrojtur, ose një person real pa leje.
- Çdo video ka raport licencash (credits) të nxjerrë nga manifesti, jo të shkruar me dorë.

## 13. Buxheti *(v2)*

Vlerat fillestare matet në Fazën 3 dhe miratohen pas saj. Deri atëherë raportohen, por nuk bllokojnë.

| Metrika (për 60 s video) | Raportohet | Objektivi fillestar (për kalibrim) |
| ------------------------ | ---------- | ---------------------------------- |
| Koha e render-it në makinën referencë | po | ≤ 10 min |
| Koha totale nga tema te MP4 | po | ≤ 20 min |
| Kostoja AI (tekst + imazhe) | po | e përcaktuar pas fazës GPU |
| Kostoja TTS | po | sipas planit ElevenLabs |
| Rigjenerime (riparime plani, asete) | po | ≤ 2 për skenë |

## 14. Quality Control dhe Gate-i *(v2)*

QC i Engine-ve ka dy faza, që nuk dublikojnë njëra-tjetrën:

| Faza | Kush | Çfarë kontrollon | Efekti |
| ---- | ---- | ---------------- | ------ |
| **Para render-it** | **Validation Gate** (pjesë e QC-së, Worker 12) | kontratat, kapacitetet, gjeometria, kohët, kriteret [A] që lexohen nga paketa | refuzim, 0 kuadro |
| **Pas render-it** | QC Worker | kriteret [V] mbi kuadrot (dridhje, kontrast, kuti subjekti, titra mbi fytyrë), kontrollet e medias, raporti i defekteve | bllokon dorëzimin nëse ka hard-fail |
| Opsionale | Kritiku AI | vetëm vlerësime semantike ku metrikat nuk mjaftojnë; çdo gjetje me provë (kuadër, timestamp) | këshilluese, jo hard-pass |

Një kriter që mund të kontrollohet para render-it nuk shtyhet pas tij.

## 15. Udhëzim për auditimin dhe zhvillimin

1. Mos supozo se implementimi aktual e përmbush standardin. Verifikoje në kod **dhe** në video reale (§3.3).
2. Për çdo aftësi, shëno statusin e §3.2 me provat e kërkuara.
3. Lidh çdo pretendim me skedarin/modulin, testin dhe videon ose matjen.
4. Shëno veçmas nëse një dështim vjen nga Engine-i apo nga materiali (asete, animacione).
5. Mos krijo Engine ose Workers të rinj për të shmangur përmirësimin e atyre ekzistues pa justifikim arkitekturor.
6. Mos fillo implementim pa audit, plan fazash, kritere pranimi dhe miratim. Rendi: P0 → P1 → P2.
7. Ruaj kufijtë dhe kontratat mes katër Engine-ve (§8).
8. Prioritizo cilësinë e videos finale dhe benchmark-et reale mbi shtimin e veçorive.

## 16. Vizioni (v1.0)

World Builder krijon një botë që mund të eksplorohet, filmohet dhe përdoret për veprim. Character Acting krijon personazhe që veprojnë me qëllim, peshë dhe ndërveprim. Cinematic Camera e tregon historinë me gjuhë filmike, kompozim dhe vazhdimësi. Environmental Motion & FX e bën botën të gjallë, atmosferike dhe koherente.

Suksesi nuk matet nga numri i moduleve ose nga fakti që videoja renderohet. Matet nga aftësia e katër Engine-ve për të prodhuar vazhdimisht skena që përmbushin këtë standard.

**ERKASA STUDIO — FOUR ENGINES. ONE COHERENT VISUAL WORLD.**
