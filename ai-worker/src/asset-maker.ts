/**
 * Asset maker (Phase 2): Claude draws the few objects a story needs that no generator or library asset
 * covers (a radio, a plate, a mooncake). A drawing enters the world only after the gate: safety (no scripts,
 * no external references, no text), structure (viewBox, shape count), style (house palette, thin strokes),
 * and a render check (it draws something, fits its canvas, floor objects stand on the ground).
 * A drawing that fails is sent back to Claude with the problems; after 3 attempts the object is left out.
 * Passing drawings are cached by brief, so the same object costs nothing the second time.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { svgCoverage, svgToPng } from "@erkasa/engine-worker";
import type { WorldSpec } from "@erkasa/contracts";
import { repoRoot } from "./env.js";
import type { Llm, StrictSchema, Usage } from "./llm.js";

/** The house palette (props, furniture, characters' clothes). Every AI colour snaps to the nearest. */
export const PALETTE = [
  "#2A1E18",
  "#F6F3EE",
  "#FFFFFF",
  "#2F8F8A",
  "#E8833A",
  "#C2554D",
  "#E3B66B",
  "#3E5F86",
  "#8FCBEA",
  "#62A06C",
  "#4F8A5B",
  "#9AA0A6",
  "#8C6A4F",
  "#8E6BB0",
  "#3E4A5C",
  "#2B3445",
  "#4D5B70",
  "#4A5568",
  "#1E2533",
  "#A9825F",
  "#8A6849",
  "#B08A68",
  "#9C7656",
  "#6B4F3A",
  "#B8C1CC",
  "#D7DEE6",
  "#8E99A6",
  "#6F7A86",
  "#7FB7E0",
  "#B88A63",
  "#A97C57",
  "#7A5A43",
  "#3B3430",
  "#E8E2D8",
  "#D9D1C4",
  "#FFE7A8",
  "#F7D98A",
  "#C9CED8",
  "#A7AEBB",
  "#EDE5DA",
  "#E2D6C6",
  "#C9A27E",
];

export const STYLE_GUIDE = `Erkasa house style (erkasa_flat_v1) for scene props:
- Flat vector shapes: <rect>, <circle>, <ellipse>, <path>, <polygon>, <g>. No outlines around shapes; a thin line (stroke-width <= 6) only for details like a cable or a crease.
- Colours only from this palette: ${PALETTE.join(", ")}. One darker tone of the main colour for the shaded side; no gradients, no filters, no text, no images.
- Simple and readable on a phone: at most 40 shapes.
- Units: 1 unit = 1 pixel of the scene, where an adult character is about 800 units tall. Floor objects stand on the bottom edge of the viewBox (y = viewBox height). Side views face right.
- Parts that move are <g id="..."> with data-pivot="x,y" (e.g. a door leaf, a laptop lid).
- Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H" width="W" height="H"><g id="<assetId>">...</g></svg>.`;

// ------------------------------------------------------------------ the gate

export interface Check {
  ok: boolean;
  problems: string[];
  shapes: number;
  strokes: number;
  colours: number;
  offPalette: number;
  /** Largest RGB distance of a colour that had to snap (0..441). */
  maxSnap: number;
}

