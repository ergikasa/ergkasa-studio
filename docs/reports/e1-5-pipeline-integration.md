# E1.5 · Raporti i auditimit: Render Package → Gate → Engine në pipeline-in kryesor

| Fusha    | Vlera                                                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Data     | 2026-11-18                                                                                                                                   |
| Branch   | `e1-5-pipeline-integration` @ `35a4e8f` (+ commit-i i këtij raporti); baza: E1.4 e pranuar (`757464a`); `main` = `7f8ffca`, i paprekur       |
| Plani    | `docs/plans/e1-5-pipeline-integration-plan.md`, me vendimet D1–D6 të PO-së (2026-11-18) dhe vendimin për defektin legacy (2026-11-18, §4)    |
| Default  | **legacy**, i pandryshuar. Rruga e re aktivizohet vetëm me `ERKASA_PIPELINE=package`, `--pipeline package` ose `params.pipeline` te worker-i |
| Verdikti | **READY** (me kufizimet e §8); **E1.5 u pranua nga PO-ja më 2026-11-18, ora 19:47**                                                          |

## 1. Përmbledhje

`pnpm video` dhe worker-i, me flamurin `package`, e prodhojnë filmin kështu:

1. **Stager-i:** shkruan paketën nga film-plan-i, script-i dhe zëri real i run-it (kohët e fjalëve, zëri si WAV, bed-i v2).
2. **Gate-i:** e verifikon paketën dhe shkruan `gate.json`.
3. **Engine-i:** prodhon një MP4 reale vetëm nga paketa e verifikuar, me video, zë dhe muzikë.

Paketa e refuzuar nuk prodhon asnjë kuadër, encoder-i nuk niset dhe nuk ka fallback te legacy.

Krahasimi me legacy mbi të njëjtat hyrje:

- **Kuadrot e dekoduara:** identikë, kuadër për kuadër. Rruga e paketës i ka të gjithë kuadrot e paketës; legacy, kur ka zë, e pret videon (§4).
- **PCM pa zë dhe pa defektin:** identike, mostër për mostër.
- **PCM me zë:** identike deri në pikat e përshkruara saktë në §6.

K1–K9, 1 192 teste, typecheck, lint, format dhe skemat kalojnë. Golden baselines dhe kodi i renderimit legacy janë të pandryshuar.

## 2. Vendimet dhe zbatimi

| Vendimi                                     | Zbatimi                                                                                                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** Audio në paketë, miksi në Engine     | Stager-i shkruan zërin dhe bed-in si asete `audio` (WAV) dhe klipe. Engine-i e ndërton miksin vetëm nga paketa dhe bajtet e verifikuara (`film/src/package/mixdown.ts`). Kontrata u plotësua me ndryshimin minimal të §3. |
| **D2** Ducking-u te capabilities            | `capabilities.audio.ducking`: lloji `sidechain`, filtri `sidechaincompress` dhe çdo parametër që paketa nuk vendos, me vlerën e tij default në FFmpeg 6.1. `audio.semantics` jep miksin hap pas hapi.                     |
| **D3** Legacy default                       | I pandryshuar. Flamuri `ERKASA_PIPELINE`/`--pipeline`/`params.pipeline` ka default `legacy`. Një test e provon që run-i pa flamur nuk krijon paketë.                                                                      |
| **D4** `legacy.ts` dhe kamera e papërpunuar | Shtyhen për E1.6. Ura `legacy.ts` vetëm eksporton edhe `writeBed`/`sfxFor` për bed-in.                                                                                                                                    |
| **D5** Renderim paralel                     | Çdo prerje kodohet më vete, në procese fëmijë që e verifikojnë sërish paketën. Me 1 dhe 2 workers, MP4-ja del identike bajt për bajt (§6, P6).                                                                            |
| **D6** W0                                   | Jashtë E1.5. Director-i nuk prodhon plan W0.                                                                                                                                                                              |
| **Defekti legacy (2026-11-18)**             | Engine-i ndjek kontratën: videoja ka gjithë kohëzgjatjen e paketës (§4). Legacy nuk preket.                                                                                                                               |

