# Auditimi: AI-ja jonë në vend të Claude API, gjenerimi i imazheve dhe lidhja me 4 Engine-t dhe 13 Workers

| Fusha    | Vlera                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| Statusi  | **Audit për miratim. Pa kod, pa konfigurim GPU.**                                                                        |
| Data     | 2026-11-19                                                                                                               |
| Branch-i | `ai-provider-audit`, nga `e1-6-production-readiness` @ `199207f` (kodi më i ri; `main` = `7f8ffca`)                      |
| Bazat    | _4 Core Engine Advanced Standard_ v1.0 dhe _13 Workers Advanced Standard_ v1.0 (objektivi afatgjatë, jo gjendja aktuale) |

Shenjat e përdorura: **[F]** fakt i lexuar në kod; **[R]** rekomandim; **[?]** pyetje që kërkon përgjigjen tënde.
Statuset ndjekin standardin: Implemented, Partial, Missing, Unsupported, Not Verified.

---

## 1. Ku përdoret Claude API sot

Ka **një pikë të vetme hyrjeje** drejt Claude-it në kodin e prodhimit: `ai-worker/src/llm.ts` **[F]**. Ndërfaqja `Llm` ka një metodë, `json({ label, system, messages, schema, maxTokens })`. Implementimi i vetëm, `AnthropicLlm`, përdor Messages API me _structured outputs_ (`output_config.format: json_schema`), `fetch` pa SDK, retry për 408/429/5xx, timeout 300 s dhe modelin nga `ERKASA_LLM_MODEL` (default `claude-sonnet-5-5`).

| #   | Përdoruesi                                                      | Hapi i pipeline-it                     | Çfarë kërkon nga modeli                                                                          | Skema                                                           | Statusi                                     |
| --- | --------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------- |
| C1  | `ai-worker/src/script-writer.ts`                                | `script.write`                         | skenari (skena, narracioni, beat, emocioni), me validim dhe riparim deri në 3 herë               | `SCRIPT_SCHEMA`                                                 | në prodhim                                  |
| C2  | `planner/src/director.ts` (përmes `film-steps.ts stepFilmPlan`) | `visual.plan`, engine `film` (default) | plani filmik: kasti, shot-et, set-i, drita, framing, kamera, veprimet, teksti; validim + riparim | `DIRECTOR_SCHEMA` (14 fusha nullable pas rregullimit `2115323`) | në prodhim                                  |
| C3  | `ai-worker/src/planner.ts` + `plan-draft.ts`                    | `visual.plan`, engine `v1`             | plani i motorit v1                                                                               | `DRAFT_SCHEMA`                                                  | rrugë e vjetër, aktive vetëm me `engine=v1` |
| C4  | `ai-worker/src/poc/ai-svg.ts`                                   | asnjë (eksperiment offline)            | Claude vizaton props SVG                                                                         | —                                                               | nuk hyn në pipeline                         |
| C5  | branch-i i ngrirë `world-builder-f1`                            | asset maker dhe visual critic          | Claude vizaton props SVG; Claude shikon contact sheet-et                                         | —                                                               | jashtë këtij branch-i, i pa-merge-uar       |

**Çfarë nuk përdor Claude [F]:** backend-i Java, Studio, engine-i (`film`), stager-i, Gate-i, zëri (ElevenLabs), muzika dhe SFX (projektues determinist), titrat (alignment-i i ElevenLabs).

**Varësitë e fshehta nga Claude që zëvendësimi duhet t'i trajtojë [F]:**

1. **Structured outputs.** Kodi mbështetet te garancia e API-së që përgjigjja ndjek skemën. Validimi dhe riparimi ekzistojnë, por janë rrjet sigurie, jo rruga kryesore.
2. **Kufijtë e skemës së API-së.** Shembull: kufiri prej 16 fushash _union_, që rrëzoi planin vizual më 2026-11-19.
3. **Prompt-et.** Janë shkruar dhe kalibruar për Claude (gjatësia, shembujt, rregullat në tekst). Një model tjetër mund të kërkojë rikalibrim.
4. **Kostoja.** `llmCost()` llogarit dollarë sipas çmimeve për token të Claude-it. Me GPU me qira, kostoja është kohë GPU, jo token.
5. **Provenance.** `usage.model` regjistrohet për çdo thirrje. Me modelin tonë duhet të regjistrohen edhe versioni dhe pesha e modelit (Workers §1, "Provenance and reproducibility").

