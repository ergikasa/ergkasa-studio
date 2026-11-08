import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { CompileResult, TimedWord } from "@erkasa/compiler";
import { compileVideo } from "@erkasa/compiler";
import { Script, VideoPlan, type Theme } from "@erkasa/contracts";
import { renderVideo, type VoiceClip } from "@erkasa/engine-worker";
import { Catalog } from "./catalog.js";
import { optional, repoRoot } from "./env.js";
import { llmCost, type Llm, type Usage } from "./llm.js";
import { planVideo } from "./planner.js";
import { writeScript } from "./script-writer.js";
import { toAlignment, type Voice } from "./voice.js";

export interface MakeOptions {
  /** New video from a topic. */
  topic?: string;
  theme?: Exclude<Theme, "everyday">;
  seconds?: number;
  notes?: string;
  /** Start from an existing script (skips the script writer). */
  fromScript?: string;
  /** Start from an existing video plan (skips script writer and planner). */
  fromPlan?: string;
  /** No ElevenLabs call: silent video with estimated word timing (for testing the pipeline cheaply). */
  noVoice?: boolean;
  /** Placeholder music bed under the voice (default true until real music exists). */
  music?: boolean;
  outDir?: string;
  log?: (line: string) => void;
}

export interface MakeDeps {
  llm?: Llm;
  voice?: Voice;
  catalog?: Catalog;
}

