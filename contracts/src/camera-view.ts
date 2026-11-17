/**
 * What a scene's camera shows, as the engine draws it (E1.4, V2 with the PO's decision B, 2026-11-17). One
 * implementation for the three of them: the renderer writes its view transforms with `drawn` and `transformAttr`,
 * the gate checks `bounds` against `cameraViews`, the stager writes `bounds` with `enclose` over the same views.
 *
 * The engine draws the world through an SVG transform `translate(ox oy) scale(s) translate(tx ty)` whose numbers
 * it writes rounded (`drawn`):
 *   - set (flat):        s = r2(H/h), tx = r2(−x), ty = r2(−y), (ox, oy) = (W/2, H/2)        r2: 2 decimals
 *   - editorial (flat):  s = r2(H/h), oy = r2(H/2 + (H/2 − y)·H/h), ox = W/2, (tx, ty) = (−W/2, −H/2)
 *   - parallax (W0):     p = project(camera, plane depth); s = p.s to 5 decimals, tx = −p.cx and ty = −p.cy to 3
 * The view is the part of the world those numbers put in the frame [0, W] × [0, H]:
 *   [(0 − ox)/s − tx, (W − ox)/s − tx] × [(0 − oy)/s − ty, (H − oy)/s − ty]
 * computed from the numbers as written (Number of the text), with no tolerance and no further rounding.
 *
 * Every instant, not only rendered frames. Between two break points of the camera's x, y, height tracks (sample
 * boundaries, key times) each channel is constant or linear, and each written number is a monotone function of
 * t: r2 and toFixed are monotone, H/h is monotone in h, (H/2 − y)·H/h is a ratio of two affine functions of t,
 * project's scale is strictly decreasing in h (d ln s/dh = (γ·dz/(D + dz) − 1)/h < 0 for γ ≤ 1, D + dz > 0) and
 * its centre affine in x. So the numbers change only at finitely many instants, found by bisection on t down to
 * adjacent floats; the view is constant between two of them and is evaluated at both sides of every change and
 * at both ends of the interval (limits from inside). Before the first and after the last break point the camera
 * is constant.
 */
import { trackOf } from "./evaluate.js";
import type { AssetManifest } from "./asset-manifest.js";
import type { RenderPackage, Track } from "./render-package.js";

type Scene = RenderPackage["scenes"][number];
type Node = Scene["layers"][number]["nodes"][number];

