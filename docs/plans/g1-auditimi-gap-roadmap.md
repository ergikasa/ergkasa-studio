# Erkasa Studio — Auditimi, Gap Analysis dhe Roadmap kundrejt "Advanced 2D Animation Engine Architecture"

| Fusha            | Vlera                                                                                                                                                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data             | 2026-11-20                                                                                                                                                                                                                                                                                                  |
| Baza             | branch `standards-v2` @ `0e20d88` (versioni më i fundit: E1.6 + Standard v2.0 + Master Architecture v1.0), me auditin `ai-provider-audit` të bashkuar                                                                                                                                                       |
| Branch-i i punës | `g0-advanced-engines`                                                                                                                                                                                                                                                                                       |
| Dokumentet burim | "Advanced 2D Animation Engine Architecture" (PO, 2026-11-20); "Additional Mandatory Requirements: Advanced Character Performance & Wardrobe Intelligence" (PO, 2026-11-20); `docs/standards/engines-standard-v2.md`; `docs/standards/workers-standard-v2.md`; `docs/architecture/master-architecture-v1.md` |
| Vendimi i PO-së  | "Boll u morëm me rregullime. Për çdo pyetje merr atë që është më e arsyeshme. Merr versionin më të fundit dhe nis implementimin." Kjo zëvendëson pritjen e miratimit të §35 për fazën e parë; fazat e tjera ndjekin rregullin e branch-it, testeve dhe krahasimit para/pas.                                 |

## 0. Përmbledhja

1. **Katër Engine-t ekzistojnë si përgjegjësi reale në kod, por asnjë nuk është në nivelin e standardit.** Character Acting dhe Camera janë më të avancuarat; Environmental FX është më i dobëti (pothuajse vetëm drita).
2. **Infrastruktura e prodhimit (Workers, Gate, Render Package, renderer determinist) është e fortë.** Kjo është baza mbi të cilën ndërtohet çdo aftësi e re. Nuk ka arsye për rindërtim.
3. **Kufiri i cilësisë së personazheve vjen kryesisht nga materiali** (rig-u placeholder i vizatuar në kod, profil, pa pjesë artisti), jo nga logjika e acting-ut.
4. **Identiteti dhe veshjet ishin boshllëku më konkret dhe më i matshëm.** B2 ndante të njëjtin person në dy cast members (`alex` dhe `alex_suit`) për t'i ndërruar rrobat, dhe "kostumi" ishte vetëm një ngjyrë më e errët. **W1 e mbyll këtë boshllëk në këtë branch** (§5).
5. **GPU/RunPod dhe gjenerimi i imazheve AI mungojnë plotësisht.** Rekomandimi mbetet MA-D3: GPU merret me qira vetëm pasi benchmark-u provon se asetet janë bottleneck-u. Arkitektura e adapterit përgatitet më herët (§4, G1).

## 1. Metoda

- Statuset janë ato të Standard v2 §3.2: **Implemented**, **Partial**, **Exists, not integrated**, **Missing**, **Broken**, **Not Verified**.
- Një aftësi shënohet Implemented vetëm nëse kalon nëpër gjithë rrugën: plan → Engine → Render Package → Gate → renderer → kuadër. Ekzistenca e një funksioni nuk mjafton.
- Prova e bazës: në `0e20d88` kalojnë **film 345, stager 86, gate 422, contracts 264** teste, si dhe goldens B1–B5 + W0.
- Kufizim: në këtë mjedis nuk ka çelës ElevenLabs/Claude. Video e plotë me zë **nuk** u prodhua. Provat vizuale janë kuadro të renderuara nga i njëjti renderer dhe matje automatike. Çdo gjë që kërkon videon finale me zë shënohet Not Verified.

## 2. Auditimi — 4 Engine-t

### 2.1 World Builder

