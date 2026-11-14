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

export { PALETTE, STYLE_GUIDE, gate, nearest, type Check } from "../asset-maker.js";
import { STYLE_GUIDE, gate } from "../asset-maker.js";

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
