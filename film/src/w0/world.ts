/**
 * W0: a place built once, as layers at different depths, from a seed and a few parameters (world.json).
 *
 * Every layer is drawn in "authored" coordinates: what the wide reference camera sees, aligned with the actors'
 * plane. The camera (camera.ts) projects each layer by its depth, so walls, the city behind the window and the
 * near foliage move at different speeds and the room reads as a space, not a backdrop. Colours are authored
 * fully lit; light and time of day are applied later by the compositor as a light map, so the same room works
 * at noon, at sunset and at night.
 */
import { hash01 } from "../motion.js";
import type { SetDef } from "../sets.js";

const f = (n: number): string => String(Math.round(n * 100) / 100);

export interface WorldParams {
  seed: number;
  /** Years the person has given to this place: one binder per year, oldest at the bottom. */
  years: number[];
  /** Palette of the show, fully lit. */
  palette: Record<string, string>;
}

/** Changing state of the place at one moment. */
export interface PlaceState {
  /** Film time, seconds (the clock reads it). */
  t: number;
  /** 0 day · 1 golden · 2 dusk · 3 night. */
  light: number;
  /** Door: 0 closed .. 1 open. */
  door: number;
  /** Desk lamp: 0 off .. 1 on. */
  lamp: number;
  /** Clock time in minutes after midnight. */
  clockMin: number;
  /** How many binders are on the stack (fractional while the last one falls). */
  binders: number;
}

/** Layer depths (in reference-camera distance units; the actors' plane is 0, the reference distance 2100). */
export const DEPTH = { sky: 30000, city: 5200, cityNear: 2600, wall: 520, mid: 0, near: -650 } as const;

export const FLOOR = 1700; // where people stand
const WALL_BASE = 1585; // where the back wall meets the floor (authored)
export const WORLD_W = 2900;
export const WORLD_H = 2300;

// --------------------------------------------------------------------------- the marks people use

export function officeSet(): SetDef {
  return {
    id: "office",
    w: WORLD_W,
    h: WORLD_H,
    floor: FLOOR,
    wide: { cx: 1450, cy: 1120, height: 2140 },
    marks: {
      chair: { x: 1150, kind: "seat", facing: 1, seatY: 1395, look: [1430, 1150], work: [1370, 1266] },
      window: { x: 1880, kind: "stand", facing: 1, look: [2240, 640] },
      door: { x: 560, kind: "stand", facing: -1, look: [300, 1050] },
      middle: { x: 880, kind: "stand", facing: -1, look: [300, 1050] },
      desk_top: { x: 1330, kind: "stand", facing: 1, surfaceY: 1290 },
    },
    props: { cup: { kind: "cup", x: 1330, y: 1262 } },
    targets: {
      clock: [1060, 470],
      screen: [1430, 1150],
      window_view: [2240, 640],
      door: [320, 1080],
      binders: [1705, 1180],
      floor: [900, 1600],
    },
    back: () => "",
    front: () => "",
  };
}

/** Where things are (actor-plane coordinates) for the compositor's lights and for framing. */
export const SPOTS = {
  lampHead: [1818, 1062] as [number, number],
  window: { x0: 1700, x1: 2400, y0: 300, y1: 1200 },
  door: { x0: 150, x1: 480, y0: 680, y1: WALL_BASE },
  clock: [1060, 470] as [number, number],
  binders: [1705, 1190] as [number, number],
  monitor: [1430, 1150] as [number, number],
};

// --------------------------------------------------------------------------- sky and city (seen through the window)

const mix = (a: string, b: string, k: number): string => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + ((pb[i] as number) - v) * Math.max(0, Math.min(1, k))));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};
/** Value of a 4-stop day curve at a fractional light. */
export function byLight<T extends number | string>(light: number, v: [T, T, T, T]): T {
  const i = Math.max(0, Math.min(2, Math.floor(light)));
  const k = Math.max(0, Math.min(1, light - i));
  const a = v[i] as T,
    b = v[i + 1] as T;
  if (typeof a === "number") return (a + ((b as number) - a) * k) as T;
  return mix(a as string, b as string, k) as T;
}