| Aftësia (dok. §4)                                                                               | Statusi                     | Prova / ku                                                                                                                                         |
| ----------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 Ambiente të brendshme                                                                       | Partial                     | 4 sete me dorë (`film/src/sets.ts`: office, interview, room, cage) + zyra W0 nga seed (`film/src/w0/world.ts`)                                     |
| 4.1 Ambiente të jashtme, industriale, natyrore, historike, simbolike                            | Missing                     | asnjë set i jashtëm; editorial templates janë "simbolike", por jo ambiente                                                                         |
| 4.2 Spatial representation (position, scale, bbox, depth, occlusion, parent-child, constraints) | Partial                     | marks (`stand`/`seat`/`surface`/`work`), props me pozicion, targets; **mungojnë** bbox, dimensione, marrëdhënie occlusion-i dhe hierarki objektesh |
| 4.3 Multiplane / parallax                                                                       | Partial                     | W0: 6 plane thellësie dhe kamerë parallax; setet v2 janë `flat`                                                                                    |
| 4.4 Object intelligence                                                                         | Partial                     | 4 lloje props (cup, paper, notebook, phone), ulëse me `seatY`, sipërfaqe, derë me gjendje 0..1; nuk ka skemë të përgjithshme objekti               |
| 4.5 Interaction support (grasp, sit, surface, collision, reach)                                 | Partial                     | sockets `hand`/`handF`, `seat`, `surface`, `work`; **mungojnë** zona ecjeje, pengesa, kolizione, rajone kapjeje sipas objektit (WB-B3 Missing)     |
| 4.6 Visual consistency                                                                          | Implemented (brenda seteve) | i njëjti set ID = i njëjti vizatim; `continuity.ts` ruan njerëzit dhe props mes shot-eve                                                           |
| 4.7 Procedural                                                                                  | Partial                     | W0 nga seed; v2 jo                                                                                                                                 |
| 4.8 Asset integration (metadata, sha, licenca, versione)                                        | Implemented                 | Asset Manifest `erkasa.assets/1`, Gate-i verifikon sha256 dhe licencën                                                                             |

### 2.2 Character Acting

| Aftësia                                             | Statusi                                        | Prova / ku                                                                                                                                                                                        |
| --------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 Rigging (FK, IK, constraints)                   | Partial                                        | `film/src/rig.ts`: 10 kocka, FK; IK me dy kocka për krahun dhe këmbën. **Mungojnë** mesh, skinning, view switching (vetëm profil dhe "turn squash"). Burimi: materiali placeholder, jo logjika    |
| 7.2 Anatomy & body mechanics                        | Partial                                        | hierarkia kokë-qafë-bust-krahë-këmbë; pa kyçe dore ose gishta                                                                                                                                     |
| 7.3 Walk & locomotion                               | Partial                                        | cikël me foot planting (IK mbi këmbën që mban peshën), ecje sipas humorit (`GAIT`), start/stop me settle, follow-through pas ndalimit. **Mungojnë** vrapi, kthimi i animuar, ecja rreth pengesave |
| 7.4 Gesture system                                  | Partial                                        | 24 folje (`Verb`): look, glance, point, shrug, nod, talk… me fillim/kulm/fund                                                                                                                     |
| 7.5 Acting principles                               | Partial                                        | anticipation dhe follow-through në ecje, slow-in/out (`EASES`), micro-acting (frymëmarrje, shkelje syri, zhvendosje peshe)                                                                        |
| 7.6 Weight & balance                                | Partial                                        | anim në ecje dhe kundërpeshë e kokës; pa ndryshim sipas peshës së objektit                                                                                                                        |
| 7.7 Object interaction                              | Partial                                        | pick_up, put_down, give, drink, type, write, open, me socket dhe IK; **mungojnë** push, pull, carry i rëndë                                                                                       |
| 7.8 Facial acting                                   | Partial                                        | sy, qepalla, vetulla, gojë (−1..1), hapje goje nga kohët e fjalëve; pa deformim fytyre                                                                                                            |
| 7.9 Secondary motion                                | Partial → **W1 shton**                         | ishte vetëm micro-acting; W1 shton rrobat që ndjekin trupin (sway me vonesë, hem i shtyrë nga gjunjët, kravatë dhe shall me gravitet, bisht flokësh)                                              |
| 7.10 + B Character identity                         | **Broken → Implemented (W1)**                  | B2: një person në dy cast members. W1: një cast member, fingerprint identiteti, Gate `IDENTITY_DRIFT`                                                                                             |
| C Wardrobe & costume intelligence                   | **Missing → Implemented (W1, pa video me zë)** | §5                                                                                                                                                                                                |
| A2 Advanced acting direction (qëllim → performancë) | Missing                                        | foljet vendosen me dorë nga plani; nuk ka shtresë që përkthen "i shqetësuar, shpjegon" në qëndrim + gjeste + intensitet                                                                           |
| A5 Performance sequencing                           | Partial                                        | disa veprime në një shot me kohë të ankoruara te fjalët; vazhdimësia mes shot-eve (`carry`). Mungon kurba emocionale e vazhdueshme                                                                |
| A3 Lip sync                                         | Partial                                        | kanali `open` nga kohët e fjalëve; pa viseme                                                                                                                                                      |
| A4 Interaksion me personazh tjetër                  | Partial                                        | give, look at person, lean_in; pa kontakt fizik                                                                                                                                                   |

