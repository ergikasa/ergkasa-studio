# E1.5 · Rruga Render Package → Gate → Engine në pipeline-in kryesor: plani teknik

| Fusha    | Vlera                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Statusi  | **Plan për miratim. Pa kod.** Implementimi fillon vetëm pas miratimit të veçantë të PO-së.                                                  |
| Data     | 2026-11-18                                                                                                                                  |
| Baza     | E1.4 e pranuar (2026-11-17): `e1-4-engine-reads-package` @ `757464a`; `main` = `7f8ffca`                                                    |
| Branch-i | `e1-5-pipeline-integration` (nga `757464a`; ky commit përmban vetëm këtë plan)                                                              |
| Qëllimi  | `pnpm video` (CLI) dhe worker-i prodhojnë MP4 reale nga **Planning → Stager → Render Package + Manifest → Gate → Engine**, me zë dhe muzikë |

**[F]** fakt nga kodi · **[S]** vlerësim · **[R]** rekomandim · **[D]** vendim që kërkohet nga PO-ja.

---

## 1. Gjendja sot

### 1.1 Rruga që prodhon videot sot (default)

```
ai-worker make / worker
  stepFilmPlan   → film-plan.json (director, AI)
  stepFilmRender → film/src/film.ts makeFilm
                     prepare (timing, perform, compose)  ← alignments + clipDurations e zërit
                     sound.ts writeBed                   ← muzikë sintetike + SFX nga `composed`
                     render.ts renderFilm                ← shot-e paralel në procese fëmijë, concat,
                                                           mix: zë (adelay, amix) + bed (volume 0.55,
                                                           sidechaincompress) + loudnorm I=-14 TP=-1.5,
                                                           AAC 48 kHz
  → <run>/video.mp4
```

[F] Thirrësit e `stepFilmRender`/`makeFilm`:

- `ai-worker/src/make.ts`, që është CLI-ja `pnpm video`;
- `ai-worker/src/worker.ts`, që është rruga MQ;
- `ai-worker/src/audio-tools.ts` (`rerender`, `audio-mix`).

### 1.2 Rruga e E1.4 (e pranuar, jo default)

```
stager/src/v2.ts stageV2(name, plan, script) → { pkg, manifest }
film/src/package/render.ts renderPackage      → Gate (validate + G16) → kuadro → ffmpegSink (-an)
```

### 1.3 Boshllëqet që E1.5 duhet të mbyllë

| #   | Boshllëku                                                                                                                                                                                                                    | Fakti                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| G1  | **Koha e zërit.** `stageV2` thërret `prepareV2({ plan, script })` pa `alignments` dhe `clipDurations`. Kohët e fjalëve dalin të vlerësuara, jo nga zëri real.                                                                | [F] `stager/src/v2.ts:130`; `film-steps.ts voiceTimings`         |
| G2  | **Audio.** Paketa ka `audio: []`. Capabilities publikojnë `output.audio: false` dhe Gate-i refuzon çdo klip audio. Renderer-i del `-an`. Bed-i (muzikë + SFX) dhe miksi jetojnë vetëm te rruga e vjetër.                     | [F] `stageV2` `audio: []`; `executable.ts` (audio); `ffmpegSink` |
| G3  | **Miksi nuk shprehet plotësisht në kontratë.** `Mix` ka vetëm `duckMusicDb` dhe `loudness`. Rruga e vjetër bën ducking me `sidechaincompress` (threshold 0.03, ratio 6, attack 80, release 500), jo me një ulje fikse në dB. | [F] `contracts/src/render-package.ts Mix`; `film/src/render.ts`  |
| G4  | **Shpejtësia.** Rruga e vjetër renderon shot-et paralelisht në procese fëmijë (`ERKASA_RENDER_WORKERS`, default 2). `renderPackage` renderon në një proces të vetëm.                                                         | [F] `render.ts renderFilm`; `package/render.ts`                  |
| G5  | **Artefaktet e run-it.** Paketa, manifesti dhe raporti i Gate-it nuk ruhen në dosjen e run-it.                                                                                                                               | [F]                                                              |
| G6  | **`stager/src/legacy.ts`** importon brendinë e `film` (compose, perform, timing, props, templates), dhe kamera e B1–B5 jepet e "pjekur". Të dyja ishin shtyrë nga E1.3/E1.4 për E1.5.                                        | [F] `stager/src/legacy.ts`; raporti i E1.4 §5.3                  |
| G7  | **W0** ka CLI-në e vet (`film/src/w0/cli.ts`) dhe nuk është pjesë e pipeline-it kryesor.                                                                                                                                     | [F]                                                              |

---

