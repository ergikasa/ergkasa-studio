/**
 * The evaluation of an erkasa.render/1 package at a frame: the one implementation of the "Evaluation" section of
 * render-package.ts. The stager's tests, the Validation Gate and the engine's renderer all read packages through
 * this module, so producer and consumer never hold two readings of the contract.
 *
 * Pure: functions of their arguments only. No I/O, no clock, no randomness, no import other than the contract's
 * own types (checked by test/evaluate-boundary.test.ts).
 *
 *   keys      before the first key: its value; after the last: the last value; between two keys the value
 *             travels with the second key's ease. Only `linear` and `hold` are defined numerically so far; any
 *             other ease throws until the easing formulas are fixed (open item before E1.4).
 *   samples   values[i] with i = floor((t - start) * rate + 1e-6), clamped to 0 .. n-1. No interpolation.
 *   events    a node is visible unless the latest event at or before t with `visible` set says otherwise.
 *
 * Time is always the frame's own time, frame / fps.
 */
import type { RenderPackage, Track } from "./render-package.js";

type Scene = RenderPackage["scenes"][number];
type Target = Track["target"];

/** The only eases a key may use: the others have no numeric definition yet (refused by the gate as EASE_UNDEFINED). */
export const DEFINED_EASES: readonly string[] = ["linear", "hold"];

export const frameTime = (frame: number, fps: number): number => frame / fps;

/** Index of the sample a frame reads. */
export function sampleIndex(track: Extract<Track, { kind: "samples" }>, t: number): number {
  return Math.min(track.values.length - 1, Math.max(0, Math.floor((t - track.start) * track.rate + 1e-6)));
}

export function evaluate(track: Track, t: number): number | string {
  if (track.kind === "samples") return track.values[sampleIndex(track, t)] as number;
  const keys = track.keys;
  const first = keys[0];
  if (!first) throw new Error("a keys track has at least one key");
  if (t <= first.t) return first.v;
  for (let k = 1; k < keys.length; k++) {
    const a = keys[k - 1] as (typeof keys)[number];
    const b = keys[k] as (typeof keys)[number];
    if (t < b.t) {
      if (b.ease === "hold") return a.v;
      if (b.ease !== "linear")
        throw new Error(`ease '${b.ease}' has no numeric definition yet (open before E1.4)`);
      if (typeof a.v !== "number" || typeof b.v !== "number")
        throw new Error("colours are interpolated with hold only");
      return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
    }
  }
  return (keys[keys.length - 1] as (typeof keys)[number]).v;
}

const same = (a: Target, kind: string, id: string | undefined): boolean =>
  a.kind === kind && ("id" in a ? a.id : undefined) === id;

/** The track of a scene that drives (target, channel); exactly one must exist. */
export function trackOf(scene: Scene, kind: Target["kind"], id: string | undefined, channel: string): Track {
  const found = scene.tracks.filter((t) => same(t.target, kind, id) && t.channel === channel);
  if (found.length !== 1)
    throw new Error(`${scene.id}: ${found.length} tracks for ${kind}:${id ?? ""}:${channel}`);
  return found[0] as Track;
}

export function numberAt(
  scene: Scene,
  kind: Target["kind"],
  id: string | undefined,
  channel: string,
  t: number,
): number {
  const v = evaluate(trackOf(scene, kind, id, channel), t);
  if (typeof v !== "number") throw new Error(`${scene.id}: ${kind}:${id}:${channel} is not a number`);
  return v;
}

export function visibleAt(scene: Scene, node: string, t: number): boolean {
  let v = true;
  let at = -Infinity;
  for (const e of scene.events)
    if (e.node === node && e.visible !== undefined && e.t <= t && e.t >= at) {
      v = e.visible;
      at = e.t;
    }
  return v;
}

// ------------------------------------------------------------------------------------------------ captions

type Captions = Extract<RenderPackage["overlays"][number], { kind: "captions" }>;
export type Phrase = Captions["phrases"][number];

/** The phrase of a captions overlay on screen at t: in <= t < out (the first one, if several). */
export const phraseAt = (o: Captions, t: number): Phrase | undefined =>
  o.phrases.find((p) => t >= p.in && t < p.out);
/** A word has been reached once t >= its t. */
export const wordReached = (w: Phrase["words"][number], t: number): boolean => t >= w.t;
/** The word being spoken (drawn in `highlight`): t <= now < end. */
export const wordCurrent = (w: Phrase["words"][number], t: number): boolean => t >= w.t && t < w.end;
