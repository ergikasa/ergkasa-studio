/**
 * A synthetic, deterministic TTS for offline tests (E1.5). NOT ElevenLabs and not a speech model: every request
 * becomes an MP3 (LAME, 44.1 kHz mono, 128 kb/s, as ElevenLabs delivers) of 0.25 s of silence, then a tone whose
 * pitch depends on the text, as long as the characters at a fixed rate; the character timings say exactly that.
 * It proves the pipeline handles a voice track (files, word timings, placement, mixing); it says nothing about
 * a real voice. The real-TTS smoke test is separate (docs/plans/e1-5-tts-smoke-test.md).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { VoicePreset } from "@erkasa/contracts";
import type { Speech, SpeechRequest, Voice } from "../src/voice.js";

export const LEAD_SEC = 0.25;
export const CHAR_SEC = 0.055;

export class SyntheticVoice implements Voice {
  readonly modelId = "synthetic-test-voice/1";
  private readonly dir = mkdtempSync(join(tmpdir(), "erkasa-synth-voice-"));
  private n = 0;
  constructor(readonly preset: VoicePreset) {}

  async speak(req: SpeechRequest): Promise<Speech> {
    const chars = [...req.text];
    const toneSec = chars.length * CHAR_SEC;
    let h = 0;
    for (const c of req.text) h = (h * 31 + c.charCodeAt(0)) % 997;
    const freq = 180 + (h % 120);
    const out = join(this.dir, `${++this.n}.mp3`);
    const r = spawnSync(
      process.env["ERKASA_FFMPEG"] ?? "ffmpeg",
      [
        ...["-y", "-loglevel", "error", "-f", "lavfi", "-i", `anullsrc=r=44100:cl=mono:d=${LEAD_SEC}`],
        ...["-f", "lavfi", "-i", `sine=frequency=${freq}:sample_rate=44100:duration=${toneSec.toFixed(3)}`],
        ...["-filter_complex", "[1:a]volume=0.4[t];[0:a][t]concat=n=2:v=0:a=1[a]", "-map", "[a]"],
        ...["-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", "-bitexact", out],
      ],
      { encoding: "utf8" },
    );
    if (r.status !== 0) throw new Error(`synthetic voice: ffmpeg failed: ${r.stderr}`);
    const start = chars.map((_, i) => LEAD_SEC + i * CHAR_SEC);
    return {
      audio: readFileSync(out),
      alignment: {
        characters: chars,
        character_start_times_seconds: start,
        character_end_times_seconds: start.map((s) => s + CHAR_SEC),
      },
      characters: chars.length,
      ms: 1,
    };
  }
}
