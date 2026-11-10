import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { compileVideo, type CompileResult, type Issue, type TimedWord } from "@erkasa/compiler";
import {
  Script,
  VideoPlan,
  VoiceAlignment,
  type AudioPlan,
  type MixSettings,
  type RenderTimeline,
  type Theme,
  type VoicePreset,
} from "@erkasa/contracts";
import {
  designSoundtrack,
  loadAudioCatalog,
  measureVoiceLufs,
  openLibrary,
  renderMix,
  renderVideo,
  type Resolve,
  type SceneStory,
  type VoiceClip,
} from "@erkasa/engine-worker";
import type { Catalog } from "./catalog.js";
import type { Llm, Usage } from "./llm.js";
import { planVideo, type PlanAttempt } from "./planner.js";
import { writeScript } from "./script-writer.js";
import { narratorLine } from "./voice-catalog.js";
import { toAlignment, type Voice } from "./voice.js";

/**
 * The four steps of a video, each reading and writing files in one run folder. The CLI (`pnpm video`)
 * runs them in a row; the RabbitMQ worker runs one per task. Same code, same files.
 */
export const RUN_FILES = {
  script: "script.json",
  voice: "voice/voice.json",
  plan: "video-plan.json",
  planAttempts: "plan-attempts.json",
  timeline: "timeline.json",
  audioPlan: "audio-plan.json",
  audioNotes: "audio-notes.txt",
  mix: "mix.wav",
  video: "video.mp4",
} as const;

export const SEED = 20261108;

/** 0..100 plus a short note, reported while a step runs. */
export type Progress = (pct: number, message: string) => void;