### 2.3 Cinematic Camera

| Aftësia                   | Statusi                  | Prova / ku                                                                                                                |
| ------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 10.1 Shot language        | Partial                  | wide, medium, close, ots, insert; mungojnë EWS, ECU dhe two-shot si plane të emërtuara                                    |
| 10.2 Movement             | Partial                  | static, push_in, pull_out, follow, drift; dolly/parallax në W0. Mungojnë pan, tilt, orbit, crane si lëvizje të deklaruara |
| 10.3 Depth & parallax     | Partial                  | vetëm W0                                                                                                                  |
| 10.4 Subject tracking     | Partial                  | `follow`, `subject`                                                                                                       |
| 10.5 Framing intelligence | Partial                  | `v2frame.ts` korniza sipas madhësisë, brezi i titrave i rezervuar (Gate). Pa matje [V] të headroom/look room mbi kuadrot  |
| 10.6 Continuity           | Implemented (kontrollet) | `continuity.ts`: POSITION_JUMP, ORIENTATION_FLIP, GAZE_JUMP, POSE_JUMP, HOLDING_MISMATCH…                                 |
| 10.7 Narrative direction  | Partial                  | `moment` dhe `framing` vendosen nga director-i (LLM); pa rregulla deterministe kontrolli                                  |

### 2.4 Environmental Motion & FX

| Aftësia                                   | Statusi                | Prova / ku                                                                                   |
| ----------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| 13.1 Particle system                      | Exists, not integrated | `engine/src/adapters/particles.ts` i engine-it legacy; jo në rrugën film/package             |
| 13.2 Wind                                 | Missing                | (W1 pranon `sway` si hyrje: erës i duhet vetëm të furnizojë një vlerë)                       |
| 13.3 Weather, 13.4 Smoke/fire, 13.5 Water | Missing                | —                                                                                            |
| 13.6 Lighting & shadow                    | Partial                | 4 humore drite me kalime (`light`, `lightTo`), llamba W0, glow; hije vetëm elipsë në dysheme |
| 13.7 Environmental interaction            | Missing                | —                                                                                            |

## 3. Auditimi — Workers dhe Infrastruktura

| Fusha                                                                             | Statusi                          | Prova                                                                                                                                   |
| --------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Orkestrimi (DAG, outbox, RabbitMQ, fencing, idempotency, cancel, retry, recovery) | Implemented                      | `backend/…/Orchestrator.java`, E1.6/2 (skenarët 1–9 me Postgres dhe RabbitMQ realë)                                                     |
| AI / Script Worker                                                                | Implemented (Claude API)         | `ai-worker/src/llm.ts`, `script-writer.ts`; structured output me kufirin 16 nullable të testuar                                         |
| AI Image Generation Worker                                                        | Missing                          | asnjë model imazhi                                                                                                                      |
| Asset Processing Worker                                                           | Partial                          | `tools/asset-validate`, Asset Registry; pa transparencë ose konvertim automatik                                                         |
| Character / Motion Execution                                                      | Implemented si pjesë e stager-it | `stager/src/v2.ts` regjistron çdo kanal të rig-ut për kuadër                                                                            |
| Environmental FX Workers                                                          | Missing                          | —                                                                                                                                       |
| Render Worker                                                                     | Implemented                      | Render Package → Gate → renderer determinist → FFmpeg, watchdog, cancel, K7 (931 kuadro identike)                                       |
| Worker Engineering Standards (§17)                                                | Partial                          | kontrata të versionuara, job identity, idempotency, retry/timeout dhe cancel ekzistojnë; metrikat dhe kostoja për hap nuk janë të plota |
| GPU Provider (RunPod)                                                             | Missing                          | —                                                                                                                                       |
| AI Model Runtime (model identity, version, VRAM, queue)                           | Partial                          | një adapter LLM; pa regjistër modelesh                                                                                                  |

## 4. Source of Truth: shtesat (Standard v2.1)

Kërkesat e reja hyjnë në `docs/standards/engines-standard-v2.md` si **§5.5 (v2.1)**, me ID, prioritet dhe kriter matjeje: **CA-P1…P4** (performanca), **CA-I1…I3** (identiteti) dhe **CA-W1…W5** (veshjet). Asnjë kërkesë ekzistuese nuk zbutet. Shtesat për Workers dhe GPU:

| ID    | Kërkesa                                                                                                                                               | P   | Kriteri                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --------------------------------------------------------------------------- |
| WK-W1 | Veshjet krijohen ose përpunohen nga Workers ekzistues (Image Generation + Asset Processing); vendosja dhe vazhdimësia mbeten te Character Acting (C5) | P1  | asnjë Worker i ri për veshjet; Gate refuzon garment që rig-u nuk e deklaron |
| GPU-1 | Ofruesi i GPU-së pas një interface (`ModelRuntime`), jo RunPod direkt në kod                                                                          | P1  | ndërrimi i ofruesit = konfigurim                                            |
| GPU-2 | Çdo model ka identity, version, VRAM, runtime, timeout, queue, metrika (§20)                                                                          | P1  | regjistër modelesh i validuar nga skema                                     |
| GPU-3 | Asnjë GPU me qira para provës nga benchmark-u (MA-D3)                                                                                                 | P0  | raporti i benchmark-ut                                                      |

## 5. W1: Character Identity + Wardrobe Intelligence (i implementuar në këtë branch)

Raporti i plotë: `docs/reports/w1/README.md`. Shkurt:

- **Kontrata:** `contracts/src/wardrobe.ts` (40 lloje veshjesh, 10 stile flokësh, 4 lloje mjekre, rregullat e një veshjeje që mund të vizatohet, fingerprint i identitetit). Fusha opsionale në `erkasa.render/1` (`actors[].wardrobe`, `actors[].features`) dhe në rig (`garments`, `hairStyles`, `facialHair`). Paketat e vjetra mbeten të vlefshme dhe identike.
- **Inteligjenca:** `film/src/wardrobe.ts`: zgjedhje deterministe sipas periudhës (6), profesionit (15), rastit (6), motit (5) dhe trupit, me arsye për çdo copë; rregulla anakronizmi; vazhdimësi (`WARDROBE_CHANGE_IN_EVENT`, `WARDROBE_CHANGE_NO_REASON`); identitet (`IDENTITY_SPLIT`).
- **Vizatimi:** `film/src/garments.ts`: shtresa nga brenda jashtë, mëngë dhe manshetë, palltë që shtyhet nga gjunjët, kravatë dhe shall me gravitet, ndjekje e lëvizjes me vonesë 5 kuadrosh, flokë dhe mjekra, kapele dhe syze, kontur i hollë për veshjet e bardha.
- **Gate:** `WARDROBE_UNSUPPORTED`, `OUTFIT_INVALID`, `FEATURES_UNSUPPORTED`, `IDENTITY_DRIFT`. Fingerprint-i i rig-ut tani mbulon `rig.ts` + `garments.ts`.
- **Director-i (LLM):** njeh profesionin, periudhën, outfits dhe `outfit` për aktor, pa shtuar asnjë fushë nullable (kufiri 16 i API-së ruhet).
- **Prova:** 18 teste W1 + round-trip i director-it. **K7: 931/931 kuadro identike** me `golden-package.json` dhe 0 dështime në B1–B5 + W0: filmat ekzistues nuk ndryshuan asnjë piksel.

## 6. Gap Analysis dhe varësitë

```
            ┌───────────── W1 Identity + Wardrobe (u krye) ─────────────┐
            ▼                                                           ▼
 W3 World Builder: modeli hapësinor      W2 Performance: qëllim → performancë,
 (objekte me bbox, zona, pengesa,        sekuenca me vazhdimësi të shikimit
  rajone kapjeje)                        dhe të duarve, kurba emocionale
            │                                     │
            ├──────────────┬──────────────────────┤
            ▼              ▼                      ▼
 W4 Camera: gramatika + QC [V] mbi kuadrot    W5 FX në rrugën e paketës
 (headroom, look room, kutia e subjektit)     (era → sway e rrobave/flokëve,
                                              pluhur nga hapat, shi, dritë)
            └──────────────┬──────────────────────┘
                           ▼
           BM Benchmark 5 skena (dok. §28) + Test 4 dhe Test 6 mbi video me zë
                           ▼
           G1 GPU/AI vetëm nëse benchmark-u tregon se asetet janë bottleneck
```

Arsyet e rendit:

1. **W2 para W3**, sepse cilësia "studio" dështon kryesisht te acting-u (verdikti i PO-së, 14 Nov: "animated PowerPoint"). Test 4 (sekuencë komplekse) është kërkesë e detyrueshme dhe ende Missing.
2. **W3 para W4 dhe W5**, sepse kamera (subjekti, occlusion-i) dhe FX (burimet, sipërfaqet) lexojnë botën. Pa modelin hapësinor, secili do ta rindërtonte vetë, gjë që e ndalon dokumenti (§23).
3. **W5 vjen pas, jo para.** Master Architecture §6.4: efektet nuk e shpëtojnë një skenë të dobët. W1 e ka përgatitur hyrjen e erës (`sway`).
4. **GPU në fund dhe me kusht** (MA-D3). Para kësaj, në G1 përgatitet vetëm interface-i `ModelRuntime` dhe regjistri i modeleve: punë e vogël që nuk kërkon GPU.

