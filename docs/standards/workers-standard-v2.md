# Erkasa Studio — 13 Workers, Advanced Capability Standard v2.0

| Fusha | Vlera |
| ----- | ----- |
| Versioni | **2.0 — Draft për miratim** (zëvendëson v1.0 pas miratimit) |
| Data | 2026-11-19 |
| Fusha | 13 Workers të pipeline-it të prodhimit. Engine-t kanë standardin e tyre (`engines-standard-v2.md`). |
| Natyra | **Specifikim i gjendjes së synuar.** Nuk përshkruan implementimin aktual dhe nuk pretendon se këto aftësi janë implementuar. |
| Çfarë shton v2 | prioritete P0/P1/P2 dhe kritere të matshme për çdo përgjegjësi; pronësia e timeline-it; QC dhe Gate-i; Style Bible, licencat, buxheti; politika e modeleve AI; statusi Broken; rregulli i provës end-to-end; heqja e emrave të teknologjive që nuk përdorim |

**Asnjë përgjegjësi e v1.0 nuk hiqet dhe asnjë nuk zbutet.** Prioritetet, statuset, rregulli i provës dhe llojet e matjes ([A], [V], [H]) janë të njëjta me standardin e Engine-ve (§3).

---

## 1. Parimet e përbashkëta (v1.0)

- **Përgjegjësi e vetme dhe kufij të qartë.** Çdo Worker ka mision, input, output, pronësi të të dhënave dhe kritere pranimi; nuk merr përsipër punën e një tjetri.
- **Kontrata të versionuara.** Input-et dhe output-et janë skema të strukturuara, të validueshme dhe të versionuara.
- **AI vetëm kur shton vlerë.** Reasoning dhe gjenerimi kreativ përdorin modele AI. Ekzekutimi, validimi, matja, retry, ruajtja dhe koordinimi janë deterministe.
- **Idempotency dhe retry i sigurt.** Job-e me ID dhe idempotency key; retry nuk dublikon dhe nuk dëmton.
- **Observability.** Statusi, kohëzgjatja, input/output, modeli dhe konfigurimi, kostoja, gabimet, versioni i kontratës.
- **Provenance dhe reproducibility.** Dihet cilat input-e, asete, modele, prompt-e, parametra dhe versione prodhuan një rezultat.
- **Failure isolation.** Një Worker që dështon nuk korrupton projektin dhe nuk e bllokon pipeline-in përgjithmonë.
- **Human approval aty ku kërkohet.** Asnjë pikë miratimi nuk anashkalohet në heshtje.
- **Pa pretendime të pambështetura.** Klasa, endpoint-i ose prompt-i nuk e provojnë një Worker; e provojnë testet dhe rezultatet (§3.3 e standardit të Engine-ve).

## 2. Harta e 13 Workers dhe politika e modeleve *(v2)*

| # | Worker | Modeli i punës | AI | Ofruesi (vendimi 2026-11-19) |
| - | ------ | -------------- | -- | ---------------------------- |
| 1 | Creative Director | AI reasoning + validim | po | **modeli ynë** |
| 2 | Script Worker | AI generation + validim determinist | po | **modeli ynë** |
| 3 | Storyboard Worker | AI planning + structured output | po | **modeli ynë** |
| 4 | Scene Planning Worker | AI-assisted + kontrolle deterministe | po | **modeli ynë** |
| 5 | Asset Generation Worker | gjenerim imazhesh + validim determinist | po | **shërbimi ynë i imazheve** |
| 6 | Scene Composition Worker (Scene Composition + Stager) | determinist (gjeometri, montim, timeline) | jo | — |
| 7 | Voice Worker | integrim TTS | po (TTS) | **ElevenLabs** |
| 8 | Music Worker | hibrid; katalog i licencuar + logjikë kohore | opsionale | katalogu i licencuar |
| 9 | Sound Design Worker | hibrid; zgjedhje + sinkronizim | opsionale | katalogu i licencuar |
| 10 | Caption & Synchronization Worker | alignment + aritmetikë kohore | jo (alignment-i vjen nga Voice) | — |
| 11 | Render Worker | determinist | jo | **renderer-i i Erkasa** (Engine + FFmpeg) |
| 12 | Quality Control Worker | Gate + metrika + kritik AI vetëm ku duhet | opsionale | modeli ynë, nëse ka vizion |
| 13 | Production Orchestrator | determinist | jo | — |

**Rregulla për modelet:**

- Ofruesi dhe modeli zgjidhen nga konfigurimi për çdo detyrë, jo në kod.
- Çdo thirrje regjistron ofruesin, modelin, versionin, parametrat, kohën dhe koston.
- Ndërrimi i modelit kalon nga benchmark-u (§8) para se të bëhet default.

