import { VoiceAlignment, type VoiceAlignment as VoiceAlignmentT } from "@erkasa/contracts";
import type { TimedWord } from "@erkasa/compiler";
import { optional, required } from "./env.js";

const API = "https://api.elevenlabs.io/v1";

export interface CharAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface Speech {
  audio: Buffer;
  alignment: CharAlignment;
  /** Characters billed for this request (= length of the text sent). */
  characters: number;
  ms: number;
}

export interface SpeechRequest {
  text: string;
  /** Narration of the neighbouring scenes, so intonation flows across scene cuts. */
  previousText?: string;
  nextText?: string;
  seed?: number;
}

/** What the pipeline needs from a TTS provider. */
export interface Voice {
  readonly voiceId: string;
  readonly modelId: string;
  speak(req: SpeechRequest): Promise<Speech>;
}

export interface VoiceInfo {
  voiceId: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  previewUrl?: string;
}

function apiKey(): string {
  return required("ELEVENLABS_API_KEY", "from https://elevenlabs.io/app/settings/api-keys");
}

async function call(path: string, init: RequestInit, key: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { "xi-api-key": key, "content-type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(180_000),
    });
    if (res.ok) return res;
    const detail = (await res.text()).slice(0, 500);
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
      continue;
    }
    const hint =
      res.status === 401
        ? " (check ELEVENLABS_API_KEY in .env)"
        : res.status === 404
          ? " (check ELEVENLABS_VOICE_ID; list yours with `pnpm voices`)"
          : "";
    throw new Error(`ElevenLabs ${res.status}${hint}: ${detail}`);
  }
}

/** ElevenLabs text-to-speech `with-timestamps`: MP3 audio plus the start/end time of every character. */
export class ElevenLabsVoice implements Voice {
  readonly voiceId: string;
  readonly modelId: string;
  private readonly key: string;

  constructor(opts: { voiceId?: string; modelId?: string } = {}) {
    this.key = apiKey();
    this.voiceId =
      opts.voiceId ?? required("ELEVENLABS_VOICE_ID", "pick one with `pnpm voices` and copy its voice_id");
    this.modelId = opts.modelId ?? optional("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2");
  }

  async speak(req: SpeechRequest): Promise<Speech> {
    const started = Date.now();
    const res = await call(
      `/text-to-speech/${encodeURIComponent(this.voiceId)}/with-timestamps?output_format=mp3_44100_128`,
      {
        method: "POST",
        body: JSON.stringify({
          text: req.text,
          model_id: this.modelId,
          ...(req.previousText ? { previous_text: req.previousText } : {}),
          ...(req.nextText ? { next_text: req.nextText } : {}),
          ...(req.seed !== undefined ? { seed: req.seed } : {}),
        }),
      },
      this.key,
    );
    const data = (await res.json()) as { audio_base64: string; alignment: CharAlignment | null };
    if (!data.alignment) throw new Error("ElevenLabs returned no alignment for this request");
    return {
      audio: Buffer.from(data.audio_base64, "base64"),
      alignment: data.alignment,
      characters: req.text.length,
      ms: Date.now() - started,
    };
  }
}

/** The voices on the account (premade, cloned, library voices added to "My voices"). */
export async function listVoices(): Promise<VoiceInfo[]> {
  const res = await call("/voices", { method: "GET" }, apiKey());
  const data = (await res.json()) as {
    voices: Array<{
      voice_id: string;
      name: string;
      category?: string;
      labels?: Record<string, string>;
      preview_url?: string;
    }>;
  };
  return data.voices.map((v) => ({
    voiceId: v.voice_id,
    name: v.name,
    category: v.category ?? "",
    labels: v.labels ?? {},
    ...(v.preview_url ? { previewUrl: v.preview_url } : {}),
  }));
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Character timings -> word timings. Words are whitespace-separated tokens of the narration, the
 * same tokens the compiler's `findWord` and the captions use, so `word:` anchors land exactly.
 */
export function charsToWords(a: CharAlignment): TimedWord[] {
  const words: TimedWord[] = [];
  let current = "";
  let start = 0;
  let end = 0;
  a.characters.forEach((ch, i) => {
    const s = a.character_start_times_seconds[i] ?? end;
    const e = a.character_end_times_seconds[i] ?? s;
    if (/\s/.test(ch)) {
      if (current) words.push({ word: current, start: round(start), end: round(end) });
      current = "";
      return;
    }
    if (!current) start = s;
    current += ch;
    end = e;
  });
  if (current) words.push({ word: current, start: round(start), end: round(end) });
  return words;
}

/** Builds the validated `erkasa.alignment/1` document for one scene. */
export function toAlignment(
  sceneId: string,
  audioUri: string,
  a: CharAlignment,
  durationSec: number,
): VoiceAlignmentT {
  const characters = a.characters
    .map((char, i) => ({
      char,
      start: round(a.character_start_times_seconds[i] ?? 0),
      end: round(a.character_end_times_seconds[i] ?? 0),
    }))
    .filter((c) => c.char.length === 1);
  return VoiceAlignment.parse({
    schema: "erkasa.alignment/1",
    sceneId,
    audio: audioUri,
    durationSec: round(Math.max(durationSec, ...characters.map((c) => c.end))),
    characters,
    words: charsToWords(a),
  });
}