export function skyLayer(s: PlaceState): string {
  const top = byLight(s.light, ["#7FB3DA", "#E9805A", "#4B4E86", "#0B1430"]);
  const midc = byLight(s.light, ["#BFDCEE", "#F7B26E", "#A86F86", "#1A2650"]);
  const low = byLight(s.light, ["#EAF3F4", "#FFE2A6", "#E9A779", "#2C3A6A"]);
  const sunY = 760 + s.light * 150;
  const sunA = byLight(s.light, [0.9, 1, 0.55, 0]);
  const stars = byLight(s.light, [0, 0, 0.25, 1]);
  let st = "";
  for (let i = 0; i < 40; i++)
    st += `<circle cx="${f(1500 + hash01(i, 3) * 1100)}" cy="${f(150 + hash01(i, 4) * 600)}" r="${f(1.5 + hash01(i, 5) * 2.2)}" fill="#FFF" opacity="${f(stars * (0.4 + hash01(i, 6) * 0.6))}"/>`;
  return `<defs><linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset=".6" stop-color="${midc}"/><stop offset="1" stop-color="${low}"/></linearGradient>
  <radialGradient id="sunh"><stop offset="0" stop-color="#FFF4D6" stop-opacity="${f(sunA * 0.9)}"/><stop offset=".25" stop-color="#FFD27D" stop-opacity="${f(sunA * 0.45)}"/><stop offset="1" stop-color="#FFD27D" stop-opacity="0"/></radialGradient></defs>
  <rect x="1000" y="-400" width="2400" height="2200" fill="url(#skyg)"/>${st}
  <circle cx="2150" cy="${f(sunY)}" r="420" fill="url(#sunh)"/>
  <circle cx="2150" cy="${f(sunY)}" r="70" fill="#FFF3D4" opacity="${f(sunA)}"/>
  ${[0, 1, 2].map((i) => `<ellipse cx="${f(1700 + i * 380 + hash01(i, 9) * 120)}" cy="${f(360 + i * 70)}" rx="${f(180 + i * 40)}" ry="22" fill="${byLight(s.light, ["#FFFFFF", "#FFD6B0", "#C9879A", "#1F2B55"])}" opacity=".55"/>`).join("")}`;
}

/** A skyline: rows of buildings with windows that light up as the day ends. */
export function cityLayer(s: PlaceState, near: boolean, seed: number): string {
  const n = near ? 9 : 16;
  const base = near ? 1260 : 1180;
  const body = near
    ? byLight(s.light, ["#7D8DA3", "#9A6A68", "#3E3E66", "#121A36"])
    : byLight(s.light, ["#A9B9CB", "#D49A83", "#6C5D84", "#1C2647"]);
  const lit = byLight(s.light, [0, 0.05, 0.55, 0.95]);
  let out = "";
  let x = 1560;
  for (let i = 0; i < n; i++) {
    const w = (near ? 120 : 70) + hash01(seed, i, 1) * (near ? 120 : 80);
    const h = (near ? 260 : 220) + hash01(seed, i, 2) * (near ? 380 : 420);
    out += `<rect x="${f(x)}" y="${f(base - h)}" width="${f(w)}" height="${f(h + 400)}" fill="${body}"/>`;
    if (hash01(seed, i, 7) > 0.6)
      out += `<rect x="${f(x + w * 0.45)}" y="${f(base - h - 40)}" width="4" height="40" fill="${body}"/>`;
    const cols = Math.floor(w / (near ? 26 : 18));
    const rows = Math.floor(h / (near ? 34 : 26));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const on = hash01(seed, i, r, c) < 0.38;
        if (!on) continue;
        const ww = near ? 10 : 6;
        out += `<rect x="${f(x + 8 + c * (near ? 26 : 18))}" y="${f(base - h + 14 + r * (near ? 34 : 26))}" width="${ww}" height="${near ? 14 : 9}" fill="#FFD98A" opacity="${f(lit * (0.5 + hash01(seed, i, r, c, 3) * 0.5))}"/>`;
      }
    x += w + (near ? 30 : 12) + hash01(seed, i, 3) * 40;
  }
  return out;
}