"Worker" nuk do të thotë agjent, model, container ose server. Është një përgjegjësi. Forma më e thjeshtë që plotëson kontratën është e preferuara.

## 3. Worker-at: përgjegjësitë, prioritetet dhe kriteret

Kolona **P** jep prioritetin; **Kriteri** është i matshëm; **[A]/[V]/[H]** si te standardi i Engine-ve §3.4.

### 3.1 Creative Director

**Misioni:** ta përkthejë qëllimin e përdoruesit në një drejtim kreativ koherent dhe ta mbajë atë gjatë gjithë prodhimit.
**Output-i:** `CreativeBrief` i versionuar: objective, audience, narrative angle, tone, visual style, pacing, constraints, approval gates, rationale.

| ID | Përgjegjësia | P | Kriteri | Matja |
| -- | ------------ | - | ------- | ----- |
| CD-1 | Analizon prompt-in, audiencën, platformën, gjuhën, kohëzgjatjen, objektivin; identifikon paqartësitë kritike | **P0** | Brief-i kalon skemën; çdo paqartësi kritike shënohet si pyetje ose si supozim i deklaruar | [A] |
| CD-2 | Përcakton creative brief (tema, këndvështrimi, toni, stili, ritmi, formaliteti, efekti te shikuesi) | **P0** | Të gjitha fushat e detyrueshme plotësohen; stili vizual është një nga stilet e Style Bible | [A] |
| CD-3 | Rregulla narrative dhe vizuale për Storyboard dhe Scene Planning | **P0** | Çdo rregull ka ID; Storyboard dhe Scene Planning e referojnë | [A] |
| CD-4 | Vlerëson realizueshmërinë brenda kohës, formatit, aseteve dhe kostos | P1 | Konflikti kohëzgjatje–përmbajtje zbulohet dhe propozohet zgjidhje (test pranimi v1) | [A] |
| CD-5 | Krahason alternativa dhe zgjedh me arsye | P1 | ≥ 2 alternativa të regjistruara me arsyen e zgjedhjes | [A] |
| CD-6 | Shqyrton QC dhe kërkon rishikime të kufizuara | P2 | Çdo rishikim lidhet me një defekt QC me ID | [A] |
| CD-7 | Nuk ndryshon vendime të miratuara pa revision të ri | **P0** | Ndryshimi pa revision refuzohet nga kontrata | [A] |

**Testet e pranimit (v1):** brief i vlefshëm nga i njëjti input; zbulimi i konfliktit kohëzgjatje/përmbajtje; asnjë ndryshim pa revision; gjurmueshmëria kërkesë → vendim.
**Dështime që nuk pranohen:** brief i përgjithshëm që nuk udhëzon askënd; ndryshime të pakontrolluara në mes të prodhimit; pretendime pa prova.

### 3.2 Script Worker

**Misioni:** skenar i qartë, i saktë, i dëgjueshëm, i përshtatshëm për kohëzgjatjen dhe audiencën.
**Output-i:** `ScriptDocument` i versionuar: title, hook, segments, narration, estimated duration, language, factual claims, revision id, approval status.

| ID | Përgjegjësia | P | Kriteri | Matja |
| -- | ------------ | - | ------- | ----- |
| SW-1 | Hook, zhvillim, shembuj, analizë, përfundim sipas brief-it | **P0** | Çdo segment ka rol narrativ të deklaruar; [H] ≥ 4 te "kuptohet ideja" | [A]+[H] |
| SW-2 | Gjuha, kompleksiteti, ritmi, toni sipas audiencës dhe platformës | **P0** | Gjuha e deklaruar (sq/en) në 100% të segmenteve; [H] ≥ 4 | [A]+[H] |
| SW-3 | Pa përsëritje, pretendime të pambështetura, fraza boshe | **P0** | Asnjë fjali e përsëritur; çdo pretendim faktik shënohet dhe ka burim, ose hiqet | [A] |
| SW-4 | Kontrollon kohëzgjatjen me numrin e fjalëve dhe ritmin | **P0** | Kohëzgjatja e vlerësuar brenda ±10% të objektivit; pas zërit, kohëzgjatja reale brenda ±15% | [A] |
| SW-5 | Segmente me qëllim dhe kohëzgjatje | **P0** | Çdo segment ka kohëzgjatje të vlerësuar dhe qëllim | [A] |
| SW-6 | Revision dhe lidhje me miratimin e përdoruesit | **P0** | Pipeline-i nuk kalon te zëri pa `approval: approved`, ose pa politikë të deklaruar auto-approve për projektin | [A] Orchestrator |

