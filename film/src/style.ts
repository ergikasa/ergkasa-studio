/**
 * The style bible of the first Erkasa show, as data. Every set, template and character reads its colours here,
 * so one film never mixes looks. Cinematic editorial illustration: flat shapes, deliberate warm light against a
 * cool night, soft shadows, Montserrat Light against Montserrat Black.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { K, fmt } from "./motion.js";

export const PALETTE = {
  night: "#14213D",
  deep: "#0C1529",
  ink: "#1B1B2F",
  cream: "#F4EBDD",
  paper: "#EADFCB",
  coral: "#E76F51",
  ochre: "#F4A261",
  sun: "#FFD27D",
  teal: "#2A9D8F",
  slate: "#264653",
  wall: "#E4D6BF",
  wallShade: "#D3C2A6",
  wood: "#8B5E3C",
  woodDark: "#6B452B",
} as const;
export type PaletteKey = keyof typeof PALETTE;

/** Every colour a film may use: the palette plus the cast's own colours (skin, hair, clothes). */
export const STYLE_ID = "erkasa_editorial_night_v1";

const require = createRequire(import.meta.url);
export function fontFiles(): string[] {
  const dir = dirname(require.resolve("@expo-google-fonts/montserrat/package.json"));
  return [
    "300Light/Montserrat_300Light.ttf",
    "500Medium/Montserrat_500Medium.ttf",
    "800ExtraBold/Montserrat_800ExtraBold.ttf",
    "900Black/Montserrat_900Black.ttf",
  ].map((f) => join(dir, f));
}

export const W = 1080;
export const H = 1920;
export const FPS = 30;

/** Shared gradients and filters, declared once per frame. */
export const DEFS = `
<linearGradient id="sky_golden" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF9E6B"/><stop offset=".55" stop-color="#FFD27D"/><stop offset="1" stop-color="#FCE9C2"/></linearGradient>
<linearGradient id="sky_day" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FC1E3"/><stop offset="1" stop-color="#E8F1F2"/></linearGradient>
<linearGradient id="sky_night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0C1529"/><stop offset="1" stop-color="#2B3A67"/></linearGradient>
<radialGradient id="vig" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>
<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFD27D" stop-opacity=".85"/><stop offset="1" stop-color="#FFD27D" stop-opacity="0"/></radialGradient>
<radialGradient id="glow_cool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#8FC1E3" stop-opacity=".6"/><stop offset="1" stop-color="#8FC1E3" stop-opacity="0"/></radialGradient>
<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFD27D" stop-opacity=".5"/><stop offset="1" stop-color="#FFD27D" stop-opacity="0"/></linearGradient>`;

export interface TypeLine {
  t: string;
  /** light = Montserrat Light, bold = Montserrat Black. */
  weight?: "light" | "bold";
  accent?: boolean;
  size?: number;
}

let clipSeq = 0;
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Rough width of a Montserrat line, for wrapping and fitting. */
export function textWidth(t: string, size: number, weight: "light" | "bold"): number {
  return t.length * size * (weight === "bold" ? 0.66 : 0.56);
}

/**
 * Kinetic editorial type: each line rises out of its own mask with a small overshoot, staggered; leaves by
 * fading up. Lines are fitted to the safe width (they shrink rather than overflow).
 */
export function kineticType(
  t: number,
  lines: TypeLine[],
  opts: {
    x?: number;
    y?: number;
    at?: number;
    gap?: number;
    out?: number | null;
    dark?: boolean;
    align?: "left" | "center";
  } = {},
): string {
  const x = opts.x ?? 90;
  const at = opts.at ?? 0;
  const gap = opts.gap ?? 0.14;
  const out = opts.out ?? null;
  const maxW = W - 2 * x;
  let yy = opts.y ?? 260;
  let o = "";
  lines.forEach((ln, i) => {
    const weight = ln.weight ?? (ln.accent ? "bold" : "light");
    let sz = ln.size ?? (weight === "bold" ? 112 : 66);
    const w = textWidth(ln.t, sz, weight);
    if (w > maxW) sz = Math.floor((sz * maxW) / w);
    if (i > 0) yy += sz * 0.98;
    const t0 = at + i * gap;
    const p = K(t, [
      [t0, 0],
      [t0 + 0.55, 1, "back"],
    ]);
    const fade =
      out === null
        ? 1
        : K(t, [
            [out, 1],
            [out + 0.35, 0, "in"],
          ]);
    const dy = (1 - p) * sz * 1.1 - (1 - fade) * 30;
    const fill = ln.accent ? PALETTE.ochre : opts.dark ? PALETTE.ink : PALETTE.cream;
    const anchor = opts.align === "center" ? "middle" : "start";
    const tx = opts.align === "center" ? W / 2 : x;
    const op = Math.min(1, p * 1.4) * fade;
    if (op > 0.002) {
      const id = `kt${clipSeq++}`;
      o += `<defs><clipPath id="${id}"><rect x="0" y="${fmt(yy - sz)}" width="${W}" height="${fmt(sz * 1.28)}"/></clipPath></defs><g clip-path="url(#${id})"><text x="${tx}" y="${fmt(yy + dy)}" text-anchor="${anchor}" font-family="Montserrat" font-weight="${weight === "bold" ? 900 : 300}" font-size="${sz}" letter-spacing="${weight === "bold" ? -1 : 0}" fill="${fill}" fill-opacity="${fmt(op)}">${esc(ln.t)}</text></g>`;
    }
    yy += sz * 0.16;
  });
  return o;
}

/** The frame: background, content, vignette. */
export function frame(body: string, bg: string = PALETTE.night): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="${bg}"/>${body}<rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;
}
