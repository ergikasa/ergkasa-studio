/**
 * Visual critic (Phase 5): before a video is rendered, Claude looks at the scenes as a contact sheet (two frames
 * of every scene) and says what a viewer would trip on: people on top of each other, an empty frame, a title
 * over a face, an object that is cut off, the same picture twice, an idea that is not visible. Findings that
 * block (not matters of taste) go back to the planner like the director's review.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CompileResult, Issue } from "@erkasa/compiler";
import type { RenderTimeline, Script, VideoPlan } from "@erkasa/contracts";
import { loadEngine, renderStill } from "@erkasa/engine-worker";
import type { Llm, StrictSchema, Usage } from "./llm.js";

const KINDS = [
  "overlap",
  "empty_frame",
  "title_over_face",
  "cut_off",
  "repeated_picture",
  "idea_not_visible",
  "unreadable",
  "wrong_object",
] as const;

export const CRITIC_SCHEMA: StrictSchema = {
  type: "object",
  additionalProperties: false,
  required: ["findings", "verdict"],
  properties: {
    verdict: { type: "string", description: "One sentence: does the film look like one made by a studio?" },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sceneId", "kind", "severity", "note"],
        properties: {
          sceneId: { type: "string", description: "The scene id, e.g. s03." },
          kind: { type: "string", enum: [...KINDS] },
          severity: {
            type: "string",
            enum: ["blocking", "minor"],
            description:
              "blocking = a viewer would notice at once and it must be fixed; minor = taste or small polish.",
          },
          note: { type: "string", description: "What is wrong, and what to change, in one sentence." },
        },
      },
    },
  },
};

export const CRITIC_SYSTEM = `You are the art director of Erkasa, a studio of short vertical (9:16) animated explainers. You are shown a contact sheet of a film's storyboard: two frames of each scene (about a third and four fifths of the way in), scene ids printed in the legend. Judge it like a viewer scrolling on a phone.
Report only what a viewer would notice: people standing on top of each other, an empty or half-empty frame, a title covering a face, an object or person cut off by the edge, two scenes that look the same, an idea that is not visible in the picture (the narration says one thing, the picture shows another), text too small to read, an object that does not belong.
Be strict about "blocking" (a clear defect) and generous with silence: when a scene is fine, say nothing about it. Do not comment on art style or taste.`;

export interface CriticFinding {
  sceneId: string;
  kind: (typeof KINDS)[number];
  severity: "blocking" | "minor";
  note: string;
}

export interface CriticResult {
  verdict: string;
  findings: CriticFinding[];
  sheets: string[];
  usage: Usage[];
}

const TILE_W = 270;

/** Two frames per scene, tiled four scenes to a sheet (JPEG files written into `dir`). Returns the sheet paths. */
export function contactSheets(
  timeline: RenderTimeline,
  assetRoots: string[],
  dir: string,
  perSheet = 4,
): string[] {
  mkdirSync(dir, { recursive: true });
  const engine = loadEngine(timeline, assetRoots);
  const work = mkdtempSync(join(tmpdir(), "erkasa-critic-"));
  try {
    const frames: string[] = [];
    timeline.scenes.forEach((s, i) => {
      const len = Math.max(2, s.duration);
      for (const [k, at] of [0.33, 0.8].entries()) {
        const f = Math.min(engine.totalFrames - 1, s.from + Math.round(len * at));
        const png = join(work, `t${String(i).padStart(3, "0")}_${k}.png`);
        renderStill(engine, f, png);
        frames.push(png);
      }
    });
    const sheets: string[] = [];
    const per = perSheet * 2;
    for (let i = 0; i < frames.length; i += per) {
      const chunk = frames.slice(i, i + per);
      const out = join(dir, `sheet-${String(sheets.length + 1).padStart(2, "0")}.jpg`);
      execFileSync(process.env["ERKASA_FFMPEG"] ?? "ffmpeg", [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        ...chunk.flatMap((c) => ["-i", c]),
        "-filter_complex",
        `${chunk.map((_, n) => `[${n}:v]scale=${TILE_W}:-1[v${n}]`).join(";")};${chunk.map((_, n) => `[v${n}]`).join("")}hstack=inputs=${chunk.length}[o]`,
        "-map",
        "[o]",
        "-frames:v",
        "1",
        "-q:v",
        "4",
        out,
      ]);
      sheets.push(out);
    }
    return sheets;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** What the critic is told about the scenes of each sheet (ids, narration, the planner's own idea). */
function legend(plan: VideoPlan, script: Script, from: number, count: number): string {
  return plan.scenes
    .slice(from, from + count)
    .map((s, i) => {
      const narr = script.scenes.find((x) => x.sceneId === s.sceneId)?.narration ?? s.narration;
      return `${from + i + 1}. ${s.sceneId} (frames ${i * 2 + 1}-${i * 2 + 2} of the sheet): "${narr.slice(0, 140)}"${s.direction ? ` | idea: ${s.direction.idea}` : ""}`;
    })
    .join("\n");
}

export async function critique(
  llm: Llm,
  plan: VideoPlan,
  script: Script,
  compiled: CompileResult & { timeline: RenderTimeline },
  assetRoots: string[],
  dir: string,
): Promise<CriticResult> {
  const sheets = contactSheets(compiled.timeline, assetRoots, dir);
  const usage: Usage[] = [];
  const findings: CriticFinding[] = [];
  let verdict = "";
  for (const [i, sheet] of sheets.entries()) {
    const from = i * 4;
    const res = await llm.json({
      label: `critic#${i + 1}`,
      system: CRITIC_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Sheet ${i + 1} of ${sheets.length}. Scenes, left to right, two frames each:\n${legend(plan, script, from, 4)}\n\nReport the findings.`,
        },
      ],
      images: [{ mediaType: "image/jpeg", base64: readFileSync(sheet).toString("base64") }],
      schema: CRITIC_SCHEMA,
      maxTokens: 3000,
    });
    usage.push(res.usage);
    const v = res.value as { verdict: string; findings: CriticFinding[] };
    verdict = verdict || v.verdict;
    findings.push(...(v.findings ?? []).filter((f) => plan.scenes.some((s) => s.sceneId === f.sceneId)));
  }
  return { verdict, findings, sheets, usage };
}

/** The blocking findings as review issues the planner repairs (minor ones stay in the report). */
export function criticIssues(plan: VideoPlan, result: CriticResult): Issue[] {
  return result.findings
    .filter((f) => f.severity === "blocking")
    .map((f) => {
      const i = plan.scenes.findIndex((s) => s.sceneId === f.sceneId);
      return {
        level: "error" as const,
        code: `VISUAL_${f.kind.toUpperCase()}`,
        path: `scenes[${i}]`,
        message: `${f.sceneId}: ${f.note}`,
        hint: "the art director saw this in the storyboard frames; change the scene so the picture shows the idea",
      };
    });
}

/** Sheets already written in a folder (for tests and reports). */
export const sheetsIn = (dir: string): string[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .map((f) => join(dir, f));
