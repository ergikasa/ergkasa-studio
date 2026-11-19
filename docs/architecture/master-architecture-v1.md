# ERKASA STUDIO — Master Architecture Audit & Technical Vision

Arkitektura e plotë, projektimi i komponentëve dhe objektivi final i Video Generation Engine

| Fusha | Vlera |
| ----- | ----- |
| Versioni | **1.0** |
| Data | 19 Nëntor 2026 |
| Statusi | **Arkitekturë e synuar, e miratuar si drejtim.** Nuk autorizon implementim. |
| Autori | PO (Ergi Kasa); vendimet dhe shënimet e 2026-11-19 janë shtuar në §0 |
| Projekti | Erkasa Studio |
| Standardet e lidhura | `docs/standards/engines-standard-v2.md`, `docs/standards/workers-standard-v2.md` |

---

## 0. Vendimet e PO-së dhe statusi i dokumentit (2026-11-19)

### 0.1 Rregulli kryesor

> **Asgjë nuk implementohet vetëm sepse përmendet në këtë dokument.**

Ky dokument përshkruan **gjendjen e synuar**. Nuk pretendon se këto komponentë ekzistojnë. Çdo komponent, teknologji ose fazë që përmendet këtu (RunPod, vLLM, ComfyUI, SeaweedFS, AI Gateway, billing, AI Critic etj.) kërkon:

1. prova nga G0 se nevojitet;
2. propozim me problem, zgjidhje, alternativa, përfitime/rreziqe, ndikim dhe plan testimi;
3. miratim të veçantë të PO-së.

Pa këto, kodi nuk ndryshohet.

### 0.2 Vendimet

| ID | Vendimi |
| -- | ------- |
| **MA-D1** | Ky dokument ruhet si **Master Architecture v1.0**: drejtimi afatgjatë, jo plan pune. |
| **MA-D2** | **G0 është fazë zbulimi dhe verifikimi, jo implementimi.** G0 = Faza 1 (Standard v2.0) + Faza 2 (Engine Audit me prova) + Faza 3 (Integrated Benchmark, 5 video). Në G0 nuk ndryshohet kodi, nuk shtohen funksione dhe nuk ndryshohet arkitektura. |
| **MA-D3** | **Nuk merret me qira GPU** pa prova nga G0 se GPU, ose modeli AI, është bottleneck-u kryesor i cilësisë, i kostos ose i kohës. |
| **MA-D4** | Pas G0, investimi i kohës dhe parave vendoset nga provat. Rendi G1–G8 (§14) **nuk është i fiksuar**. Rishikohet nga rezultati i G0. |
| **MA-D5** | Pronari i timeline-it përfundimtar është **Stager-i** (§7.2). Standard v2.0 është përditësuar për t'u përputhur. |

### 0.3 Pikat e hapura (verifikohen në G0, vendosen pas G0)

| ID | Pika | Çfarë duhet provuar |
| -- | ---- | ------------------- |
| **MA-O1** | **Imazhet AI dhe personazhet.** Një model imazhi jep imazh statik. Character Acting kërkon personazh të ndarë në pjesë dhe me rig. Imazhet AI mund të jenë të përdorshme drejtpërdrejt për ambiente, props dhe sfonde. Për personazhet duhet një rrugë: imazhi AI si referencë për artistin, ndarje e automatizuar në pjesë, ose kombinim. | A vjen dobësia vizuale nga asetet, apo nga acting-u, kamera ose kompozimi? (Faza 2–3) |
| **MA-O2** | **AI Gateway: adapter apo shërbim.** Sot ka një pikë të vetme për LLM-në (`ai-worker/src/llm.ts`). Alternativa e parë: zgjerim i adapterit, i konfigurueshëm nga `.env`. Shërbim më vete vetëm kur ka disa GPU worker-a. | Numri i ofruesve dhe modeleve që nevojiten pas G0 |
| **MA-O3** | **Komponentë që sot nuk ekzistojnë:** SeaweedFS (sot storage në disk lokal), credits/billing/pagesa, autentikim për shumë përdorues. Kandidatë për G7–G8. | Ngarkesa dhe nevoja komerciale |
| **MA-O4** | **State machine i projektit.** Pipeline-i aktual është DAG hapash me ekzekutim paralel. Një zinxhir linear statusesh (§3.3) do ta kundërshtonte. Propozimi: statusi i projektit nxirret nga DAG-u. | Krahasim me Orchestrator-in aktual |
| **MA-O5** | **Licencat e modeleve** (Qwen, Z-Image-Turbo ose alternativat): përdorim komercial, kushte, atribuim. | Verifikim i licencës para çdo zgjedhjeje |
| **MA-O6** | **Niveli aktual.** Vlerësimi fillestar: rreth Level 2 (§15). | Statuset e auditit dhe benchmark-u |

