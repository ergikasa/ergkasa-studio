/**
 * E1.6 subphase 4a: the designed score of a film (an `erkasa.audio-plan/2` from the sound designer, built from the
 * licensed audio catalog) staged as package clips. The stager places what the plan says; it chooses nothing:
 *   - each music segment is one `music` clip of its library file: from `startSec` (whole ms), the file from
 *     `offsetSec` (trim), for the segment's length (no longer than the file after the trim, nor than the film),
 *     with its fades and gain (the designer's crossfades are two overlapping clips);
 *   - each effect is one `sfx` clip at `atSec` (whole ms), from `offsetSec`, for `maxSec` (with v1's 0.25 s fade
 *     out) or to the end of its file, inside the film;
 *   - the mix: v1's duck (a hard sidechain, threshold 0.015, ratio 20, the plan's attack and release) limited
 *     to the plan's depth (duckMusicDb = ducking.amountDb), and the plan's loudness target with an 11 LU range.
 * A segment longer than its file plays the file once (v1 looped it): the shortening is reported in `notes`.
 */
import { createHash } from "node:crypto";
import {
  toWholeMs,
  wavInfo,
  type AssetManifest,
  type AudioPlan,
  type RenderPackage,
} from "@erkasa/contracts";
import type { ManifestBuilder } from "./manifest.js";
import type { AudioFile } from "./audio.js";

type Asset = Extract<AssetManifest["assets"][number], { kind: "audio" }>;
type Clip = RenderPackage["audio"][number];
type Mix = RenderPackage["mix"];

/** A library file used by the score: the WAV the package carries, and where it comes from. */
export interface ScoreFile extends AudioFile {
  /** The catalog entry (`m_hook_doc_piano`). */
  catalogId: string;
  /** SPDX id or LicenseRef-* for the manifest (`LicenseRef-Pixabay-Content-License`). */
  license: string;
}

export interface Score {
  plan: AudioPlan;
  /** By catalog id (the plan's `assetId`). */
  files: Record<string, ScoreFile>;
}

/** v1's duck (engine-worker/src/sound/mix.ts): a hard compressor whose depth the mix limits. */
export const SCORE_DUCKING = { kind: "sidechain", threshold: 0.015, ratio: 20 } as const;
export const SCORE_RANGE_LU = 11;
/** v1's fade at the end of an effect cut to maxSec. */
export const SFX_CUT_FADE = 0.25;

/** The manifest asset id of a catalog entry (`m_hook_doc_piano` → `lib_m_hook_doc_piano`). */
export const libraryAssetId = (catalogId: string): string =>
  `lib_${catalogId.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;

function asset(f: ScoreFile): Asset {
  const w = wavInfo(f.bytes);
  if ("error" in w) throw new Error(`${f.uri}: ${w.error}`);
  return {
    id: libraryAssetId(f.catalogId),
    version: 1,
    kind: "audio",
    format: "wav",
    source: { kind: "file", uri: f.uri, sha256: createHash("sha256").update(f.bytes).digest("hex") },
    style: { kit: "erkasa_editorial_night_v1" },
    provenance: f.provenance,
    approval: f.approval,
    license: f.license,
    durationSec: w.durationSec,
    sampleRate: w.sampleRate,
  };
}

const ms = (x: number): number => Math.round(x * 1000) / 1000;
/**
 * The largest whole-ms value not above `limit` (rounding to the nearest ms could step past the end of the file or
 * of the film by half a millisecond, and the Gate allows 1e-6 s).
 */
const msAtMost = (x: number, limit: number): number => {
  let v = Math.floor(Math.min(x, limit) * 1000 + 1e-6) / 1000;
  while (v > limit) v = Math.round(v * 1000 - 1) / 1000;
  return v;
};

/** Music and sfx clips of the score, and the mix; `notes` says what had to be shortened or left out. */
export function stageScore(
  M: ManifestBuilder,
  score: Score,
  filmSec: number,
): { clips: Clip[]; mix: Omit<Mix, "loudness"> & { loudness: Mix["loudness"] }; notes: string[] } {
  const notes: string[] = [];
  const clips: Clip[] = [];
  const fileOf = (id: string): { a: Asset; ref: string } => {
    const f = score.files[id];
    if (!f) throw new Error(`the score uses '${id}', which has no file in the package`);
    const a = asset(f);
    return { a, ref: M.use(a) };
  };
  score.plan.music.forEach((m, k) => {
    const { a, ref } = fileOf(m.assetId);
    const start = toWholeMs(m.startSec);
    const trim = ms(Math.min(m.offsetSec, a.durationSec));
    const want = m.endSec - start;
    const duration = msAtMost(want, Math.min(a.durationSec - trim, filmSec - start));
    if (duration <= 0) {
      notes.push(`music ${m.assetId} at ${start} s left out: nothing of it fits`);
      return;
    }
    if (duration < want - 0.001)
      notes.push(
        `music ${m.assetId} at ${start} s plays ${duration} s of the ${ms(want)} s segment (the file or the film ends)`,
      );
    const fadeIn = msAtMost(m.fadeInSec, duration / 2);
    const fadeOut = msAtMost(m.fadeOutSec, duration - fadeIn);
    clips.push({
      id: `music_${String(k + 1).padStart(3, "0")}`,
      asset: ref,
      role: "music",
      start,
      trim,
      duration,
      gainDb: m.gainDb,
      fadeIn,
      fadeOut,
      pan: 0,
    });
  });
  score.plan.sfx.forEach((s, k) => {
    const { a, ref } = fileOf(s.assetId);
    const start = toWholeMs(s.atSec);
    const trim = ms(Math.min(s.offsetSec ?? 0, a.durationSec));
    const left = Math.min(a.durationSec - trim, filmSec - start);
    const duration = msAtMost(s.maxSec ?? left, left);
    if (duration <= 0) {
      notes.push(`sfx ${s.assetId} at ${start} s left out: it would play after the film`);
      return;
    }
    clips.push({
      id: `sfx_${String(k + 1).padStart(3, "0")}`,
      asset: ref,
      role: "sfx",
      start,
      trim,
      duration,
      gainDb: s.gainDb,
      fadeIn: 0,
      fadeOut: s.maxSec !== undefined ? msAtMost(SFX_CUT_FADE, duration) : 0,
      pan: 0,
    });
  });
  const d = score.plan.ducking;
  return {
    clips,
    mix: {
      duckMusicDb: d.amountDb,
      ducking: { ...SCORE_DUCKING, attackMs: d.attackMs, releaseMs: d.releaseMs },
      loudness: {
        integratedLufs: score.plan.loudness.targetLufs,
        truePeakDb: score.plan.loudness.truePeakDb,
        rangeLu: SCORE_RANGE_LU,
      },
    },
    notes,
  };
}
