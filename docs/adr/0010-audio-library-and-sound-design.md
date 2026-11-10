# ADR 0010: Biblioteka audio dhe dizajni i zërit (H1)

- Statusi: pranuar
- Data: 2026-11-10

## Konteksti

Deri te Faza G, nën narracion kishte vetëm një pad sinusoidal placeholder. Auditi (H1) kërkoi muzikë që ndjek
strukturën emocionale të historisë, efekte të pakta e të sinkronizuara, origjinë dhe të drejta të dokumentuara
për çdo skedar, dhe një miks që vlerësohet me dëgjim, me narracionin gjithmonë në plan të parë.

## Vendimi

- **Katalogu (`audio/catalog.json`, kontrata `audio-catalog`) futet në Git, skedarët audio jo.** Licenca e
  Pixabay ndalon rishpërndarjen e skedarit më vete. Skedarët rrinë te `assets-src/audio/{music,sfx}/<id>.mp3`
  (gitignored, `ERKASA_AUDIO_DIR`). Çdo hyrje ruan titullin, autorin, URL-në e faqes, licencën, flamujt
  Content ID / AI në datën e kontrollit, dhe pas importit sha256, kohëzgjatjen, loudness dhe seksionet.
- **Asnjë skedar me Content ID ose "AI generated" nuk përdoret.** Kontrata e ndalon statusin `imported` për to,
  importer-i i refuzon, dhe biblioteka i lë jashtë me arsye.
- **Importi (`pnpm audio:import`)** mat me FFmpeg (EBU R128) dhe propozon intro/build/peak/outro nga kurba e
  loudness. Seksionet e konfirmuara me dëgjim (`--notes`, `source: listened`) fitojnë gjithmonë mbi ato automatike.
- **Dizajneri i zërit** (`engine-worker/src/sound/design.ts`) shkruan `audio-plan/2` nga timeline-i i kompiluar
  dhe beat-et e skenarit. Muzika: beat → rol, skenat e njëpasnjëshme me të njëjtin rol ndajnë një pjesë,
  ndryshimet e shkurtra bashkohen (twist/turn mund të mbajnë 5 s të tyren), para twist-it ka një frymë
  heshtjeje, turn-i hyn me crossfade më të gjatë, dhe pjesa e fundit vendoset që fundi i saj natyral të bjerë në
  kuadrin e fundit. Efektet: vetëm në ngjarje që shikuesi i sheh ose i ndjen (telefon, orë, twist, insight),
  me prioritet, buxhet densiteti (`sfxEverySec`), distancë minimale dhe kufi për skedar. Çdo zgjedhje ka arsye
  te `audio-notes.txt`.
- **Nivelet janë relative ndaj zërit të matur:** muzika = zëri − `musicUnderVoiceDb` (+ ofset sipas rolit),
  efektet = zëri − `sfxUnderVoiceDb`. Ducking-u me sidechain ka thellësi të saktë në dB.
- **Mastering në dy kalime:** miks → matje → një gain linear + limiter (−14 LUFS, −1 dBTP). `loudnorm` me një
  kalim do ta sheshonte dinamikën e projektuar (heshtjen para twist-it, ngritjen e turn-it).
- **Akordimi bëhet me vesh:** `pnpm audio:mix <run> --variants musicUnderVoiceDb=14,18,22` jep disa WAV për
  krahasim. `pnpm video:rerender <run>` ripërdor zërin dhe planin pa thirrje Claude/ElevenLabs.

## Pasojat

- Pa importuar asgjë, pipeline-i vazhdon me pad-in placeholder dhe e thotë në raport.
- Numrat e miksit jetojnë te `audio/catalog.json > mix`, jo në kod: ndryshohen pas dëgjimit dhe futen në Git.
- Shtimi i një pjese të re = një hyrje në katalog + import. Nuk kërkon kod.