## 2. Si zëvendësohet Claude me AI-në tonë

### 2.1 Zgjidhja e propozuar [R]

Pa Worker-a të rinj dhe pa shërbim të ri: ndryshon vetëm ofruesi pas ndërfaqes `Llm` që ekziston.

| Ndryshimi                                                                                                    | Ku                                                 | Pse                                                                                            |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Një adapter i ri, p.sh. `OwnModelLlm`, që implementon `Llm`                                                  | `ai-worker/src/llm.ts`, ose `llm-own.ts` pranë tij | Script Worker, regjisori dhe planner-i v1 nuk ndryshojnë: e marrin modelin përmes `deps.llm()` |
| Zgjedhja e ofruesit dhe e modelit nga konfigurimi, për çdo detyrë (`script`, `plan`)                         | `ai-worker/src/env.ts`, `worker.ts deps.llm`       | Workers §5: "Model/provider selection through configuration and registry, not hardcoded"       |
| Structured output i garantuar nga serveri, p.sh. _guided decoding_ / JSON-schema grammar                     | te adapteri dhe te serveri i modelit (faza GPU)    | Pa këtë, çdo përgjigje kalon nga riparimi dhe planet dështojnë më shpesh                       |
| Provenance për çdo thirrje: ofruesi, modeli, versioni ose hash-i i peshave, temperatura, seed-i, kohëzgjatja | `Usage` → `run.json`                               | Riprodhueshmëria; krahasimi para/pas                                                           |
| Kostoja: sekonda GPU dhe tokenë, jo dollarë Claude                                                           | `llmCost()`                                        | Kostoja e vërtetë për video                                                                    |
| Timeout dhe retry sipas GPU-së: nisje e ftohtë, radhë                                                        | adapteri                                           | 300 s mund të mos mjaftojnë në nisjen e parë                                                   |
| `AnthropicLlm` mbetet si adapter i zgjedhshëm deri në pranimin e fazës                                       | konfigurimi                                        | Rollback i menjëhershëm dhe bazë krahasimi për benchmark-un, siç bëmë me `legacy`              |

### 2.2 Alternativat

| Alternativa                                  | Përfitimi                                              | Risku                                                                    |
| -------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| **A. Adapter pas `Llm` (rekomanduar)**       | Ndryshim i vogël, i testueshëm; rollback me konfigurim | Kërkon që modeli ynë të mbështesë JSON-schema të detyruar                |
| B. Gateway i ndërmjetëm (p.sh. LiteLLM)      | Shumë ofrues pa kod                                    | Shërbim më shumë për t'u operuar; shumicën e përfitimeve i jep A         |
| C. Agjent me mjete (tool calling) për planin | Fleksibilitet                                          | E kundërta e rregullit 3 ("pa AI Agents pa nevojë"); më pak determinizëm |

### 2.3 Rreziqet

- **Cilësia e planit vizual dhe e skenarit.** Kjo është rreziku kryesor. Plani i regjisorit është detyra më e vështirë e modelit: shumë rregulla, vazhdimësi dhe skemë e madhe. Matet me benchmark (§7), jo me përshtypje.
- **Gjuha.** Skenarët janë në anglisht dhe në shqip. Modeli ynë duhet të provohet në të dyja.
- **Dritarja e kontekstit dhe gjatësia e përgjigjes.** Plani i një filmi 3-minutësh është i gjatë (`maxTokens` 32 000 sot).

## 3. Si integrohet AI Image Generation

### 3.1 Çfarë ekziston sot [F]

- **Biblioteka e aseteve:** 636 asete vektoriale (SVG) dhe rig-e personazhesh me kocka (`vector`, `rig`). Krijohen offline nga gjeneratorë procedurale Python (`tools/asset-gen/`), validohen (`pnpm assets:validate`) dhe indeksohen nga backend-i.
- **Llojet e aseteve në kontratë** (`contracts/src/asset-manifest.ts`): `vector`, `rig`, `font`, `audio`. **Nuk ka lloj për imazh raster** (PNG/WebP). Megjithatë `provenance.origin` e pranon tashmë vlerën `"ai"`.
- **Engine-i** vizaton SVG me resvg/Skia dhe animon rig-et me kocka, IK dhe pika kontakti (affordances: `grip`, `seat`, `surface`, `stand`, `openable`…). Rig-et janë pjesë-pjesë që mund të lëvizen.
- **Gjenerim imazhesh me AI:** **Missing.** Ka vetëm eksperimente SVG me Claude (C4, C5).