export interface MakeReport {
  outDir: string;
  video?: string;
  durationSec?: number;
  usage: Usage[];
  llmCostUsd?: number;
  voiceCharacters: number;
  planAttempts: number;
  warnings: string[];
  timingsSec: Record<string, number>;
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "video"
  );
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function writeJson(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** Exact audio duration via ffprobe (the alignment ends at the last character, not the last sample). */
function probeDuration(file: string): number | undefined {
  try {
    const out = execFileSync(
      process.env["ERKASA_FFPROBE"] ?? "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
      { encoding: "utf8" },
    );
    const d = Number(out.trim());
    return Number.isFinite(d) && d > 0 ? d : undefined;
  } catch {
    return undefined;
  }
}

/**
 * topic -> script -> voice -> plan -> compile -> MP4. Every intermediate artifact is written to the
 * run folder, so any step can be inspected, edited and resumed with --from-script / --from-plan.
 */
export async function makeVideo(opts: MakeOptions, deps: MakeDeps = {}): Promise<MakeReport> {
  const log = opts.log ?? ((l: string) => console.info(l));
  const root = repoRoot();
  const assetsDir = join(root, "assets");
  const catalog = deps.catalog ?? new Catalog(assetsDir);
  const timings: Record<string, number> = {};
  const usage: Usage[] = [];
  const warnings: string[] = [];
  const time = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const t0 = Date.now();
    try {
      return await fn();
    } finally {
      timings[name] = (Date.now() - t0) / 1000;
    }
  };

  let script: Script | undefined;
  let plan: VideoPlan | undefined;
  if (opts.fromPlan) plan = VideoPlan.parse(JSON.parse(readFileSync(opts.fromPlan, "utf8")));
  else if (opts.fromScript) script = Script.parse(JSON.parse(readFileSync(opts.fromScript, "utf8")));

  const name = slugify(opts.topic ?? script?.title ?? plan?.projectId ?? "video");
  const outDir = resolve(opts.outDir ?? join(root, "out", `${stamp()}-${name}`));
  mkdirSync(join(outDir, "voice"), { recursive: true });
  log(`run folder: ${relative(process.cwd(), outDir) || "."}`);
  let voiceCharacters = 0;
  let planAttempts = 0;
  /** Writes run.json (also on failure, so a broken run can be inspected) and returns the report. */
  const finish = (extra: Partial<MakeReport> = {}): MakeReport => {
    const cost = llmCost(usage);
    const r: MakeReport = {
      outDir,
      ...extra,
      usage,
      ...(cost !== undefined ? { llmCostUsd: Math.round(cost * 10000) / 10000 } : {}),
      voiceCharacters,
      planAttempts,
      warnings,
      timingsSec: timings,
    };
    writeJson(join(outDir, "run.json"), r);
    return r;
  };

  // 1. script
  if (!script && !plan) {
    if (!opts.topic || !opts.theme) throw new Error("a new video needs a topic and a theme");
    if (!deps.llm) throw new Error("no language model configured");
    const llm = deps.llm;
    const res = await time("script", () =>
      writeScript(
        llm,
        {
          topic: opts.topic as string,
          theme: opts.theme as Exclude<Theme, "everyday">,
          targetSec: opts.seconds ?? 45,
          ...(opts.notes ? { notes: opts.notes } : {}),
        },
        catalog.vocabulary(),
      ),
    );
    usage.push(...res.usage);
    script = res.script;
    log(`script: "${script.title}", ${script.scenes.length} scenes, ~${script.estimatedSec}s`);
  }
  if (script) writeJson(join(outDir, "script.json"), script);

  // 2. voice (before planning, so the planner is checked against the real word timings)
  const narrations = plan
    ? plan.scenes.map((s) => ({ sceneId: s.sceneId, narration: s.narration }))
    : (script as Script).scenes;
  const alignments: Record<string, TimedWord[]> = {};
  const clipFiles: Record<string, string> = {};
  if (!opts.noVoice) {
    if (!deps.voice) throw new Error("no voice configured (use --no-voice for a silent test)");
    const voice = deps.voice;
    await time("voice", async () => {
      for (const [i, s] of narrations.entries()) {
        const speech = await voice.speak({
          text: s.narration,
          ...(narrations[i - 1] ? { previousText: narrations[i - 1]?.narration } : {}),
          ...(narrations[i + 1] ? { nextText: narrations[i + 1]?.narration } : {}),
          seed: 20261108 + i,
        });
        const file = join(outDir, "voice", `${s.sceneId}.mp3`);
        writeFileSync(file, speech.audio);
        const alignment = toAlignment(
          s.sceneId,
          `file://voice/${s.sceneId}.mp3`,
          speech.alignment,
          probeDuration(file) ?? 0,
        );
        writeJson(join(outDir, "voice", `${s.sceneId}.alignment.json`), alignment);
        alignments[s.sceneId] = alignment.words;
        clipFiles[s.sceneId] = file;
        voiceCharacters += speech.characters;
        log(`voice ${s.sceneId}: ${alignment.durationSec.toFixed(2)}s, ${alignment.words.length} words`);
      }
    });
  }
  const align = Object.keys(alignments).length ? { alignments } : {};

  // 3. plan
  let compiled: CompileResult;
  if (plan) {
    compiled = compileVideo(plan, { assets: catalog.source, seed: 20261108, ...align });
  } else {
    if (!deps.llm) throw new Error("no language model configured");
    const llm = deps.llm;
    const s = script as Script;
    const res = await time("plan", () =>
      planVideo(llm, s, catalog, {
        projectId: name,
        voiceId: deps.voice?.voiceId ?? optional("ELEVENLABS_VOICE_ID", "none"),
        ...align,
      }),
    );
    usage.push(...res.usage);
    planAttempts = res.attempts.length;
    writeJson(join(outDir, "plan-attempts.json"), res.attempts);
    if (!res.plan || !res.compiled) {
      const last = res.attempts[res.attempts.length - 1];
      const errors = (last?.issues ?? []).filter((i) => i.level === "error");
      log(
        `plan: still ${errors.length} error(s) after ${res.attempts.length} attempts; see plan-attempts.json`,
      );
      for (const e of errors.slice(0, 10)) log(`  ${e.code} ${e.path}: ${e.message}`);
      return finish();
    }
    plan = res.plan;
    compiled = res.compiled;
    log(`plan: compiled on attempt ${planAttempts}`);
  }
  writeJson(join(outDir, "video-plan.json"), plan);
  for (const i of compiled.issues) {
    const line = `${i.level} ${i.code} ${i.path}: ${i.message}`;
    if (i.level === "warning") warnings.push(line);
    log(`  ${line}`);
  }
  if (!compiled.timeline) {
    log("compile failed; fix video-plan.json and resume with --from-plan");
    return finish();
  }
  writeJson(join(outDir, "timeline.json"), compiled.timeline);

  // 4. render
  const fps = compiled.timeline.fps;
  const clips: VoiceClip[] = compiled.scenes.flatMap((s) =>
    clipFiles[s.sceneId] ? [{ file: clipFiles[s.sceneId] as string, startSec: s.from / fps }] : [],
  );
  const video = join(outDir, "video.mp4");
  let lastPct = -1;
  const rendered = await time("render", () =>
    renderVideo({
      timeline: compiled.timeline,
      assetsDir,
      out: video,
      voice: clips,
      musicPlaceholder: opts.music ?? true,
      onProgress: (done, total) => {
        const pct = Math.floor((done / total) * 10) * 10;
        if (pct !== lastPct) {
          lastPct = pct;
          log(`render ${pct}%`);
        }
      },
    }),
  );
  return finish({ video, durationSec: rendered.frames / fps });
}