**Testet (v1):** kohëzgjatja brenda tolerancës; çdo segment me funksion; validimi zbulon mungesat ose gjuhën e gabuar; asnjë hap pas miratimit pa approval.
**Dështime që nuk pranohen:** tekst që nuk lexohet në kohë; hook që nuk mbështetet; përsëritje, kontradikta, fakte të sajuara; anashkalim i miratimit.

### 3.3 Storyboard Worker

**Misioni:** skenari i miratuar → sekuencë vizuale ku çdo skenë e bën historinë më të kuptueshme.
**Output-i:** `StoryboardDocument`: skena me rend, beat ids, intervale narracioni, qëllim vizual, entitete, tranzicione, referenca vazhdimësie, kohëzgjatje.

| ID | Përgjegjësia | P | Kriteri | Matja |
| -- | ------------ | - | ------- | ----- |
| SB-1 | Narracioni ndahet në skena dhe beats me kohëzgjatje | **P0** | 100% e narracionit mbulohet nga beats; shuma e kohëzgjatjeve = kohëzgjatja e videos (±2%) | [A] |
| SB-2 | Qëllimi vizual, informacioni dhe emocioni i çdo skene | **P0** | Çdo skenë ka tre fushat; [H] ≥ 4 te "skena e bën idenë më të qartë" | [A]+[H] |
| SB-3 | Personazhet, objektet, ambientet dhe ndërveprimet e nevojshme | **P0** | Çdo entitet ka ID të qëndrueshme që rikthehet e njëjtë | [A] |
| SB-4 | Pa ilustrim literal të çdo fjale; metafora vetëm kur ndihmojnë | P1 | Asnjë skenë që përsërit vetëm tekstin (kontroll i ngjashmërisë tekst ↔ qëllim vizual); [H] ≥ 3 | [A]+[H] |
| SB-5 | Lidhjet narrative dhe vizuale mes skenave | P1 | Çdo tranzicion ka arsye të deklaruar | [A] |
| SB-6 | Udhëzime të mjaftueshme për Scene Planning, pa diktuar brendinë e Engine-ve | **P0** | Scene Planning nuk kërkon informacion narrativ jashtë storyboard-it | [A] kontrata |

**Dështime që nuk pranohen:** lista skenash që përsërisin narracionin; skena pa qëllim; humbje identiteti; tranzicione pa logjikë.

### 3.4 Scene Planning Worker

**Misioni:** storyboard-i → plan prodhimi i ekzekutueshëm, me varësi, kërkesa për Engine-t dhe kontrolle.
**Output-i:** `ScenePlan`: scene graph, detyra, varësi, entity ids, kërkesa për Engine-t, kohë, kontrolle pranimi, politika fallback.

| ID | Përgjegjësia | P | Kriteri | Matja |
| -- | ------------ | - | ------- | ----- |
| SP-1 | Çdo beat → kërkesa konkrete për world, personazhe, props, kamerë, lëvizje, FX, audio cues | **P0** | Çdo beat ka kërkesë për çdo Engine që e prek; plani kalon skemën dhe Gate-in | [A] |
| SP-2 | Çfarë është e re dhe çfarë ripërdoret | **P0** | Asnjë aset nuk gjenerohet dy herë kur ekziston një i miratuar | [A] |
| SP-3 | Varësitë dhe rendi; paralelizmi | P1 | Grafi pa cikle; detyrat paralele të shënuara | [A] |
| SP-4 | Kufizime hapësinore, kohore dhe stili | **P0** | Çdo kërkesë që Engine-i nuk e mbështet shënohet unsupported/partial para render-it (capabilities) | [A] Gate |
| SP-5 | Kërkesa të strukturuara për 4 Engine-t, pa kopjuar përgjegjësitë e tyre | **P0** | Plani nuk përmban transforme ose kurba që i takojnë Engine-it | [A] kontrata |
| SP-6 | Vlerëson kompleksitetin dhe sinjalizon tejkalimet | P1 | Buxheti i parashikuar (§6) raportohet para render-it | [A] |

**Dështime që nuk pranohen:** plan i paekzekutueshëm ose ciklik; gjenerim i përsëritur i të njëjtit aset; kërkesa kontradiktore; fshehje e kufizimeve.

### 3.5 Asset Generation Worker

**Misioni:** asete vizuale të qëndrueshme, sipas stilit, të ripërdorshme.
**Output-i:** `AssetManifest` me ID, skedarë, metadata, dimensione, model/version, prompt, licencë, flamuj cilësie.

