# E1.6 · Nënfaza 4: Audio reale, muzika e licencuar dhe titrat (raport)

| Fusha        | Vlera                                                                                                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Statusi      | **E implementuar, testet automatike kalojnë.** Mbetet prova manuale me bibliotekën reale dhe me ElevenLabs, si dhe shikimi yt i titrave.                                                                                                         |
| Commit-et 4a | `d36298e` (gate), `4593d87` (engine), `da50231` (testet e engine/gate), `3b0e2b2` (stager), `0d405df` (worker), `1d8178b` (testet e worker-it)                                                                                                   |
| Commit-et 4b | `d1e5f78` (contracts), `9ea407b` (gate + capabilities), `cdcca6c` (stager), `7f80ffd` (worker), `4057007` (testet)                                                                                                                               |
| CI           | E gjelbër: 4a [44395925992](https://github.com/ergikasa/ergkasa-studio/actions/runs/44395925992) në `1d8178b`; 4b [44400617718](https://github.com/ergikasa/ergkasa-studio/actions/runs/44400617718) në `4057007` (3 punë, golden-ët, RabbitMQ). |

## Çfarë është e vërtetë dhe çfarë nuk është provuar

- **E provuar automatikisht:** rruga e plotë katalog → projektues → paketë → Gate → engine → MP4, me **katalogun real** (`audio/catalog.json`: ID-të, rolet, seksionet, licencat, burimet dhe mix-i). Skedarët muzikorë janë zëvendësuar me **tone të gjeneruara** me të njëjtën gjatësi. Skedarët Pixabay nuk janë as në repo, as në CI (ADR 0010).
- **E paprovuar këtu:** si tingëllon muzika reale e licencuar në një video, si dhe zëri real ElevenLabs. Të dyja i bën ti lokalisht. Komanda:

  ```
  ERKASA_AUDIO_DIR=<biblioteka> pnpm video "<tema>" --theme <tema>
  ```

  Default-i është `package`, muzikë nga katalogu dhe titra. Videoja demo e nënfazës 3 **nuk** është provë për audion ose titrat.

## 4a · Muzika dhe SFX të licencuara

- **Engine (capabilities):**
  - deri në 64 klipe `music` dhe 256 `sfx`, me fillim në milisekonda të plota;
  - `trim`, `fadeIn` dhe `fadeOut` zbatohen, me kurbë `qsin` si në v1;
  - `duration` "at-most-audible": brenda skedarit pas trim-it dhe brenda filmit;
  - `duckMusicDb` nga 0 deri në 30 dB, si thellësi e duck-ut me sidechain (`mix = 1 − 10^(−dB/20)`, siç e përshkruan plani). Kërkon `mix.ducking`.
  - Grafi i E1.5 (një bed në 0) prodhohet **bajt për bajt si më parë**.
- **Gate:**
  - 8 refuzimet e E1.5 që E1.6 i heq tani pranohen; secila provohet me një rast pozitiv.
  - 9 refuzime të reja, me kod dhe shteg të saktë: trim përtej skedarit, kohëzgjatje përtej skedarit ose filmit, fade më i gjatë se klipi, duck mbi 30 dB, duck pa ducking, mbi 64 klipe muzike, SFX jashtë milisekondave.
  - K5 (0 kuadro për çdo paketë të refuzuar) mbulon tani 184 raste.
- **Projektimi:**
  - Projektuesi ekzistues i tingullit (`designSoundtrack`) merr kohët e v2 përmes një adapteri: skenat, beat-et e script-it, fjalët dhe efektet e shot-eve.
  - Plani ruhet te `audio-plan.json` dhe arsyet te `audio-notes.txt`.
  - Çdo skedar katalogu verifikohet me sha256 dhe hyn në paketë si WAV 16-bit 48 kHz, me `license: LicenseRef-Pixabay-Content-License` dhe burim (`audio catalog <id>`, URL-ja te `approval.note`).
- **Pa placeholder (D2):**
  - Nëse biblioteka është bosh ose çdo skedar muzike ka sha256 tjetër, render-i dështon me `AUDIO_LIBRARY_MISSING`, jo _retryable_: pa video dhe pa bed sintetik.
  - Një skedar i ndryshuar lihet jashtë, dhe kjo shënohet te `audio-notes.txt`.
  - Bed-i sintetik zgjidhet vetëm me emër (`musicSource: "synthetic"`), për teste dhe krahasime me legacy.
- **Matja me FFmpeg real:**
  - me `duckMusicDb 7`, muzika bie **−6,49 dB** nën zë; pa thellësi bie −26,18 dB;
  - segmentet, trim-i, fade-et dhe SFX-të ndodhen aty ku i vendos paketa (`duck-measurement.txt`, `mix-e16.test.ts`).

## 4b · Titrat

- **Brezi (E-D2):** 1450–1720 px, i gjerë 900 px. Publikohet te capabilities `captions.zone`.
- **Gate:**
  - titra jashtë brezit → `VALUE_RANGE …/at/y`;
  - frazë më e gjerë se brezi → `VALUE_RANGE …/phrases/n`;
  - tekst kinetik brenda brezit, në një skenë që shfaqet ndërsa shfaqet një frazë → **`CAPTION_CONFLICT …/phrases/n`**. Mesazhi emërton skenën, node-in dhe intervalin.
- **Matja e gjerësisë.** Stager-i dhe Gate-i përdorin të njëjtin funksion (`contracts captionPhraseWidth`) dhe një tabelë gjerësish të Montserrat-it, të nxjerrë nga fontet e engine-it (`film/scripts/font-metrics.ts`). Kontrolli kundrejt Skia: diferenca është më e vogël se 2%, dhe vlera jonë nuk del kurrë më shumë se 1 px më e ngushtë.
- **Stager-i.**
  - Frazat ndërtohen nga fjalët e alignment-it. Fraza e re fillon kur ndryshon skena, pas një pauze mbi 0,45 s, pas 7 fjalësh, ose kur fjala tjetër nuk hyn më në brez.
  - Fjala mbetet "current" deri sa nis fjala tjetër. Frazat nuk mbivendosen.
  - **Teksti kinetik që do të hynte në brez ngrihet mbi të.** Te B1 kjo ndodh në `s01` (y 1430→1336) dhe `s13` (y 1430→1286).
- **Worker-i:** titrat janë aktive si default; `captions: false` i çaktivizon. Krahasimet me legacy i çaktivizojnë me emër, sepse legacy nuk vizaton titra.
- **E2E:**
  - Çdo fjalë e alignment-it shfaqet në titra një herë, në rend.
  - Pikselët e engine-it ndryshojnë **vetëm brenda brezit** dhe **vetëm ndërsa shfaqet një frazë**; mes frazave nuk ndryshon asnjë piksel.
  - B1, B2 dhe B5 me titra kalojnë Gate-in.

## Ndryshime në teste ekzistuese (asnjë i dobësuar)

| Testi                                                                           | Ndryshimi                                                                                   | Arsyeja                                                                                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `gate/test/audio-cases.ts`                                                      | 8 raste të E1.5 kaluan nga "refuzohet" te "pranohet" (testet pozitive të reja)              | Capabilities i zbatojnë tani (plani 4a)                                                                                            |
| idem, "WAV me kohëzgjatje të ndryshme"                                          | pritet vetëm `AUDIO_MISMATCH`                                                               | Me "at-most-audible", zëri 1,2 s brenda 1,25 s të deklaruara nuk është më gabim kohëzgjatjeje; mospërputhja e header-it kapet ende |
| `gate/test/fields.test.ts`                                                      | kodet e trim/fades/duration bëhen `VALUE_RANGE`                                             | Kufij të rinj, të provuar me raste negative                                                                                        |
| `gate/test/capabilities.test.ts`                                                | capabilities e audios v2 dhe `captions.zone`; edhe konstantet e renderer-it që përdor matja | Përshkrimi i ri                                                                                                                    |
| `gate/test/films.test.ts` (prisoner-cell, fixture kontrate, jo e ekzekutueshme) | +1 refuzim i pritur: titri i saj është 6 px mbi brez                                        | Brezi i ri                                                                                                                         |
| `film/test/package/encode.test.ts`                                              | Fixture-i i grafit merr kohëzgjatje realiste të klipeve. Stringjet e grafit nuk ndryshuan.  | Kohëzgjatja tani ka kuptim                                                                                                         |
| `film/test/package/k5.test.ts`                                                  | 183 → 184 raste                                                                             | −8 të hequra, +9 të reja                                                                                                           |
| E2E-ja e E1.5                                                                   | `musicSource: "synthetic"`, `captions: false` me emër                                       | Krahasohet me legacy; pohimet nuk ndryshuan                                                                                        |

## Provat

| Prova                                                                                                                 | Skedari ose testi                                                 |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| B1 pa titra / me titra, në shot-et ku teksti u ngrit (`s01`, `s13`) dhe një shot pa ndryshim (`s05`)                  | `b1-captions-before-after.png`                                    |
| Teksti kinetik i ngritur te B1                                                                                        | `b1-lifted-type.txt`                                              |
| Duck-u i matur                                                                                                        | `duck-measurement.txt`                                            |
| Score-i nga katalogu, end-to-end (8 teste), titrat end-to-end (4)                                                     | `ai-worker/test/score.test.ts`, `ai-worker/test/captions.test.ts` |
| Lokalisht: contracts 264, gate 422, film 345, stager 85, worker 74 (+1 RabbitMQ në CI); golden 0 dështime; K7 931/931 | log-et e CI-së                                                    |

## Rreziqet dhe çfarë duhet të shikosh

1. **Lëvizja e tekstit kinetik** te shot-et me titra ndryshon kompozimin. Te B1 `s13`, "What will / you give?" bie mbi personazhin. Shiko imazhin. Nëse nuk të pëlqen, alternativat janë një brez më i ulët ose tekst më i vogël; secila kërkon vendimin tënd.
2. **Muzika reale:** projektuesi zgjedh pjesët dhe seksionet nga beat-et. Për v2 e merr vetëm nga kohët dhe efektet e shot-eve, ndaj zgjedhjet duhen dëgjuar. Një segment më i gjatë se skedari luhet njëherë (v1 e përsëriste), dhe kjo shënohet te notes.
3. **Loudness:** paketa normalizon me `loudnorm` −14 LUFS, kurse v1 me master gain + limiter. Tingulli mund të ndryshojë pak nga v1.
4. **Stili i titrave:** Montserrat 800, 60 px, krem me kontur të errët, fjala aktuale portokalli. Mund të ndryshohet vetëm me miratim.
