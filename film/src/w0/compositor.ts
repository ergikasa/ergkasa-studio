/**
 * The W0 compositor (E1.4: moved out of composer.ts unchanged, its inputs made explicit). It knows nothing of plans,
 * timing, performances or scripts: the plan path (composer.ts) and the package renderer (package/) both describe a
 * frame as a `W0View` and get the same pixels.
 *
 *   sky · city · wall (blurred by depth of field) · cast shadows · furniture · people · near foliage
 *   × a light map (ambient by time of day + window, lamp, door and screen lights)
 *   + rim light on the side of each person that faces the key light · light shafts · bloom · vignette · grain
 *   + kinetic type and captions (as SVG, drawn last)
 */
import { createCanvas, loadImage, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { EASES, clamp } from "../motion.js";
import { DEFS, H, W, kineticType, type TypeLine } from "../style.js";
import { project, svgTransform, toScreen, type Cam } from "./camera.js";
import {
  byLight,
  cityLayer,
  midLayer,
  nearLayer,
  skyLayer,
  SPOTS,
  wallLayer,
  type PlaceState,
  type WorldParams,
} from "./world.js";

const M = 48; // margin around every offscreen layer, so blur has pixels to pull from at the frame edge
const CW = W + 2 * M;
const CH = H + 2 * M;

/** Everything one shot of the place needs to be drawn at one instant. */
export interface W0View {
  /** World time (s): the film grain follows it. */
  T: number;
  cam: Cam;
  /** The place at that instant (time of day, light, door, lamp, clock, binders). */
  st: PlaceState;
  world: WorldParams;
  city: { seed: number; nearSeed: number };
  /** Depth of each plane (world units in front of / behind the actors' plane). */
  depth: { sky: number; city: number; cityNear: number; wall: number; mid: number; near: number };
  /** Blur in px: sky and city, wall (and the people's shadows on it), furniture, people, near foliage. */
  blur: { far: number; wall: number; mid: number; people: number; near: number };
  /** Whether the near foliage is in the shot. */
  near: boolean;
  /** SVG in world units: the people in drawing order, the props they hold, the props at rest on the furniture. */
  people: string;
  held: string;
  resting: string;
}

const svgDoc = (body: string, defs = ""): Buffer =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}"><defs>${DEFS}${defs}</defs><g transform="translate(${M} ${M})">${body}</g></svg>`,
  );

async function layer(body: string): Promise<Awaited<ReturnType<typeof loadImage>>> {
  return loadImage(svgDoc(body));
}

interface Surfaces {
  main: Canvas;
  L: Canvas;
  LM: Canvas;
  E: Canvas;
  grain: Canvas[];
}