| ID | Përgjegjësia | P | Kriteri | Matja |
| -- | ------------ | - | ------- | ----- |
| AG-1 | Kërkesa gjenerimi nga ScenePlan dhe Style Bible | **P0** | Çdo kërkesë referon një entitet të planit dhe stilin | [A] |
| AG-2 | Orkestron modelet dhe parametrat; menaxhon versionet | **P0** | Çdo aset ka modelin, versionin, seed-in dhe parametrat; i njëjti input + seed → i njëjti aset (ose diferencë e dokumentuar e modelit) | [A] |
| AG-3 | Personazhe, props, objekte, ambiente, variante | **P0** për ambiente dhe props, P1 për personazhe (kërkon rig, standardi i Engine-ve §5) | Lloji i asetit pranohet nga kontrata dhe Gate-i | [A] |
| AG-4 | Format, rezolucion, transparencë, dimensione, integritet | **P0** | 100% e aseteve kalojnë kontrollet teknike; asnjë skedar i korruptuar | [A] |
| AG-5 | Identitet, version, prompt, model, licencë, hash | **P0** | Asnjë aset pa provenance dhe licencë (standardi i Engine-ve §12) | [A] |
| AG-6 | Dublikimet dhe ripërdorimi për vazhdimësi | **P0** | Një entitet i miratuar ripërdoret; ri-gjenerimi kërkon revision | [A] |
| AG-7 | Stili | **P0** | Paleta ΔE ≤ 3 (Style Bible); [H] ≥ 4 te "i përket botës" | [V]+[H] |

**Dështime që nuk pranohen:** asete të korruptuara ose me dimensione të gabuara; ndryshim i identitetit të personazhit; asete pa provenance ose licencë; rigjenerim kur ekziston aset i miratuar.

### 3.6 Scene Composition Worker

**Misioni:** skena e renderueshme nga planifikimi dhe output-et e Engine-ve, me hierarki, pozicionim dhe marrëdhënie hapësinore të ruajtura.
**Dy pjesë *(v2)*:** **Scene Composition** koordinon output-et e Engine-ve dhe zgjidh konfliktet hapësinore; **Stager-i** ndërton timeline-in përfundimtar dhe paketën e render-it (Master Architecture v1.0 §7).
**Output-i:** **paketa e render-it** (`ComposedScene` + timeline-i përfundimtar, i ndërtuar nga Stager-i), me scene graph, transforme, shtresa, kufij, lidhjen e kamerës, kohët, referencat e aseteve dhe raportin e validimit.

| ID | Përgjegjësia | P | Kriteri | Matja |
| -- | ------------ | - | ------- | ----- |
| SC-1 | Kombinon world, personazhe, props, kamerë, FX në një përfaqësim skene | **P0** | Paketa kalon Gate-in; 0 referenca të humbura | [A] |
| SC-2 | Koordinata, transforme, anchors, kufij, thellësi, kufizime | **P0** | Kufijtë e nyjeve llogariten dhe kontrollohen nga Gate-i | [A] |
| SC-3 | Overlap, clipping, elemente jashtë kuadrit, konflikte shtresash | **P0** | Gate-i i refuzon me kod dhe shteg; asnjë konflikt i padeklaruar në video | [A]+[V] |
| SC-4 | Ruajtja e ID-ve dhe vazhdimësia mes skenave | **P0** | ID-të e entiteteve të planit gjenden në paketë | [A] |
| SC-5 | **Stager-i është pronari i timeline-it përfundimtar** *(v2)*: e vetmja e vërtetë kohore për renderer-in | **P0** | Renderer-i nuk ndryshon asnjë kohë; Gate-i refuzon kohët kontradiktore | [A] |
| SC-6 | Nuk shpik vendime narrative; raporton konfliktet | **P0** | Çdo devijim nga plani raportohet me arsye | [A] |

**Dështime që nuk pranohen:** elemente që notojnë ose mbivendosen; humbje koordinatash ose identiteti; kompozim që kundërshton Engine-t; skenë që kalon validimin, por dështon në render.

### 3.7 Voice Worker

**Misioni:** narracion i pastër dhe i kontrollueshëm, besnik ndaj skenarit të miratuar. Ofruesi: **ElevenLabs**.
**Output-i:** `VoiceManifest`: referenca audio, segment ids, kohëzgjatje, cilësimet e zërit dhe modelit, hash i tekstit, metadata teknike, status, **alignment fjalë për fjalë**.