### 0.4 Rezultati i pritur i G0

- Statusi i çdo aftësie të 4 Engine-ve dhe 13 Workers (Implemented / Partial / Missing / Broken / Not Verified), me kod, teste dhe video.
- 5 video benchmark, me matje dhe nota.
- Kostoja dhe koha për video, sipas hapave.
- **Harta e bottleneck-ëve:** ku humbet cilësia, koha dhe paraja, me prova.
- Propozim i renditur për fazën e parë pas G0, për miratim.

---

## 1. Vizioni i projektit

Erkasa Studio duhet të zhvillohet si një AI-Native 2D Animation & Video Production Engine.

Objektivi nuk është të krijojmë një aplikacion që merr një prompt, thërret disa API dhe bashkon disa imazhe në një video.

Objektivi është të ndërtojmë një sistem që kupton një histori, e transformon në skena vizuale, krijon personazhe dhe ambiente, planifikon veprimet, kontrollon kamerën dhe prodhon një video finale me vazhdimësi vizuale dhe narrative.

Sistemi duhet të ketë:

- Inteligjencë për interpretimin e historisë.
- Planifikim të strukturuar të skenave.
- Gjenerim dhe menaxhim të aseteve vizuale.
- Katër Engine të specializuara.
- Një sistem determinist për kompozimin dhe ekzekutimin e skenave.
- Një sistem audio dhe narracioni.
- Një Renderer të kontrolluar nga vetë arkitektura e Erkasa-s.
- Quality Control dhe automatizim të procesit të prodhimit.

Parimi kryesor: AI vendos dhe krijon aty ku kërkohet inteligjencë gjeneruese. Engine-t dhe koordinimi determinist sigurojnë që rezultatet të jenë të kontrollueshme, të riprodhueshme dhe të renderueshme.

## 2. Arkitektura e përgjithshme

Arkitektura ndahet në tetë shtresa.

1. User Interface & Project Management.
2. Core Backend & Production Orchestration.
3. AI Intelligence Layer.
4. Creative Planning & Production Workers.
5. Four Specialized Engines.
6. Scene Composition & Timeline.
7. Audio & Rendering.
8. Quality Control & Delivery.

### 2.1 Arkitektura e propozuar

```
                  USER
                    |
                    v
             ERKASA WEB APP
             React + TypeScript
                    |
                    v
          SPRING BOOT CORE API
             Java 21
                    |
          PROJECT MANAGEMENT
          JOB ORCHESTRATION
          CREDITS / BILLING
          AUTHENTICATION
                    |
                    v
             RABBITMQ
           JOB QUEUE SYSTEM
                    |
                    v
        AI INFERENCE GATEWAY
          MODEL ROUTER
                    |
          +---------+---------+
          |                   |
          v                   v
      LLM MODELS          IMAGE MODELS
       GPU HOSTING         GPU HOSTING
          |                   |
          +---------+---------+
                    |
                    v
           CREATIVE PIPELINE
                    |
       +------------+------------+
       |            |            |
       v            v            v
    SCRIPT      STORYBOARD    SCENE PLANNING
       |            |            |
       +------------+------------+
                    |
                    v
              FOUR ENGINES
                    |
       +------------+------------+
       |            |            |
       v            v            v
  WORLD BUILDER  CHARACTER    CINEMATIC
                 ACTING        CAMERA
       |
       v
  ENVIRONMENTAL MOTION & FX
                    |
                    v
           SCENE COMPOSITION
                    |
                    v
             TIMELINE / STAGER
                    |
                    v
             AUDIO PIPELINE
                    |
                    v
              RENDER ENGINE
                    |
                    v
               QC / GATE
                    |
             +------+------+
             |             |
             v             v
          APPROVED       FAILED
             |
             v
         FINAL VIDEO
             |
             v
        USER DELIVERY
```

Kjo është ndarja logjike. Në implementim, katër Engine-t mund të punojnë paralelisht kur varësitë e skenës e lejojnë.

> *Shënim (2026-11-19):* në standardin e Engine-ve §8, Gate-i para render-it (pre-render) vepron mbi paketën e Stager-it, para Render Engine; QC pas render-it vepron mbi videon. Diagrami tregon rrjedhën logjike, jo rendin e kontrolleve (shih §10).

