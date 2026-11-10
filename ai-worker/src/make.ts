import { mkdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { Script, VideoPlan, type Theme, type VoicePreset } from "@erkasa/contracts";
import { Catalog } from "./catalog.js";
import { repoRoot } from "./env.js";
import { llmCost, type Llm, type Usage } from "./llm.js";
import {
  RUN_FILES,
  loadVoiceTrack,
  stepPlan,
  stepRender,
  stepScript,
  stepVoice,
  writeJson,
  type Narration,
} from "./steps.js";
import type { Voice } from "./voice.js";
import { loadVoiceCatalog, resolvePreset } from "./voice-catalog.js";

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
  /** Voice preset id from voices/catalog.json (default: ERKASA_VOICE or the catalog default). */
  voice?: string;
  /** No ElevenLabs call: silent video with estimated word timing (for testing the pipeline cheaply). */
  noVoice?: boolean;
  /** Placeholder music bed under the voice (default true until real music exists). */
  music?: boolean;
  outDir?: string;
  log?: (line: string) => void;
}

export interface MakeDeps {
  llm?: Llm;
  /** Builds the TTS client for the chosen preset (absent with --no-voice). */
  voiceFor?: (preset: VoicePreset) => Voice;
  catalog?: Catalog;
}

export interface MakeReport {
  outDir: string;
  voice: string;
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

/**
 * topic -> script -> voice -> plan -> compile -> MP4. Every intermediate artifact is written to the
 * run folder, so any step can be inspected, edited and resumed with --from-script / --from-plan.
 */
export async function makeVideo(opts: MakeOptions, deps: MakeDeps = {}): Promise<MakeReport> {
  const log = opts.log ?? ((l: string) => console.info(l));
  const root = repoRoot();
  const catalog = deps.catalog ?? new Catalog(join(root, "assets"));
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

  const voices = loadVoiceCatalog();
  // when resuming a plan, keep its narrator unless the user picked another one
  const planVoice = plan && voices.voices.some((v) => v.id === plan?.voiceId) ? plan.voiceId : undefined;
  const preset = resolvePreset(voices, opts.voice ?? planVoice);
  const name = slugify(opts.topic ?? script?.title ?? plan?.projectId ?? "video");
  const outDir = resolve(opts.outDir ?? join(root, "out", `${stamp()}-${name}`));
  mkdirSync(outDir, { recursive: true });
  log(`run folder: ${relative(process.cwd(), outDir) || "."}`);
  log(`voice: ${preset.name} (${preset.id})${opts.noVoice ? ", not synthesized (--no-voice)" : ""}`);
  let voiceCharacters = 0;
  let planAttempts = 0;
  /** Writes run.json (also on failure, so a broken run can be inspected) and returns the report. */
  const finish = (extra: Partial<MakeReport> = {}): MakeReport => {
    const cost = llmCost(usage);
    const r: MakeReport = {
      outDir,
      voice: preset.id,
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
    const params = {
      topic: opts.topic,
      theme: opts.theme,
      seconds: opts.seconds ?? 45,
      ...(opts.notes ? { notes: opts.notes } : {}),
    };
    const res = await time("script", () => stepScript(outDir, params, llm, catalog));
    usage.push(...res.usage);
    script = res.script;
    log(`script: "${script.title}", ${script.scenes.length} scenes, ~${script.estimatedSec}s`);
  } else if (script) writeJson(join(outDir, RUN_FILES.script), script);

  // 2. voice (before planning, so the planner is checked against the real word timings)
  const narrations: Narration[] = plan
    ? plan.scenes.map((s) => ({ sceneId: s.sceneId, narration: s.narration }))
    : (script as Script).scenes;
  if (!opts.noVoice) {
    if (!deps.voiceFor) throw new Error("no voice configured (use --no-voice for a silent test)");
    const voice = deps.voiceFor(preset);
    const track = await time("voice", () => stepVoice(outDir, narrations, voice));
    voiceCharacters = track.characters;
    for (const c of track.scenes) log(`voice ${c.sceneId}: ${c.durationSec.toFixed(2)}s`);
  }

  // 3. plan
  if (plan) {
    plan = { ...plan, voiceId: preset.id };
    writeJson(join(outDir, RUN_FILES.plan), plan);
  } else {
    if (!deps.llm) throw new Error("no language model configured");
    const llm = deps.llm;
    const s = script as Script;
    const res = await time("plan", () => stepPlan(outDir, s, preset, llm, catalog, name));
    usage.push(...res.usage);
    planAttempts = res.attempts.length;
    if (!res.plan) {
      log(
        `plan: still ${res.errors.length} error(s) after ${planAttempts} attempts; see ${RUN_FILES.planAttempts}`,
      );
      for (const e of res.errors.slice(0, 10)) log(`  ${e.code} ${e.path}: ${e.message}`);
      return finish();
    }
    plan = res.plan;
    log(`plan: compiled on attempt ${planAttempts}`);
    for (const d of res.directionIssues) {
      const line = `direction ${d.code} ${d.path}: ${d.message}`;
      warnings.push(line);
      log(`  ${line}`);
    }
  }

  // 4. compile + render
  let lastLogged = -1;
  const rendered = await time("render", () =>
    stepRender(outDir, plan as VideoPlan, {
      catalog,
      music: opts.music ?? true,
      progress: (pct) => {
        if (pct % 10 === 0 && pct !== lastLogged) {
          lastLogged = pct;
          log(`render ${pct}%`);
        }
      },
    }),
  );
  for (const i of rendered.compiled.issues) {
    const line = `${i.level} ${i.code} ${i.path}: ${i.message}`;
    if (i.level === "warning") warnings.push(line);
    log(`  ${line}`);
  }
  if (rendered.audio) {
    log(
      `audio: ${rendered.audio.mode}${rendered.audio.mode === "designed" ? ` (see ${RUN_FILES.audioNotes})` : ""}`,
    );
    for (const n of rendered.audio.notes
      .filter((l) => l.startsWith("music ") || !/^sfx /.test(l))
      .slice(0, 12))
      log(`  ${n}`);
    if (rendered.audio.mode === "placeholder") warnings.push(...rendered.audio.notes);
  }
  if (!rendered.video) {
    log(`compile failed; fix ${RUN_FILES.plan} and resume with --from-plan`);
    return finish();
  }
  if (!opts.noVoice && !loadVoiceTrack(outDir)) warnings.push("voice track missing");
  return finish({
    video: rendered.video,
    ...(rendered.durationSec ? { durationSec: rendered.durationSec } : {}),
  });
}