export interface ViewRect {
  /** An instant at which the camera has this view. */
  t: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface Framing {
  cx: number;
  cy: number;
  height: number;
}

/** How a scene is drawn through its camera. `plane`: depth of the layer the view is measured on. */
export type Lens =
  | { kind: "set" }
  | { kind: "editorial" }
  | { kind: "parallax"; reference: Framing; gamma: number; plane: number };

/** The engine's 2-decimal rounding of transform numbers (motion.ts `fmt` writes String of this). */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface Projection {
  s: number;
  cx: number;
  cy: number;
}

/**
 * W0's projection of a layer at depth dz: screen = (p − c)·s + (W/2, H/2). Part of every zoom is lens and part
 * is distance (gamma); the camera's distance at the reference framing is the reference height.
 */
export function project(c: Framing, dz: number, ref: Framing, gamma: number, H: number): Projection {
  const dref = ref.height;
  const D = dref * (c.height / ref.height) ** gamma;
  const s = (H / c.height) * ((D * (dref + dz)) / (dref * (D + dz)));
  const k = dref / (dref + dz);
  return { s, cx: ref.cx + (c.cx - ref.cx) * k, cy: ref.cy + (c.cy - ref.cy) * k };
}

/** The numbers of a view transform as the engine writes them: translate(ox oy) scale(s) translate(tx ty). */
export interface Drawn {
  ox: string;
  oy: string;
  s: string;
  tx: string;
  ty: string;
}

export const transformAttr = (d: Drawn): string =>
  `translate(${d.ox} ${d.oy}) scale(${d.s}) translate(${d.tx} ${d.ty})`;

/** W0: the transform of a projected layer (w0/camera.ts svgTransform). */
export const projected = (p: Projection, W: number, H: number): Drawn => ({
  ox: String(W / 2),
  oy: String(H / 2),
  s: p.s.toFixed(5),
  tx: (-p.cx).toFixed(3),
  ty: (-p.cy).toFixed(3),
});

/** The transform the engine writes for the camera at (x, y), `h` world units tall. */
export function drawn(lens: Lens, x: number, y: number, h: number, W: number, H: number): Drawn {
  if (lens.kind === "parallax")
    return projected(project({ cx: x, cy: y, height: h }, lens.plane, lens.reference, lens.gamma, H), W, H);
  if (lens.kind === "editorial") {
    const z = H / h;
    const dy = (H / 2 - y) * z;
    return {
      ox: String(W / 2),
      oy: String(round2(H / 2 + dy)),
      s: String(round2(z)),
      tx: String(-W / 2),
      ty: String(-H / 2),
    };
  }
  return {
    ox: String(W / 2),
    oy: String(H / 2),
    s: String(round2(H / h)),
    tx: String(round2(-x)),
    ty: String(round2(-y)),
  };
}

/** The part of the world a transform puts in the frame [0, W] × [0, H]. */
export function viewOf(d: Drawn, W: number, H: number, t = 0): ViewRect {
  const [ox, oy, s, tx, ty] = [d.ox, d.oy, d.s, d.tx, d.ty].map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  return { t, x0: (0 - ox) / s - tx, x1: (W - ox) / s - tx, y0: (0 - oy) / s - ty, y1: (H - oy) / s - ty };
}

/** The rule that decides a scene's lens: editorial builtins (a prefix), and the parallax projection. */
export interface LensRule {
  editorial: { builtins: string } | null;
  parallax: { reference: Framing; gamma: number; plane: string } | null;
}

/** The builtin a node is drawn by (its state's builtin source), from the manifest. */
export function builtinOf(manifest: AssetManifest): (n: Node) => string | undefined {
  const named = new Map(manifest.assets.map((a) => [`${a.id}@${a.version}`, a]));
  return (n) => {
    if (n.kind !== "asset") return undefined;
    const a = named.get(n.asset);
    if (a?.kind !== "vector") return undefined;
    const st = a.states.find((s) => s.name === n.state);
    return st && "source" in st && st.source.kind === "builtin" ? st.source.name : undefined;
  };
}

/**
 * How the engine draws `scene`: parallax at the depth of the layer of the plane's builtin; flat scenes with a
 * node of the editorial builtins (in their layers, as the renderer looks) editorially, the others as a set.
 * Undefined when a parallax scene has no layer with the plane's builtin (the gate reports the missing role).
 */
export function sceneLens(
  scene: Scene,
  of: (n: Node) => string | undefined,
  rule: LensRule,
): Lens | undefined {
  if (rule.parallax) {
    const plane = rule.parallax.plane;
    const l = scene.layers.find((x) => x.nodes.some((n) => of(n) === plane));
    if (!l) return undefined;
    return {
      kind: "parallax",
      reference: rule.parallax.reference,
      gamma: rule.parallax.gamma,
      plane: l.depth,
    };
  }
  const ed = rule.editorial;
  if (ed && scene.layers.some((l) => l.nodes.some((n) => of(n)?.startsWith(ed.builtins))))
    return { kind: "editorial" };
  return { kind: "set" };
}

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

/** The track's value on [a, b] as the interval's own function (limits from inside at the ends). */
function within(tr: Track, a: number, b: number): (t: number) => number {
  const mid = Number.isFinite(a) && Number.isFinite(b) ? (a + b) / 2 : Number.isFinite(a) ? a + 1 : b - 1;
  if (tr.kind === "samples") {
    const i = Math.min(tr.values.length - 1, Math.max(0, Math.floor((mid - tr.start) * tr.rate + 1e-6)));
    const v = tr.values[i] as number;
    return () => v;
  }
  const keys = tr.keys;
  const first = keys[0] as (typeof keys)[number];
  if (mid <= first.t) return () => first.v as number;
  for (let k = 1; k < keys.length; k++) {
    const p = keys[k - 1] as (typeof keys)[number];
    const q = keys[k] as (typeof keys)[number];
    if (mid < q.t) {
      if (q.ease !== "linear") return () => p.v as number;
      // evaluate.ts, the renderer's evaluator, with the exact key values at the keys
      return (t) =>
        t === p.t
          ? (p.v as number)
          : t === q.t
            ? (q.v as number)
            : (p.v as number) + (((q.v as number) - (p.v as number)) * (t - p.t)) / (q.t - p.t);
    }
  }
  const last = keys[keys.length - 1] as (typeof keys)[number];
  return () => last.v as number;
}

const key = (d: Drawn): string => `${d.ox} ${d.oy} ${d.s} ${d.tx} ${d.ty}`;

/**
 * Every view the camera of `scene` takes, drawn through `lens`. Undefined when the camera lacks one of its x, y,
 * height tracks (the gate reports TRACK_MISSING) or a key is out of order or has no numeric definition.
 */
export function cameraViews(scene: Scene, W: number, H: number, lens: Lens): ViewRect[] | undefined {
  let tracks: Track[];
  try {
    tracks = (["x", "y", "height"] as const).map((c) => trackOf(scene, "camera", undefined, c));
  } catch {
    return undefined;
  }
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
  for (let e = 0; e + 1 < edges.length; e++) {
    const a = edges[e] as number;
    const b = edges[e + 1] as number;
    const [fx, fy, fh] = tracks.map((tr) => within(tr, a, b)) as [
      (t: number) => number,
      (t: number) => number,
      (t: number) => number,
    ];
    const at = (t: number): Drawn => drawn(lens, fx(t), fy(t), fh(t), W, H);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      const t = Number.isFinite(a) ? a : b;
      out.push(viewOf(at(t), W, H, t));
      continue;
    }
    // the instants where a written number changes: bisection down to adjacent floats
    const instants: number[] = [a, b];
    const split = (lo: number, dlo: string, hi: number, dhi: string): void => {
      if (dlo === dhi) return;
      const mid = lo + (hi - lo) / 2;
      if (mid <= lo || mid >= hi) {
        instants.push(lo, hi);
        return;
      }
      const dm = key(at(mid));
      split(lo, dlo, mid, dm);
      split(mid, dm, hi, dhi);
    };
    split(a, key(at(a)), b, key(at(b)));
    for (const t of new Set(instants)) out.push(viewOf(at(t), W, H, t));
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