// --------------------------------------------------------------------------- the back wall (one plane)

function books(x: number, y: number, w: number, seed: number, P: Record<string, string>): string {
  // a row of books standing on a shelf at y (their bottom), seeded heights, colours and leans
  const cols = [P["coral"], P["teal"], P["ochre"], P["slate"], P["cream"], "#7A6A8A", "#B85C4A", "#3F6F7A"];
  let out = "";
  let cx = x;
  let k = 0;
  while (cx < x + w - 20) {
    const bw = 16 + hash01(seed, k, 1) * 18;
    const bh = 70 + hash01(seed, k, 2) * 60;
    const lean = hash01(seed, k, 3) > 0.9 ? 12 : 0;
    const col = cols[Math.floor(hash01(seed, k, 4) * cols.length)] as string;
    const gap = hash01(seed, k, 5) > 0.85 ? 26 : 2;
    out += `<g transform="translate(${f(cx)} ${f(y)}) rotate(${lean})"><rect x="0" y="${f(-bh)}" width="${f(bw)}" height="${f(bh)}" rx="2" fill="${col}"/><rect x="${f(bw * 0.2)}" y="${f(-bh + 12)}" width="${f(bw * 0.6)}" height="5" fill="#FFF" opacity=".35"/><rect x="${f(bw * 0.2)}" y="${f(-22)}" width="${f(bw * 0.6)}" height="4" fill="#000" opacity=".18"/></g>`;
    cx += bw + gap;
    k++;
  }
  return out;
}