### 3.2 Pasoja kryesore arkitekturore

Një imazh i gjeneruar është **raster dhe një copë e vetme**. Engine-i ynë animon **pjesë vektoriale me kocka**. Ndaj kjo pyetje e përcakton gjithë integrimin:

| Lloji i asetit                                      | A shkon imazhi raster?                               | Arsyeja                                                                                      |
| --------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Ambiente (sfonde, plane thellësie për parallax)     | **Po**, si shtresa (foreground/midground/background) | Statike ose me lëvizje kamere; World Builder dhe Camera i përdorin si shtresa                |
| Props statike (tavolinë, raft, pemë)                | **Po**, me transparencë (alpha)                      | Vendosen dhe zhvendosen, nuk deformohen                                                      |
| Props që ndryshojnë gjendje (derë që hapet, llambë) | **Pjesërisht**: një imazh për çdo gjendje            | Kontrata ka tashmë `states` dhe `openable`                                                   |
| Tekstura dhe elemente FX (mjegull, tym, re)         | **Po**, si sprite/tekstura                           | FX Engine i animon me logjikë deterministe                                                   |
| **Personazhe që aktrojnë**                          | **Jo drejtpërdrejt**                                 | Një figurë e vetme nuk ecën, nuk ulet dhe nuk kap dot. Kërkon ndarje në pjesë dhe rig (§3.4) |

### 3.3 Zgjidhja e propozuar [R]

1. **Lloji i ri i asetit `image` në kontratë** (raster, PNG/WebP, alpha, dimensione, hash), shtues, me versionim. Gate-i dhe engine-i e marrin përmes capabilities, si audion në E1.5–E1.6.
2. **Asset Generation Worker** (Worker 5 i standardit, sot Missing) si **lloj i ri detyre te `ai-worker` ekzistues**, jo si shërbim i ri. Ai:
   - merr kërkesat e aseteve nga plani i skenës;
   - kontrollon fillimisht bibliotekën dhe cache-in (një aset i miratuar nuk gjenerohet sërish);
   - thërret ofruesin e imazheve përmes një ndërfaqeje si `Llm` (`ImageGen`), me ofrues nga konfigurimi;
   - kontrollon formatin, rezolucionin, alpha-n dhe integritetin;
   - regjistron prompt-in, modelin, seed-in, parametrat, licencën dhe hash-in (Workers §5).
3. **Vendi në pipeline:** hap i ri `assets` pas `plan` dhe para `render`, në DAG-un e Orchestrator-it, ose detyrë offline për bibliotekën. Shih pyetjen **[?] Q4**.
4. **Konsistenca vizuale.** Stili editorial (paleta dhe drita e natës) dhe identiteti i personazheve kërkojnë referenca stili dhe identiteti: seed, LoRA ose imazh referencë. Kjo i përket fazës GPU; këtu përcaktojmë vetëm kontratën që e regjistron.
5. **Shqyrtimi.** Aseti i gjeneruar hyn në prodhim i shënuar `approval: pending` ose `approved` sipas politikës. QC (Worker 12) dhe ti vendosni nëse kërkohet miratim njerëzor.

### 3.4 Personazhet: tre rrugë [?]

| Rruga                                                                                                                                | Si                                  | Përfitimi                                                             | Risku                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| P1. Rig-et vektoriale mbeten për aktrimin; AI për ambiente, props dhe FX                                                             | —                                   | Character Acting nuk prishet; cilësia e lëvizjes mbetet e kontrolluar | Personazhet nuk përfitojnë nga AI                                                                         |
| P2. AI gjeneron _design sheet_-in e personazhit; një proces gjysmë-automatik e ndan në pjesë dhe e rig-on (si artist brief-i, Spine) | offline, një herë për çdo personazh | Personazhe të reja, të ripërdorshme, me acting të vërtetë             | Ndarja dhe rig-u nuk janë të automatizueshme plotësisht; kërkojnë punë njerëzore ose një model segmentimi |
| P3. AI gjeneron personazhin pjesë-pjesë (koka, trupi, krahët) me identitet të njëjtë                                                 | për çdo personazh                   | Rig i drejtpërdrejtë                                                  | Konsistenca mes pjesëve është shumë e vështirë; rrezik i lartë "paper-doll" (Engine §4.4)                 |

