/**
 * E1.5: the audio of a v2 film in its Render Package. The stager places what the run made, it makes nothing:
 *   - one voice clip per scene the voice was recorded for, at the scene's start in whole milliseconds (the
 *     engine's resolution; the v2 engine delayed by Math.round(start × 1000) ms too);
 *   - the sound bed (music and effects, film/src/sound.ts writeBed) as the one music clip, at 0, at the gain the
 *     v2 engine gave it under a voice (× 0.55) and none without one;
 *   - the mix: ducking by a compressor keyed by the voice (the v2 engine's: threshold 0.03, ratio 6, attack 80 ms,
 *     release 500 ms) when there is a voice and a bed; loudness −14 LUFS, true peak −1.5 dB, range 11 LU.
 * Every audio asset is a WAV whose header gives its duration and sample rate (contracts wavInfo, as the gate
 * reads it), hashed like any file asset. A clip is heard for its audible duration (contracts audibleDuration).
 */
import { createHash } from "node:crypto";
import {
  audibleDuration,
  toWholeMs,
  wavInfo,
  type AssetManifest,
  type RenderPackage,
} from "@erkasa/contracts";
import { prepareV2, sfxFor, writeBed, type FilmPlan, type Timing } from "./legacy.js";
import type { ManifestBuilder } from "./manifest.js";
import type { Script } from "@erkasa/contracts";

type Asset = AssetManifest["assets"][number];
type Clip = RenderPackage["audio"][number];
type Mix = RenderPackage["mix"];

export interface AudioFile {
  /** Where the file is, relative to the package root. */
  uri: string;
  bytes: Uint8Array;
  provenance: Extract<Asset, { kind: "audio" }>["provenance"];
  /** Who approved it for this run, and how. */
  approval: Extract<Asset, { kind: "audio" }>["approval"];
}

export interface V2Audio {
  voice: Array<{ sceneId: string } & AudioFile>;
  music?: AudioFile;
}

/** The v2 engine's mix (film/src/render.ts): bed × 0.55 under a voice, ducked; loudnorm I −14, TP −1.5, LRA 11. */
export const V2_MUSIC_UNDER_VOICE_DB = 20 * Math.log10(0.55);
export const V2_DUCKING = {
  kind: "sidechain",
  threshold: 0.03,
  ratio: 6,
  attackMs: 80,
  releaseMs: 500,
} as const;
export const V2_LOUDNESS = { integratedLufs: -14, truePeakDb: -1.5, rangeLu: 11 } as const;

function audioAsset(id: string, f: AudioFile): Extract<Asset, { kind: "audio" }> {
  const w = wavInfo(f.bytes);
  if ("error" in w) throw new Error(`${f.uri}: ${w.error}`);
  return {
    id,
    version: 1,
    kind: "audio",
    format: "wav",
    source: { kind: "file", uri: f.uri, sha256: createHash("sha256").update(f.bytes).digest("hex") },
    style: { kit: "erkasa_editorial_night_v1" },
    provenance: f.provenance,
    approval: f.approval,
    license: "LicenseRef-Erkasa-Original",
    durationSec: w.durationSec,
    sampleRate: w.sampleRate,
  };
}

/** The clips and the mix of a v2 film of `filmSec` seconds. */
export function stageAudio(
  M: ManifestBuilder,
  timing: Timing,
  filmSec: number,
  audio: V2Audio,
): { clips: Clip[]; mix: Mix } {
  const clips: Clip[] = [];
  const voiced = audio.voice.filter((v) => timing.scenes.some((s) => s.sceneId === v.sceneId));
  const clip = (
    id: string,
    asset: Extract<Asset, { kind: "audio" }>,
    role: Clip["role"],
    start: number,
    gainDb: number,
  ): Clip => ({
    id,
    asset: M.use(asset),
    role,
    start,
    trim: 0,
    duration: audibleDuration(start, asset.durationSec, filmSec),
    gainDb,
    fadeIn: 0,
    fadeOut: 0,
    pan: 0,
  });
  if (audio.music)
    clips.push(
      clip(
        "music",
        audioAsset("music_bed", audio.music),
        "music",
        0,
        voiced.length ? V2_MUSIC_UNDER_VOICE_DB : 0,
      ),
    );
  voiced.forEach((v, k) => {
    const sc = timing.scenes.find((s) => s.sceneId === v.sceneId) as Timing["scenes"][number];
    const n = String(k + 1).padStart(3, "0");
    clips.push(clip(`voice_${n}`, audioAsset(`voice_${n}`, v), "voice", toWholeMs(sc.start), 0));
  });
  return {
    clips,
    mix: {
      duckMusicDb: 0,
      ...(audio.music && voiced.length ? { ducking: { ...V2_DUCKING } } : {}),
      loudness: clips.length ? { ...V2_LOUDNESS } : { integratedLufs: -14, truePeakDb: -1.5 },
    },
  };
}

/**
 * Writes the v2 sound bed of a film (music and effects) to `file`, from the same timing the stager stages with:
 * film/src/sound.ts writeBed, as the v2 engine wrote it.
 */
export function writeBedV2(
  file: string,
  plan: FilmPlan,
  script: Script,
  voice: {
    alignments?: Parameters<typeof prepareV2>[0]["alignments"];
    clipDurations?: Record<string, number>;
  } = {},
): void {
  const { timing, composed } = prepareV2({ plan, script, ...voice });
  writeBed(file, script, timing, sfxFor(composed), composed.duration);
}
