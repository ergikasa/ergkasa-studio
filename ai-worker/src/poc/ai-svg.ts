/**
 * Offline experiment (Visual PoC, step 5): can Claude draw scene props in the Erkasa style?
 *
 *   pnpm poc:ai-svg            draws the test objects, checks and normalizes them, writes a comparison
 *
 * Nothing here runs in the video pipeline. Each drawing goes through the same gate a downloaded
 * asset would: safety (no scripts, no external references), structure (viewBox, size, named parts),
 * and style (palette snap, no outlines). The output lets the team decide with evidence whether AI
 * drafts are worth it: out/poc/ai-svg/report.md and one comparison image per object.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { svgToPng } from "@erkasa/engine-worker";
import { repoRoot } from "../env.js";
import { AnthropicLlm, type Llm, type StrictSchema, type Usage } from "../llm.js";

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

export interface Target {
  id: string;
  brief: string;
  /** Our procedural version, for the side-by-side comparison. */
  compareWith?: string;
}

export const TARGETS: Target[] = [
  {
    id: "chair_office_side",
    compareWith: "prop_chair_office_side_01",
    brief:
      "An office chair seen from the side, facing right. Seat surface 212 units above the floor, seat depth about 190, backrest on the left, a gas-lift column and a five-star base with small wheels. viewBox about 260 x 560.",
  },
  {
    id: "laptop_side",
    compareWith: "prop_laptop_side_01",
    brief:
      "An open laptop seen from the side: thin base lying flat, lid open about 100 degrees, hinge on the left, screen facing right. viewBox about 220 x 170; the base sits on the bottom edge.",
  },
  {
    id: "mug",
    compareWith: "prop_mug_01",
    brief: "A plain coffee mug with a handle on the right, seen from the side. viewBox about 90 x 90.",
  },
  {
    id: "plant_floor",
    compareWith: "prop_plant_floor_01",
    brief:
      'A floor plant in a simple pot, broad leaves, about 420 units tall. viewBox about 220 x 420; group the leaves as <g id="leaves" data-pivot="110,250">.',
  },
  {
    id: "bookshelf",
    brief:
      "A low wooden bookshelf seen from the front, two shelves of books of different heights and colours, about 520 units tall and 360 wide.",
  },
  {
    id: "water_cooler",
    brief:
      "An office water cooler: a blue water bottle upside down on a white cabinet, about 640 units tall and 200 wide.",
  },
];

const SCHEMA: StrictSchema = {
  type: "object",
  additionalProperties: false,
  required: ["svg", "notes"],
  properties: {
    svg: { type: "string", description: "The complete SVG document." },
    notes: { type: "string", description: "One sentence on choices made." },
  },
};

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

// ------------------------------------------------------------------ the experiment

export async function runAiSvg(llm: Llm = new AnthropicLlm(), targets = TARGETS): Promise<string> {
  const root = repoRoot();
  const dir = join(root, "out", "poc", "ai-svg");
  mkdirSync(dir, { recursive: true });
  const rows: string[] = [];
  const usage: Usage[] = [];
  for (const t of targets) {
    console.info(`drawing ${t.id}...`);
    const res = await llm.json({
      label: `ai-svg:${t.id}`,
      system: `You draw scene props for a 2D animation studio as clean SVG code.\n${STYLE_GUIDE}`,
      messages: [
        {
          role: "user",
          content: `Draw: ${t.brief}\nThe root group id is "ai_${t.id}". Answer with the SVG and one sentence of notes.`,
        },
      ],
      schema: SCHEMA,
      maxTokens: 12000,
    });
    usage.push(res.usage);
    const { svg, notes } = res.value as { svg: string; notes: string };
    writeFileSync(join(dir, `${t.id}.ai.svg`), svg);
    const { check, normalized } = gate(svg, `ai_${t.id}`);
    if (normalized) writeFileSync(join(dir, `${t.id}.normalized.svg`), normalized);
    // side by side: ours | AI as drawn | AI normalized
    const panels: string[] = [];
    const add = (name: string, s: string | undefined): void => {
      if (!s) return;
      try {
        const f = join(dir, `${t.id}.${name}.png`);
        writeFileSync(f, svgToPng(s, 420));
        panels.push(f);
      } catch {
        // unrenderable drawings are reported by the gate
      }
    };
    const ours = t.compareWith ? join(root, "assets", "props", t.compareWith, "asset.svg") : undefined;
    add("ours", ours && existsSync(ours) ? readFileSync(ours, "utf8") : undefined);
    add("ai", svg);
    add("ai-normalized", normalized);
    if (panels.length > 1) {
      try {
        execFileSync(process.env["ERKASA_FFMPEG"] ?? "ffmpeg", [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          ...panels.flatMap((p) => ["-i", p]),
          "-filter_complex",
          `hstack=${panels.length}`,
          join(dir, `${t.id}.compare.png`),
        ]);
      } catch {
        // the separate PNGs are still there
      }
    }
    rows.push(
      `| ${t.id} | ${check.ok ? "pass" : "fail"} | ${check.shapes} | ${check.offPalette}/${check.colours} (max ${check.maxSnap}) | ${check.problems.join("; ") || "-"} | ${res.usage.outputTokens} | ${notes.replace(/\|/g, "/")} |`,
    );
  }
  const tokens = usage.reduce((n, u) => n + u.inputTokens + u.outputTokens, 0);
  const report = `# AI-SVG experiment (${new Date().toISOString().slice(0, 10)})

Model: ${usage[0]?.model ?? "?"} · ${targets.length} objects · ${tokens} tokens in total.
Each drawing passed through the same gate as an imported asset: safety, structure, palette.
Compare the images \`<id>.compare.png\` (ours | AI as drawn | AI with the palette snapped).

| object | gate | shapes | off-palette colours | problems | output tokens | model's note |
|---|---|---|---|---|---|---|
${rows.join("\n")}

How to judge: does the normalized AI drawing look like it belongs next to our characters? Would it
need a human pass before entering the library? If most objects pass the gate and look right, AI
drafts can speed up the prop library (with a person approving each one); if not, keep the code generators.
`;
  writeFileSync(join(dir, "report.md"), report);
  console.info(`report: ${join(dir, "report.md")}`);
  return report;
}