**[R]:** P1 tani, P2 si fazë e veçantë pas provave me ambiente dhe props. P3 nuk e rekomandoj pa një prototip që provon konsistencën.

## 4. Cilët Workers përdorin AI-në tonë

Statuset janë auditi i këtij branch-i. "Not Verified" do të thotë që kodi ekziston, por nuk është provuar me output real sipas standardit.

| #   | Worker (standardi)       | Ku është sot                                                                                     | Statusi                                                                                                                     | AI-ja jonë?                                                                                                  |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | Creative Director        | Nuk ka artefakt `CreativeBrief`. Tema, stili dhe kohëzgjatja hyjnë direkt te skenari.            | **Missing**                                                                                                                 | **Po** (reasoning), me output të strukturuar                                                                 |
| 2   | Script Worker            | `script-writer.ts` (C1): skema, numri i fjalëve, riparimi                                        | **Partial**: nuk ka _approval gate_ (DAG-u vazhdon automatikisht te zëri)                                                   | **Po**                                                                                                       |
| 3   | Storyboard Worker        | Brenda `director.ts` (C2), në të njëjtën thirrje me planin                                       | **Partial**: nuk ka `StoryboardDocument` të veçantë                                                                         | **Po**                                                                                                       |
| 4   | Scene Planning Worker    | `director.ts` (C2) + compiler/stager determinist + Gate                                          | **Partial**                                                                                                                 | **Po**, për planifikimin; varësitë dhe kontrollet mbeten deterministe                                        |
| 5   | Asset Generation Worker  | — (vetëm gjeneratorë procedurale offline)                                                        | **Missing**                                                                                                                 | **Po**, gjenerim imazhesh (§3)                                                                               |
| 6   | Scene Composition Worker | `stager/` (determinist) + Gate (gjeometri, kamera, titra)                                        | **Partial**                                                                                                                 | Jo                                                                                                           |
| 7   | Voice Worker             | `voice.ts` (ElevenLabs)                                                                          | **Implemented, Not Verified** (smoke test i yti)                                                                            | Jo: mbetet ElevenLabs                                                                                        |
| 8   | Music Worker             | `score.ts` + `designSoundtrack` (katalog i licencuar, rregulla)                                  | **Implemented, Not Verified** me bibliotekën reale (E1.6)                                                                   | Jo tani; standardi e lejon AI për _semantic matching_ më vonë                                                |
| 9   | Sound Design Worker      | po ai projektues (SFX nga event-et e shot-eve)                                                   | **Partial**                                                                                                                 | Jo tani                                                                                                      |
| 10  | Caption & Sync Worker    | `stager/captions.ts` (alignment ElevenLabs), timeline në paketë                                  | **Implemented** (E1.6), **Not Verified** vizualisht                                                                         | Jo                                                                                                           |
| 11  | Render Worker            | `film/package` (engine + FFmpeg)                                                                 | **Implemented** (E1.5–E1.6). Shënim: standardi përmend Remotion; ne përdorim engine-in tonë, me arsye të dokumentuar në ADR | Jo                                                                                                           |
| 12  | Quality Control Worker   | Gate-i (para render-it), `film/src/qa.ts`, golden-ët; kritiku vizual vetëm te `world-builder-f1` | **Partial**: nuk ka QC pas render-it me raport defektesh                                                                    | **Opsionale**: kritik AI vetëm ku metrikat deterministe nuk mjaftojnë, dhe kërkon model me vizion **[?] Q1** |
| 13  | Production Orchestrator  | `backend/.../Orchestrator.java` (DAG, outbox, retry, fencing)                                    | **Implemented** (E1.6), pa approval gates                                                                                   | Jo: determinist                                                                                              |