## 2. Rruga e synuar

```
ai-worker make / worker (njësoj deri te film-plan.json)
  stepStage   → <run>/package/render.json + assets.json      (Stager; kohët nga zëri real; audio e vendosur)
                <run>/package/audio/voice-*.wav, bed.wav     (asete audio me sha256)
  stepGate    → <run>/package/gate.json                      (raporti i Gate-it; refuzimi ndalon run-in)
  stepRender  → <run>/video.mp4                              (Engine: kuadro + miksi nga paketa)
```

Parimet:

1. **Engine-i njeh vetëm paketën.** Ai nuk shikon plan, script ose zë si të dhëna të planifikimit, vetëm asete të verifikuara.
2. **Pa rënie te rruga e vjetër.** Nëse Gate-i refuzon, run-i dështon me gjetjet e Gate-it, 0 kuadro, dhe encoder-i nuk niset. Nuk renderohet "me rrugën e vjetër".
3. **Kalimi bëhet me flamur.** `ERKASA_PIPELINE=package|legacy` (dhe `--pipeline` te CLI). Default-i mbetet `legacy` gjatë gjithë E1.5. Ndërrimi i default-it është hapi i fundit dhe kërkon miratimin tënd (D2).
4. **Paketa ruhet në run.** `rerender` mund të rindërtojë videon nga paketa e ruajtur, pa ri-stage.

---

## 3. Vendimet që kërkohen nga PO-ja

| #      | Pyetja                                           | Opsionet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | [R]                                                                                                                                                                                                                         |
| ------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Ku jeton audio?                                  | **(a)** Në paketë. Stager-i shkruan zërin dhe bed-in si asete `audio` dhe si klipe `audio`. Engine-i merr aftësinë `output.audio: true` dhe bën miksin. Kjo është zgjerim i Engine-it, por pa ndryshim skeme (`AudioAsset`, `AudioClip` dhe `Mix` ekzistojnë). **(b)** Engine-i mbetet pa zë. Një hap i `ai-worker` e bashkon videon pa zë me audio-n e rrugës së vjetër. Ndryshon më pak, por paketa nuk përshkruan më videon e plotë.                                                 | **(a)**: kontrata e E1 thotë që Render Package mban `audio`. Me (b), Gate-i nuk do ta kontrollonte zërin.                                                                                                                   |
| **D2** | Si shprehet ducking-u (G3)?                      | **(a)** Zgjerim i vogël i kontratës `Mix`: `duck: { kind: "sidechain", threshold, ratio, attackMs, releaseMs }` (i ri, opsional, `erkasa.render/1` mbetet, fushë e re me versionim minor) dhe `music.gainDb` = −5,19 dB (= 0,55). **(b)** Pa ndryshim kontrate: Engine-i e deklaron semantikën e `duckMusicDb` si sidechain-in e sotëm me vlera fikse te capabilities, dhe Stager-i shkruan `duckMusicDb` që e zgjedh atë. **(c)** Ducking me ulje fikse në dB (zëri ndryshon nga sot). | **(b)** për E1.5: zero ndryshim skeme, i njëjti zë si sot, semantika e publikuar si te captions. (a) mbetet për më vonë, kur të ketë muzikë reale.                                                                          |
| **D3** | Kur ndërrohet default-i?                         | **(a)** Në fund të E1.5, pas pranimit të provave të barazisë (§5), me commit të veçantë. **(b)** Në një fazë më vete.                                                                                                                                                                                                                                                                                                                                                                   | **(a)**, por vetëm me miratimin tënd të veçantë mbi provat e §5. Deri atëherë default-i mbetet `legacy`.                                                                                                                    |
| **D4** | G6: heqja e `legacy.ts` dhe kamera e papërpunuar | **(a)** Brenda E1.5. **(b)** Në **E1.6**, pasi rruga e paketës të jetë default dhe e provuar.                                                                                                                                                                                                                                                                                                                                                                                           | **(b)**: E1.5 mbetet integrim. Heqja e kodit të vjetër, para se rruga e re të jetë default, rrezikon të dyja rrugët njëkohësisht.                                                                                           |
| **D5** | Paralelizmi (G4)                                 | **(a)** Renderer-i ndan kuadrot në N pjesë të vazhdueshme, në procese fëmijë. Çdo proces hap të njëjtën paketë të verifikuar dhe nxjerr kuadrot e veta. Prindi i kodon me një encoder të vetëm. **(b)** Një proces: më e thjeshtë, më e ngadaltë.                                                                                                                                                                                                                                       | **(a)**, me provë që hash-et e kuadrove të papërpunuara janë identike me renderimin në një proces. Prindi ekzekuton Gate-in një herë, dhe secili fëmijë e verifikon sërish paketën (hash-et), pa u besuar bajteve të marra. |
| **D6** | W0 (G7)                                          | Jashtë E1.5. W0 nuk hyn në pipeline-in kryesor, sepse director-i nuk prodhon plan W0.                                                                                                                                                                                                                                                                                                                                                                                                   | Jashtë E1.5.                                                                                                                                                                                                                |