## 3. Infrastructure & Core Backend

Kjo është baza që mban të gjithë sistemin.

### 3.1 Frontend

Teknologjia: React, TypeScript, Vite.

Përgjegjësitë:

- User authentication.
- Krijimi dhe menaxhimi i projekteve.
- Prompt input.
- Script review dhe approval.
- Production progress.
- Video preview.
- Credits dhe billing.
- Final video delivery.

Frontend nuk duhet të ketë logjikë të prodhimit të videos. Ai komunikon me Core API.

### 3.2 Core Backend

Teknologjia: Java 21, Spring Boot, PostgreSQL.

Core Backend është autoriteti kryesor i sistemit.

Ai zotëron:

- Users.
- Projects.
- Project settings.
- Job lifecycle.
- Credits.
- Payments.
- Permissions.
- Production status.
- Artifact metadata.
- Error handling.

Core Backend nuk duhet të kryejë drejtpërdrejt gjenerimin e imazheve ose renderimin e videos.

Ai menaxhon procesin dhe delegon punën.

### 3.3 Production Orchestrator

Ky komponent koordinon gjithë procesin.

Përgjegjësitë:

- Dërgimi i jobs në RabbitMQ.
- Menaxhimi i varësive.
- Parallel execution.
- Retry policies.
- Job status transitions.
- Timeout handling.
- Recovery pas restart.
- Failure management.
- Refund kur një job dështon sipas politikës së sistemit.

Duhet të kemi state machine të qartë për çdo projekt.

Shembull:

```
CREATED
   |
SCRIPT_PENDING
   |
SCRIPT_READY
   |
STORYBOARD_READY
   |
ASSETS_PENDING
   |
ASSETS_READY
   |
SCENES_READY
   |
AUDIO_READY
   |
RENDERING
   |
QC_PENDING
   |
APPROVED
   |
COMPLETED
```

Statuset e dështuara dhe të anuluara duhet të jenë pjesë e kontratës së lifecycle-it.

> *Shënim (MA-O4):* Orchestrator-i aktual ekzekuton një DAG hapash me paralelizëm. Propozimi është që statuset e mësipërme të nxirren nga gjendja e DAG-ut, jo të zëvendësojnë DAG-un. Vendoset pas G0.

### 3.4 RabbitMQ

RabbitMQ përdoret për komunikimin asinkron ndërmjet komponentëve.

Nuk duhet të kalojmë imazhe ose video të mëdha përmes queue.

Queue mbart:

- Job ID.
- Project ID.
- Artifact references.
- Contract version.
- Execution metadata.

Worker merr detyrën, punon dhe ruan rezultatin në storage.

### 3.5 SeaweedFS

SeaweedFS është storage layer për asetet dhe rezultatet.

Duhet të ruajë:

- Generated images.
- Character assets.
- Backgrounds.
- Props.
- Audio.
- Captions.
- Scene artifacts.
- Render outputs.
- Preview videos.
- Final MP4.

Çdo artifact duhet të ketë metadata, version dhe lidhje me projektin përkatës.

> *Shënim (MA-O3):* sot artefaktet ruhen në disk lokal me metadata në PostgreSQL. SeaweedFS nuk ekziston në repository.

## 4. AI Inference Architecture

Kjo është një nga pjesët më të rëndësishme të planit të ardhshëm.

Erkasa duhet të jetë e pavarur nga një AI provider i vetëm.

### 4.1 AI Inference Gateway

Ndërtojmë një gateway që komunikon me modelet AI.

Ai duhet të menaxhojë:

- LLM inference.
- Image generation.
- Model selection.
- Model routing.
- GPU availability.
- Request validation.
- Timeouts.
- Retry.
- Model versions.
- Usage tracking.

Worker-at nuk duhet të varen drejtpërdrejt nga një provider specifik.

Ata komunikojnë me kontrata të qëndrueshme.

> *Shënim (MA-O2):* forma e parë mund të jetë adapteri ekzistues `ai-worker/src/llm.ts`, i zgjeruar për imazhe dhe i konfigurueshëm nga `.env`. Vendoset pas G0.

### 4.2 GPU Infrastructure – RunPod

> *Shënim (MA-D3):* asnjë GPU nuk merret me qira para provave të G0.

GPU-të me qira në RunPod do të përdoren për modelet që duam të hostojmë vetë.

Ndarja e propozuar:

**LLM GPU Worker**, për:

- Creative reasoning.
- Script generation.
- Scene planning.
- Storyboard generation.
- Structured JSON generation.

Mund të përdorim një model të familjes Qwen ose një model tjetër që kalon benchmark-un tonë.

vLLM mund të përdoret për inference serving.

**Image Generation GPU Worker**, për:

- Character generation.
- Environment generation.
- Props.
- Scene backgrounds.
- Visual assets.

ComfyUI mund të përdoret si workflow execution layer, me një model imazhi të zgjedhur sipas benchmark-ut, p.sh. Z-Image-Turbo.

Parimi: Nuk zgjedhim një model vetëm sepse është popullor. E zgjedhim sipas cilësisë, kohës, kostos dhe licencës (MA-O5).

### 4.3 GPU Worker Architecture

GPU Workers duhet të jenë:

- Stateless sa herë që është e mundur.
- Të pavarur nga Core Backend.
- Të kontrolluar nga queue.
- Të aftë për të raportuar progress.
- Të aftë të ruajnë output-et në storage.
- Të zëvendësueshëm pa ndryshuar pipeline-in.

Duhet të mbështesim GPU lifecycle management dhe kontrollin e kostos.

Nuk duhet të mbajmë GPU të ndezura pa arsye kur nuk ka kërkesa.

## 5. Creative Production Pipeline

Kjo shtresë transformon prompt-in në një plan konkret prodhimi.

### 5.1 Creative Director

Creative Director interpreton kërkesën e përdoruesit.

Përcakton:

- Narrative direction.
- Video format.
- Visual style.
- Story structure.
- Scene objectives.
- Production constraints.

Ai nuk krijon vetë çdo aset dhe nuk kontrollon drejtpërdrejt renderer-in.

Output-i duhet të jetë një kontratë e strukturuar.

### 5.2 Script Worker

Përgjegjësitë:

- Krijimi i narracionit.
- Storytelling.
- Hook.
- Narrative progression.
- Explanations.
- Ending.
- Duration estimation.

Script duhet të kalojë në review përpara se të fillojë prodhimi i aseteve.

Miratimi njerëzor është një checkpoint i detyrueshëm në këtë fazë.

### 5.3 Storyboard Worker

Transformon skenarin në një strukturë vizuale.

Përcakton:

- Scene sequence.
- Visual objectives.
- Characters.
- Locations.
- Actions.
- Narrative transitions.
- Required assets.

Storyboard duhet të jetë i lidhur me versionin e miratuar të skenarit.

### 5.4 Scene Planning Worker

Këtu ndodh planifikimi teknik i skenave.

Përcakton:

- Scene duration.
- Character placement intent.
- Object requirements.
- Spatial relationships.
- Camera intent.
- Action sequence.
- Environment requirements.

Scene Planning nuk duhet të ndërtojë timeline-in final. Ai prodhon planin e skenës që më pas ekzekutohet nga Engine-t.

### 5.5 Asset Generation Worker

Ky Worker koordinon gjenerimin e aseteve.

Ai përdor AI Image Generation për të krijuar ose për të marrë asetet e nevojshme.

Duhet të kemi:

- Character identity consistency.
- Environment consistency.
- Asset reuse.
- Style constraints.
- Transparent assets kur kërkohen.
- Asset validation.
- Versioning.

Gjenerimi i një personazhi nuk duhet të bëhet nga e para në çdo skenë.

Duhet të ekzistojë një identitet vizual i qëndrueshëm.

> *Shënim (MA-O1):* për personazhet, imazhi statik duhet kthyer në personazh me pjesë dhe rig që Character Acting mund ta animojë. Rruga zgjidhet pas G0.

## 6. Four Specialized Engines

Këto janë katër sistemet krijuese që duhet të përbëjnë avantazhin teknik të Erkasa-s.

Nuk janë thjesht module me emra. Secili duhet të ketë kontrata, përgjegjësi, input, output dhe teste të veta. Standardi i detajuar: `docs/standards/engines-standard-v2.md`.

### 6.1 World Builder Engine

Misioni: Të krijojë dhe menaxhojë botën vizuale ku zhvillohet historia.

Përgjegjësitë:

1. Environment generation.
2. Spatial layout.
3. Architecture.
4. Object placement.
5. Scene depth.
6. Foreground / midground / background.
7. Spatial consistency.
8. Environment continuity.
9. Environment reuse.

World Builder duhet të kuptojë që një dhomë nuk është thjesht një imazh background.

