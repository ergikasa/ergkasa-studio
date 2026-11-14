import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { Script, VideoPlan, type Theme, type VoicePreset } from "@erkasa/contracts";
import { Catalog } from "./catalog.js";
import { repoRoot } from "./env.js";
import { llmCost, type Llm, type Usage } from "./llm.js";
import { RecordingLlm } from "./llm-record.js";
import { buildStoryboard } from "./storyboard.js";
import {
  RUN_FILES,
  loadVoiceTrack,
  stepPlan,
  stepRender,
  stepScript,
  stepVoice,
  stepWorld,
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
  /** Host (main character) chosen by the user, e.g. char_host_01. */
  host?: string;
  /** No ElevenLabs call: silent video with estimated word timing (for testing the pipeline cheaply). */
  noVoice?: boolean;
  /** Placeholder music bed under the voice (default true until real music exists). */
  music?: boolean;
  /** Design the video's own world after the script (default true). false = the library, as before. */
  world?: boolean;
  /** Let Claude look at the storyboard frames before rendering and fix what a viewer would trip on (default false). */
  critic?: boolean;
  /** The look of the world, chosen by the producer (storybook, clean_editorial, night_noir, sunset_warm). */
  style?: string;
  /** Stop after the plan and the storyboard stills; render later with `render <run folder>`. */
  storyboard?: boolean;
  /** Render with this many processes at once (default 1). */
  workers?: number;
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
  /** The video's world, when it has one: style, places, cast and props in one line. */
  world?: string;
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
  const library = deps.catalog ?? new Catalog(join(root, "assets"));
  let catalog = library;
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
  let worldSummary: string | undefined;
  let host = opts.host;
  // every answer of the model is kept in the run folder (llm/), so the run can be replayed at no cost
  const llm = deps.llm ? new RecordingLlm(deps.llm, join(outDir, "llm")) : undefined;
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
      ...(worldSummary ? { world: worldSummary } : {}),
    };
    writeJson(join(outDir, "run.json"), r);
    return r;
  };

  // 1. script
  if (!script && !plan) {
    if (!opts.topic || !opts.theme) throw new Error("a new video needs a topic and a theme");
    if (!llm) throw new Error("no language model configured");
    const params = {
      topic: opts.topic,
      theme: opts.theme,
      seconds: opts.seconds ?? 45,
      ...(opts.notes ? { notes: opts.notes } : {}),
    };
    const res = await time("script", () => stepScript(outDir, params, llm, library));
    usage.push(...res.usage);
    script = res.script;
    log(`script: "${script.title}", ${script.scenes.length} scenes, ~${script.estimatedSec}s`);
  } else if (script) writeJson(join(outDir, RUN_FILES.script), script);

  // 1b. the video's own world: Claude designs it from the script, the World Builder draws it
  if (script && !plan && opts.world !== false) {
    if (!llm) throw new Error("no language model configured");
    const s = script;
    const w = await time("world", () =>
      stepWorld(outDir, s, llm, library, name.replace(/-/g, "_"), host, opts.style),
    );
    usage.push(...w.usage);
    if (w.dir) {
      catalog = new Catalog([w.dir, library.assetsDir]);
      script = w.script;
      writeJson(join(outDir, "script.world.json"), script);
      if (w.hostId) host = w.hostId;
      worldSummary = w.summary;
      timings["worldBuild"] = w.buildSec ?? 0;
      log(`world: ${w.summary} (attempt ${w.attempts}, built in ${(w.buildSec ?? 0).toFixed(2)} s)`);
      if (w.custom)
        log(
          `custom objects: ${w.custom.passed}/${w.custom.requested} passed the gate${w.custom.failed.length ? `; left out: ${w.custom.failed.map((f) => `${f.id} (${f.problems.join("; ")})`).join(", ")}` : ""}`,
        );
    } else {
      const line = `world: no valid world after ${w.attempts} attempts (see ${RUN_FILES.worldIssues}); using the library`;
      warnings.push(line);
      log(line);
    }
  }
  // resuming a plan made in a world: its assets are in the plan's run folder
  if (plan && opts.fromPlan) {
    const worldDir = join(dirname(opts.fromPlan), RUN_FILES.worldDir);
    if (existsSync(join(worldDir, "manifest.json"))) {
      catalog = new Catalog([worldDir, library.assetsDir]);
      log(`world: ${relative(process.cwd(), worldDir)}`);
    }
  }

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
    if (!llm) throw new Error("no language model configured");
    const s = script as Script;
    const cat = catalog;
    const res = await time("plan", () =>
      stepPlan(outDir, s, preset, llm, cat, name, host, { critic: opts.critic === true }),
    );
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

  // 3b. storyboard: the scenes as frames, with what the render will take; the producer decides before it starts
  if (opts.storyboard) {
    const sb = buildStoryboard(outDir, plan as VideoPlan, catalog, { workers: opts.workers ?? 1 });
    log(
      `storyboard: ${sb.scenes.length} scenes, ${sb.totalSec}s of film, render ~${Math.ceil(sb.estimate.renderSec / 60)} min with ${sb.estimate.workers} worker(s); frames in ${relative(process.cwd(), join(outDir, "storyboard")) || "storyboard"}`,
    );
    return finish();
  }

  // 4. compile + render
  let lastLogged = -1;
  const rendered = await time("render", () =>
    stepRender(outDir, plan as VideoPlan, {
      catalog,
      music: opts.music ?? true,
      ...(opts.workers ? { workers: opts.workers } : {}),
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