const FORBIDDEN: Array<[RegExp, string]> = [
  [/<script/i, "script"],
  [/<foreignObject/i, "foreignObject"],
  [/\son[a-z]+\s*=/i, "event handler"],
  [/(?:xlink:)?href\s*=\s*["'](?!#)/i, "external reference"],
  [/<image/i, "embedded image"],
  [/<text/i, "text"],
  [/<filter|filter\s*=/i, "filter"],
  [/<style|style\s*=/i, "CSS style (use attributes)"],
  [/url\(\s*["']?(?!#)/i, "external url()"],
];

const hex = (c: string): [number, number, number] => {
  const h = c.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((x) => x + x)
          .join("")
      : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};
const dist = (a: string, b: string): number => {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
};
export function nearest(c: string): { colour: string; d: number } {
  let best = { colour: PALETTE[0] ?? "#000000", d: Infinity };
  for (const p of PALETTE) {
    const d = dist(c, p);
    if (d < best.d) best = { colour: p, d };
  }
  return best;
}

/** Safety + structure + style checks, then the normalized drawing (palette snapped, root id set). */
export function gate(svg: string, assetId: string): { check: Check; normalized?: string } {
  const problems: string[] = [];
  for (const [re, what] of FORBIDDEN) if (re.test(svg)) problems.push(`forbidden: ${what}`);
  const vb = /viewBox\s*=\s*["']\s*0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*["']/.exec(svg);
  if (!vb) problems.push("no viewBox starting at 0 0");
  const shapes = (svg.match(/<(rect|circle|ellipse|path|polygon|polyline|line)\b/g) ?? []).length;
  if (shapes === 0) problems.push("no shapes");
  if (shapes > 60) problems.push(`${shapes} shapes (max 60): too detailed for the style`);
  const strokes = (svg.match(/stroke-width\s*=\s*["'](\d+(?:\.\d+)?)/g) ?? []).filter(
    (s) => Number(/(\d+(?:\.\d+)?)/.exec(s)?.[1]) > 6,
  ).length;
  if (strokes > 0) problems.push(`${strokes} thick outline(s)`);
  const colours = new Set(
    (svg.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? []).map((c) => c.toUpperCase()),
  );
  let offPalette = 0;
  let maxSnap = 0;
  let normalized = svg;
  for (const c of colours) {
    const n = nearest(c);
    if (n.d > 0.5) {
      offPalette++;
      maxSnap = Math.max(maxSnap, n.d);
      normalized = normalized.split(new RegExp(c, "gi")).join(n.colour);
    }
  }
  if (/\sfill\s*=\s*["'](?:red|blue|green|black|gray|grey|orange|yellow|brown|white)["']/i.test(svg))
    problems.push("named colours (use the palette)");
  if (maxSnap > 90) problems.push(`colours far from the palette (snap up to ${maxSnap.toFixed(0)})`);
  // root group id = asset id, so the engine can address the drawing
  normalized = normalized.replace(
    /<svg([^>]*)>\s*<g(\s[^>]*)?>/,
    (_m, a: string, g?: string) => `<svg${a}><g id="${assetId}"${(g ?? "").replace(/\sid="[^"]*"/, "")}>`,
  );
  let renders = true;
  try {
    svgToPng(normalized, 64);
  } catch {
    renders = false;
    problems.push("does not render");
  }
  const safe = !problems.some((p) => p.startsWith("forbidden"));
  const check: Check = {
    ok: problems.length === 0,
    problems,
    shapes,
    strokes,
    colours: colours.size,
    offPalette,
    maxSnap: Math.round(maxSnap),
  };
  return safe && renders && vb ? { check, normalized } : { check };
}

// ------------------------------------------------------------------ render check

export type PropSize = "hand" | "table" | "floor";

const SIZE_GUIDE: Record<PropSize, string> = {
  hand: "It is held in one hand: viewBox about 120 x 120.",
  table: "It stands on a table or desk: viewBox about 220 x 200, the object sits on the bottom edge.",
  floor: "It stands on the floor: viewBox about 280 x 560, the object sits on the bottom edge.",
};

/** Does the normalized drawing draw something sensible inside its canvas? Returns problems (empty = fine). */
export function renderProblems(svg: string, size: PropSize): string[] {
  const out: string[] = [];
  let c;
  try {
    c = svgCoverage(svg, 160);
  } catch {
    return ["does not render"];
  }
  if (!c.bbox || c.coverage < 0.05) return ["almost empty: the object fills under 5% of its canvas"];
  if (c.coverage > 0.92) out.push("fills the whole canvas: it must be an object, not a background");
  const { x0, y0, x1 } = c.bbox;
  if (x0 < 0.003 || x1 > 0.997 || y0 < 0.003)
    out.push("touches or crosses the canvas edge: it is cut off; leave a small margin");
  if (size !== "hand" && c.bbox.y1 < 0.95) out.push("does not stand on the bottom edge of the viewBox");
  if (c.bbox.x1 - c.bbox.x0 < 0.3 && c.bbox.y1 - c.bbox.y0 < 0.3)
    out.push("too small inside its canvas: crop the viewBox to the object");
  return out;
}

// ------------------------------------------------------------------ drawing

const SCHEMA: StrictSchema = {
  type: "object",
  additionalProperties: false,
  required: ["svg", "notes"],
  properties: {
    svg: { type: "string", description: "The complete SVG document." },
    notes: { type: "string", description: "One sentence on choices made." },
  },
};

export interface CustomRequest {
  id: string;
  brief: string;
  size: PropSize;
  /** The world it belongs to, for the mood only ("storybook", "night_noir"). */
  style?: string;
}

export interface CustomResult {
  id: string;
  ok: boolean;
  attempts: number;
  cached: boolean;
  /** Normalized SVG when ok. */
  svg?: string;
  /** Problems of the last failed attempt (or of every attempt when it never passed). */
  problems: string[];
  usage: Usage[];
  shapes?: number;
}

export function cacheDir(): string {
  return process.env["ERKASA_ASSET_CACHE"] ?? join(repoRoot(), "out", "asset-cache");
}

function cacheKey(req: CustomRequest): string {
  return createHash("sha1")
    .update(`v1|${req.size}|${req.brief.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 16);
}

/** Draws one object: up to `maxAttempts` tries, each told what was wrong with the previous drawing. */
/**
 * The model that draws the bulk objects (default: the cheap one; the gate checks every drawing, so a weaker
 * model costs attempts, not quality). ERKASA_ASSET_MODEL=same uses the main model, any other value names a model.
 */
export function assetModel(): string | undefined {
  const m = process.env["ERKASA_ASSET_MODEL"] ?? "claude-haiku-5-5";
  return m === "same" || m === "" ? undefined : m;
}

export async function drawCustom(llm: Llm, req: CustomRequest, maxAttempts = 3): Promise<CustomResult> {
  const key = cacheKey(req);
  const cached = join(cacheDir(), `${key}.svg`);
  if (existsSync(cached)) {
    const svg = readFileSync(cached, "utf8").replace(/<g id="[^"]*"/, `<g id="${req.id}"`);
    return { id: req.id, ok: true, attempts: 0, cached: true, svg, problems: [], usage: [] };
  }
  const usage: Usage[] = [];
  let problems: string[] = [];
  let feedback = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await llm.json({
      label: `asset:${req.id}${attempt > 1 ? `:${attempt}` : ""}`,
      ...(assetModel() ? { model: assetModel() as string } : {}),
      system: `You draw scene props for a 2D animation studio as clean SVG code.\n${STYLE_GUIDE}`,
      messages: [
        {
          role: "user",
          content: `Draw: ${req.brief}\n${SIZE_GUIDE[req.size]}${req.style ? ` The video's mood: ${req.style}.` : ""}\nThe root group id is "${req.id}". Answer with the SVG and one sentence of notes.${feedback}`,
        },
      ],
      schema: SCHEMA,
      maxTokens: 12000,
    });
    usage.push(res.usage);
    const svg = String((res.value as { svg?: unknown }).svg ?? "");
    const { check, normalized } = gate(svg, req.id);
    problems = [...check.problems];
    if (normalized && !problems.some((p) => p.startsWith("forbidden")))
      problems.push(...renderProblems(normalized, req.size));
    if (normalized && problems.length === 0) {
      mkdirSync(cacheDir(), { recursive: true });
      writeFileSync(cached, normalized);
      return {
        id: req.id,
        ok: true,
        attempts: attempt,
        cached: false,
        svg: normalized,
        problems: [],
        usage,
        shapes: check.shapes,
      };
    }
    feedback = `\n\nYour previous drawing was rejected: ${problems.join("; ")}. Draw it again and fix exactly these problems.`;
  }
  return { id: req.id, ok: false, attempts: maxAttempts, cached: false, problems, usage };
}

export interface CustomReport {
  requested: number;
  passed: number;
  failed: Array<{ id: string; problems: string[] }>;
  usage: Usage[];
  results: CustomResult[];
}

/**
 * Draws every `custom` prop of the spec into `<dir>/<propId>.svg` (the world builder reads them) and returns the
 * spec without the props that could not be drawn (their scenes simply do without the object).
 */
export async function makeCustomAssets(
  llm: Llm,
  spec: WorldSpec,
  dir: string,
): Promise<{ spec: WorldSpec; report: CustomReport }> {
  const results: CustomResult[] = [];
  mkdirSync(dir, { recursive: true });
  const custom = spec.props.filter((p) => p.kind === "custom");
  for (const p of custom) {
    const r = await drawCustom(llm, {
      id: p.id,
      brief: p.brief ?? p.id,
      size: p.size ?? "table",
      style: spec.style,
    });
    results.push(r);
    if (r.ok && r.svg) writeFileSync(join(dir, `${p.id}.svg`), r.svg);
  }
  const failed = new Set(results.filter((r) => !r.ok).map((r) => r.id));
  const report: CustomReport = {
    requested: custom.length,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).map((r) => ({ id: r.id, problems: r.problems })),
    usage: results.flatMap((r) => r.usage),
    results,
  };
  return { spec: { ...spec, props: spec.props.filter((p) => !failed.has(p.id)) }, report };
}