Ajo përmban hapësirë, objekte, pozicione dhe marrëdhënie ndërmjet elementeve.

Duhet të prodhojë një përfaqësim të strukturuar të botës.

Objektivi final: Skena të kenë ambient koherent dhe personazhet të mos duken sikur janë vendosur rastësisht mbi një background.

### 6.2 Character Acting Engine

Misioni: Të prodhojë veprime dhe sjellje të lexueshme për personazhet.

Përgjegjësitë:

1. Character rigging.
2. Pose generation.
3. Walking.
4. Gestures.
5. Body mechanics.
6. Anticipation.
7. Weight transfer.
8. Object interaction.
9. Character-to-character interaction.
10. Emotional body language.

Ky Engine është një nga sfidat më të mëdha.

Një personazh që lëviz krahun nuk do të thotë se po aktron.

Duhet të ketë qëllim, reagim, peshë dhe marrëdhënie me objektet.

Për të arritur nivel profesional mund të kërkohen:

- Rigging më i avancuar.
- Animation libraries.
- Motion capture ose animacion i autorizuar.
- Procedural animation.
- Pose interpolation.
- IK dhe kontroll i lëvizjes.

Kodi vetëm nuk mund të zëvendësojë të dhënat dhe mjeshtërinë e animacionit.

Objektivi final: Personazhe që duken sikur veprojnë, jo figura që thjesht ndryshojnë pozicion.

### 6.3 Cinematic Camera Engine

Misioni: Të tregojë historinë nëpërmjet kamerës.

Përgjegjësitë:

1. Shot selection.
2. Framing.
3. Camera positioning.
4. Camera movement.
5. Zoom.
6. Pan.
7. Tracking.
8. Orbit.
9. Subject focus.
10. Camera transitions.
11. Narrative camera motivation.

Kamera duhet të kuptojë rëndësinë e veprimit.

Për shembull:

- Kur personazhi merr një objekt, kamera mund të fokusohet te duart.
- Kur dy personazhe përballen, kamera duhet të ruajë marrëdhënien hapësinore.
- Kur shfaqet një element i rëndësishëm, kamera duhet ta drejtojë vëmendjen te ai.

Objektivi final: Video që duken të drejtuara nga një regjisor dhe jo si slideshow me lëvizje.

### 6.4 Environmental Motion & FX Engine

Misioni: Të krijojë jetë dhe lëvizje në ambient.

Përgjegjësitë:

1. Wind.
2. Rain.
3. Snow.
4. Fire.
5. Smoke.
6. Dust.
7. Atmospheric particles.
8. Environmental reactions.
9. Secondary motion.
10. Lighting effects.

Ky Engine nuk duhet të jetë prioritet përpara tri Engine-ve të tjera.

Fillimisht duhet të kemi ambient dhe karakter të besueshëm. Efektet atmosferike nuk e shpëtojnë një skenë të dobët.

Objektivi final: Ambiente që duken të gjalla dhe jo statike.

## 7. Scene Composition & Timeline

Kjo shtresë bashkon rezultatet e katër Engine-ve.

Duhet të jetë një nga pjesët më deterministe të arkitekturës.

### 7.1 Scene Composition Worker

Përgjegjësitë:

- Marrja e rezultateve nga Engine-t.
- Validimi i kontratave.
- Zgjidhja e konflikteve hapësinore.
- Organizimi i elementeve të skenës.
- Përgatitja e scene data për Stager.

Nuk duhet të ketë një logjikë të dytë Character Acting ose Camera.

Ai koordinon rezultatet, nuk zëvendëson Engine-t.

### 7.2 Stager & Timeline Builder

Stager zotëron ndërtimin e paketës finale të render-it dhe timeline-in përfundimtar (MA-D5).

Ai merr:

- Scene data.
- Character animation data.
- Camera instructions.
- Environment layers.
- Object states.
- Audio timing.
- Captions.
- Transitions.

Pastaj ndërton një timeline të versionuar dhe të vlefshëm për renderer-in.

Ky është burimi i vetëm autoritativ për timing-un final.

Nuk duhet të kemi disa komponentë që ndërtojnë timeline të ndryshëm dhe pastaj përpiqen t'i sinkronizojnë.

## 8. Audio & Narration Pipeline

Kjo shtresë merret me përmbajtjen audio.

**Voice Generation**

- Text-to-speech.
- Voice selection.
- Language.
- Pronunciation.
- Audio generation.

ElevenLabs mund të ruhet si provider për voice generation.