## 3. Kontrata: semantika e audios

**Verifikimi.** Kontrata `erkasa.render/1` e E1.4 nuk e përfaqësonte plotësisht miksin real (`film/src/render.ts`):

| Semantika e miksit v2                                                           | Para E1.5                                                       | Pas E1.5                                                                                                                       |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Zëri: 48 kHz, stereo, i vendosur në `start` me rezolucion ms                    | `start` në sekonda, pa rezolucion                               | `start` duhet të jetë ms i plotë (`clipStartMs`); **restricted**                                                               |
| Bed-i × 0,55 nën zë                                                             | `gainDb` ekzistonte                                             | `gainDb` = 20·log₁₀(0,55), që kthehet saktë në 0,55; **applied**                                                               |
| Ducking: kompresor i drejtuar nga zëri (threshold 0,03, ratio 6, 80 ms, 500 ms) | vetëm `duckMusicDb`, një ulje fikse në dB, pra semantikë tjetër | **`mix.ducking`** i ri, opsional: `{ kind: "sidechain", threshold, ratio, attackMs, releaseMs }`. `duckMusicDb` kufizohet në 0 |
| `loudnorm` I −14, TP −1,5, **LRA 11**                                           | pa LRA                                                          | **`mix.loudness.rangeLu`** i ri, opsional; i detyrueshëm kur ka audio                                                          |
| Çdo skedar luhet i tëri; dalja mbaron me videon                                 | `duration` "sa luhet"                                           | `duration` = `audibleDuration(start, skedari, filmi)`, aritmetikë e përbashkët; **restricted**                                 |
| `trim`, `fadeIn`, `fadeOut`, `pan`                                              | pa semantikë                                                    | të fiksuara në 0; **restricted**                                                                                               |

**Ndryshimi** është shtues dhe opsional:

- paketat e mëparshme mbeten valide dhe bajt për bajt të njëjta;
- `erkasa.render/1` nuk ndryshon emër;
- skema JSON u rigjenerua;
- matrica e fushave kalon nga 243 në 249 fusha.

Pjesët e përbashkëta:

- **`contracts/src/audio-clip.ts`** (Stager, Gate, Engine): `wavInfo` (koka WAV), `audibleDuration`, `clipStartMs`, `gainLinear`.
- **Gate-i:**
  - asetet audio verifikohen si WAV; `durationSec` dhe `sampleRate` duhet të jenë ato të skedarit (`AUDIO_INVALID`, `AUDIO_MISMATCH`);
  - klipet dhe miksi kontrollohen kundrejt capabilities (`VALUE_UNSUPPORTED`);
  - miksi kontrollohet vetëm kur ka klipe (V1 i E1.4).
- **Buxheti i ri `audioBytes` = 40 MB për skedar audio.** Buxheti i aseteve (2,2 MB, 10 × SVG-ja më e madhe) refuzonte bed-in e një filmi 35 s (13,5 MB). 40 MB = 2 × WAV-i më i madh që shkruan pipeline-i për një film 100 s, i rrumbullakosur lart.
- **Capabilities v2:**
  - `output.video`: encoder-i, crf 20, grain `noise=alls=4:allf=t`, një stream për çdo prerje;
  - `audio`: formatet, rolet, fushat fikse, kohëzgjatja e dëgjueshme, ducking-u, loudness, AAC 192 kb/s dhe semantika.
  - Test-i i capabilities i krahason këto vlera me kodin legacy.

## 4. Gjetje: defekt në rrugën legacy (default)

Kur ka zë dhe muzikë, `sidechaincompress` mbaron me hyrjen më të shkurtër, pra me klipin e fundit të zërit, dhe `-shortest` e pret videon aty. Pa muzikë, miksi mbaron po ashtu me zërin.

Te fixture-i E2E, filmi është 8,03 s (241 kuadro), por legacy nxjerr 6,5 s (195 kuadro). **Çdo video legacy me zë humb pjesën pas fjalës së fundit.**

Vendimi i PO-së ishte që Engine-i të ndjekë kontratën:

