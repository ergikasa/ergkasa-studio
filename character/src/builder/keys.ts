/**
 * Character Builder: morph targets from key drawings.
 *
 * A source delivers a part at rest and at key states (an expression, a turn, a nod). A key becomes a morph target:
 *   - exact: the part was redrawn point for point (same commands, same vertex count), so the target is the
 *     difference of its points;
 *   - field: the part's outline or shading was recomputed from a form (silhouettes, cel-shading regions), so its
 *     points do not correspond from one state to the next; the target moves each rest point with the form's own
 *     displacement, interpolated from the form's sample points (inverse distance, nearest samples).
 */
import type { TaggedPart, Vec } from "./sources/tagged-svg.js";

export type Delta = [number, number, number];

/** A form's sample points at rest and in a key state (same order), and which ones are seen at rest. */
export interface Field {
  from: readonly Vec[];
  to: readonly Vec[];
  seen: readonly boolean[];
}

/** Whether two drawings of a part have the same commands over the same vertex count. */
export function sameTopology(a: TaggedPart, b: TaggedPart): boolean {
  if (a.vertices.length !== b.vertices.length || a.paths.length !== b.paths.length) return false;
  for (let i = 0; i < a.paths.length; i++) {
    const p = a.paths[i]?.cmds ?? [];
    const q = b.paths[i]?.cmds ?? [];
    if (p.length !== q.length) return false;
    for (let k = 0; k < p.length; k++) {
      const x = p[k] as readonly (string | number)[];
      const y = q[k] as readonly (string | number)[];
      if (x.length !== y.length || x.some((v, j) => v !== y[j])) return false;
    }
  }
  return true;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** The exact target: differences of corresponding points (sparse: only points that move). */
export function exactDeltas(rest: readonly Vec[], key: readonly Vec[], eps = 0.01): Delta[] {
  const out: Delta[] = [];
  rest.forEach((p, i) => {
    const q = key[i] as Vec;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    if (Math.abs(dx) > eps || Math.abs(dy) > eps) out.push([i, r2(dx), r2(dy)]);
  });
  return out;
}

/** Nearest-sample lookup on a uniform grid. */
class Grid {
  private readonly cells = new Map<string, number[]>();
  constructor(
    private readonly pts: readonly Vec[],
    private readonly size: number,
  ) {
    pts.forEach((p, i) => {
      const k = this.key(Math.floor(p[0] / size), Math.floor(p[1] / size));
      const list = this.cells.get(k) ?? [];
      list.push(i);
      this.cells.set(k, list);
    });
  }
  private key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }
  /** The k nearest samples to q (indices and squared distances). */
  nearest(q: Vec, k: number): Array<[number, number]> {
    const cx = Math.floor(q[0] / this.size);
    const cy = Math.floor(q[1] / this.size);
    const found: Array<[number, number]> = [];
    for (let ring = 0; ring < 64; ring++) {
      for (let x = cx - ring; x <= cx + ring; x++)
        for (let y = cy - ring; y <= cy + ring; y++) {
          if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== ring) continue;
          for (const i of this.cells.get(this.key(x, y)) ?? []) {
            const p = this.pts[i] as Vec;
            found.push([i, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2]);
          }
        }
      // every sample within `ring` cells is found; enough once the k-th nearest is closer than that
      if (found.length >= k) {
        found.sort((a, b) => a[1] - b[1]);
        const kth = (found[k - 1] as [number, number])[1];
        if (kth <= (ring * this.size) ** 2) return found.slice(0, k);
      }
    }
    found.sort((a, b) => a[1] - b[1]);
    return found.slice(0, k);
  }
}

/** The field target: each rest point moves like the form's seen samples around it. */
export function fieldDeltas(rest: readonly Vec[], field: Field, k = 6, eps = 0.01): Delta[] {
  const idx: number[] = [];
  field.seen.forEach((s, i) => {
    if (s) idx.push(i);
  });
  const from = idx.map((i) => field.from[i] as Vec);
  const disp = idx.map((i) => {
    const a = field.from[i] as Vec;
    const b = field.to[i] as Vec;
    return [b[0] - a[0], b[1] - a[1]] as Vec;
  });
  const grid = new Grid(from, 12);
  const out: Delta[] = [];
  rest.forEach((p, i) => {
    let wx = 0;
    let wy = 0;
    let ws = 0;
    for (const [j, d2] of grid.nearest(p, k)) {
      const w = 1 / (d2 + 1);
      const d = disp[j] as Vec;
      wx += w * d[0];
      wy += w * d[1];
      ws += w;
    }
    if (ws === 0) return;
    const dx = wx / ws;
    const dy = wy / ws;
    if (Math.abs(dx) > eps || Math.abs(dy) > eps) out.push([i, r2(dx), r2(dy)]);
  });
  return out;
}