| ID | Përgjegjësia | P | Kriteri | Matja |
| -- | ------------ | - | ------- | ----- |
| VW-1 | Tekst i miratuar → TTS | **P0** | Hash-i i tekstit të segmentit = hash-i i tekstit të miratuar | [A] |
| VW-2 | Profili i zërit, gjuha, parametrat | **P0** | Cilësimet regjistrohen për çdo segment | [A] |
| VW-3 | Segmentim dhe lidhje me skenarin | **P0** | 1:1 segment skenari ↔ segment audio | [A] |
| VW-4 | Kontrolle teknike (kohëzgjatje, sample rate, kanale, clipping, heshtje, integritet) | **P0** | True peak ≤ −1 dBTP; heshtje fillestare ≤ 0,3 s; dekodohet plotësisht | [A] |
| VW-5 | Alignment fjalë për fjalë | **P0** | Çdo fjalë ka kohë; drift-i ndaj audios ≤ 40 ms (kontroll me ASR mbi një mostër) | [A] |
| VW-6 | Rigjenerim i pjesshëm | P1 | Ndryshimi i një segmenti rigjeneron vetëm atë | [A] |

**Dështime që nuk pranohen:** audio e paplotë ose e korruptuar; tekst i vjetër; mungesë e lidhjes segment–audio; kosto e pakontrolluar nga rigjenerimet.

### 3.8 Music Worker

**Misioni:** muzikë e licencuar që mbështet ritmin dhe emocionin pa konkurruar me narracionin.
**Output-i:** `MusicPlan`: track refs, licencë, vendosja, trim, gain, fades, arsyeja.

| ID | Përgjegjësia | P | Kriteri | Matja |
| -- | ------------ | - | ------- | ----- |
| MW-1 | Kërkim sipas mood, tempo, zhanrit, energjisë, të drejtave | **P0** | Çdo track ka licencë të vlefshme për përdorim komercial | [A] |
| MW-2 | Track ose pjesë që përshtatet me strukturën | **P0** | Mbulon intervalin e kërkuar pa gap të paqëllimshëm (> 0,5 s) | [A] |
| MW-3 | Start/end, trim, loop, fades, ducking | **P0** | Nën zë, muzika është ≥ 12 LU më e ulët se zëri; asnjë kërcim niveli > 3 dB në 50 ms | [A] |
| MW-4 | Licenca, territori, platforma | **P0** | Gate-i refuzon track-un pa licencë | [A] |
| MW-5 | Metadata e përdorimit | **P0** | Plani riprodhohet nga track id dhe parametrat | [A] |
| MW-6 | Pa maskim të të folurit | **P0** | [H] ≥ 4 te "zëri kuptohet gjithmonë" | [H] |

**Dështime që nuk pranohen:** track pa licencë; muzikë që mbulon narracionin; loop ose fade me kërcime; zëvendësim pa metadata.

### 3.9 Sound Design Worker

**Misioni:** efekte zanore të sinkronizuara, pa zhurmë të panevojshme.
**Output-i:** `SoundDesignPlan`: event → tingull, referenca audio, kohë, gain, pan, fades, shtresim, provenance.

| ID | Përgjegjësia | P | Kriteri | Matja |
| -- | ------------ | - | ------- | ----- |
| SD-1 | Interpreton event-et e skenës (hapa, goditje, objekte, ambient, tranzicione) | P1 | Çdo event kryesor ka mapping ose arsye pse hesht | [A] |
| SD-2 | Biblioteka e miratuar ose gjenerim i autorizuar | **P0** | Çdo SFX ka burim dhe licencë | [A] |
| SD-3 | Lidhja me event id, entity id, kohë | **P0** | Sinkronizim ≤ ±2 kuadro (66 ms) nga event-i | [A] |
| SD-4 | Panning, gain, fades, shtresim | P1 | Asnjë clipping; headroom ≥ 1 dB | [A] |
| SD-5 | Pa përplasje me zërin/muzikën dhe pa përsëritje mekanike | P1 | I njëjti SFX jo > 3 herë në 10 s | [A] |

**Dështime që nuk pranohen:** efekte pa lidhje me veprimin; audio e mbingarkuar ose e përsëritur; jashtë sinkronizimit; pa provenance.

### 3.10 Caption & Synchronization Worker

**Misioni:** captions të lexueshme dhe të sinkronizuara.
**Output-i:** `CaptionTrack` (fjalë/rresht/kohë, formati, raporti i validimit) dhe kohët reale të fjalëve për Scene Composition. **Timeline-i përfundimtar i përket Stager-it (§3.6, SC-5)** *(v2)*.