let surfaces: Surfaces | undefined;
function surf(): Surfaces {
  if (surfaces) return surfaces;
  const grain = [0, 1, 2, 3].map((k) => {
    const g = createCanvas(384, 384);
    const gc = g.getContext("2d");
    const d = gc.createImageData(384, 384);
    let s = 1234567 + k * 7919;
    for (let i = 0; i < d.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = (s >> 16) & 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    gc.putImageData(d, 0, 0);
    return g;
  });
  surfaces = {
    main: createCanvas(W, H),
    L: createCanvas(CW, CH),
    LM: createCanvas(CW, CH),
    E: createCanvas(CW, CH),
    grain,
  };
  return surfaces;
}

const rgba = (hex: string, a: number): string =>
  `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/** How much each light source is on. */
function lights(st: PlaceState) {
  const golden = byLight(st.light, [0.35, 1, 0.35, 0]);
  const dark = byLight(st.light, [0, 0.2, 0.75, 1]);
  return {
    ambient: byLight(st.light, ["#FFFFFF", "#F6E2C8", "#A7A6C8", "#646FA0"]),
    golden,
    dark,
    lamp: st.lamp * (0.25 + 0.75 * dark),
    door: st.door,
  };
}

function radial(c: SKRSContext2D, x: number, y: number, r: number, col: string, a: number): void {
  if (a <= 0.003 || r <= 1) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(0.45, rgba(col, a * 0.45));
  g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, 2 * r, 2 * r);
}

/** Multiply the layer in L by the light map, keeping L's own alpha. */
function lightLayer(img: Awaited<ReturnType<typeof loadImage>>, S: Surfaces, tint?: string): void {
  const l = S.L.getContext("2d");
  l.globalCompositeOperation = "source-over";
  l.globalAlpha = 1;
  l.filter = "none";
  l.clearRect(0, 0, CW, CH);
  l.drawImage(img, 0, 0);
  l.globalCompositeOperation = "multiply";
  l.drawImage(S.LM, 0, 0);
  if (tint) {
    l.fillStyle = tint;
    l.fillRect(0, 0, CW, CH);
  }
  l.globalCompositeOperation = "destination-in";
  l.drawImage(img, 0, 0);
  l.globalCompositeOperation = "source-over";
}

function drawL(ctx: SKRSContext2D, S: Surfaces, blur = 0, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (blur > 0.4) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.drawImage(S.L, -M, -M);
  ctx.restore();
}

/**
 * One composited frame: `cur`, and inside a cross-dissolve the previous shot under it (`prev.p`: how far the
 * dissolve is, 0..1, before easing). Vignette and grain follow `cur`.
 */
export async function compositeFrame(cur: W0View, prev?: { view: W0View; p: number }): Promise<Canvas> {
  const S = surf();
  await drawPlace(S.main.getContext("2d"), S, cur);
  if (prev) {
    const snap = createCanvas(W, H);
    snap.getContext("2d").drawImage(S.main, 0, 0);
    await drawPlace(S.main.getContext("2d"), S, prev.view);
    const ctx = S.main.getContext("2d");
    ctx.globalAlpha = EASES.io(prev.p);
    ctx.drawImage(snap, 0, 0);
    ctx.globalAlpha = 1;
  }
  finish(S.main.getContext("2d"), cur.T);
  return S.main;
}

async function drawPlace(ctx: SKRSContext2D, S: Surfaces, v: W0View): Promise<void> {
  const { cam, st, depth, blur } = v;
  const lt = lights(st);
  const pa = project(cam, depth.mid);
  const pw = project(cam, depth.wall);
  const sA = pa.s;
  const scr = (p: [number, number], pr = pa): [number, number] => {
    const [x, y] = toScreen(pr, p[0], p[1]);
    return [x + M, y + M];
  };

  // ---- light map
  const lm = S.LM.getContext("2d");
  lm.globalCompositeOperation = "source-over";
  lm.fillStyle = lt.ambient;
  lm.fillRect(0, 0, CW, CH);
  lm.globalCompositeOperation = "lighter";
  const win = SPOTS.window;
  const [wx, wy] = scr([(win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2 + 200], pw);
  radial(lm, wx, wy, 1500 * pw.s, "#FFB872", 0.34 * lt.golden);
  const [lx, ly] = scr(SPOTS.lampHead);
  radial(lm, lx - 60 * sA, ly + 120 * sA, 1050 * sA, "#FFC37A", 0.95 * lt.lamp);
  const [mx, my] = scr(SPOTS.monitor);
  radial(lm, mx, my, 420 * sA, "#9CC9FF", 0.3 * lt.dark);
  const dr = SPOTS.door;
  const [dx, dy] = scr([(dr.x0 + dr.x1) / 2, 1250], pw);
  radial(lm, dx + 120 * sA, dy, 1300 * sA, "#FFE6BF", 0.95 * lt.door);
  lm.globalCompositeOperation = "source-over";

  // ---- sky and city (their colours already carry the time of day)
  const skyPr = project(cam, depth.sky);
  const cityPr = project(cam, depth.city);
  const nearCityPr = project(cam, depth.cityNear);
  const skyImg = await layer(
    `<g transform="${svgTransform(skyPr)}">${skyLayer(st)}</g><g transform="${svgTransform(cityPr)}">${cityLayer(st, false, v.city.seed)}</g><g transform="${svgTransform(nearCityPr)}">${cityLayer(st, true, v.city.nearSeed)}</g>`,
  );
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#0C1529";
  ctx.fillRect(0, 0, W, H);
  const dofWall = blur.wall;
  ctx.save();
  if (blur.far > 0.4) ctx.filter = `blur(${blur.far.toFixed(1)}px)`;
  ctx.drawImage(skyImg, -M, -M);
  ctx.restore();

  // ---- the wall plane
  const wallImg = await layer(`<g transform="${svgTransform(pw)}">${wallLayer(st, v.world)}</g>`);
  lightLayer(wallImg, S, rgba(byLight(st.light, ["#FFFFFF", "#FFF4E6", "#E4E0F2", "#D8DCF0"]), 1));
  drawL(ctx, S, dofWall);

  // light shafts on the wall and floor from the low sun
  if (lt.golden > 0.02) {
    const a = scr([win.x0 + 40, win.y0 + 230], pw);
    const b = scr([win.x1, win.y0 + 230], pw);
    const c2 = scr([win.x1 - 900, 2150]);
    const d2 = scr([win.x0 - 1150, 2150]);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const g = ctx.createLinearGradient(a[0], a[1], d2[0], d2[1]);
    g.addColorStop(0, rgba("#FFC98A", 0.26 * lt.golden));
    g.addColorStop(1, rgba("#FFC98A", 0));
    ctx.fillStyle = g;
    ctx.filter = "blur(18px)";
    ctx.beginPath();
    ctx.moveTo(a[0] - M, a[1] - M);
    ctx.lineTo(b[0] - M, b[1] - M);
    ctx.lineTo(c2[0] - M, c2[1] - M);
    ctx.lineTo(d2[0] - M, d2[1] - M);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---- people (drawn now, used for shadows first)
  const actorsSvg = v.people + v.held;
  const restingSvg = v.resting;
  const actorImg = actorsSvg ? await layer(`<g transform="${svgTransform(pa)}">${actorsSvg}</g>`) : undefined;

  // cast shadows of people on the wall: away from the key light, soft
  if (actorImg) {
    const key = Math.max(lt.golden * 0.85, lt.lamp);
    const shA = 0.3 * key + 0.12 * lt.door;
    if (shA > 0.01) {
      const dir = lt.door > 0.3 ? 1 : -1;
      const e = S.E.getContext("2d");
      e.globalCompositeOperation = "source-over";
      e.clearRect(0, 0, CW, CH);
      e.drawImage(actorImg, 0, 0);
      e.globalCompositeOperation = "source-in";
      e.fillStyle = "#1B1530";
      e.fillRect(0, 0, CW, CH);
      e.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.globalAlpha = shA;
      ctx.filter = `blur(${(10 + dofWall).toFixed(1)}px)`;
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(S.E, -M + dir * 95 * sA, -M - 30 * sA, CW, CH * 0.985);
      ctx.restore();
    }
  }

  // ---- furniture (same plane as the people)
  const midImg = await layer(`<g transform="${svgTransform(pa)}">${midLayer(st, v.world)}${restingSvg}</g>`);
  lightLayer(midImg, S);
  drawL(ctx, S, blur.mid);

  // ---- people: lit, then a rim of light on the side that faces the key light
  if (actorImg) {
    lightLayer(actorImg, S);
    drawL(ctx, S, blur.people);
    const rims: Array<{ dir: number; col: string; a: number }> = [
      { dir: 1, col: "#FFC88A", a: Math.max(lt.golden * 0.9, lt.lamp * 0.85) },
      { dir: -1, col: "#FFF1D6", a: lt.door },
    ];
    for (const r of rims) {
      if (r.a < 0.03) continue;
      const e = S.E.getContext("2d");
      const wpx = Math.max(3, 5 * sA);
      e.globalCompositeOperation = "source-over";
      e.clearRect(0, 0, CW, CH);
      e.drawImage(actorImg, 0, 0);
      e.globalCompositeOperation = "destination-out";
      e.drawImage(actorImg, -r.dir * wpx, wpx * 0.35);
      e.globalCompositeOperation = "source-in";
      e.fillStyle = r.col;
      e.fillRect(0, 0, CW, CH);
      e.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = Math.min(1, r.a);
      ctx.filter = "blur(1.2px)";
      ctx.drawImage(S.E, -M, -M);
      ctx.restore();
    }
  }

  // ---- near foreground, far out of focus
  if (v.near) {
    const pn = project(cam, depth.near);
    const nearImg = await layer(`<g transform="${svgTransform(pn)}">${nearLayer()}</g>`);
    lightLayer(nearImg, S, rgba("#B8B4C8", 1));
    drawL(ctx, S, blur.near);
  }

  // ---- bloom: the lamp bulb, the low sun in the window, the open door
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  radial(ctx, lx - M - 62 * sA, ly - M + 70 * sA, 260 * sA, "#FFD9A0", 0.7 * lt.lamp);
  radial(ctx, wx - M, wy - M - 160 * pw.s, 900 * pw.s, "#FFC27E", 0.28 * lt.golden);
  radial(ctx, dx - M, dy - M, 900 * sA, "#FFF1D6", 0.65 * lt.door);
  ctx.restore();
}

// ------------------------------------------------------------------------------------ type, captions, finish

/** Vignette and film grain; the grain frame follows world time `T` (24 per second, 4 frames). */
function finish(ctx: SKRSContext2D, T: number): void {
  const S = surf();
  // vignette
  const v = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.28, W / 2, H * 0.46, H * 0.78);
  v.addColorStop(0, "rgba(8,10,24,0)");
  v.addColorStop(1, "rgba(8,10,24,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  // film grain
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.07;
  const g = S.grain[Math.floor(T * 24) % 4] as Canvas;
  const pat = ctx.createPattern(g, "repeat");
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** W0's kinetic type: a scrim that fades with it, and the type (`t`, `at`, `out`: the shot's own time). */
export function typeW0Svg(
  t: number,
  text: { lines: TypeLine[]; place: "top" | "center" | "bottom"; at: number; out: number | null; id: string },
): string {
  const y = text.place === "bottom" ? 1300 : text.place === "center" ? 860 : 250;
  const a = clamp((t - text.at + 0.2) / 0.5) * (text.out !== null ? 1 - clamp((t - text.out) / 0.4) : 1);
  let o = "";
  if (a > 0.01)
    o += `<rect x="0" y="0" width="${W}" height="${text.place === "top" ? 760 : 1920}" fill="url(#scrimW0)" opacity="${a.toFixed(3)}"/>`;
  return o + kineticType(t, text.lines, { id: text.id, y, at: text.at, out: text.out });
}

export interface CaptionLook {
  x: number;
  y: number;
  family: string;
  weight: number;
  size: number;
  color: string;
  highlight: string;
  stroke?: { color: string; width: number };
}

/**
 * A caption phrase: every word, the ones not yet spoken at 0.6 opacity, the current one in `highlight`; under it
 * the same text stroked. `inA`: how far the phrase has faded in (0..1).
 */
export function captionSvg(
  look: CaptionLook,
  words: Array<{ text: string; reached: boolean; current: boolean }>,
  inA: number,
): string {
  const spans = (stroke: boolean): string =>
    words
      .map((w) => {
        const fill = stroke ? (look.stroke?.color ?? look.color) : w.current ? look.highlight : look.color;
        return `<tspan fill="${fill}" fill-opacity="${stroke ? 0.9 : w.reached ? 1 : 0.6}">${escapeXml(w.text)} </tspan>`;
      })
      .join("");
  const attrs = `x="${look.x}" y="${look.y}" text-anchor="middle" font-family="${look.family}" font-weight="${look.weight}" font-size="${look.size}"`;
  const under = look.stroke
    ? `<text ${attrs} stroke="${look.stroke.color}" stroke-width="${look.stroke.width}" stroke-linejoin="round" stroke-opacity=".9">${spans(true)}</text>`
    : "";
  return `<g opacity="${inA.toFixed(3)}">${under}<text ${attrs}>${spans(false)}</text></g>`;
}

const escapeXml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const TYPE_DEFS = `<linearGradient id="scrimW0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0C1529" stop-opacity=".82"/><stop offset=".7" stop-color="#0C1529" stop-opacity=".35"/><stop offset="1" stop-color="#0C1529" stop-opacity="0"/></linearGradient>`;

/** Type and captions as one SVG layer over the finished frame, then the frame's RGBA bytes. */
export async function finalPixels(c: Canvas, overlaySvg: string): Promise<Buffer> {
  const ctx = c.getContext("2d");
  if (overlaySvg) {
    const img = await loadImage(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${DEFS}${TYPE_DEFS}</defs>${overlaySvg}</svg>`,
      ),
    );
    ctx.drawImage(img, 0, 0);
  }
  return Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer);
}