**Audio Processing**

- Audio trimming.
- Normalization.
- Timing.
- Music integration.
- Sound effects.
- Audio synchronization.

**Caption Generation**

- Caption segmentation.
- Word timing.
- Subtitle positioning.
- Synchronization.

Whisper mund të përdoret për transkriptim dhe verifikim, kur është e nevojshme.

Të gjitha rezultatet duhet të lidhen me timeline-in e Stager-it.

## 9. Renderer Architecture

Renderer është sistemi që ekzekuton paketën e përgatitur nga Stager.

Duhet të jetë i pavarur nga AI inference.

Përgjegjësitë:

1. Scene execution.
2. Layer compositing.
3. Character animation rendering.
4. Camera transformations.
5. Object rendering.
6. Environmental effects.
7. Typography.
8. Audio synchronization.
9. Frame generation.
10. Video encoding.

Renderer duhet të jetë determinist sa më shumë që lejon teknologjia.

Duhet të mund të riprodhojë një render me të njëjtat inputs, assets dhe versions.

Arkitektura nuk duhet të lidhet me Remotion vetëm sepse është një teknologji e njohur. Duhet të ruhet kontrolli mbi engine-in ekzistues të Erkasa-s.

FFmpeg mund të përdoret për media encoding dhe operacione të specializuara, nëse përputhet me arkitekturën.

Objektivi final: Renderer që mund të prodhojë video profesionale pa pasur nevojë që AI të vendosë çdo frame në momentin e renderimit.

## 10. Quality Control System

QC duhet të jetë pjesë e pipeline-it, jo një kontroll i shtuar në fund.

Duhet të kemi dy nivele.

### 10.1 Pre-render Gate

Kontrollon:

- Contract validity.
- Missing assets.
- Invalid geometry.
- Out-of-bounds elements.
- Timeline conflicts.
- Audio duration.
- Caption timing.
- Unsupported scene instructions.
- Renderer compatibility.

Nëse një dështim kritik ekziston, renderimi nuk fillon.

### 10.2 Post-render QC

Kontrollon videon e prodhuar:

- Black frames.
- Missing elements.
- Flicker.
- Visual discontinuity.
- Character sliding.
- Broken animation.
- Audio clipping.
- Caption errors.
- Incorrect duration.
- Scene transition failures.

Duhet të krijojmë contact sheets dhe një AI Critic që vlerëson rezultatet.

Por AI Critic nuk duhet të jetë gjykatësi i vetëm.

Pranimi final kërkon:

- Automated tests.
- Visual inspection.
- Golden videos.
- Quality scorecard.
- Zero critical failures.

## 11. Global Style Bible

Të katër Engine-t duhet të ndajnë të njëjtin sistem vizual.

Style Bible duhet të përcaktojë:

- Visual language.
- Character proportions.
- Color palette.
- Lighting rules.
- Background treatment.
- Line weight.
- Texture.
- Typography.
- Camera language.
- Motion principles.

Çdo skenë duhet të trashëgojë të njëjtin identitet vizual.

Style Bible duhet të jetë një kontratë e versionuar, jo një dokument që AI e interpreton ndryshe çdo herë. Drafti fillestar: standardi i Engine-ve §9.

## 12. Asset Governance & Licensing

Çdo aset duhet të ketë metadata:

- Source.
- Generation model.
- Model version.
- Creation date.
- License.
- Commercial usage rights.
- Project association.
- Asset version.

Duhet të kontrollojmë licencat e modeleve AI, fontet, muzikën, sound effects dhe asetet e jashtme.

Asnjë aset nuk duhet të konsiderohet automatikisht i licencuar për përdorim komercial vetëm sepse është gjeneruar nga AI.

## 13. Cost & Performance Architecture

Erkasa duhet të kontrollojë koston për çdo video.

Duhet të matim:

- LLM inference cost.
- Image generation cost.
- GPU execution time.
- Voice generation cost.
- Storage cost.
- Rendering time.
- Retry cost.
- Total cost per video.

Gjithashtu:

- Max concurrent jobs.
- GPU queue latency.
- Worker throughput.
- Failure rate.
- Average generation time.
- Storage growth.

Nuk mund të ndërtojmë një produkt komercial pa ditur sa kushton prodhimi i një videoje.

## 14. Roadmap – Nga arkitektura te Video Generation

Kjo është ndarja e propozuar e fazave të zhvillimit.

