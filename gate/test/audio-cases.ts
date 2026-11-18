/**
 * E1.5: audio in a Render Package, as the engine mixes it (capabilities `audio`). `withAudio` gives the base
 * (B3 + a file asset) a voice clip and a music clip in real WAV files, ducked, with a loudness range: the gate
 * passes it (AUDIO_POSITIVE). Every case breaks one thing and is refused with its exact findings (K5: 0 frames).
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion -- cases over known package shapes */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AssetManifest, RenderPackage } from "@erkasa/contracts";
import { audibleDuration } from "@erkasa/contracts";
import type { ExecCase } from "./executable-cases.js";

type Pkg = RenderPackage;
type C = { pkg: Pkg; manifest: AssetManifest; root: string; budgets?: object };

/** A WAV (16-bit PCM) of a quiet sine, `sec` long. */
export function wav(sec: number, rate = 48000, channels = 2, extraData = 0): Buffer {
  const frames = Math.round(sec * rate);
  const data = frames * channels * 2;
  const b = Buffer.alloc(44 + data);
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(36 + data, 4);
  b.write("WAVE", 8, "latin1");
  b.write("fmt ", 12, "latin1");
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * channels * 2, 28);
  b.writeUInt16LE(channels * 2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36, "latin1");
  b.writeUInt32LE(data + extraData, 40);
  for (let i = 0; i < frames; i++)
    for (let ch = 0; ch < channels; ch++)
      b.writeInt16LE(
        Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 3000),
        44 + (i * channels + ch) * 2,
      );
  return b;
}

const sha = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

/** Adds a WAV asset to the case's manifest and root; returns its ref. */
export function audioAsset(c: C, id: string, bytes: Buffer, over: Record<string, unknown> = {}): string {
  const uri = `assets/${id}.wav`;
  writeFileSync(join(c.root, uri), bytes);
  const like = c.manifest.assets.find((a) => a.id === "prop_chairfile")!;
  const info = {
    frames: (bytes.readUInt32LE(40) / (bytes.readUInt16LE(32) || 1)) | 0,
    rate: bytes.readUInt32LE(24),
  };
  c.manifest.assets.push({
    id,
    version: 1,
    kind: "audio",
    format: "wav",
    durationSec: info.frames / info.rate,
    sampleRate: info.rate,
    style: like.style,
    license: like.license,
    provenance: { origin: "generator", by: "gate test" },
    approval: like.approval,
    source: { kind: "file", uri, sha256: sha(bytes) },
    ...over,
  } as unknown as AssetManifest["assets"][number]);
  return `${id}@1`;
}

/** The base with a voice at 1 s (1.2 s long) over a 3 s music bed, ducked, normalised. */
export function withAudio(c: C): void {
  const film = c.pkg.output.duration;
  const music = audioAsset(c, "music_bed", wav(3));
  const voice = audioAsset(c, "voice_one", wav(1.2, 44100, 1));
  const clip = (
    id: string,
    asset: string,
    role: "voice" | "music",
    start: number,
    sec: number,
    gainDb: number,
  ) => ({
    id,
    asset,
    role,
    start,
    trim: 0,
    duration: audibleDuration(start, sec, film),
    gainDb,
    fadeIn: 0,
    fadeOut: 0,
    pan: 0,
  });
  c.pkg.audio = [
    clip("music", music, "music", 0, 3, 20 * Math.log10(0.55)),
    clip("voice_one", voice, "voice", 1, 1.2, 0),
  ];
  c.pkg.mix = {
    duckMusicDb: 0,
    ducking: { kind: "sidechain", threshold: 0.03, ratio: 6, attackMs: 80, releaseMs: 500 },
    loudness: { integratedLufs: -14, truePeakDb: -1.5, rangeLu: 11 },
  };
}

const A = (name: string, mutate: (c: C) => void, expect: string[]): ExecCase => ({
  name: `E1.5 audio: ${name}`,
  mutate: (c) => {
    withAudio(c);
    mutate(c);
  },
  expect,
});

/** E1.6 rules (trim, fades, several music clips, sfx, duck depth): refused cases. */
const A6 = (name: string, mutate: (c: C) => void, expect: string[]): ExecCase => ({
  name: `E1.6 audio: ${name}`,
  mutate: (c) => {
    withAudio(c);
    mutate(c);
  },
  expect,
});