**Përmbledhje:** AI-ja jonë hyn te Workers **1, 2, 3, 4** (tekst/reasoning) dhe **5** (imazhe). Mund të hyjë më vonë te **12**, nëse modeli ka vizion. Workers 6–11 dhe 13 mbeten deterministë, siç kërkon rregulli 3. Voice mbetet ElevenLabs.

## 5. Si lidhen këto shërbime me 4 Core Engines

Parimi i standardit dhe i arkitekturës sonë: **AI-ja nuk e drejton kurrë një Engine drejtpërdrejt.** AI prodhon **kërkesa të strukturuara** (plani) dhe **asete**. Engine-t i ekzekutojnë në mënyrë deterministe. Gate-i e refuzon çdo gjë që Engine-i nuk e mbështet.

| Engine                    | Ku është sot                                                                                                               | Statusi (paraprak)                                                                       | Merr nga AI                                 | Merr nga Asset Generation                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| World Builder             | set-e të koduara (`film/src/sets.ts`: office, interview, room, cage), W0 (`film/src/w0/world.ts`), affordances në kontratë | **Partial**: set-e fikse, pa ambiente të gjeneruara, pa _walkable areas_                 | zgjedhjen e set-it dhe të gjendjeve (plani) | **ambiente dhe props raster** (§3.3), me metadata: thellësi, zona ndërveprimi |
| Character Acting          | `film/src/perform.ts`, `rig.ts`, `motion.ts`, `continuity.ts` (IK, ecje, ulje, merr/jep, shikim)                           | **Partial** (shih diagnozën _why we stay_: lëvizje matematikore, jo acting i autorizuar) | veprimet dhe qëllimin për çdo shot          | personazhet vetëm sipas rrugës P2 (§3.4)                                      |
| Cinematic Camera          | `film/src/compose.ts` (framing, lëvizje, prerje), `w0/camera.ts` (2.5D, parallax)                                          | **Partial**                                                                              | framing-un dhe lëvizjen për çdo shot        | plane thellësie për parallax                                                  |
| Environmental Motion & FX | dritë në W0 (`light`, `lightTo`), pak efekte                                                                               | **Missing / Partial**                                                                    | humorin dhe ngjarjet atmosferike            | **tekstura FX** (mjegull, tym, shi)                                           |

**Kontrata:** asetet e gjeneruara hyjnë në **Asset Manifest** ekzistues (`erkasa.assets/1`, me llojin e ri `image`). Engine-t i marrin vetëm përmes referencave të paketës (`erkasa.render/1`), si çdo aset tjetër. Asnjë Engine nuk thërret ofruesin e imazheve.

## 6. Çfarë duhet të ndryshojë në pipeline-in ekzistues

| Komponenti                           | Ndryshimi                                                                            | Kontrata                                                             | Rreziku                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `ai-worker` (C1–C3)                  | adapteri i modelit tonë pas `Llm`; zgjedhja nga konfigurimi; provenance; kostoja GPU | asnjë kontratë pipeline-i; ndryshon vetëm `run.json` (fusha shtuese) | Mesatar: cilësia e modelit                                              |
| Prompt-et dhe skemat (C1, C2)        | rikalibrim për modelin tonë, me benchmark                                            | skemat ekzistuese                                                    | Mesatar                                                                 |
| `.env.example`                       | variablat e ofruesit (emrat, jo vlerat)                                              | —                                                                    | I ulët                                                                  |
| Kontrata `erkasa.assets`             | lloji `image` (shtues)                                                               | **ndryshim kontrate: kërkon miratimin tënd**                         | Mesatar                                                                 |
| Gate dhe engine (`film/package`)     | vizatimi i `image` me transparencë dhe shtresa, capabilities, raste negative         | capabilities                                                         | Mesatar                                                                 |
| `ai-worker`                          | detyra `asset.generate` (Asset Generation Worker)                                    | `erkasa.task/1` ekzistuese, me `taskType` të ri                      | Mesatar                                                                 |
| Orchestrator (backend)               | hapi `assets` në DAG, nëse zgjedhim gjenerimin për çdo run (Q4)                      | DAG                                                                  | I ulët–mesatar                                                          |
| Studio                               | shfaqja e aseteve të gjeneruara dhe miratimi i tyre, nëse kërkohet                   | API                                                                  | I ulët                                                                  |
| Raporti i licencave (E1.6 nënfaza 5) | asetet AI me modelin, prompt-in, seed-in dhe licencën e modelit                      | credits                                                              | I ulët; **arsye për ta mbaruar nënfazën 5 para gjenerimit të imazheve** |