- çelësi i ducking-ut zgjatet me heshtje (`apad`);
- miksi, kur të gjithë skedarët mbarojnë para filmit, mbushet me heshtje deri në kohëzgjatjen e filmit (`apad=whole_dur`).

Legacy nuk u ndryshua. Defekti mbetet aty deri në një vendim të veçantë.

## 5. Engine, integrimi, anulimi

- **`encodePackage`** (`film/src/package/encode.ts`):
  - Gate-i ekzekutohet i pari. Paketa e refuzuar kthen gjetjet e Gate-it pa nisur asnjë proces dhe pa shkruar asnjë skedar.
  - Çdo prerje kodohet si shot-i v2 (`segmentArgs`), në procese fëmijë kur ka më shumë se 1 worker.
  - Prerjet bashkohen pa rikodim, pastaj miksohet audio.
  - Dalja shkruhet me emër të përkohshëm dhe riemërtohet vetëm në fund.
  - **Anulimi** bëhet me `AbortSignal`: çdo proces ka grupin e vet, dhe FFmpeg-u i një fëmije ndan grupin e fëmijës. Ndalimi e vret grupin, dhe gabimi raportohet vetëm pasi çdo proces ka dalë.
- **Integrimi** (`ai-worker/src/package-steps.ts`):
  - **`stepStage`:** MP3-të e zërit kthehen në WAV float me të njëjtat mostra. Kjo u provua: legacy miks MP3-të, paketa WAV-et, dhe PCM-ja del identike në rastin "vetëm zë" (P4); bed-i v2; paketa.
  - **`stepGate`:** shkruan `gate.json`; refuzimi ngre `PackageRefused`, kod `PACKAGE_REFUSED`, jo retryable.
  - **`stepPackageRender`.**
  - `make`/CLI (`--pipeline`, Ctrl-C anulon) dhe worker-i (`params.pipeline`) zgjedhin rrugën. Anulimi klasifikohet si `CANCELLED`.

## 6. Testet e detyrueshme dhe rezultatet

| Kërkesa                               | Testi                                                                                                                                                                                                         | Rezultati                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E2E me MP4 reale, `ffprobe`           | `ai-worker/test/package-e2e.test.ts` P1                                                                                                                                                                       | ✓ H.264 1080×1920, 30/1, yuv420p, 241 = të gjithë kuadrot e paketës; AAC 48 kHz stereo                                                                                                                                                                                                                                                                                                                                                                       |
| Krahasim i kuadrove të dekoduara      | P3 (framemd5)                                                                                                                                                                                                 | ✓ **Pa zë:** identikë (të gjithë). **Me zë:** 195/195 kuadrot e legacy identikë; paketa vazhdon deri në 241. **B1–B5** (skripti i provave, bed pa zë): 1 506 / 1 258 / 1 051 / 1 016 / 1 212 kuadro, të gjithë identikë                                                                                                                                                                                                                                      |
| Krahasim i PCM të dekoduar            | P4                                                                                                                                                                                                            | ✓ **Pa audio:** asnjë stream në të dyja. **Vetëm muzikë:** identike. **Vetëm zë:** identike deri te 2 frame-t e fundit AAC të stream-it legacy (ku ai mbaron), pastaj heshtje. **Zë + muzikë:** identike deri ≤ 3 s para prerjes së legacy (dritarja e `loudnorm`, e matur: 2,97 s). **B1–B5:** B2–B4 identike; B1 dhe B5 identike mbi stream-in më të shkurtër (bed-i v2 mbaron 2 ms para videos; mbushja e paketës e mbyll stream-in AAC 1 frame më herët) |
| Sinkronizimi audio/video              | P5                                                                                                                                                                                                            | ✓ Të dy stream-et nisin në 0; audio mbaron brenda 1 kuadri nga videoja; çdo zë dëgjohet te `start` + hyrja sintetike, brenda 1 kuadri                                                                                                                                                                                                                                                                                                                        |
| Determinizmi me 1 dhe 2 workers       | P6; `encode.test.ts`                                                                                                                                                                                          | ✓ MP4 identike bajt për bajt (fixture-i me zë dhe office-clock); paketa dhe skedarët audio identikë                                                                                                                                                                                                                                                                                                                                                          |
| Paketë e pavlefshme                   | P7; `encode.test.ts`; K5                                                                                                                                                                                      | ✓ `y: "top"`: `VALUE_UNSUPPORTED …/params/y`; 0 kuadro; FFmpeg-u spiun nuk thirret; asnjë `video.mp4`, asnjë dosje pune; renderer-i legacy nuk ekzekutohet. **K5:** 183 raste (+19 audio), 0 kuadro, encoder-i nuk niset                                                                                                                                                                                                                                     |
| Dështim, retry, anulim                | P8; `encode.test.ts`                                                                                                                                                                                          | ✓ FFmpeg që dështon: `WORKER_ERROR`, retryable, pa video, pa fallback; retry-i (attempt 2) prodhon të njëjtën MP4 bajt për bajt. Anulimi: `AbortError` → `CANCELLED`, pa video, pa skedar `.part`, 0 procese të mbetura                                                                                                                                                                                                                                      |
| Kontrata, Gate, capabilities, kufijtë | `contracts/test/audio-clip.test.ts` (12), `stager/test/audio.test.ts` (7), `gate/test/audio-cases.ts` (19), `capabilities.test.ts`, `fields.test.ts` (249), `encode.test.ts` (kufiri i modulit të encoder-it) | ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## 7. Komandat dhe provat