> *Shënim (MA-D2, MA-D4):* G0 përfshin Fazat 1–3 dhe është vetëm zbulim dhe verifikim. Fazat G1–G8 janë kandidate. Rendi i tyre vendoset nga provat e G0 dhe secila kërkon miratim të veçantë.

**G0 – Architecture Audit & Design** (zbulim dhe verifikim, pa implementim)

- Audit i gjithë repository-t.
- Verifikim i komponentëve ekzistues.
- Standardizim i kontratave (në dokument).
- Identifikim i moduleve që mungojnë.
- AI/GPU architecture design (në dokument).
- Cost estimation.
- Përfshin: Faza 1 – Standard v2.0; Faza 2 – Engine Audit; Faza 3 – Integrated Benchmark.

Rezultati: Një arkitekturë e miratuar, një hartë e saktë e implementimit dhe harta e bottleneck-ëve me prova.

**G1 – GPU Image Infrastructure**

- Krijimi i GPU image worker.
- RunPod deployment.
- Model installation.
- Image generation API.
- Storage integration.
- Benchmark i imazheve.
- Performance testing.

Rezultati: Erkasa mund të përdorë një sistem të vetin për gjenerimin e imazheve.

**G2 – GPU LLM Infrastructure**

- Model selection.
- vLLM deployment.
- LLM inference API.
- Structured output.
- Model routing.
- Benchmark kundrejt nevojave të Creative Pipeline.

Rezultati: LLM inference i hostuar nga infrastruktura jonë.

**G3 – Core Integration**

- AI Gateway integration.
- Worker communication.
- RabbitMQ integration.
- Artifact storage.
- Job status.
- Failure handling.
- Monitoring.

Rezultati: AI infrastruktura mund të përdoret nga pipeline-i i Erkasa-s.

**G4 – Creative Production Pipeline**

- Creative Director.
- Script.
- Storyboard.
- Scene Planning.
- Asset Generation.
- Audio pipeline.

Rezultati: Prompt-i transformohet në një plan prodhimi të strukturuar.

**G5 – Four Engine Maturity**

- World Builder.
- Character Acting.
- Cinematic Camera.
- Environmental Motion & FX.

Çdo Engine zhvillohet dhe auditohet sipas standardit përkatës.

Rezultati: Aftësi vizuale të verifikuara dhe të integruara.

**G6 – Scene Composition & Rendering**

- Scene Composition.
- Stager.
- Timeline.
- Renderer integration.
- Audio synchronization.
- Final output.

Rezultati: Pipeline i plotë nga scene data te video finale.

**G7 – Quality, Reliability & Recovery**

- Pre-render Gate.
- Post-render QC.
- AI Critic.
- Golden benchmark.
- Render recovery.
- Watchdog.
- Retry policies.
- Cost monitoring.

Rezultati: Sistem që mund të prodhojë video në mënyrë të qëndrueshme dhe të kontrollueshme.

**G8 – Production Scaling**

- Concurrent GPU workers.
- Autoscaling.
- Queue optimization.
- GPU cost optimization.
- Monitoring.
- Production deployment.
- User load testing.

Rezultati: Një platformë e gatshme për përdorues realë dhe ngarkesë komerciale.

## 15. Në çfarë niveli mund të arrijë Erkasa Studio?

Kjo është pjesa më e rëndësishme e auditit.

Duhet të dallojmë katër nivele të ndryshme.

**Level 1 – Automated Video Assembly**

Prompt → Script → Images → Voice → Captions → Video.

Ky është niveli bazë.

Sistemi mund të prodhojë video, por lëvizjet dhe ndërveprimet mund të jenë të kufizuara.

**Level 2 – Structured Editorial Motion**

Skena të organizuara, kompozim më i mirë, kamera e kontrolluar, animacione, personazhe dhe elemente grafike.

Video nuk është më thjesht një slideshow.

Ky është një nivel real i një produkti editorial video.

**Level 3 – Advanced 2D Animation Production**

Ky është objektivi kryesor që do t'i vendosja Erkasa-s.

Karakteristikat:

- Personazhe me acting të lexueshëm.
- Ndërveprime me objekte.
- Ambiente të ndërtuara në mënyrë koherente.
- Kamera me motiv narrativ.
- Environmental animation.
- Scene continuity.
- Professional editorial storytelling.
- Kontroll mbi kompozimin dhe ritmin.

Në këtë nivel mund të prodhojmë video edukative, historike, biznesi, psikologjike dhe shpjeguese me identitet vizual të qëndrueshëm.

**Level 4 – Advanced AI Animation Studio**