## 7. Roadmap

| Faza      | Objektivi                                                          | Engine / Worker                          | Kontratat                                                                                    | Testet dhe pranimi                                                                                                          | Rreziqet                                                                                  | Rollback                                                         |
| --------- | ------------------------------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **W1** ✅ | Identitet + veshje                                                 | Character Acting; Stager; Gate; Director | `erkasa.render/1` +2 fusha opsionale; rig `@2`; `erkasa.film/1` +fusha opsionale             | D1, D2, D3, D5, D6 (§5); goldens identike                                                                                   | stili i veshjeve mbetet placeholder deri te rig-u i artistit                              | `rig @1` mbetet; plan pa `profession`/`outfits` = pamja e vjetër |
| **W2**    | Acting direction + performance sequencing                          | Character Acting                         | `erkasa.film/1`: `intent` për beat (emocion, intensitet, objektiv)                           | Test 4 i dokumentit: ecje → ndalim → shikim → kapje → lexim → reagim → kthim, me matjet CA-B3, CA-C4, CA-E3, CA-P2; [H] ≥ 4 | rreziku i gjesteve të përsëritura; zgjidhet me fjalor me variacion                        | flag për plan; foljet manuale mbeten                             |
| **W3**    | Modeli hapësinor i botës                                           | World Builder                            | seti si të dhëna: objekte me bbox, dimensione, `grip`/`seat`/`surface`, zona ecjeje, pengesa | WB-T1…T5; CA-D4 (pa penetrim > 5 px); "walk around obstacles"                                                               | migrimi i 4 seteve; drift në goldens nëse ndryshon vizatimi (nuk lejohet: vetëm të dhëna) | setet e vjetra lexohen nga adapteri                              |
| **W4**    | Camera: gramatikë + QC mbi kuadro                                  | Cinematic Camera; QC Worker              | `framing` + `two`, `ecu`, `ews`; `camera` + `pan`, `tilt`                                    | CC-T1…T6; matje [V] e kutisë së subjektit në çdo kuadër                                                                     | kosto e matjes për kuadër; bëhet mbi kuadro të zgjedhura                                  | lëvizjet e reja opsionale                                        |
| **W5**    | FX dhe dritë në paketë                                             | Environmental FX                         | `events[].fx` (Gate i ka sot `FX_UNSUPPORTED`)                                               | FX-T1…T6; pa flicker (FX-D2)                                                                                                | popping, mbulimi i subjektit                                                              | FX opsional për skenë                                            |
| **BM**    | Benchmark-u me 5 skena                                             | të katërta                               | —                                                                                            | dok. §28 + scorecard [H]                                                                                                    | kërkon zë real                                                                            | —                                                                |
| **G1**    | Adapter `ModelRuntime` + regjistër modelesh; RunPod vetëm me provë | AI Worker; Image Generation              | `models.json` i versionuar                                                                   | kontratë + mock; asnjë GPU pa provë                                                                                         | kostoja                                                                                   | konfigurim                                                       |

## 8. Ku kundërshtoj dokumentin, me argumente

1. **Deformation meshes, mesh weighting, skinning (7.1):** jo tani. Stili editorial me cutout nuk i kërkon. Sjellin kompleksitet të madh (editor peshash, renderim mesh-i në resvg) pa provë që cilësia humbet atje. Rishikohen pas rig-ut të artistit, nëse shfaqen artefakte në bërryla dhe gjunjë.
2. **Simulim fizik i rrobave:** dokumenti vetë thotë "jo në çdo skenë". W1 përdor ndjekje me vonesë dhe kufizime kontakti. Është determinist, i matshëm dhe i lirë.
3. **Heat distortion dhe ujë (13.4, 13.5):** P2. Temat e Erkasa-s (psikologji, vendime, ekonomi) i kërkojnë rrallë.
4. **GPU tani:** vendimi MA-D3 mbetet. Kodi vetëm përgatit ndarjen (GPU-1), pa marrë GPU me qira.

## 9. Çfarë kërkohet nga PO-ja

- Shikimi i provave të W1 (`docs/reports/w1/*.png`) dhe një run i plotë me zë: `pnpm video` me një skenar që ka ndërrim veshjesh.
- Miratimi për merge të W1 në `main`. Nuk bëra merge.
- Nuk kërkohet asnjë vendim tjetër për të nisur W2.