export const AUDIO_CASES: ExecCase[] = [
  A(
    "an audio file larger than the audio budget (and only the audio files count against it)",
    (c) => (c.budgets = { audioBytes: 200_000 }),
    ["BUDGET_ASSET_BYTES manifest/assets/12/source/uri"],
  ),
  A("a voice that starts between two milliseconds", (c) => (c.pkg.audio[1]!.start = 1.0005), [
    "VALUE_UNSUPPORTED package/audio/1/start",
  ]),
  A("a panned clip", (c) => (c.pkg.audio[1]!.pan = 0.5), ["VALUE_UNSUPPORTED package/audio/1/pan"]),
  A(
    "ducking without music",
    (c) => {
      c.pkg.audio = c.pkg.audio.filter((x) => x.role === "voice");
    },
    ["VALUE_UNSUPPORTED package/mix/ducking"],
  ),
  A("no loudness range", (c) => delete (c.pkg.mix.loudness as { rangeLu?: number }).rangeLu, [
    "VALUE_UNSUPPORTED package/mix/loudness/rangeLu",
  ]),
  A("a true peak below what loudnorm limits to", (c) => (c.pkg.mix.loudness.truePeakDb = -10), [
    "VALUE_UNSUPPORTED package/mix/loudness/truePeakDb",
  ]),
  A(
    "an MP3 asset (the engine reads WAV)",
    (c) => ((c.manifest.assets[c.manifest.assets.length - 1] as { format: string }).format = "mp3"),
    ["VALUE_UNSUPPORTED manifest/assets/13/format"],
  ),
  A(
    "a WAV whose duration is not the declared one",
    (c) => ((c.manifest.assets[c.manifest.assets.length - 1] as { durationSec: number }).durationSec = 1.25),
    // E1.6: the voice plays 1.2 s, within the declared 1.25 s; the gate still compares the header with the claim
    ["AUDIO_MISMATCH manifest/assets/13/durationSec"],
  ),
  A(
    "a WAV whose sample rate is not the declared one",
    (c) => ((c.manifest.assets[c.manifest.assets.length - 1] as { sampleRate: number }).sampleRate = 48000),
    ["AUDIO_MISMATCH manifest/assets/13/sampleRate"],
  ),
  A(
    "a file that is not a WAV",
    (c) => {
      const a = c.manifest.assets[c.manifest.assets.length - 1] as {
        source: { uri: string; sha256: string };
      };
      const b = Buffer.from("ID3 not a wave file");
      writeFileSync(join(c.root, a.source.uri), b);
      a.source.sha256 = sha(b);
    },
    ["AUDIO_INVALID manifest/assets/13/source/uri"],
  ),
  A(
    "a WAV whose data chunk runs past the end of the file",
    (c) => {
      const a = c.manifest.assets[c.manifest.assets.length - 1] as {
        source: { uri: string; sha256: string };
      };
      const b = wav(1.2, 44100, 1, 4000);
      writeFileSync(join(c.root, a.source.uri), b);
      a.source.sha256 = sha(b);
    },
    ["AUDIO_INVALID manifest/assets/13/source/uri"],
  ),
];

/**
 * E1.6: what E1.5 refused and the engine now mixes (capabilities audio: several music clips, sfx, trim, fades,
 * duck depth). Each is a valid package: the gate passes it (no finding). Applied by the engine: film encode tests.
 */
export const AUDIO_E16_ACCEPTED: ExecCase[] = [
  A6("a sound-effect clip", (c) => c.pkg.audio.push({ ...c.pkg.audio[1]!, id: "sfx_one", role: "sfx" }), []),
  A6("a second music clip", (c) => c.pkg.audio.push({ ...c.pkg.audio[0]!, id: "music_two" }), []),
  A6(
    "music that starts at 0.5 s, for the rest of the film",
    (c) => {
      const m = c.pkg.audio[0]!;
      m.start = 0.5;
      m.duration = Math.min(3, c.pkg.output.duration - 0.5);
    },
    [],
  ),
  A6(
    "a trimmed voice that plays to the end of its file",
    (c) => {
      const v = c.pkg.audio[1]!;
      v.trim = 0.1;
      v.duration = 1.1;
    },
    [],
  ),
  A6("a fade in and a fade out", (c) => Object.assign(c.pkg.audio[1]!, { fadeIn: 0.2, fadeOut: 0.3 }), []),
  A6("a clip shorter than the file it plays", (c) => (c.pkg.audio[1]!.duration = 0.6), []),
  A6("a duck at most 7 dB deep (the v1 depth)", (c) => (c.pkg.mix.duckMusicDb = 7), []),
];

/** E1.6: refused, with their exact findings. */
export const AUDIO_E16_CASES: ExecCase[] = [
  A6("a trim that leaves nothing of the file", (c) => (c.pkg.audio[1]!.trim = 1.2), [
    "VALUE_RANGE package/audio/1/trim",
  ]),
  A6(
    "a duration longer than what the trim leaves",
    (c) => {
      const v = c.pkg.audio[1]!;
      v.trim = 0.5;
      v.duration = 1;
    },
    ["VALUE_RANGE package/audio/1/duration"],
  ),
  A6(
    "a clip that would play past the end of the film",
    (c) => {
      const v = c.pkg.audio[1]!;
      v.start = Math.round((c.pkg.output.duration - 0.5) * 1000) / 1000;
      v.duration = 1;
    },
    ["TIME_RANGE package/audio/1/start", "VALUE_RANGE package/audio/1/duration"],
  ),
  A6("a fade in longer than the clip", (c) => (c.pkg.audio[1]!.fadeIn = 2), [
    "VALUE_RANGE package/audio/1/fadeIn",
  ]),
  A6("fades longer than the clip", (c) => Object.assign(c.pkg.audio[1]!, { fadeIn: 0.8, fadeOut: 0.8 }), [
    "VALUE_RANGE package/audio/1/fadeOut",
  ]),
  // the contract itself caps the depth at 30 dB, the engine's maximum
  A6("a duck deeper than 30 dB", (c) => (c.pkg.mix.duckMusicDb = 31), ["SCHEMA package/mix/duckMusicDb"]),
  A6(
    "a duck depth without ducking",
    (c) => {
      c.pkg.mix.duckMusicDb = 6;
      delete c.pkg.mix.ducking;
    },
    ["VALUE_UNSUPPORTED package/mix/duckMusicDb"],
  ),
  A6(
    "more music clips than the engine mixes (64)",
    (c) => {
      for (let k = 0; k < 64; k++) c.pkg.audio.push({ ...c.pkg.audio[0]!, id: `music_${k + 2}` });
    },
    ["VALUE_UNSUPPORTED package/audio/65/role"],
  ),
  A6(
    "a sfx that starts between two milliseconds",
    (c) => {
      c.pkg.audio.push({ ...c.pkg.audio[1]!, id: "sfx_one", role: "sfx", start: 0.0005 });
    },
    ["VALUE_UNSUPPORTED package/audio/2/start"],
  ),
];
