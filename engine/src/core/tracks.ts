import type { Keyframe as KeyframeT } from "@erkasa/contracts";
import { easeFn, isHold } from "./easing.js";

export type Keyframe = KeyframeT;
export type Tracks = Record<string, Keyframe[]>;

/**
 * Samples a numeric track at a (scene-local) frame. The easing of a keyframe describes the
 * segment that ENDS at that keyframe. Before the first / after the last keyframe the value holds.
 */
export function sampleNumber(track: Keyframe[] | undefined, frame: number, fallback: number): number {
  if (!track || track.length === 0) return fallback;
  const first = track[0] as Keyframe;
  if (frame <= first.f) return asNumber(first.v, fallback);
  for (let i = 1; i < track.length; i++) {
    const b = track[i] as Keyframe;
    if (frame < b.f) {
      const a = track[i - 1] as Keyframe;
      const va = asNumber(a.v, fallback);
      if (isHold(b.ease)) return va;
      const t = (frame - a.f) / (b.f - a.f);
      return va + (asNumber(b.v, fallback) - va) * easeFn(b.ease)(t);
    }
  }
  return asNumber((track[track.length - 1] as Keyframe).v, fallback);
}

/** A discrete value (action clip, expression...) plus the previous one, for cross-fading. */
export interface DiscreteSample {
  value: string;
  /** Frame at which the current value started. */
  since: number;
  previous?: { value: string; since: number };
  /** 0 at the switch, 1 when fully blended into `value`. */
  blend: number;
}

export function sampleDiscrete(
  track: Keyframe[] | undefined,
  frame: number,
  fallback: string,
): DiscreteSample {
  if (!track || track.length === 0) return { value: fallback, since: 0, blend: 1 };
  let idx = -1;
  for (let i = 0; i < track.length; i++) {
    if ((track[i] as Keyframe).f <= frame) idx = i;
    else break;
  }
  if (idx < 0) return { value: String((track[0] as Keyframe).v), since: 0, blend: 1 };
  const cur = track[idx] as Keyframe;
  const prev = idx > 0 ? (track[idx - 1] as Keyframe) : undefined;
  const blendFrames = cur.blend ?? 0;
  const blend = blendFrames > 0 ? Math.min(1, (frame - cur.f) / blendFrames) : 1;
  const sample: DiscreteSample = { value: String(cur.v), since: cur.f, blend };
  if (prev && blend < 1) sample.previous = { value: String(prev.v), since: prev.f };
  return sample;
}

function asNumber(v: Keyframe["v"], fallback: number): number {
  return typeof v === "number" ? v : fallback;
}
