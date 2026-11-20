/**
 * Drawing an evaluated character on a Skia canvas (@napi-rs/canvas, the library of the existing W0 compositor,
 * film/src/w0/compositor.ts). Vector parts are filled and stroked paths; texture parts are drawn triangle by
 * triangle with the image as a pattern mapped onto each deformed triangle. No filters: soft shading is painted
 * into textures by the Builder, never blurred at render time.
 *
 * Cross-fades between views: each combination of views is drawn to its own transparent layer and the layers are
 * summed with their weights ((1 − t)·A + t·B), then drawn over the frame, so parts common to both views do not
 * change and nothing behind the character shows through where both views cover.
 */
import {
  createCanvas,
  Path2D,
  type Canvas,
  type CanvasGradient,
  type CanvasPattern,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import type { CharacterPaint } from "@erkasa/contracts";
import type { DrawItem, Evaluated, IrisItem, Layer, PartItem } from "./evaluate.js";
import type { LoadedCharacter } from "./load.js";

export interface Placement {
  /** Where the package origin lands on the canvas, px. */
  x: number;
  y: number;
  /** Canvas px per package unit. */
  scale: number;
}

/** Screen pixels each triangle is grown by around its centroid, against anti-aliasing cracks between triangles. */
export const TRIANGLE_GROW_PX = 0.6;

const pt = (p: Float64Array, i: number): [number, number] => [p[i * 2] as number, p[i * 2 + 1] as number];

function pathOf(item: PartItem): Path2D {
  const path = new Path2D();
  if (item.part.kind !== "vector") return path;
  for (const sub of item.part.paths) for (const cmd of sub.cmds) appendCmd(path, item.points, cmd);
  return path;
}

function appendCmd(path: Path2D, p: Float64Array, cmd: readonly (string | number)[]): void {
  const v = (k: number): [number, number] => pt(p, cmd[k] as number);
  switch (cmd[0]) {
    case "M":
      path.moveTo(...v(1));
      break;
    case "L":
      path.lineTo(...v(1));
      break;
    case "Q":
      path.quadraticCurveTo(...v(1), ...v(2));
      break;
    case "C":
      path.bezierCurveTo(...v(1), ...v(2), ...v(3));
      break;
    default:
      path.closePath();
  }
}

function paintOf(ctx: SKRSContext2D, paint: CharacterPaint, p: Float64Array): string | CanvasGradient {
  if (paint.kind === "solid") return paint.color;
  let g: CanvasGradient;
  if (paint.kind === "linear") {
    const [x0, y0] = pt(p, paint.from);
    const [x1, y1] = pt(p, paint.to);
    g = ctx.createLinearGradient(x0, y0, x1, y1);
  } else {
    const [cx, cy] = pt(p, paint.center);
    const [ex, ey] = pt(p, paint.edge);
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1e-6, Math.hypot(ex - cx, ey - cy)));
  }
  for (const [o, c] of paint.stops) g.addColorStop(o, c);
  return g;
}

function drawVector(ctx: SKRSContext2D, item: PartItem): void {
  if (item.part.kind !== "vector") return;
  for (const sub of item.part.paths) {
    const path = new Path2D();
    for (const cmd of sub.cmds) appendCmd(path, item.points, cmd);
    if (sub.fill) {
      ctx.fillStyle = paintOf(ctx, sub.fill, item.points);
      ctx.fill(path);
    }
    if (sub.stroke) {
      ctx.strokeStyle = paintOf(ctx, sub.stroke.paint, item.points);
      ctx.lineWidth = sub.stroke.width;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke(path);
    }
  }
}