---

## 4. Hapat e implementimit (pas miratimit)

Çdo hap ka commit-in dhe testet e veta. Golden baselines nuk preken. Default-i mbetet `legacy` deri në hapin S9.

| Hapi   | Puna                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Skedarët kryesorë                                                                                                      | Testet                                                                                                                                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** | **Kohët e zërit te Stager-i (G1).** `stageV2(name, plan, script, voice?)`, ku `voice = { alignments, clipDurations }` kalon te `prepareV2`. Pa `voice`, sjellja mbetet e njëjtë, ndaj B1–B5 nuk ndryshojnë.                                                                                                                                                                                                                                                                              | `stager/src/v2.ts`, `stager/src/index.ts`                                                                              | Paketa = `prepare(job)` e rrugës së vjetër për të njëjtat alignments (kohët e skenave dhe të fjalëve, bit për bit). K1 dhe K7 të pandryshuar.                                                                                |
| **S2** | **Audio te Stager-i (D1 a).** Zëri: një aset `audio` (wav, sha256, `durationSec`, `sampleRate`) dhe një klip `voice` për çdo skenë, në `start` = fillimi i skenës sipas `timing`. Bed-i: `writeBed` shkruan `bed.wav` (i njëjti funksion), dhe ai bëhet aset dhe klip `music`. `mix` shkruhet sipas D2.                                                                                                                                                                                  | `stager/src/v2.ts` (klipet), `stager/src/audio.ts` (i ri)                                                              | Klipet dhe kohët = `makeFilm` (`voice[].startSec`, bed). Gate-i i pranon kur `output.audio` është `true` dhe i refuzon me capabilities e sotme.                                                                              |
| **S3** | **Engine-i: aftësia audio (D1 a, D2 b).** Capabilities: `output.audio: true`; `audio.roles` (`voice`, `music`); semantika e miksit e publikuar (filtergraph-i i sotëm). Renderer-i e ndërton miksin vetëm nga `pkg.audio` + `pkg.mix` + bajtet e verifikuara. Gate-i (G16): klipet, rolet, `trim`, `fade`, `pan` që Engine-i nuk zbaton → refuzohen, si te F1. Matrica e fushave (243) përditësohet: `audio.*` dhe `mix.*` kalojnë nga `refused`/`restricted` te `applied`/`restricted`. | `film/src/package/audio.ts` (i ri), `render.ts`, `capabilities.ts`, `capabilities-fields.ts`, `gate/src/executable.ts` | PCM i dekoduar = PCM i rrugës së vjetër për të njëjtat hyrje (§5, P4). Rastet negative të reja në K5. `fields.test.ts` me klasat e reja. T9 përditësohet: renderer-i lexon `audio`/`mix`, por jo fushat që mbeten `refused`. |
| **S4** | **Paralelizmi (D5 a).** `renderPackage({ workers })`: pjesë kuadrosh në procese fëmijë, një encoder.                                                                                                                                                                                                                                                                                                                                                                                     | `film/src/package/render.ts`, `film/src/package/child.ts` (i ri)                                                       | Hash-et e kuadrove me 1, 2 dhe 4 workers janë identike (K7 i zgjeruar). Paketa e refuzuar: 0 procese fëmijë, 0 kuadro.                                                                                                       |
| **S5** | **Hapat e pipeline-it (G5).** `stepStage`, `stepGate`, `stepRender` te `ai-worker/src/package-steps.ts`. Artefaktet ruhen në `<run>/package/`. `make.ts` dhe `worker.ts` zgjedhin rrugën me `ERKASA_PIPELINE`/`--pipeline` (default `legacy`). Raporti i run-it shënon rrugën, hash-in e paketës dhe gjetjet e Gate-it.                                                                                                                                                                  | `ai-worker/src/package-steps.ts` (i ri), `make.ts`, `worker.ts`, `cli.ts`                                              | Testet ekzistuese të `ai-worker` kalojnë pa ndryshim në `legacy`. Testet e reja janë te §5.                                                                                                                                  |
| **S6** | **`rerender` nga paketa.** Nëse run-i ka `package/`, `rerender` e rindërton videon nga paketa e ruajtur, pa ri-stage. `audio-mix` mbetet te rruga e vjetër deri në E1.6.                                                                                                                                                                                                                                                                                                                 | `ai-worker/src/audio-tools.ts`                                                                                         | Rindërtimi jep të njëjtat kuadro (hash) dhe të njëjtin PCM.                                                                                                                                                                  |
| **S7** | **Testi end-to-end (§5).**                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `ai-worker/test/package-e2e.test.ts` (i ri), fixture-at e zërit                                                        | P1–P8                                                                                                                                                                                                                        |
| **S8** | **Raporti dhe provat.** Video para/pas për B1–B5 dhe për një run të ri me zë; raporti; provat në `docs/reports/e1-5/evidence/`.                                                                                                                                                                                                                                                                                                                                                          | `docs/reports/e1-5-…`                                                                                                  | K1–K9 të E1.4 + P1–P10                                                                                                                                                                                                       |
| **S9** | **Ndërrimi i default-it (D3), vetëm me miratimin tënd të veçantë.** `ERKASA_PIPELINE` kalon në `package`. `legacy` mbetet e zgjedhshme deri në E1.6.                                                                                                                                                                                                                                                                                                                                     | `ai-worker/src/env.ts` / `make.ts`                                                                                     | Testet e pipeline-it në të dyja rrugët.                                                                                                                                                                                      |