| ID | Përgjegjësia | P | Kriteri | Matja |
| -- | ------------ | - | ------- | ----- |
| CS-1 | Captions nga teksti/audio e miratuar, me alignment | **P0** | Çdo fjalë e narracionit shfaqet një herë, në rend | [A] |
| CS-2 | Lidhja e çdo caption me fjalët dhe kohët | **P0** | Drift caption–audio ≤ 80 ms në çdo fjalë | [A] |
| CS-3 | Ndarja e rreshtave, karakteret, koha minimale e leximit, safe areas | **P0** | Çdo frazë ≥ 0,7 s në ekran; rreshti brenda brezit të titrave (Style Bible); ≤ 7 fjalë | [A] Gate |
| CS-4 | Zbulon overlap, gap, drift, elemente jashtë kohëzgjatjes | **P0** | Gate-i refuzon kohët jashtë filmit ose të mbivendosura | [A] |
| CS-5 | Formate të ndryshme (SRT/VTT, të djegura në video) | P1 | Eksport SRT/VTT i vlefshëm me të njëjtat kohë | [A] |

**Dështime që nuk pranohen:** captions të pasinkronizuara; tekst i prerë ose i palexueshëm; track-e të mbivendosura; kohë të paqëndrueshme.

### 3.11 Render Worker

**Misioni:** ekzekutimi i paketës së validuar në video të qëndrueshme, të riprodhueshme dhe teknikisht korrekte. Renderer-i: **Engine-i i Erkasa + FFmpeg** *(v2: v1 përmendte Remotion, që nuk përdoret)*.
**Output-i:** `RenderArtifacts`: MP4 final, preview, manifest render-i, log-e, rezultati i ffprobe, status.

| ID | Përgjegjësia | P | Kriteri | Matja |
| -- | ------------ | - | ------- | ----- |
| RW-1 | Merr paketën e validuar, asetet dhe profilin e render-it | **P0** | Asnjë kuadër nuk renderohet pa Gate PASS | [A] |
| RW-2 | Renderon me Engine + FFmpeg | **P0** | I njëjti input → të njëjtat kuadro (hash) | [A] |
| RW-3 | Rezolucione, fps, aspect ratio, codec të konfiguruar | **P0** (9:16), P2 (formate të tjera) | ffprobe përputhet me profilin | [A] |
| RW-4 | Progress, cancel, timeout, retry, cleanup | **P0** | Pas cancel/timeout: 0 procese, asnjë skedar i pjesshëm i shënuar sukses | [A] |
| RW-5 | MP4 final, preview, metadata teknike | **P0** (MP4), P1 (preview) | Numri i kuadrove dhe kohëzgjatja = paketa (±1 kuadër audio) | [A] |
| RW-6 | Manifest me hash-e, versione, kohëzgjatje, fps, rezolucion, codec | **P0** | Render-i auditohet nga manifesti | [A] |

**Dështime që nuk pranohen:** output i korruptuar i shënuar sukses; humbje kuadrosh ose audioje; proces që ngec; render që mbishkruan të tjerët pa versionim.

### 3.12 Quality Control Worker

**Misioni:** vlerësim i matshëm i cilësisë teknike, vizuale, narrative dhe audio, me prova për çdo problem.
**Output-i:** `QCReport`: pass/fail, nota sipas dimensioneve, defekte me timestamp, severity, prova, confidence, rekomandime, versioni i vlerësuesit.

**QC ka dy faza *(v2)*:** **Validation Gate** para render-it (kontrata, kapacitete, gjeometri, kohë: refuzim me 0 kuadro) dhe **kontrollet pas render-it** (mbi kuadrot dhe median). Një kontroll që mund të bëhet para render-it nuk shtyhet pas tij.

| ID | Përgjegjësia | P | Kriteri | Matja |
| -- | ------------ | - | ------- | ----- |
| QC-1 | Integriteti, kuadro të zeza dhe të ngrira, clipping audio, heshtje, kufijtë e captions, kohëzgjatja | **P0** | Çdo kontroll ka prag; çdo shkelje ka timestamp | [V] |
| QC-2 | Vazhdimësia e personazheve, objekteve, ambientit, kamerës, stilit | **P0** | Kriteret [A]/[V] të standardit të Engine-ve ekzekutohen automatikisht | [A]+[V] |
| QC-3 | Foot sliding, penetrim, clipping, paper-doll, z-index, framing | **P0** kur testi ekziston | Kriteret e Engine-ve (CA-A3, CA-D4, WB-B2, CC-A4) | [A]+[V] |
| QC-4 | Kritik AI vetëm për vlerësime semantike | P2 | Çdo gjetje me kuadër dhe timestamp; asnjë gjetje pa provë | [V] |
| QC-5 | Contact sheet, mostra kuadrosh, defekte, severity, confidence, rekomandime | **P0** | Raporti gjenerohet për çdo render | [A] |
| QC-6 | Hard failures bllokojnë dorëzimin; soft warnings kërkojnë vendim | **P0** | Një defekt kritik i futur qëllimisht bllokon dorëzimin (testi G) | [A] |