Ky është objektiv afatgjatë.

Do të kërkonte:

- Rigging dhe animation systems shumë më të avancuara.
- Motion generation më të sofistikuar.
- Complex multi-character interactions.
- Advanced procedural environments.
- More expressive animation.
- Advanced visual direction.
- Automated visual quality optimization.

Ky nivel kërkon kërkim dhe zhvillim të vazhdueshëm. Nuk arrihet vetëm duke përfunduar roadmap-in fillestar.

> *Shënim (MA-O6):* vlerësimi fillestar i gjendjes aktuale është rreth Level 2. Konfirmohet ose korrigjohet nga G0.

## 16. Kufijtë e produktit që duhet të kemi parasysh

Erkasa Studio, sipas këtij projekti, duhet të fokusohet në 2D editorial animation dhe motion-based storytelling.

Nuk duhet të pretendojmë se po ndërtojmë një alternativë të drejtpërdrejtë ndaj modeleve text-to-video si Sora apo Veo.

Këto janë probleme të ndryshme teknike.

Avantazhi i Erkasa-s duhet të jetë kontrolli mbi:

- Historinë.
- Personazhet.
- Ambientet.
- Veprimet.
- Kamerën.
- Timeline-in.
- Kompozimin.
- Rezultatin final.

Ky kontroll mund të jetë më i vlefshëm për prodhim editorial sesa gjenerimi i pakontrolluar i videove.

## 17. Kritere për përfundimin e projektit

Unë nuk do ta konsideroja Erkasa-n të përfunduar vetëm sepse të gjitha fazat janë implementuar.

Duhet të kemi prova.

| Kriteri | Kushti i pranimit |
| ------- | ----------------- |
| Prompt-to-video | Pipeline funksionon nga fillimi në fund |
| Script | Narracion i strukturuar dhe i miratuar |
| Character Acting | Veprime të lexueshme dhe pa dështime kritike |
| World Builder | Ambiente koherente |
| Camera | Framing dhe lëvizje me motiv |
| Environmental Motion | Efekte të kontrolluara |
| Composition | Skena pa konflikte kritike |
| Timeline | Sinkronizim i saktë |
| Renderer | Rezultat i riprodhueshëm |
| QC | Zero critical failures |
| Reliability | Recovery dhe retry të verifikuara |
| Economics | Kosto e matur për video |

Benchmark-u duhet të përfshijë pesë video me skena dhe vështirësi të ndryshme.

Çdo video duhet të ruhet si golden benchmark dhe të përdoret për regresion pas ndryshimeve të Engine-ve.

## 18. Vendimi përfundimtar

Nëse do të isha përgjegjës për arkitekturën teknike të Erkasa Studio, do të merrja këto vendime:

1. Do të ruaja ndarjen Core Backend / Workers / AI Gateway / Engines / Renderer.
2. Nuk do të ndërtoja një monolit që bën gjithçka.
3. Nuk do të lejoja që Workers të kopjonin logjikën e Engine-ve.
4. Do të përdorja GPU me qira për modelet që kanë kuptim ekonomikisht.
5. Do të ruaja kontratat e versionuara ndërmjet çdo shtrese.
6. Do të mbaja AI jashtë ekzekutimit determinist të renderer-it.
7. Do të vendosja Character Acting, World Builder dhe Cinematic Camera si prioritetet kryesore të cilësisë.
8. Do të ruaja një sistem të vetëm për timeline-in final.
9. Do të kërkoja prova vizuale për çdo pretendim se një aftësi është përfunduar.
10. Nuk do të zgjeroja funksionalitetet pa matur cilësinë e videos finale.

### Objektivi që do të ndiqja

Erkasa Studio – A Proprietary AI-Native 2D Animation & Video Production Engine.

Një sistem që merr një ide dhe e transformon në një prodhim vizual të strukturuar, me personazhe, ambiente, veprime, kamera, audio dhe kompozim profesional.

Niveli që do të synoja si produkt të parë serioz është Level 3 – Advanced 2D Animation Production.

Level 4 do të ishte drejtimi afatgjatë i R&D.

**Shënim arkitekturor:** Ky dokument është vizioni dhe propozimi teknik. Nuk pretendon se të gjitha këto komponentë ekzistojnë aktualisht në repository. Para implementimit, çdo pjesë duhet krahasuar me kodin, testet, kontratat dhe videot reale të Erkasa-s. Ky dokument nuk autorizon ndryshime automatike në arkitekturën ekzistuese (§0.1).