function clock(cx: number, cy: number, r: number, minutes: number, P: Record<string, string>): string {
  const h = ((minutes / 60) % 12) * 30;
  const m = (minutes % 60) * 6;
  const sec = ((minutes * 60) % 60) * 6;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const r0 = i % 3 === 0 ? r * 0.72 : r * 0.8;
    return `<line x1="${f(cx + Math.sin(a) * r0)}" y1="${f(cy - Math.cos(a) * r0)}" x2="${f(cx + Math.sin(a) * r * 0.88)}" y2="${f(cy - Math.cos(a) * r * 0.88)}" stroke="${P["ink"]}" stroke-width="${i % 3 === 0 ? 6 : 3}" stroke-linecap="round"/>`;
  }).join("");
  const hand = (deg: number, len: number, w: number, col: string): string =>
    `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(cx + Math.sin((deg * Math.PI) / 180) * len)}" y2="${f(cy - Math.cos((deg * Math.PI) / 180) * len)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  return `<circle cx="${f(cx + 6)}" cy="${f(cy + 10)}" r="${f(r + 12)}" fill="#000" opacity=".16"/>
  <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r + 10)}" fill="${P["slate"]}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="#FBF6EC"/>
  <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="none" stroke="#000" stroke-opacity=".08" stroke-width="10"/>${ticks}
  ${hand(h, r * 0.48, 9, P["ink"] as string)}${hand(m, r * 0.72, 6, P["ink"] as string)}${hand(sec, r * 0.8, 2.5, P["coral"] as string)}
  <circle cx="${f(cx)}" cy="${f(cy)}" r="7" fill="${P["coral"]}"/>`;
}

export function wallLayer(s: PlaceState, wp: WorldParams): string {
  const P = wp.palette;
  const wall = P["wall"] as string;
  const wallLow = P["wallLow"] as string;
  const W0 = -600,
    W1 = WORLD_W + 600;
  const win = SPOTS.window;
  const dr = SPOTS.door;
  // the wall with the window cut out (even-odd), so the sky and city layers show through it
  const wallPath = `M${W0} -800 H${W1} V${WALL_BASE} H${W0} Z M${win.x0} ${win.y0} V${win.y1} H${win.x1} V${win.y0} Z`;
  const floorLines = Array.from({ length: 24 }, (_, i) => {
    const x = -400 + i * 160;
    return `<line x1="${f(x)}" y1="${WALL_BASE}" x2="${f(1450 + (x - 1450) * 2.6)}" y2="2700" stroke="#000" stroke-opacity=".07" stroke-width="3"/>`;
  }).join("");
  const hLines = [1640, 1720, 1830, 1990, 2220]
    .map(
      (y) =>
        `<line x1="${W0}" y1="${y}" x2="${W1}" y2="${y}" stroke="#000" stroke-opacity=".06" stroke-width="3"/>`,
    )
    .join("");
  // door: frame, opening (bright when open), leaf that swings toward the room
  const open = s.door;
  const leafW = (dr.x1 - dr.x0) * (1 - open * 0.82);
  const door = `<rect x="${dr.x0 - 22}" y="${dr.y0 - 22}" width="${dr.x1 - dr.x0 + 44}" height="${dr.y1 - dr.y0 + 22}" fill="${P["woodDark"]}"/>
    <rect x="${dr.x0}" y="${dr.y0}" width="${dr.x1 - dr.x0}" height="${dr.y1 - dr.y0}" fill="#FFF3D9"/>
    <rect x="${dr.x0}" y="${dr.y0}" width="${dr.x1 - dr.x0}" height="${dr.y1 - dr.y0}" fill="#2A2A3A" opacity="${f(1 - open)}"/>
    <g transform="translate(${dr.x0} ${dr.y0})"><rect width="${f(leafW)}" height="${dr.y1 - dr.y0}" fill="${P["wood"]}"/>
      <rect x="${f(leafW * 0.14)}" y="70" width="${f(leafW * 0.72)}" height="300" fill="#CFE0E6" opacity=".85"/>
      <rect x="${f(leafW * 0.14)}" y="70" width="${f(leafW * 0.72)}" height="300" fill="none" stroke="${P["woodDark"]}" stroke-width="8"/>
      <rect x="${f(leafW * 0.14)}" y="460" width="${f(leafW * 0.72)}" height="330" fill="none" stroke="${P["woodDark"]}" stroke-width="6" opacity=".6"/>
      <rect x="${f(leafW - 46)}" y="430" width="30" height="12" rx="6" fill="${P["ochre"]}"/></g>`;
  // the window frame, blinds and sill
  const ww = win.x1 - win.x0;
  const blind = 220;
  const windowFrame = `<rect x="${win.x0 - 26}" y="${win.y0 - 26}" width="${ww + 52}" height="${win.y1 - win.y0 + 26}" fill="none" stroke="#F7F1E6" stroke-width="30"/>
    <rect x="${win.x0}" y="${win.y0}" width="${ww}" height="${blind}" fill="#E8DFCF"/>
    ${Array.from({ length: 9 }, (_, i) => `<rect x="${win.x0}" y="${win.y0 + i * 24}" width="${ww}" height="4" fill="#000" opacity=".12"/>`).join("")}
    <rect x="${win.x0}" y="${win.y0 + blind - 10}" width="${ww}" height="14" fill="#CDBFA8"/>
    <rect x="${f(win.x0 + ww / 2 - 9)}" y="${win.y0}" width="18" height="${win.y1 - win.y0}" fill="#F7F1E6"/>
    <rect x="${win.x0}" y="${f((win.y0 + win.y1) / 2 + 60)}" width="${ww}" height="16" fill="#F7F1E6"/>
    <rect x="${win.x0 - 60}" y="${win.y1}" width="${ww + 120}" height="34" fill="#F7F1E6"/><rect x="${win.x0 - 60}" y="${win.y1 + 34}" width="${ww + 120}" height="12" fill="#000" opacity=".1"/>
    <g transform="translate(${win.x0 + 120} ${win.y1})"><path d="M-36 0 L-28 -64 L28 -64 L36 0Z" fill="${P["coral"]}"/>
      ${[
        [-30, -150, -20],
        [0, -175, 0],
        [28, -150, 22],
        [-12, -120, -35],
        [16, -118, 35],
      ]
        .map(
          ([x, y, r]) =>
            `<ellipse cx="${x}" cy="${y}" rx="18" ry="52" transform="rotate(${r} ${x} ${y})" fill="${P["teal"]}"/>`,
        )
        .join("")}</g>`;
  // radiator under the window
  const rad = `<g transform="translate(${win.x0 + 90} 1290)"><rect width="${ww - 180}" height="200" rx="12" fill="#ECE5D8"/>${Array.from({ length: 14 }, (_, i) => `<rect x="${18 + i * ((ww - 216) / 14)}" y="16" width="${f((ww - 216) / 14 - 10)}" height="168" rx="8" fill="#000" opacity=".07"/>`).join("")}</g>`;
  // shelves with books above filing cabinets
  const shelf = (y: number, x0: number, x1: number, seed: number): string =>
    books(x0 + 14, y, x1 - x0 - 28, seed, P) +
    `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="18" fill="${P["woodDark"]}"/><rect x="${x0}" y="${y + 18}" width="${x1 - x0}" height="10" fill="#000" opacity=".12"/>`;
  const cabinets = `<g transform="translate(640 1145)">${[0, 1].map((c) => `<g transform="translate(${c * 190} 0)"><rect width="180" height="440" fill="#9AA6AE"/>${[0, 1, 2].map((d) => `<rect x="12" y="${14 + d * 142}" width="156" height="128" rx="4" fill="#B3BEC5"/><rect x="66" y="${50 + d * 142}" width="48" height="14" rx="7" fill="#6E7B84"/><rect x="62" y="${84 + d * 142}" width="56" height="22" fill="#FBF6EC"/>`).join("")}</g>`).join("")}
    <rect x="20" y="-34" width="70" height="34" fill="${P["cream"]}"/><rect x="26" y="-46" width="58" height="12" fill="#E6DCCB"/><rect x="250" y="-30" width="60" height="30" rx="4" fill="${P["slate"]}"/><path d="M262 -30 q18 -40 36 0" fill="${P["teal"]}"/></g>`;
  // corkboard with pinned notes; a framed certificate; a calendar
  const notes = Array.from({ length: 9 }, (_, i) => {
    const x = 22 + (i % 3) * 92 + hash01(wp.seed, i, 11) * 14;
    const y = 22 + Math.floor(i / 3) * 74 + hash01(wp.seed, i, 12) * 10;
    const col = ["#FFF2A8", "#FBF6EC", "#FFD1C2", "#CDEBE6"][i % 4];
    const r = (hash01(wp.seed, i, 13) - 0.5) * 10;
    return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(r)})"><rect width="72" height="58" fill="${col}"/><rect x="10" y="16" width="44" height="4" fill="#000" opacity=".2"/><rect x="10" y="28" width="36" height="4" fill="#000" opacity=".2"/><circle cx="36" cy="6" r="5" fill="${P["coral"]}"/></g>`;
  }).join("");
  const cork = `<g transform="translate(1225 720)"><rect x="-14" y="-14" width="328" height="270" fill="${P["woodDark"]}"/><rect width="300" height="242" fill="#C89B6D"/>${notes}</g>`;
  const cert = `<g transform="translate(1260 470)"><rect x="-10" y="-10" width="200" height="150" fill="${P["ochre"]}"/><rect width="180" height="130" fill="#FBF6EC"/><circle cx="90" cy="46" r="20" fill="${P["ochre"]}" opacity=".8"/><rect x="40" y="80" width="100" height="6" fill="#000" opacity=".25"/><rect x="56" y="96" width="68" height="5" fill="#000" opacity=".18"/></g>`;
  const cal = `<g transform="translate(870 760)"><rect width="150" height="170" fill="#FBF6EC"/><rect width="150" height="40" fill="${P["coral"]}"/>${Array.from({ length: 20 }, (_, i) => `<rect x="${12 + (i % 5) * 26}" y="${54 + Math.floor(i / 5) * 26}" width="18" height="16" fill="#000" opacity="${i < 17 ? ".14" : ".05"}"/>${i < 17 ? `<line x1="${12 + (i % 5) * 26}" y1="${54 + Math.floor(i / 5) * 26}" x2="${30 + (i % 5) * 26}" y2="${70 + Math.floor(i / 5) * 26}" stroke="${P["coral"]}" stroke-width="3"/>` : ""}`).join("")}</g>`;
  // a coat on a hook by the door (he has never taken it down in daylight)
  const coat = `<g transform="translate(540 840)"><rect x="-6" y="-14" width="40" height="10" rx="5" fill="${P["ink"]}"/><path d="M10 -6 Q-44 30 -40 260 L60 260 Q66 30 10 -6Z" fill="#5C6B7A"/><path d="M10 -6 L10 250" stroke="#000" stroke-opacity=".2" stroke-width="4"/><path d="M40 120 q30 70 6 150 l-30 -6Z" fill="#7B5A43"/></g>`;
  // ceiling: a cornice and a dark ceiling with a light strip (off after hours)
  const ceiling = `<rect x="${W0}" y="-800" width="${W1 - W0}" height="880" fill="#C9BBA4"/><rect x="${W0}" y="70" width="${W1 - W0}" height="22" fill="#F7F1E6"/><rect x="${W0}" y="92" width="${W1 - W0}" height="8" fill="#000" opacity=".1"/>
    ${[500, 1450, 2400].map((x) => `<rect x="${x - 180}" y="20" width="360" height="26" rx="6" fill="#FFF8E8"/>`).join("")}`;
  const wainscot = `<rect x="${W0}" y="1220" width="${W1 - W0}" height="${WALL_BASE - 1220}" fill="${wallLow}"/><rect x="${W0}" y="1212" width="${W1 - W0}" height="14" fill="#F7F1E6"/>
    <rect x="${W0}" y="${WALL_BASE - 34}" width="${W1 - W0}" height="34" fill="#F7F1E6"/>`;
  const outlet = `<rect x="1560" y="1440" width="40" height="56" rx="6" fill="#F7F1E6"/><rect x="590" y="1050" width="34" height="56" rx="5" fill="#F7F1E6"/>`;
  const plant = `<g transform="translate(2620 ${WALL_BASE})"><path d="M-70 0 L-56 -150 L56 -150 L70 0Z" fill="${P["slate"]}"/>${Array.from(
    { length: 9 },
    (_, i) => {
      const a = -70 + i * 17;
      const len = 220 + hash01(wp.seed, i, 21) * 160;
      return `<ellipse cx="${f(Math.sin((a * Math.PI) / 180) * len * 0.5)}" cy="${f(-150 - Math.cos((a * Math.PI) / 180) * len * 0.5)}" rx="34" ry="${f(len * 0.5)}" transform="rotate(${a} ${f(Math.sin((a * Math.PI) / 180) * len * 0.5)} ${f(-150 - Math.cos((a * Math.PI) / 180) * len * 0.5)})" fill="${i % 2 ? P["teal"] : "#23786E"}"/>`;
    },
  ).join("")}</g>`;
  return `<path d="${wallPath}" fill="${wall}" fill-rule="evenodd"/>
    <rect x="${W0}" y="${WALL_BASE}" width="${W1 - W0}" height="1200" fill="${P["floor"]}"/>${floorLines}${hLines}
    ${ceiling}${wainscot}
    <path d="M${win.x0} ${win.y0} h${ww} v${win.y1 - win.y0} h-${ww}Z" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="40"/>
    ${windowFrame}${rad}${door}${coat}
    ${shelf(640, 620, 1010, wp.seed + 1)}${shelf(910, 1580, 1660, wp.seed + 2)}
    ${cabinets}${cork}${cert}${cal}${outlet}${plant}
    ${clock(SPOTS.clock[0], SPOTS.clock[1], 78, s.clockMin, P)}`;
}

// --------------------------------------------------------------------------- the actors' plane: furniture

function binderStack(x: number, y: number, s: PlaceState, wp: WorldParams): string {
  // binders lying flat, spines toward the camera, one per year; the newest can fall onto the stack
  const P = wp.palette;
  const cols = [P["slate"], P["coral"], P["teal"], P["ochre"], "#7A6A8A", P["slate"], P["coral"], P["teal"]];
  const th = 38;
  let out = "";
  const whole = Math.floor(s.binders);
  const frac = s.binders - whole;
  const n = Math.min(wp.years.length, Math.ceil(s.binders));
  for (let i = 0; i < n; i++) {
    let dy = 0;
    let rot = ((hash01(wp.seed, i, 31) - 0.5) * 3).toFixed(2);
    let op = 1;
    if (i === whole && frac > 0) {
      // falling: from above, landing with a small bounce
      const k = frac;
      const fall = k < 0.8 ? (k / 0.8) ** 2 : 1 - Math.sin(((k - 0.8) / 0.2) * Math.PI) * 0.04;
      dy = -(1 - fall) * 520;
      rot = ((1 - fall) * -14).toFixed(2);
      op = Math.min(1, k * 5);
    }
    const yy = y - (i + 1) * th + dy;
    const w = 236 - (i % 2) * 10 + hash01(wp.seed, i, 32) * 14;
    const xx = x - w / 2 + (hash01(wp.seed, i, 33) - 0.5) * 18;
    out += `<g opacity="${f(op)}" transform="rotate(${rot} ${f(x)} ${f(yy + th / 2)})"><rect x="${f(xx)}" y="${f(yy)}" width="${f(w)}" height="${th - 3}" rx="4" fill="${cols[i % cols.length]}"/>
      <rect x="${f(xx + w * 0.34)}" y="${f(yy + 7)}" width="${f(w * 0.32)}" height="${th - 17}" rx="2" fill="#FBF6EC"/>
      <rect x="${f(xx)}" y="${f(yy + th - 8)}" width="${f(w)}" height="5" fill="#000" opacity=".18"/>
      <text x="${f(xx + w * 0.5)}" y="${f(yy + th - 13)}" font-family="Montserrat" font-weight="800" font-size="17" text-anchor="middle" fill="${P["ink"]}">${wp.years[i]}</text></g>`;
  }
  return out;
}

export function midLayer(s: PlaceState, wp: WorldParams): string {
  const P = wp.palette;
  const desk = `<g><rect x="1225" y="1290" width="680" height="30" rx="5" fill="${P["wood"]}"/><rect x="1225" y="1316" width="680" height="12" fill="#000" opacity=".15"/>
    <rect x="1250" y="1320" width="26" height="${FLOOR - 1320}" fill="${P["woodDark"]}"/>
    <rect x="1600" y="1320" width="190" height="${FLOOR - 1320 - 10}" fill="${P["woodDark"]}"/>
    ${[0, 1, 2].map((i) => `<rect x="1612" y="${1334 + i * 118}" width="166" height="104" rx="4" fill="${P["wood"]}"/><rect x="1670" y="${1376 + i * 118}" width="50" height="10" rx="5" fill="${P["ochre"]}"/>`).join("")}</g>`;
  const monitor = `<g transform="translate(1430 1150)"><rect x="-150" y="-110" width="300" height="190" rx="12" fill="${P["ink"]}"/><rect x="-136" y="-96" width="272" height="162" rx="5" fill="#9FC6DE"/>
    <rect x="-120" y="-80" width="150" height="12" fill="#FFF" opacity=".55"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="-120" y="${-56 + i * 20}" width="${200 - ((i * 37) % 90)}" height="8" fill="#FFF" opacity=".35"/>`).join("")}
    <rect x="-14" y="80" width="28" height="44" fill="${P["ink"]}"/><rect x="-70" y="120" width="140" height="18" rx="6" fill="${P["ink"]}"/></g>
    <rect x="1300" y="1272" width="150" height="16" rx="5" fill="#D9D3C8"/><rect x="1470" y="1276" width="34" height="12" rx="6" fill="#D9D3C8"/>`;
  const lampOn = s.lamp;
  const lamp = `<g transform="translate(1880 1290)"><rect x="-44" y="-12" width="88" height="14" rx="6" fill="${P["ink"]}"/>
    <path d="M0 -12 L-40 -150 L-62 -228" stroke="${P["ink"]}" stroke-width="12" fill="none" stroke-linecap="round"/>
    <g transform="translate(-62 -228) rotate(-28)"><path d="M-12 0 L-64 70 L56 70 L12 0Z" fill="${P["ochre"]}"/><ellipse cx="-4" cy="70" rx="60" ry="12" fill="#FFF2C6" opacity="${f(0.25 + 0.75 * lampOn)}"/></g></g>`;
  const chair = `<g transform="translate(1150 1395)"><rect x="-120" y="-16" width="200" height="36" rx="14" fill="${P["ink"]}"/><rect x="-130" y="-340" width="34" height="330" rx="14" fill="${P["ink"]}"/>
    <rect x="-28" y="20" width="18" height="150" fill="#2C2C44"/><rect x="-110" y="168" width="180" height="16" rx="8" fill="#2C2C44"/><circle cx="-100" cy="${FLOOR - 1395 - 12}" r="12" fill="#2C2C44"/><circle cx="58" cy="${FLOOR - 1395 - 12}" r="12" fill="#2C2C44"/></g>`;
  const boxes = `<g transform="translate(1960 ${FLOOR})">${[
    [0, 0, 190, 130, wp.years[0] ?? ""],
    [20, -130, 160, 110, wp.years[1] ?? ""],
  ]
    .map(
      ([x, y, w, h, label]) =>
        `<rect x="${x}" y="${(y as number) - (h as number)}" width="${w}" height="${h}" fill="#C8A57A"/><rect x="${x}" y="${(y as number) - (h as number)}" width="${w}" height="16" fill="#B08D63"/><rect x="${(x as number) + 40}" y="${(y as number) - (h as number) + 40}" width="${(w as number) - 80}" height="40" fill="#FBF6EC"/><text x="${(x as number) + (w as number) / 2}" y="${(y as number) - (h as number) + 69}" font-family="Montserrat" font-weight="800" font-size="22" text-anchor="middle" fill="${P["ink"]}">${label}</text>`,
    )
    .join("")}</g>`;
  const bin = `<g transform="translate(1090 ${FLOOR})"><path d="M-52 0 L-62 -130 L62 -130 L52 0Z" fill="#59677A"/><circle cx="-14" cy="-138" r="20" fill="#FBF6EC"/><circle cx="16" cy="-142" r="17" fill="#EFE6D6"/></g>`;
  const papers = `<g transform="translate(1290 1290)"><rect x="-8" y="-6" width="96" height="6" fill="#FBF6EC" transform="rotate(-3)"/><rect x="0" y="-11" width="92" height="5" fill="#EFE6D6" transform="rotate(2)"/></g>`;
  return `${chair}${desk}${monitor}${papers}${binderStack(SPOTS.binders[0], 1290, s, wp)}${lamp}${bin}${boxes}
    <ellipse cx="1450" cy="${FLOOR + 6}" rx="420" ry="18" fill="#000" opacity=".12"/>`;
}

/** Near foreground: things between the camera and the room (always out of focus). */
export function nearLayer(): string {
  const leaves = Array.from({ length: 7 }, (_, i) => {
    const a = -60 + i * 22;
    return `<ellipse cx="${f(2560 + Math.sin((a * Math.PI) / 180) * 160)}" cy="${f(1700 - Math.cos((a * Math.PI) / 180) * 200)}" rx="60" ry="230" transform="rotate(${a} ${f(2560 + Math.sin((a * Math.PI) / 180) * 160)} ${f(1700 - Math.cos((a * Math.PI) / 180) * 200)})" fill="${i % 2 ? "#1E4E4A" : "#16403C"}"/>`;
  }).join("");
  return leaves;
}