---

## 5. Testi end-to-end dhe provat e barazisë

### 5.1 Testi E2E (S7): MP4 reale, pa API

- **Hyrja:** një model i skriptuar, si `ai-worker/test/film-worker.test.ts`, që jep script-in dhe film-plan-in. Zëri është një fixture deterministe: `voice-track.json` me alignments, dhe një wav i shkurtër për çdo skenë, i gjeneruar me `ffmpeg` (ton + heshtje). Nuk ka thirrje ElevenLabs dhe nuk ka rrjet.
- **Ekzekutimi:** `make(..., { pipeline: "package" })`, si dhe e njëjta komandë përmes worker-it (`handleCommand`).
- **Dalja që kontrollohet:**

| #      | Kontrolli                                                                                                                                                                                                                                                                               |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1** | `video.mp4` ekziston. `ffprobe`: h264, 1080×1920, 30 fps, `yuv420p`; AAC, 48 kHz, stereo; numri i kuadrove = `output.duration × 30`; kohëzgjatja e audios brenda një kuadri nga ajo e videos.                                                                                           |
| **P2** | `<run>/package/render.json`, `assets.json` dhe `gate.json` ekzistojnë. Gate-i: `ok: true`, 0 gjetje. Çdo aset, edhe audio, ka sha256 që përputhet me skedarin.                                                                                                                          |
| **P3** | **Kuadrot:** hash-et e kuadrove të papërpunuara (RGBA) të rrugës së paketës = hash-et e rrugës së vjetër (`frameAt` + rasterizimi) për të njëjtin run, për çdo kuadër. Krahasohen kuadrot para kodimit, sepse rruga e vjetër kodon për shot dhe i bashkon, ndaj bajtet h264 ndryshojnë. |
| **P4** | **Zëri:** PCM i dekoduar nga `video.mp4` = PCM i rrugës së vjetër për të njëjtat hyrje, mostër për mostër. Nëse koduesi AAC jep ndryshim në bit, kërkohet barazi e PCM-së para kodimit dhe raportohet ndryshimi pas kodimit, pa tolerancë të fshehur.                                   |
| **P5** | **Refuzimi:** paketa e ruajtur prishet qëllimisht (p.sh. `y: "top"` te `type.kinetic`) dhe nisen `stepGate` + `stepRender`. Run-i dështon me `VALUE_UNSUPPORTED` dhe shtegun. Nuk krijohet `video.mp4`, nuk ka kuadro, dhe `ffmpeg` nuk niset (sink-u i spiunuar).                      |
| **P6** | **Pa fallback:** me `pipeline: "package"`, një refuzim i Gate-it nuk thërret kurrë `makeFilm`.                                                                                                                                                                                          |
| **P7** | **Determinizmi:** dy run-e të njëjta, në procese të ndara dhe me 1 e 2 workers, japin paketa identike (bajt për bajt), hash-e kuadrosh identike dhe PCM identike.                                                                                                                       |
| **P8** | **Run pa zë** (`--no-voice`): videoja ka vetëm bed-in (ose asnjë audio me `--no-music`). Gate-i dhe P1 kalojnë.                                                                                                                                                                         |

### 5.2 Provat në nivel projekti (S8)

