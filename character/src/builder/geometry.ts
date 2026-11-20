/**
 * Builder geometry helpers: anchors that carry their skin weights and morph displacements, and smooth closed or
 * open outlines through them. Bézier control points are linear combinations of anchors, so their weights and
 * morph deltas are the same combinations: a curve deforms exactly as its anchors do.
 */
import type { CharacterPart, CharacterVectorPart } from "@erkasa/contracts";

export type Vec = [number, number];
export type Weights = Record<string, number>;

export interface Anchor {
  p: Vec;
  w: Weights;
  /** Morph id → displacement at full weight. */
  m: Record<string, Vec>;
}

export const anchor = (p: Vec, w: Weights, m: Record<string, Vec> = {}): Anchor => ({ p, w, m });

/** a·A + b·B + ... as an anchor (positions, weights and morph deltas combined linearly). */
export function combine(terms: ReadonlyArray<[number, Anchor]>): Anchor {
  const p: Vec = [0, 0];
  const w: Weights = {};
  const m: Record<string, Vec> = {};
  for (const [k, a] of terms) {
    p[0] += k * a.p[0];
    p[1] += k * a.p[1];
    for (const [b, x] of Object.entries(a.w)) w[b] = (w[b] ?? 0) + k * x;
    for (const [id, d] of Object.entries(a.m)) {
      const cur = m[id] ?? [0, 0];
      m[id] = [cur[0] + k * d[0], cur[1] + k * d[1]];
    }
  }
  return { p, w, m };
}

/**
 * A Bézier control point: its position and morph deltas are the exact Catmull-Rom combination; its skin weights
 * are those of the segment's two anchors blended at `t` (always positive, so skinning stays a convex blend).
 */
function control(c: Anchor, a: Anchor, b: Anchor, t: number): Anchor {
  return {
    p: c.p,
    m: c.m,
    w: combine([
      [1 - t, { p: [0, 0], w: a.w, m: {} }],
      [t, { p: [0, 0], w: b.w, m: {} }],
    ]).w,
  };
}

export type Cmd = CharacterVectorPart["paths"][number]["cmds"];

/** Collects vertices and builds the part's binding and morphs. */
export class PartGeometry {
  readonly anchors: Anchor[] = [];

  add(a: Anchor): number {
    this.anchors.push(a);
    return this.anchors.length - 1;
  }

  /** A smooth closed outline (Catmull-Rom as cubic Béziers) through the anchors. */
  closed(points: readonly Anchor[], tension = 1): Cmd {
    const n = points.length;
    const idx = points.map((p) => this.add(p));
    const cmds: Cmd = [["M", idx[0] as number]];
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n] as Anchor;
      const p1 = points[i] as Anchor;
      const p2 = points[(i + 1) % n] as Anchor;
      const p3 = points[(i + 2) % n] as Anchor;
      const k = tension / 6;
      const c1 = this.add(
        control(
          combine([
            [1, p1],
            [k, p2],
            [-k, p0],
          ]),
          p1,
          p2,
          1 / 3,
        ),
      );
      const c2 = this.add(
        control(
          combine([
            [1, p2],
            [-k, p3],
            [k, p1],
          ]),
          p1,
          p2,
          2 / 3,
        ),
      );
      cmds.push(["C", c1, c2, idx[(i + 1) % n] as number]);
    }
    cmds.push(["Z"]);
    return cmds;
  }

  /** A smooth open line through the anchors (end tangents from the end segments). */
  open(points: readonly Anchor[]): Cmd {
    const n = points.length;
    const idx = points.map((p) => this.add(p));
    const cmds: Cmd = [["M", idx[0] as number]];
    for (let i = 0; i < n - 1; i++) {
      const p0 = points[Math.max(0, i - 1)] as Anchor;
      const p1 = points[i] as Anchor;
      const p2 = points[i + 1] as Anchor;
      const p3 = points[Math.min(n - 1, i + 2)] as Anchor;
      const c1 = this.add(
        control(
          combine([
            [1, p1],
            [1 / 6, p2],
            [-1 / 6, p0],
          ]),
          p1,
          p2,
          1 / 3,
        ),
      );
      const c2 = this.add(
        control(
          combine([
            [1, p2],
            [-1 / 6, p3],
            [1 / 6, p1],
          ]),
          p1,
          p2,
          2 / 3,
        ),
      );
      cmds.push(["C", c1, c2, idx[i + 1] as number]);
    }
    return cmds;
  }

  /** Vertices, binding (rigid when every vertex has the same single bone) and morphs (zero deltas dropped). */
  build(): Pick<CharacterPart, "vertices" | "binding" | "morphs"> {
    const vertices = this.anchors.map((a): Vec => [round(a.p[0]), round(a.p[1])]);
    const bones = [
      ...new Set(this.anchors.flatMap((a) => Object.keys(a.w).filter((b) => Math.abs(a.w[b] ?? 0) > 1e-9))),
    ].sort();
    const single = bones.length === 1 ? (bones[0] as string) : undefined;
    const binding: CharacterPart["binding"] = single
      ? { kind: "rigid", bone: single }
      : {
          kind: "skin",
          bones,
          weights: this.anchors.map((a) => {
            const pairs = Object.entries(a.w)
              .filter(([, x]) => x > 1e-6)
              .sort((x, y) => y[1] - x[1])
              .slice(0, 4);
            const s = pairs.reduce((t, [, x]) => t + x, 0);
            const norm = pairs.map(([b, x]): [number, number] => [bones.indexOf(b), round(x / s, 6)]);
            // exact sum 1 after rounding
            const err = 1 - norm.reduce((t, [, x]) => t + x, 0);
            if (norm[0]) norm[0][1] = round(norm[0][1] + err, 6);
            return norm;
          }),
        };
    const ids = [...new Set(this.anchors.flatMap((a) => Object.keys(a.m)))].sort();
    const morphs = ids
      .map((id) => ({
        id,
        deltas: this.anchors
          .map((a, i): [number, number, number] => [i, round(a.m[id]?.[0] ?? 0), round(a.m[id]?.[1] ?? 0)])
          .filter(([, dx, dy]) => Math.abs(dx) > 1e-3 || Math.abs(dy) > 1e-3),
      }))
      .filter((mo) => mo.deltas.length > 0);
    return { vertices, binding, morphs };
  }
}

export const round = (x: number, d = 3): number => {
  const k = 10 ** d;
  const r = Math.round(x * k) / k;
  return Object.is(r, -0) ? 0 : r;
};