function drawTexture(
  c: LoadedCharacter,
  ctx: SKRSContext2D,
  item: PartItem,
  lod: Evaluated["lod"],
  scale: number,
): void {
  const part = item.part;
  if (part.kind !== "texture") return;
  const mediumImg = c.textures.get(part.images.medium);
  const img = c.textures.get(part.images[lod] ?? part.images.medium);
  if (!img || !mediumImg) return;
  // uv are in the medium image's pixels; another level is the same picture at another size
  const k = img.width / mediumImg.width;
  const pattern: CanvasPattern = ctx.createPattern(img, "no-repeat");
  const grow = TRIANGLE_GROW_PX / scale;
  const P = item.points;
  for (const [ia, ib, ic] of part.triangles) {
    const a = pt(P, ia);
    const b = pt(P, ib);
    const cc = pt(P, ic);
    const ua = part.uv[ia] as [number, number];
    const ub = part.uv[ib] as [number, number];
    const uc = part.uv[ic] as [number, number];
    // affine map texture px → package space for this triangle
    const sx1 = (ub[0] - ua[0]) * k;
    const sy1 = (ub[1] - ua[1]) * k;
    const sx2 = (uc[0] - ua[0]) * k;
    const sy2 = (uc[1] - ua[1]) * k;
    const det = sx1 * sy2 - sx2 * sy1;
    if (Math.abs(det) < 1e-9) continue;
    const dx1 = b[0] - a[0];
    const dy1 = b[1] - a[1];
    const dx2 = cc[0] - a[0];
    const dy2 = cc[1] - a[1];
    const A = (dx1 * sy2 - dx2 * sy1) / det;
    const C = (dx2 * sx1 - dx1 * sx2) / det;
    const B = (dy1 * sy2 - dy2 * sy1) / det;
    const D = (dy2 * sx1 - dy1 * sx2) / det;
    const E = a[0] - A * ua[0] * k - C * ua[1] * k;
    const F = a[1] - B * ua[0] * k - D * ua[1] * k;
    pattern.setTransform({ a: A, b: B, c: C, d: D, e: E, f: F });
    ctx.fillStyle = pattern;
    const mx = (a[0] + b[0] + cc[0]) / 3;
    const my = (a[1] + b[1] + cc[1]) / 3;
    const g = (q: [number, number]): [number, number] => {
      const vx = q[0] - mx;
      const vy = q[1] - my;
      const l = Math.hypot(vx, vy) || 1;
      return [q[0] + (vx / l) * grow, q[1] + (vy / l) * grow];
    };
    ctx.beginPath();
    ctx.moveTo(...g(a));
    ctx.lineTo(...g(b));
    ctx.lineTo(...g(cc));
    ctx.closePath();
    ctx.fill();
  }
}

function drawIris(ctx: SKRSContext2D, it: IrisItem): void {
  ctx.save();
  ctx.clip(pathOf(it.clip));
  const [cx, cy] = it.center;
  const rot = (it.angle * Math.PI) / 180;
  const ellipse = (rx: number, ry: number, color: string): void => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  const e = it.eye;
  ellipse(it.rx, it.ry, e.iris.ring);
  ellipse(it.rx * 0.82, it.ry * 0.82, e.iris.color);
  const k = e.pupil.radius / e.iris.radius;
  ellipse(it.rx * k, it.ry * k, e.pupil.color);
  ctx.beginPath();
  ctx.arc(it.highlight[0], it.highlight[1], e.highlight.radius, 0, Math.PI * 2);
  ctx.fillStyle = e.highlight.color;
  ctx.fill();
  ctx.restore();
}

function drawItems(
  c: LoadedCharacter,
  ctx: SKRSContext2D,
  items: readonly DrawItem[],
  ev: Evaluated,
  at: Placement,
): void {
  ctx.save();
  ctx.setTransform(at.scale, 0, 0, at.scale, at.x, at.y);
  for (const it of items) {
    if (it.kind === "iris") {
      ctx.globalAlpha = it.clip.opacity;
      drawIris(ctx, it);
      continue;
    }
    if (it.opacity <= 0) continue;
    ctx.globalAlpha = it.opacity;
    if (it.part.kind === "vector") drawVector(ctx, it);
    else drawTexture(c, ctx, it, ev.lod, at.scale);
  }
  ctx.restore();
}

/**
 * Offscreen canvases for cross-fades, reused: Skia's native pixel memory is not reclaimed promptly by the garbage
 * collector, so a canvas per frame grows the process by megabytes per frame (measured in Phase 2's benchmark).
 */
const POOL = new Map<string, Canvas[]>();
function pooled(width: number, height: number, k: number): Canvas {
  const key = `${width}x${height}`;
  const list = POOL.get(key) ?? [];
  POOL.set(key, list);
  while (list.length <= k) list.push(createCanvas(width, height));
  const cv = list[k] as Canvas;
  const g = cv.getContext("2d");
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, width, height);
  g.restore();
  return cv;
}

/** Draws the character on `ctx` (whose current transform is ignored: `at` places the package origin). */
export function drawCharacter(c: LoadedCharacter, ctx: SKRSContext2D, ev: Evaluated, at: Placement): void {
  const only = ev.layers.length === 1 ? (ev.layers[0] as Layer) : undefined;
  if (only) {
    drawItems(c, ctx, only.items, ev, at);
    return;
  }
  const { width, height } = ctx.canvas;
  const sum = pooled(width, height, 0);
  const sctx = sum.getContext("2d");
  ev.layers.forEach((layer, i) => {
    const one = pooled(width, height, i + 1);
    drawItems(c, one.getContext("2d"), layer.items, ev, at);
    sctx.save();
    sctx.globalAlpha = layer.weight;
    sctx.globalCompositeOperation = i === 0 ? "source-over" : "lighter";
    sctx.drawImage(one, 0, 0);
    sctx.restore();
  });
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(sum, 0, 0);
  ctx.restore();
}
