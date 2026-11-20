/**
 * Character Builder: tagged SVG → vector parts.
 *
 * An artwork source (an artist's file, or a construction drawn by code) is an SVG whose groups carry
 * `data-part="id"` and `data-bind="..."`. Every path inside such a group becomes a path of that part: its points
 * become the part's vertices and its commands index them, so a curve stays a curve. A path inside a
 * `clip-path` group is clipped here, at build time, because a package has no general clip at run time; the
 * result is a polygon (straight segments), so clipped paths cannot carry morph targets (their vertex count
 * depends on the clip), which is fine for shading and regions.
 *
 * Supported SVG: `<g>` (data-part, data-bind, clip-path), `<clipPath>`, `<path d>` with absolute M, L, C, Q, Z,
 * `<circle>`, `<ellipse>`; attributes fill, stroke, stroke-width, opacity. Anything else is refused.
 */
import polygonClipping from "polygon-clipping";

export type Vec = [number, number];
export type Cmd =
  ["M", number] | ["L", number] | ["Q", number, number] | ["C", number, number, number] | ["Z"];

export interface TaggedPath {
  cmds: Cmd[];
  fill?: string;
  stroke?: { color: string; width: number };
}

export interface TaggedPart {
  id: string;
  bind: string;
  /**
   * How the part follows key states: `exact` (default) redraws point for point, so a key is the difference of its
   * points; `field` parts (outlines and shading regions computed from a form) move with the form's displacement.
   */
  morph: "exact" | "field";
  /** Order of the part's group in the document: the draw order. */
  order: number;
  vertices: Vec[];
  paths: TaggedPath[];
  /** Whether any path was clipped (its geometry then depends on the clip, not only on its own points). */
  clipped: boolean;
}

interface Raw {
  d: string;
  fill?: string;
  stroke?: string;
  width?: number;
  opacity: number;
}

const attrs = (s: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)) out[m[1] as string] = m[2] as string;
  return out;
};

const num = (s: string | undefined, fallback = 0): number => (s === undefined ? fallback : Number(s));

function circlePath(cx: number, cy: number, rx: number, ry: number): string {
  // four cubic arcs (kappa) make a circle or an ellipse
  const k = 0.5522847498;
  const p = (x: number, y: number) => `${cx + x} ${cy + y}`;
  return (
    `M${p(rx, 0)} C${p(rx, ry * k)} ${p(rx * k, ry)} ${p(0, ry)} C${p(-rx * k, ry)} ${p(-rx, ry * k)} ${p(-rx, 0)} ` +
    `C${p(-rx, -ry * k)} ${p(-rx * k, -ry)} ${p(0, -ry)} C${p(rx * k, -ry)} ${p(rx, -ry * k)} ${p(rx, 0)} Z`
  );
}

/** Parses an absolute path (M, L, C, Q, Z) into subpaths of [command, points]. */
export function parseD(d: string): Array<Array<{ c: string; pts: Vec[] }>> {
  const tokens = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const subs: Array<Array<{ c: string; pts: Vec[] }>> = [];
  let cur: Array<{ c: string; pts: Vec[] }> | null = null;
  let i = 0;
  let cmd = "";
  const take = (n: number): Vec[] => {
    const pts: Vec[] = [];
    for (let k = 0; k < n; k++) {
      pts.push([Number(tokens[i]), Number(tokens[i + 1])]);
      i += 2;
    }
    return pts;
  };
  while (i < tokens.length) {
    const t = tokens[i] as string;
    if (/^[MLCQZ]$/i.test(t)) {
      cmd = t.toUpperCase();
      i++;
      if (t !== t.toUpperCase()) throw new Error(`tagged svg: relative command ${t} is not supported`);
      if (cmd === "Z") {
        cur?.push({ c: "Z", pts: [] });
        continue;
      }
    }
    const n = cmd === "C" ? 3 : cmd === "Q" ? 2 : 1;
    if (cmd === "M") {
      cur = [];
      subs.push(cur);
      cur.push({ c: "M", pts: take(1) });
      cmd = "L"; // implicit lineto after a moveto
    } else if (cmd === "L" || cmd === "C" || cmd === "Q") {
      if (!cur) throw new Error("tagged svg: path does not start with M");
      cur.push({ c: cmd, pts: take(n) });
    } else throw new Error(`tagged svg: unexpected token ${t}`);
  }
  return subs;
}

