# E1.5 · Smoke test me TTS real (propozim, i paekzekutuar)

| Fusha   | Vlera                                                                                                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Statusi | **I paekzekutuar; do ta kryejë PO-ja manualisht më vonë (vendim 2026-11-18). Nuk është bllokues për fazat e ardhshme.** Integrimi real me ElevenLabs mbetet i paverifikuar deri atëherë. |
| Pse     | Testet e E1.5 përdorin një zë sintetik deterministik (`ai-worker/test/synthetic-voice.ts`). Ai provon tubacionin, por nuk provon integrimin real me ElevenLabs.                          |

## Çfarë provon

Një run real me zë ElevenLabs kalon nga i njëjti run nëpër të dy rrugët (`legacy` dhe `package`), dhe kontrollohen pikat që zëri sintetik nuk i mbulon:

| Pika | Kontrolli                                                                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1   | MP3-të reale të ElevenLabs (44,1 kHz, me vonesën e koduesit) kthehen në WAV float pa humbje: PCM i miksuar nga WAV = PCM i miksuar drejtpërdrejt nga MP3 (u provua me MP3 të LAME, jo me ato të ElevenLabs). |
| T2   | Kohët reale të fjalëve (`alignments`) japin të njëjtin timing te Stager-i dhe te legacy: kuadrot e dekoduara janë identike deri te kuadri i fundit që nxjerr legacy.                                         |
| T3   | PCM: identike deri te dritarja e `loudnorm` para prerjes së legacy (si në E2E); pas saj, paketa vazhdon deri në fund të filmit.                                                                              |
| T4   | Sinkronizimi: fillimi i çdo klipi zanor në MP4 bie brenda një kuadri nga `start` i tij në paketë (fillimi i parë i zërit mbi pragun në PCM, pas `start`).                                                    |
| T5   | `ffprobe`: H.264 1080×1920 30 fps, AAC 48 kHz stereo; kohëzgjatja e videos = `output.duration` e paketës.                                                                                                    |
| T6   | Dëgjim nga PO-ja: zëri, muzika nën zë dhe fundi i filmit (pjesa që legacy e pret).                                                                                                                           |

## Si ekzekutohet

```
# një herë: zëri real, 2 skena (~120 karaktere, kosto e vogël)
pnpm video --from-script benchmark/scripts/b3-every-yes.script.json --out out/smoke-tts --pipeline legacy
cp -r out/smoke-tts out/smoke-tts-package
pnpm video:rerender-package out/smoke-tts-package      # (do të shtohet vetëm nëse miratohet; ose ERKASA_PIPELINE=package me të njëjtin run)
node --import tsx ai-worker/scripts/compare-runs.ts out/smoke-tts out/smoke-tts-package   # T2–T5
```

Run-i i dytë nuk thërret sërish ElevenLabs: përdor zërin e ruajtur të run-it të parë. Kështu krahasimi bëhet mbi të njëjtat hyrje.

## Çfarë më duhet

1. Çelësi i ElevenLabs në `.env` (`ELEVENLABS_API_KEY`) dhe miratimi yt për koston: ~2 000 karaktere, nëse bëhet me një film të plotë B1–B5.
2. Miratimi për dy skriptet e vogla të sipërme (`rerender-package`, `compare-runs`), ose vendimi që smoke test-i të bëhet me dorë me të njëjtat hapa.