**Dështime që nuk pranohen:** nota pa prova; kritik AI që shpik defekte; video me gabim kritik që kalon nga mesatarja; QC që ndryshon videon pa revision.

### 3.13 Production Orchestrator

**Misioni:** ekzekutim i besueshëm i pipeline-it, me varësi, miratime, kufij burimesh dhe gjendje të projektit.
**Output-i:** gjendja e ekzekutimit: job ids, statuse, attempts, grafi i varësive, event-e progresi, audit log, rezultati final.

| ID | Përgjegjësia | P | Kriteri | Matja |
| -- | ------------ | - | ------- | ----- |
| PO-1 | Grafi i job-eve sipas versionit të pipeline-it | **P0** | Asnjë hap nuk nis para varësive | [A] |
| PO-2 | Queue (RabbitMQ) dhe cikli i jetës | **P0** | Çdo job ka status përfundimtar të ligjshëm | [A] |
| PO-3 | Dependencies, concurrency, prioritete, kuota | P1 | Kufijtë e konfiguruar respektohen | [A] |
| PO-4 | Idempotency, retry me backoff, timeout, cancel, dead-letter | **P0** | Retry pa dublikim; vetëm attempt-i i autorizuar publikon (fencing); dead-letter P1 | [A] |
| PO-5 | Gjendja në PostgreSQL dhe rikuperimi pas restart-it | **P0** | Restart gjatë një run-i: 0 job-e të dublikuara, 0 gjendje të humbura | [A] |
| PO-6 | Statuset, audit trail, njoftime për UI | **P0** | Çdo tranzicion regjistrohet me kohë | [A] |
| PO-7 | Pa vendime kreative; respekton approval gates | **P0** | Asnjë hap pas një gate pa approval (testi A) | [A] |

**Dështime që nuk pranohen:** Orchestrator që bën punë kreative; job-e të dublikuara nga retry; pipeline që vazhdon pas dështimit kritik; tranzicione të pamundura ose të humbura pas restart-it.

## 4. Kufijtë me 4 Core Engines (v1.0)

Katër Engine-t nuk janë Workers. Workers përgatisin kërkesat, furnizojnë asetet, integrojnë output-et dhe kontrollojnë rezultatin.

| Engine | Merr kërkesa nga | Output-i i tij integrohet nga |
| ------ | ---------------- | ----------------------------- |
| World Builder | Scene Planning | Scene Composition |
| Character Acting | Scene Planning (identiteti, qëllimi, koha) | Scene Composition |
| Cinematic Camera | Scene Planning (beat, qëllimi i kompozimit), gjeometria e skenës | Scene Composition → Renderer |
| Environmental Motion & FX | Scene Planning (ambienti, cues, kohë) | Scene Composition → Renderer |

**Rregull:** asnjë Worker nuk implementon fshehurazi një version të dytë të një Engine-i. Kur një Engine nuk e mbështet një aftësi, Scene Planning e shënon unsupported/partial (capabilities), Gate-i e refuzon, dhe Orchestrator-i zbaton fallback-un ose ndalon prodhimin sipas politikës.

## 5. Kontratat mes Workers (v1.0)

- Çdo output ka `schema_version`, `project_id`, `job_id`, `producer`, `created_at` dhe referenca te input-et.
- Media ruhet në storage të qëndrueshëm; databaza ruan metadata dhe referenca.
- Output-et janë immutable pas finalizimit; ndryshimi prodhon revision të ri.
- Statuset: `SUCCEEDED`, `FAILED`, `RETRYABLE_FAILED`, `CANCELLED`, `NEEDS_REVIEW`.
- Gabimet ndahen në validation, provider, resource, timeout, dependency, internal.
- Pa tekst të lirë mes Workers kur nevojitet kontratë: JSON/skema të versionuara.
- Modeli dhe ofruesi zgjidhen nga konfigurimi dhe regjistri, jo në kod.

## 6. Buxheti, licencat dhe Style Bible *(v2)*

- **Buxheti:** metrikat e standardit të Engine-ve §13 raportohen për çdo run, me kosto dhe kohë sipas Worker-it (AI, TTS, render). Pas Fazës 3 bëhen kufij.
- **Licencat:** standardi i Engine-ve §12 vlen për çdo Worker që prodhon ose zgjedh asete (5, 7, 8, 9). Raporti i licencave (credits) prodhohet nga manifesti për çdo video.
- **Style Bible:** standardi i Engine-ve §9 vlen për Creative Director, Storyboard, Asset Generation dhe Caption.