Provat ruhen në `docs/reports/e1-5/evidence/` (indeksi: `README.md`).

| Pika                               | Komanda                                                                                                                                                                                                                            | Rezultati                                                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| K9 + testet e reja                 | `pnpm -r --workspace-concurrency=1 test`                                                                                                                                                                                           | contracts 256, engine 23, compiler 28, engine-worker 16, film 336, stager 77, gate 400, planner 6, ai-worker 50 = **1 192, 0 dështime** |
| K1                                 | `cd film && npx vitest run test/package/k1.test.ts`                                                                                                                                                                                | 5/5 filma, 6 043/6 043 kuadro                                                                                                           |
| K2/K3/K7                           | `cd film && node --expose-gc --import tsx test/package/golden-package.ts --verify`                                                                                                                                                 | 0 dështime; 931/931                                                                                                                     |
| Pipeline-i default                 | `cd film && pnpm -s golden`                                                                                                                                                                                                        | 405 v2 + 136 W0, 0 dështime                                                                                                             |
| B1–B5 legacy kundrejt paketës      | `cd film && node --import tsx test/package/e15-bench.ts`                                                                                                                                                                           | çdo kuadër identik; PCM si në §6                                                                                                        |
| Typecheck / lint / format / skemat | `pnpm typecheck`; `pnpm lint`; `pnpm format:check`; `pnpm contracts:gen --check`                                                                                                                                                   | OK                                                                                                                                      |
| Baselines                          | `git diff --quiet eda5ab5 HEAD -- film/golden/golden.json`; `git diff --quiet 757464a HEAD -- film/golden gate/fixtures film/src/render.ts film/src/film.ts film/src/compose.ts film/src/sound.ts film/src/v2frame.ts film/src/w0` | identikë; `origin/main` = `7f8ffca`                                                                                                     |

Kohët e matura (B1–B5, 4 workers, i njëjti kompjuter): legacy 52–171 s, paketa 52–124 s për film.

## 8. Kufizimet e mbetura

1. **Zëri në testet offline është sintetik.** Është MP3 deterministe nga FFmpeg/LAME, me kohë karakteresh të sakta. Prova nuk vlen për integrimin real me ElevenLabs. Propozimi për smoke test-in me TTS real (kërkon çelësin dhe miratimin e kostos): `docs/plans/e1-5-tts-smoke-test.md`.
2. **Nuk ka run-e reale B1–B5 me zë në repo.** Krahasimi B1–B5 u bë me bed-in v2 dhe pa zë. Zëri u provua vetëm me fixture-in sintetik.
3. **Defekti legacy (§4) mbetet në default-in.** Rregullimi i tij te legacy kërkon vendimin tënd, sepse ndryshon pipeline-in default.
4. **Ndryshimet PCM me legacy janë të karakterizuara, jo zero**, në tri raste:
   - me zë: rreth dritares së `loudnorm` para prerjes së legacy;
   - vetëm zë: 2 frame-t e fundit AAC;
   - B1/B5: fundi i stream-it AAC, rreth 21 ms.

   Të gjitha vijnë nga ndryshimi i miratuar (§4) ose nga fundi i stream-it. Asnjë tolerancë nuk fsheh ndryshime brenda pjesës identike.