/** Points along a parsed subpath (curves flattened), for clipping. */
function flatten(sub: Array<{ c: string; pts: Vec[] }>, steps = 6): Vec[] {
  const out: Vec[] = [];
  let p: Vec = [0, 0];
  for (const s of sub) {
    if (s.c === "M" || s.c === "L") {
      p = s.pts[0] as Vec;
      out.push(p);
    } else if (s.c === "C") {
      const [a, b, c] = s.pts as [Vec, Vec, Vec];
      for (let k = 1; k <= steps; k++) {
        const t = k / steps,
          u = 1 - t;
        out.push([
          u * u * u * p[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * c[0],
          u * u * u * p[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * c[1],
        ]);
      }
      p = c;
    } else if (s.c === "Q") {
      const [a, c] = s.pts as [Vec, Vec];
      for (let k = 1; k <= steps; k++) {
        const t = k / steps,
          u = 1 - t;
        out.push([
          u * u * p[0] + 2 * u * t * a[0] + t * t * c[0],
          u * u * p[1] + 2 * u * t * a[1] + t * t * c[1],
        ]);
      }
      p = c;
    }
  }
  return out;
}

const colour = (c: string | undefined, opacity: number): string | undefined => {
  if (!c || c === "none") return undefined;
  if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(c))
    throw new Error(`tagged svg: colour ${c} is not #rrggbb`);
  if (opacity >= 0.999) return c.toUpperCase();
  const base = c.slice(0, 7).toUpperCase();
  const a0 = c.length === 9 ? parseInt(c.slice(7), 16) / 255 : 1;
  const a = Math.round(Math.max(0, Math.min(1, a0 * opacity)) * 255);
  return `${base}${a.toString(16).padStart(2, "0").toUpperCase()}`;
};

/** Parses a tagged SVG into parts, in document order. */
export function parseTaggedSvg(svg: string): TaggedPart[] {
  const clips = new Map<string, string[]>();
  const parts: TaggedPart[] = [];
  type Tag = { id: string; bind: string; morph: "exact" | "field" };
  const stack: Array<{ part?: Tag; clip?: string }> = [];
  let clipDef: string | null = null;
  let order = 0;
  const current = (): { part: Tag; clips: string[] } | null => {
    let part: Tag | undefined;
    const cl: string[] = [];
    for (const s of stack) {
      if (s.part) part = s.part;
      if (s.clip) cl.push(s.clip);
    }
    return part ? { part, clips: cl } : null;
  };
  const byId = new Map<string, TaggedPart>();
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, close, tag, rest, selfClose] = m as unknown as [string, string, string, string, string];
    if (tag === "svg" || tag === "rect" || tag === "text" || tag === "line" || tag === "tspan") continue;
    if (close) {
      if (tag === "g") stack.pop();
      if (tag === "clipPath") clipDef = null;
      continue;
    }
    const a = attrs(rest);
    if (tag === "clipPath") {
      clipDef = a.id ?? "";
      clips.set(clipDef, []);
      if (selfClose) clipDef = null;
      continue;
    }
    if (tag === "g") {
      const entry: { part?: Tag; clip?: string } = {};
      if (a["data-part"])
        entry.part = {
          id: a["data-part"],
          bind: a["data-bind"] ?? "",
          morph: a["data-morph"] === "field" ? "field" : "exact",
        };
      const cp = a["clip-path"]?.match(/url\(#([^)]+)\)/);
      if (cp) entry.clip = cp[1];
      if (!selfClose) stack.push(entry);
      continue;
    }
    let raw: Raw;
    if (tag === "path")
      raw = {
        d: a.d ?? "",
        fill: a.fill,
        stroke: a.stroke,
        width: num(a["stroke-width"], 1),
        opacity: num(a.opacity, 1),
      };
    else if (tag === "circle")
      raw = {
        d: circlePath(num(a.cx), num(a.cy), num(a.r), num(a.r)),
        fill: a.fill,
        stroke: a.stroke,
        width: num(a["stroke-width"], 1),
        opacity: num(a.opacity, 1),
      };
    else if (tag === "ellipse")
      raw = {
        d: circlePath(num(a.cx), num(a.cy), num(a.rx), num(a.ry)),
        fill: a.fill,
        stroke: a.stroke,
        width: num(a["stroke-width"], 1),
        opacity: num(a.opacity, 1),
      };
    else throw new Error(`tagged svg: element <${tag}> is not supported`);
    if (clipDef !== null) {
      clips.get(clipDef)?.push(raw.d);
      continue;
    }
    const ctx = current();
    if (!ctx) continue; // untagged artwork is not part of the character
    let part = byId.get(ctx.part.id);
    if (!part) {
      part = {
        id: ctx.part.id,
        bind: ctx.part.bind,
        morph: ctx.part.morph,
        order: order++,
        vertices: [],
        paths: [],
        clipped: false,
      };
      byId.set(part.id, part);
      parts.push(part);
    }
    addPath(
      part,
      raw,
      ctx.clips.map((c) => clips.get(c) ?? []),
    );
  }
  return parts;
}

function addPath(part: TaggedPart, raw: Raw, clipSets: string[][]): void {
  const fill = colour(raw.fill, raw.opacity);
  const stroke =
    raw.stroke && raw.stroke !== "none"
      ? { color: colour(raw.stroke, raw.opacity) as string, width: raw.width ?? 1 }
      : undefined;
  if (!fill && !stroke) return;
  const subs = parseD(raw.d);
  if (clipSets.length && fill) {
    // clip at build time: the shape (all subpaths) against every active clip (each a union of paths)
    let shape: polygonClipping.MultiPolygon = subs.map((s) => [ring(flatten(s))]);
    shape = polygonClipping.union(shape);
    for (const set of clipSets) {
      const clip = polygonClipping.union(
        set.flatMap((d) => parseD(d).map((s) => [ring(flatten(s))])) as polygonClipping.MultiPolygon,
      );
      shape = polygonClipping.intersection(shape, clip);
    }
    const cmds: Cmd[] = [];
    for (const poly of shape)
      for (const r of poly) {
        const pts = simplify(r.slice(0, -1) as Vec[], CLIP_TOLERANCE);
        if (pts.length < 3) continue;
        pts.forEach((p, k) => {
          cmds.push([k === 0 ? "M" : "L", part.vertices.length]);
          part.vertices.push([round(p[0]), round(p[1])]);
        });
        cmds.push(["Z"]);
      }
    part.clipped = true;
    // a stroke of the fill's own colour (a seam seal, an outline's ink) follows the clipped outline; any other
    // stroke (a detail's outline) is kept whole
    const seal = stroke && stroke.color === fill;
    if (cmds.length) part.paths.push({ cmds, fill, ...(seal ? { stroke } : {}) });
    if (stroke && !seal) addPath(part, { ...raw, fill: "none" }, []);
    return;
  }
  const cmds: Cmd[] = [];
  for (const sub of subs)
    for (const s of sub) {
      const idx = s.pts.map((p) => {
        part.vertices.push([round(p[0]), round(p[1])]);
        return part.vertices.length - 1;
      });
      if (s.c === "Z") cmds.push(["Z"]);
      else if (s.c === "M") cmds.push(["M", idx[0] as number]);
      else if (s.c === "L") cmds.push(["L", idx[0] as number]);
      else if (s.c === "Q") cmds.push(["Q", idx[0] as number, idx[1] as number]);
      else cmds.push(["C", idx[0] as number, idx[1] as number, idx[2] as number]);
    }
  if (cmds.length >= 2) part.paths.push({ cmds, ...(fill ? { fill } : {}), ...(stroke ? { stroke } : {}) });
}

const round = (v: number): number => Math.round(v * 100) / 100;

/** Package units a clipped outline may move when it is simplified (its curves were flattened to clip it). */
const CLIP_TOLERANCE = 0.1;

/** Ramer–Douglas–Peucker on a closed ring. */
function simplify(pts: Vec[], tol: number): Vec[] {
  if (pts.length < 8) return pts;
  const keep = new Uint8Array(pts.length);
  const rdp = (a: number, b: number): void => {
    const p = pts[a] as Vec;
    const q = pts[b] as Vec;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const l = Math.hypot(dx, dy) || 1e-9;
    let far = -1;
    let fd = tol;
    for (let i = a + 1; i < b; i++) {
      const r = pts[i] as Vec;
      const d = Math.abs((r[0] - p[0]) * dy - (r[1] - p[1]) * dx) / l;
      if (d > fd) {
        fd = d;
        far = i;
      }
    }
    if (far < 0) return;
    keep[far] = 1;
    rdp(a, far);
    rdp(far, b);
  };
  // split the ring at its first point and the point farthest from it
  const o = pts[0] as Vec;
  let m = 1;
  pts.forEach((r, i) => {
    if (
      Math.hypot(r[0] - o[0], r[1] - o[1]) > Math.hypot((pts[m] as Vec)[0] - o[0], (pts[m] as Vec)[1] - o[1])
    )
      m = i;
  });
  keep[0] = 1;
  keep[m] = 1;
  rdp(0, m);
  const last = pts.length;
  pts.push(o);
  rdp(m, last);
  pts.pop();
  return pts.filter((_, i) => keep[i]);
}

/** A closed ring for polygon-clipping (first point repeated at the end). */
function ring(pts: Vec[]): Vec[] {
  const r = pts.map((p) => [p[0], p[1]] as Vec);
  const a = r[0],
    b = r[r.length - 1];
  if (a && b && (a[0] !== b[0] || a[1] !== b[1])) r.push([a[0], a[1]]);
  return r;
}