**Pa ndryshim:** Voice (ElevenLabs), muzika dhe SFX, titrat, render-i, Gate-i për audion, izolimi i attempt-eve dhe Orchestrator-i, përveç hapit të ri opsional.

## 7. Plani i testimit (para çdo pranimi)

1. **Benchmark-u i tekstit (C1, C2).** 5 tema të ngrira (B1–B5), me Claude si bazë dhe me modelin tonë, me të njëjtin input. Matet:
   - sa plane kalojnë skemën dhe Gate-in në përpjekjen e parë;
   - numri i riparimeve;
   - gabimet sipas kodit;
   - koha dhe kostoja;
   - nota jote 1–5, me pyetjet e auditit të 2026-11-14.

   Pranimi: asnjë rënie në kalueshmëri dhe nota jo më e ulët se baza.

2. **Testet e adapterit.** Përgjigje e vlefshme, skemë e shkelur, timeout, nisje e ftohtë, 429/5xx, anulim. Provenance e regjistruar.
3. **Imazhet (pas fazës GPU).** Kontrollet teknike (format, alpha, dimensione, hash), konsistenca e stilit mbi një set referencë, ripërdorimi pa rigjenerim, dhe video para/pas te benchmark-et e Engine-ve (§9 e standardit).
4. **Çdo fazë:** branch i veçantë, CI e gjelbër, raport dhe video reale kur preket cilësia vizuale (rregulli 6).

## 8. Rendi i propozuar i fazave (pas miratimit)

| Faza | Përmbajtja                                                                                               | Varet nga                   |
| ---- | -------------------------------------------------------------------------------------------------------- | --------------------------- |
| 0    | Mbyllja e E1.6: nënfaza 5 (ruajtja, credits me provenance), pranimet e nënfazave 1–4, nënfaza 6 (legacy) | vendimi yt                  |
| AI-1 | Adapteri i modelit tonë pas `Llm`, konfigurimi, provenance, benchmark-u Claude kundrejt modelit tonë     | Q1–Q3, endpoint-i i modelit |
| GPU  | Konfigurimi i GPU-së dhe i serverëve (bashkë, fazë më vete)                                              | —                           |
| AI-2 | Kontrata `image`, Gate dhe engine, me asete raster të bëra me dorë (pa GPU)                              | miratimi i kontratës        |
| AI-3 | Asset Generation Worker: ambiente dhe props, cache, provenance, shqyrtim                                 | AI-2, GPU                   |
| AI-4 | Personazhet sipas rrugës së zgjedhur (P1/P2)                                                             | vendimi Q5                  |

## 9. Pyetjet që kërkojnë përgjigjen tënde

- **Q1. Modeli ynë i tekstit.**
  - Çfarë API-je ka? P.sh. _OpenAI-compatible chat completions_ (vLLM, TGI, SGLang) apo tjetër.
  - Si bëhet autentikimi?
  - A mbështet JSON-schema të detyruar (_guided decoding_)?
  - Sa është konteksti maksimal, dhe a ka vizion (imazhe në input)?
  - **Më thuaj vetëm emrat e variablave te `.env`, jo vlerat.**
- **Q2. Gjenerimi i imazheve.** Çfarë shërbimi ose API-je? A kthen PNG me transparencë? A ka kontroll seed-i dhe imazhe referencë (stil dhe identitet)?
- **Q3. Claude si rollback.** A mbetet Claude i zgjedhshëm nga konfigurimi gjatë kalimit, si bazë krahasimi dhe rollback, apo hiqet menjëherë?
- **Q4. Kur gjenerohen asetet?** Për çdo video (hap i ri në DAG) apo offline në bibliotekë, me rishikim para përdorimit? **[R]** bibliotekë + cache së pari, për konsistencë dhe kosto.
- **Q5. Personazhet.** P1 tani dhe P2 më vonë (rekomandimi im), apo një rrugë tjetër?
- **Q6. Rendi.** E mbyllim E1.6 (nënfazat 5 dhe 6) para AI-1, apo AI-1 fillon menjëherë?