5. **Protokolli MQ i worker-it nuk ka mesazh anulimi.** Anulimi funksionon te Engine-i, te hapat dhe te CLI (Ctrl-C). Worker-i e klasifikon `CANCELLED`, por nuk ka si ta marrë nga orkestratori pa një ndryshim kontrate (`erkasa.task/1`).
6. **Bed-i v2** krijohet përmes urës `legacy.ts`. Lëvizja e `sound.ts` bëhet në E1.6 (D4).
7. **Metrika `durationSec` e worker-it ndryshon pak:** legacy raporton `composed.duration` (8,04), paketa `output.duration` (8,03 = kuadrot / 30).
8. **Rritja e kontratës** (`mix.ducking`, `loudness.rangeLu`, buxheti `audioBytes`, capabilities `output.video`/`audio`) u bë brenda autorizimit të D1/D2. Ty të mbetet shqyrtimi i saj.

## 9. Commit-et

| Commit                                                | Grupi            | Përmbajtja                                                                                                           |
| ----------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| `d3d6d73`                                             | kontratat        | `mix.ducking`, `loudness.rangeLu`, `audio-clip.ts`, capabilities video/audio, rregullat e Gate-it, matrica e fushave |
| `2ea2d14`                                             | kontratat        | buxheti `audioBytes`                                                                                                 |
| `cfc7628`                                             | audio dhe kodimi | `encodePackage`, `mixdown`, Stager-i: audio dhe kohët e zërit                                                        |
| `9d825db`, `e896a7e`                                  | audio dhe kodimi | grupet e proceseve; mbushja vetëm kur nevojitet                                                                      |
| `3883320`                                             | integrimi        | `package-steps`, `make`/CLI/worker, flamuri                                                                          |
| `13c90bd`, `6e74c42`, `e57f090`, `caf2dc5`, `35a4e8f` | testet           | E2E, encoder-i, Stager-i, kontratat, rastet e Gate-it, skripti i provave, smoke test-i                               |

## 10. Verdikti

**READY.**

Të gjitha testet e detyrueshme kalojnë dhe provat janë ruajtur. Default-i mbetet legacy, golden baselines janë të paprekura dhe `main` nuk është prekur.

Pres miratimin tënd. Nuk bëj merge, nuk ndërroj default-in dhe nuk filloj E1.6.

## 11. Pranimi (2026-11-18)

**E1.5 u pranua nga PO-ja më 2026-11-18, ora 19:47 (Europe/Tirane).**

Kushtet e pranimit:

- pa merge në `main`;
- pipeline-i default mbetet `legacy`;
- golden baselines të paprekura;
- E1.6 vetëm si plan, deri në miratimin e veçantë.

**Integrimi real me ElevenLabs mbetet i paverifikuar.** Testet e E1.5 përdorin një zë sintetik. Smoke test-i me TTS real (`docs/plans/e1-5-tts-smoke-test.md`) do ta kryejë PO-ja manualisht, në një moment të mëvonshëm. Sipas vendimit të PO-së, ai **nuk është bllokues** për fazat e ardhshme, dhe nuk kërkohet asnjë API key për to.

Gjendja në momentin e pranimit:

| Pika           | Vlera                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| Branch         | `e1-5-pipeline-integration`                                            |
| HEAD i pranuar | `2bad31a` (raporti); pas tij vetëm commit-i i regjistrimit të pranimit |
| `origin/main`  | `7f8ffca`                                                              |
| Provat         | `docs/reports/e1-5/evidence/`                                          |