## 7. Vlerësimi në nivel sistemi (v1.0)

| Dimensioni | Çfarë provohet |
| ---------- | -------------- |
| Contract correctness | skema valide, versionim, kompatibilitet |
| Functional correctness | rastet normale dhe edge cases |
| Failure behavior | timeout, retry, cancel, gabime provider-i pa korruptim |
| Observability | log-e, metrika, provenance |
| Quality evidence | rezultat i matshëm dhe artefakte prove |
| Cost/latency | kufij të qartë kostoje dhe kohe |
| Security/licensing | sekretet, të dhënat dhe licencat sipas politikave |

## 8. Test suite i përbashkët (v1.0, me kritere *(v2)*)

| Testi | Kriteri |
| ----- | ------- |
| A. Happy path end-to-end, me miratimin e skenarit | MP4 final; gate-i i miratimit respektohet; QC PASS |
| B. Dështim i pjesshëm (Asset Generation dështon) | retry i sigurt ose ndalje me status të saktë; 0 asete të pjesshme të publikuara |
| C. Ofruesi nuk përgjigjet (TTS, imazhe, model teksti) | puna nuk shënohet sukses; gabim i klasifikuar `provider` |
| D. Restart i Orchestrator-it gjatë run-it | 0 dublikime, 0 gjendje të humbura |
| E. Ndryshohet një segment i skenarit | rigjenerohen vetëm varësitë e prekura |
| F. Integriteti i timeline-it | zë, muzikë, SFX, captions, skena: kriteret VW-5, CS-2, SD-3 |
| G. QC hard failure | një defekt kritik i futur qëllimisht bllokon dorëzimin |
| H. Riprodhueshmëria | nga manifesti rindërtohen versionet dhe input-et |
| **I. Ndërrimi i modelit AI** *(v2)* | i njëjti benchmark me modelin e ri: kalueshmëria e skemës dhe e Gate-it, numri i riparimeve dhe notat [H] jo më të ulëta se baza |

## 9. Definition of Done për një Worker (v1.0 + v2)

- Përgjegjësia dhe kufijtë janë dokumentuar dhe nuk mbivendosen pa arsye.
- Kontrata input/output është e versionuar dhe e validuar.
- Ka teste unit, contract dhe integration; të paktën një rast normal, një edge case dhe një dështim.
- Retry, timeout, cancellation dhe idempotency janë përcaktuar sipas nevojës.
- Log-et dhe metadata mundësojnë auditimin e një ekzekutimi.
- Output-i është verifikuar me artefakt real, jo vetëm me mock, sipas rregullit end-to-end.
- Të gjitha përgjegjësitë **P0** janë Implemented; P1/P2 Implemented ose kufizimi i miratuar.
- Dokumentacioni përshkruan konfigurimin, kufizimet dhe mënyrën e verifikimit.
- Statusi raportohet me prova dhe miratohet para se të quhet complete.

## 10. Rregulla për auditimin dhe implementimin

- Ky dokument është standard i synuar, jo përshkrim i implementimit.
- Mos supozo se një Worker ekziston sepse emri i tij shfaqet në kod, dokumentacion ose plan.
- Statuset: Implemented, Partial, Missing, Broken, Not Verified (standardi i Engine-ve §3.2).
- Për çdo Implemented: skedarët, simbolet, testet dhe artefaktet që e provojnë.
- Mos krijo 13 agjentë AI vetëm për të përputhur numrin 13.
- Mos e ngatërro Worker-in me modelin, container-in, queue-n ose serverin.
- Mos ndrysho kontrata ose arkitekturë pa audit, propozim, ndikim, plan migrimi dhe miratim.
- Mos fillo implementim nga ky dokument pa audit dhe faza të vogla me teste dhe prova. Rendi: P0 → P1 → P2.
- Ruaj ndarjen mes 13 Workers dhe 4 Core Engines.

## 11. Përkufizimi i suksesit (v1.0)

Erkasa Studio arrin standardin kur 13 Workers kanë përgjegjësi të qarta, kontrata të qëndrueshme dhe sjellje të testueshme; katër Engine-t prodhojnë rezultatet vizuale sipas standardit të tyre; Orchestrator-i koordinon me rikuperim të besueshëm; dhe Quality Control provon me evidencë nëse videoja është e pranueshme. Suksesi matet me cilësinë, besueshmërinë, koston dhe kontrollueshmërinë e videos finale, jo me numrin e agjentëve AI.