| #       | Prova                                                                                                                                                                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P9**  | B1–B5 përmes `make --pipeline package` me zërin e tyre të ruajtur (nëse run-et me zë ekzistojnë në repo; përndryshe me fixture-n e zërit): P3 dhe P4 kundrejt `--pipeline legacy`. Video para/pas për ty.                                             |
| **P10** | K1–K9 të E1.4 të pandryshuara: `golden.json`, `golden-package.json` dhe `golden-fixtures-b.json` me 0 bajt ndryshim; K7 931/931; testet, typecheck, lint, format, `contracts:gen --check`. Pipeline-i default (`legacy`) me `pnpm golden` 0 dështime. |

---

## 6. Kriteret e pranimit të E1.5

1. P1–P10 kalojnë, me provat e ruajtura te `docs/reports/e1-5/evidence/`.
2. `pnpm video --pipeline package` prodhon një MP4 me zë, nga paketa e verifikuar, dhe e ruan paketën në run.
3. Çdo paketë që kalon Gate-in, edhe me audio, renderohet sipas kontratës. Çdo paketë e refuzuar jep 0 kuadro, encoder-i nuk niset, dhe run-i dështon pa fallback.
4. Golden baselines janë të paprekura. Default-i ndërrohet vetëm në S9, me miratimin tënd.
5. Asnjë merge në `main` pa miratimin tënd.

---

## 7. Rreziqet

| Rreziku                                                                                                         | Masa                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Miksi i ri nuk jep PCM identike (rendi i inputeve në filtergraph, `adelay` me ms të rrumbullakosur, resampling) | I njëjti filtergraph, i ndërtuar nga e njëjta pjesë kodi. P4 e mat mostër për mostër. Çdo ndryshim raportohet para se të vazhdojë puna.                                      |
| `writeBed` lexon `composed` (SFX). Nëse Stager-i e thërret, Stager-i varet sërish nga brendia e `film`          | Në E1.5, bed-i krijohet nga Stager-i përmes `legacy.ts` (si pjesa tjetër e `prepareV2`). Lëvizja e `sound.ts` te Stager-i bëhet në E1.6 bashkë me heqjen e `legacy.ts` (D4). |
| Kohët e zërit (S1) ndryshojnë timing-un kundrejt B1–B5                                                          | Pa `voice`, `stageV2` mbetet bit për bit i njëjtë (K1/K7). Me `voice`, krahasohet me `prepare` të rrugës së vjetër me të njëjtat alignments.                                 |
| Paralelizmi jep kuadro të ndryshëm (gjendje globale në procese)                                                 | Id-të janë tashmë deterministe (E1.4). P7 dhe S4 krahasojnë hash-et me 1, 2 dhe 4 workers.                                                                                   |
| Madhësia e paketës (mostra për kuadër, ~0,5 MB për aktor në 45 s)                                               | Pranohet në E1.5. Ruhet e ngjeshur vetëm nëse matet si problem; asgjë nuk ndryshon në kontratë.                                                                              |
| Testi E2E i ngadaltë në CI                                                                                      | Film i shkurtër (2 skena, ~6 s, si `film-worker.test.ts`). P9 ekzekutohet si skript provash, jo në çdo `pnpm test`.                                                          |

---

## 8. Çfarë nuk preket në E1.5

- `main`, pa merge pa miratimin tënd;
- golden baselines (`golden.json`, `golden-evidence.json`, `golden-package.json`, `golden-fixtures-b.json`) dhe fixtures B;
- default-i i pipeline-it, deri në S9;
- `v2frame.ts`, `w0/compositor.ts` dhe vizatimi, pra asnjë veçori e re vizuale;
- W0 dhe CLI-ja e tij;
- skemat e paketës dhe të manifestit (me D2 b);
- director-i, script-writer-i dhe voice-i.

---

## 9. Vlerësimi [S]

| Hapat        | Koha               |
| ------------ | ------------------ |
| S1–S2        | 1,5–2 ditë         |
| S3           | 2–3 ditë           |
| S4           | 1–1,5 ditë         |
| S5–S6        | 1,5 ditë           |
| S7–S8        | 2 ditë             |
| **Gjithsej** | **8–10 ditë pune** |

S9 është një commit i vogël pas miratimit.

## 10. Çfarë më duhet për të filluar

1. Vendimet **D1–D6** (rekomandimet: D1 a, D2 b, D3 a, D4 b, D5 a, D6 jashtë).
2. Miratimin e veçantë për të filluar implementimin në `e1-5-pipeline-integration`.
3. Nëse dëshiron P9 me zë real: run-et me zë të B1–B5, nëse janë të ruajtura diku jashtë repo-s. Përndryshe P9 bëhet me fixture-n e zërit.
