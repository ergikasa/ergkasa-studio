/**
 * What a scene's camera can see, at every instant it can take (E1.4, V2). The gate checks `bounds` against it and
 * the stager writes `bounds` from it, through this one function.
 *
 * The view at an instant: with the camera at (x, y) and `height` world units tall, an output of W × H shows
 *
 *   [x − h·W/H/2, x + h·W/H/2] × [y − h/2, y + h/2]
 *
 * in world units: exactly the set view and (with x = W/2) the editorial view of a flat scene, and, for a parallax
 * scene, the actors' plane (depth 0), where the projection reduces to the same rectangle.
 *
 * Every instant, not only rendered frames: a samples track is constant between two sample boundaries (where
 * `sampleIndex` changes), a keys track is linear or constant between two keys (only linear and hold have a
 * definition), so between consecutive break points every edge of the view is affine in t and its extremes are at
 * the ends of the interval. The view is evaluated at both ends of every interval with that interval's own values,
 * and in the clamped regions before the first and after the last break point. Overshoot stored in samples is
 * covered because every sample is a value the camera takes.
 */
import { trackOf } from "./evaluate.js";
import type { RenderPackage, Track } from "./render-package.js";

type Scene = RenderPackage["scenes"][number];

export interface ViewRect {
  /** An instant at which the camera has this view (the end of an interval or a break point). */
  t: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export const viewRect = (t: number, x: number, y: number, h: number, W: number, H: number): ViewRect => {
  const halfW = (h * W) / H / 2;
  const halfH = h / 2;
  return { t, x0: x - halfW, x1: x + halfW, y0: y - halfH, y1: y + halfH };
};

/** The times at which the track's value can change. */
function breaks(tr: Track): number[] {
  if (tr.kind === "samples")
    // sampleIndex: floor((t - start) * rate + 1e-6) reaches i at t = start + (i - 1e-6) / rate
    return Array.from(
      { length: Math.max(0, tr.values.length - 1) },
      (_, k) => tr.start + (k + 1 - 1e-6) / tr.rate,
    );
  return tr.keys.map((k) => k.t);
}

/** The track's value on the open interval (a, b), as its values at the two ends (limits from inside). */
function ends(tr: Track, a: number, b: number): [number, number] {
  const mid = Number.isFinite(a) && Number.isFinite(b) ? (a + b) / 2 : Number.isFinite(a) ? a + 1 : b - 1;
  if (tr.kind === "samples") {
    const i = Math.min(tr.values.length - 1, Math.max(0, Math.floor((mid - tr.start) * tr.rate + 1e-6)));
    const v = tr.values[i] as number;
    return [v, v];
  }
  const keys = tr.keys;
  const first = keys[0] as (typeof keys)[number];
  if (mid <= first.t) return [first.v as number, first.v as number];
  for (let k = 1; k < keys.length; k++) {
    const p = keys[k - 1] as (typeof keys)[number];
    const q = keys[k] as (typeof keys)[number];
    if (mid < q.t) {
      if (q.ease !== "linear") return [p.v as number, p.v as number];
      const at = (t: number): number =>
        t === p.t
          ? (p.v as number)
          : t === q.t
            ? (q.v as number)
            : (p.v as number) + (((q.v as number) - (p.v as number)) * (t - p.t)) / (q.t - p.t);
      return [at(a), at(b)];
    }
  }
  const last = keys[keys.length - 1] as (typeof keys)[number];
  return [last.v as number, last.v as number];
}

/**
 * Every view the camera of `scene` takes. Undefined when the camera lacks one of its x, y, height tracks (the gate
 * reports TRACK_MISSING) or a key has no numeric definition (EASE_UNDEFINED).
 */
export function cameraViews(scene: Scene, W: number, H: number): ViewRect[] | undefined {
  let tracks: Track[];
  try {
    tracks = (["x", "y", "height"] as const).map((c) => trackOf(scene, "camera", undefined, c));
  } catch {
    return undefined;
  }
  // keys out of order (KEY_ORDER) or without a numeric definition (EASE_UNDEFINED) have no views to check
  for (const tr of tracks)
    if (
      tr.kind === "keys" &&
      tr.keys.some(
        (k, i) =>
          i > 0 && ((k.ease !== "linear" && k.ease !== "hold") || k.t <= (tr.keys[i - 1]?.t ?? -Infinity)),
      )
    )
      return undefined;
  const pts = [...new Set(tracks.flatMap(breaks))].sort((a, b) => a - b);
  const edges = [-Infinity, ...pts, Infinity];
  const out: ViewRect[] = [];
  for (let k = 0; k + 1 < edges.length; k++) {
    const a = edges[k] as number;
    const b = edges[k + 1] as number;
    const [x, y, h] = tracks.map((tr) => ends(tr, a, b)) as [
      [number, number],
      [number, number],
      [number, number],
    ];
    out.push(viewRect(Number.isFinite(a) ? a : b, x[0], y[0], h[0], W, H));
    out.push(viewRect(Number.isFinite(b) ? b : a, x[1], y[1], h[1], W, H));
  }
  return out;
}

/** The sides of `bounds` a view crosses, with how far (no tolerance). */
export function outside(
  bounds: Scene["bounds"],
  v: ViewRect,
): Array<{ side: "left" | "right" | "top" | "bottom"; by: number }> {
  const out: Array<{ side: "left" | "right" | "top" | "bottom"; by: number }> = [];
  if (v.x0 < bounds.x) out.push({ side: "left", by: bounds.x - v.x0 });
  if (v.x1 > bounds.x + bounds.w) out.push({ side: "right", by: v.x1 - (bounds.x + bounds.w) });
  if (v.y0 < bounds.y) out.push({ side: "top", by: bounds.y - v.y0 });
  if (v.y1 > bounds.y + bounds.h) out.push({ side: "bottom", by: v.y1 - (bounds.y + bounds.h) });
  return out;
}

const nextUp = (v: number): number => {
  if (v === 0) return Number.MIN_VALUE;
  const b = new Float64Array([v]);
  const i = new BigInt64Array(b.buffer);
  i[0] = (i[0] as bigint) + (v > 0 ? 1n : -1n);
  return b[0] as number;
};

/**
 * The smallest enlargement of `bounds` that contains every view: the sides move out to the views' extremes; the
 * width and height grow by one representable step at a time until `outside` (the gate's own test) finds nothing,
 * so float arithmetic can never leave a view a hair outside. Nothing is rounded.
 */
export function enclose(bounds: Scene["bounds"], views: ViewRect[]): Scene["bounds"] {
  let x = bounds.x;
  let y = bounds.y;
  let r = bounds.x + bounds.w;
  let b = bounds.y + bounds.h;
  for (const v of views) {
    x = Math.min(x, v.x0);
    y = Math.min(y, v.y0);
    r = Math.max(r, v.x1);
    b = Math.max(b, v.y1);
  }
  if (x === bounds.x && y === bounds.y && r === bounds.x + bounds.w && b === bounds.y + bounds.h)
    return bounds;
  let w = Math.max(bounds.w, r - x);
  let h = Math.max(bounds.h, b - y);
  while (x + w < r) w = nextUp(w);
  while (y + h < b) h = nextUp(h);
  return { x, y, w, h };
}