export function writeJson(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Exact audio duration via ffprobe (the alignment ends at the last character, not the last sample). */
export function probeDuration(file: string): number | undefined {
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

// ---------------------------------------------------------------- 1. script

export interface ScriptParams {
  topic: string;
  theme: Exclude<Theme, "everyday">;
  seconds: number;
  notes?: string;
}

export async function stepScript(
  dir: string,
  params: ScriptParams,
  llm: Llm,
  catalog: Catalog,
): Promise<{ script: Script; usage: Usage[] }> {
  mkdirSync(dir, { recursive: true });
  const res = await writeScript(
    llm,
    {
      topic: params.topic,
      theme: params.theme,
      targetSec: params.seconds,
      ...(params.notes ? { notes: params.notes } : {}),
    },
    catalog.vocabulary(),
    catalog.characters.map((c) => c.id),
  );
  writeJson(join(dir, RUN_FILES.script), res.script);
  return res;
}

export function loadScript(dir: string): Script {
  return Script.parse(readJson(join(dir, RUN_FILES.script)));
}

// ---------------------------------------------------------------- 2. voice

/** voice/voice.json: which clips exist for the run. Paths are relative to the run folder. */
export interface VoiceTrack {
  voice: string;
  modelId: string;
  characters: number;
  scenes: Array<{ sceneId: string; audio: string; alignment: string; durationSec: number }>;
}

export interface Narration {
  sceneId: string;
  narration: string;
}

export async function stepVoice(
  dir: string,
  narrations: Narration[],
  voice: Voice,
  progress?: Progress,
): Promise<VoiceTrack> {
  mkdirSync(join(dir, "voice"), { recursive: true });
  const track: VoiceTrack = { voice: voice.preset.id, modelId: voice.modelId, characters: 0, scenes: [] };
  for (const [i, s] of narrations.entries()) {
    progress?.(Math.round((i / narrations.length) * 100), `voice ${s.sceneId}`);
    const speech = await voice.speak({
      text: s.narration,
      ...(narrations[i - 1] ? { previousText: narrations[i - 1]?.narration } : {}),
      ...(narrations[i + 1] ? { nextText: narrations[i + 1]?.narration } : {}),
      seed: SEED + i,
    });
    const audio = `voice/${s.sceneId}.mp3`;
    const alignmentFile = `voice/${s.sceneId}.alignment.json`;
    writeFileSync(join(dir, audio), speech.audio);
    const alignment = toAlignment(
      s.sceneId,
      `file://${audio}`,
      speech.alignment,
      probeDuration(join(dir, audio)) ?? 0,
    );
    writeJson(join(dir, alignmentFile), alignment);
    track.characters += speech.characters;
    track.scenes.push({
      sceneId: s.sceneId,
      audio,
      alignment: alignmentFile,
      durationSec: alignment.durationSec,
    });
  }
  writeJson(join(dir, RUN_FILES.voice), track);
  progress?.(100, "voice done");
  return track;
}

export function loadVoiceTrack(dir: string): VoiceTrack | undefined {
  const file = join(dir, RUN_FILES.voice);
  return existsSync(file) ? (readJson(file) as VoiceTrack) : undefined;
}

/** Word timings per scene from the voice track (validated alignment files). */
export function alignmentsOf(
  dir: string,
  track: VoiceTrack | undefined,
): Record<string, TimedWord[]> | undefined {
  if (!track) return undefined;
  const out: Record<string, TimedWord[]> = {};
  for (const s of track.scenes) out[s.sceneId] = VoiceAlignment.parse(readJson(join(dir, s.alignment))).words;
  return out;
}

// ---------------------------------------------------------------- 3. plan

export interface PlanStepResult {
  plan?: VideoPlan;
  attempts: PlanAttempt[];
  usage: Usage[];
  /** Errors of the last attempt when no plan compiled. */
  errors: Issue[];
  /** Director's review findings left on the chosen plan (empty = it passed). */
  directionIssues: Issue[];
}

export async function stepPlan(
  dir: string,
  script: Script,
  preset: VoicePreset,
  llm: Llm,
  catalog: Catalog,
  projectId: string,
): Promise<PlanStepResult> {
  const alignments = alignmentsOf(dir, loadVoiceTrack(dir));
  const res = await planVideo(llm, script, catalog, {
    projectId,
    voiceId: preset.id,
    narrator: narratorLine(preset),
    ...(alignments ? { alignments } : {}),
  });
  writeJson(join(dir, RUN_FILES.planAttempts), res.attempts);
  if (res.plan) writeJson(join(dir, RUN_FILES.plan), res.plan);
  const last = res.attempts[res.attempts.length - 1];
  return {
    ...(res.plan ? { plan: res.plan } : {}),
    attempts: res.attempts,
    usage: res.usage,
    errors: res.plan ? [] : (last?.issues ?? []).filter((i) => i.level === "error"),
    directionIssues: res.directionIssues,
  };
}

export function loadPlan(dir: string): VideoPlan {
  return VideoPlan.parse(readJson(join(dir, RUN_FILES.plan)));
}

// ---------------------------------------------------------------- 4. soundtrack + render

export interface Soundtrack {
  plan: AudioPlan;
  resolve: Resolve;
  /** Decisions and what was left out, one per line (also written to audio-notes.txt). */
  notes: string[];
}

/**
 * Designs the soundtrack of a compiled run: music by story beats, effects on visible events, levels
 * relative to the measured narration. Writes audio-plan.json and audio-notes.txt. Returns undefined
 * when the audio library has nothing usable yet (the caller falls back to the placeholder pad).
 */
export function stepSoundtrack(
  dir: string,
  compiled: CompileResult & { timeline: RenderTimeline },
  opts: { mix?: Partial<MixSettings>; write?: boolean } = {},
): Soundtrack | { missing: string } {
  let library;
  try {
    library = openLibrary(loadAudioCatalog());
  } catch (e) {
    return { missing: `audio catalog unreadable: ${e instanceof Error ? e.message : String(e)}` };
  }
  library = { ...library, mix: { ...library.mix, ...opts.mix } };
  if (!library.music.length && !library.sfx.length)
    return {
      missing: `audio library empty (${library.skipped.length} entries not imported): run pnpm audio:import`,
    };

  const runId = basename(dir);
  const fps = compiled.timeline.fps;
  const track = loadVoiceTrack(dir);
  const voice: AudioPlan["voice"] = compiled.scenes.flatMap((s) => {
    const clip = track?.scenes.find((c) => c.sceneId === s.sceneId);
    return clip
      ? [{ sceneId: s.sceneId, audio: `file://${runId}/${clip.audio}`, startSec: s.from / fps }]
      : [];
  });
  const voiceLufs = track ? measureVoiceLufs(track.scenes.map((c) => join(dir, c.audio))) : undefined;
  const scriptFile = join(dir, RUN_FILES.script);
  const story: SceneStory[] = existsSync(scriptFile)
    ? loadScript(dir).scenes.map((s) => ({
        sceneId: s.sceneId,
        ...(s.beat ? { beat: s.beat } : {}),
        ...(s.emotion ? { emotion: s.emotion } : {}),
        ...(s.emphasis ? { emphasis: s.emphasis } : {}),
      }))
    : [];
  const res = designSoundtrack({
    timeline: compiled.timeline,
    story,
    words: Object.fromEntries(compiled.scenes.map((s) => [s.sceneId, s.words])),
    planned: compiled.sfx,
    voice,
    ...(voiceLufs !== undefined ? { voiceLufs } : {}),
    library,
    seed: SEED,
  });
  const notes = [
    ...res.notes,
    ...library.skipped
      .filter((s) => s.reason !== "not imported yet")
      .map((s) => `left out ${s.id}: ${s.reason}`),
  ];
  if (opts.write !== false) {
    writeJson(join(dir, RUN_FILES.audioPlan), res.plan);
    writeFileSync(join(dir, RUN_FILES.audioNotes), `${notes.join("\n")}\n`);
  }
  const prefix = `file://${runId}/`;
  const byId = new Map([...library.music, ...library.sfx].map((i) => [i.id, i.path]));
  const resolve: Resolve = (ref) => {
    if (ref.startsWith(prefix)) return join(dir, ref.slice(prefix.length));
    const path = byId.get(ref);
    if (!path) throw new Error(`audio plan refers to '${ref}', which is not in the library`);
    return path;
  };
  return { plan: res.plan, resolve, notes };
}

export interface RenderStepResult {
  compiled: CompileResult;
  video?: string;
  durationSec?: number;
  /** How the soundtrack was made: designed from the library, the placeholder pad, or voice only. */
  audio?: { mode: "designed" | "placeholder" | "voice" | "silent"; notes: string[] };
}

/** Compiles a run's plan against its real word timings (estimated when there is no voice). */
export function compileRun(dir: string, plan: VideoPlan, catalog: Catalog): CompileResult {
  const alignments = alignmentsOf(dir, loadVoiceTrack(dir));
  return compileVideo(plan, { assets: catalog.source, seed: SEED, ...(alignments ? { alignments } : {}) });
}

/** Compiles the plan against the run's real word timings, then renders video.mp4 with the voice mixed in. */
export async function stepRender(
  dir: string,
  plan: VideoPlan,
  opts: { catalog: Catalog; music: boolean; progress?: Progress; videoName?: string },
): Promise<RenderStepResult> {
  const track = loadVoiceTrack(dir);
  const compiled = compileRun(dir, plan, opts.catalog);
  if (!compiled.timeline) return { compiled };
  writeJson(join(dir, RUN_FILES.timeline), compiled.timeline);
  const fps = compiled.timeline.fps;
  const clips: VoiceClip[] = compiled.scenes.flatMap((s) => {
    const clip = track?.scenes.find((c) => c.sceneId === s.sceneId);
    return clip ? [{ file: join(dir, clip.audio), startSec: s.from / fps }] : [];
  });
  const video = join(dir, opts.videoName ?? RUN_FILES.video);
  let audio: RenderStepResult["audio"];
  let mixFile: string | undefined;
  if (opts.music) {
    const st = stepSoundtrack(dir, { ...compiled, timeline: compiled.timeline });
    if ("missing" in st) audio = { mode: "placeholder", notes: [`${st.missing}; placeholder pad used`] };
    else {
      opts.progress?.(0, "mixing the soundtrack");
      const mixed = await renderMix(st.plan, st.resolve, join(dir, RUN_FILES.mix));
      mixFile = mixed.file;
      audio = {
        mode: "designed",
        notes: [...st.notes, `mix: ${mixed.lufs} LUFS, peak ${mixed.truePeakDb} dBTP`],
      };
    }
  } else audio = { mode: clips.length ? "voice" : "silent", notes: [] };
  let last = -1;
  const rendered = await renderVideo({
    timeline: compiled.timeline,
    assetsDir: opts.catalog.assetsDir,
    out: video,
    ...(mixFile ? { audio: mixFile } : { voice: clips, musicPlaceholder: opts.music }),
    onProgress: (done, total) => {
      const pct = Math.floor((done / total) * 20) * 5;
      if (pct !== last) {
        last = pct;
        opts.progress?.(pct, `render ${done}/${total} frames`);
      }
    },
  });
  return { compiled, video, durationSec: rendered.frames / fps, ...(audio ? { audio } : {}) };
}
