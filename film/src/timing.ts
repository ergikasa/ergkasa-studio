import { estimateWords, type TimedWord } from "@erkasa/compiler";
import type { Script } from "@erkasa/contracts";
import type { Anchor, FilmPlan, Shot } from "./contract.js";

/** Pause after each scene's narration, seconds. */
export const SCENE_PAD = 0.35;
/** A cut lands this much before the word it belongs to (picture leads sound by a few frames). */
export const CUT_LEAD = 0.12;
/** The last shot holds this long after the last word. */
export const TAIL = 1.2;

export interface FilmWord extends TimedWord {
  scene: string;
  /** Seconds from the start of the film. */
  t: number;
}

export interface Timing {
  words: FilmWord[];
  scenes: Array<{ sceneId: string; start: number; duration: number }>;
  duration: number;
}

/**
 * Lays the script's scenes end to end. Word times come from the voice alignment when it exists (seconds from
 * the start of each scene's clip), otherwise from an estimate at ~165 words per minute.
 */
export function layoutTiming(
  script: Script,
  alignments?: Record<string, TimedWord[]>,
  clipDurations?: Record<string, number>,
): Timing {
  const words: FilmWord[] = [];
  const scenes: Timing["scenes"] = [];
  let at = 0;
  for (const s of script.scenes) {
    const ws = alignments?.[s.sceneId] ?? estimateWords(s.narration);
    const spoken = Math.max(
      clipDurations?.[s.sceneId] ?? 0,
      ws.length ? (ws[ws.length - 1] as TimedWord).end : 0.5,
    );
    const duration = spoken + SCENE_PAD;
    for (const w of ws) words.push({ ...w, scene: s.sceneId, t: at + w.start });
    scenes.push({ sceneId: s.sceneId, start: at, duration });
    at += duration;
  }
  return { words, scenes, duration: at };
}

const norm = (w: string): string => w.toLowerCase().replace(/[^a-z0-9']/g, "");

/** Parses `word:<w>#n` into the word and its occurrence. */
export function parseWord(anchor: string): { word: string; occurrence: number } | undefined {
  const m = /^word:([^\s#]+)(?:#(\d+))?$/.exec(anchor);
  return m ? { word: norm(m[1] as string), occurrence: Number(m[2] ?? 1) } : undefined;
}

/**
 * Absolute time of an anchor. Words are looked up from `from` onward (in the scene the shot starts in, then the
 * following ones), so `word:the#2` means the second "the" after the shot began.
 */
export function anchorTime(
  timing: Timing,
  anchor: Anchor,
  shotStart: number,
  sceneId: string,
): number | undefined {
  if (anchor === "start") return shotStart;
  if (anchor.startsWith("sec:")) return shotStart + Number(anchor.slice(4));
  const w = parseWord(anchor);
  if (!w) return undefined;
  const sceneIdx = timing.scenes.findIndex((s) => s.sceneId === sceneId);
  const pool = timing.words.filter(
    (x) => timing.scenes.findIndex((s) => s.sceneId === x.scene) >= sceneIdx && x.t >= shotStart - 0.3,
  );
  let seen = 0;
  for (const x of pool) if (norm(x.word) === w.word && ++seen === w.occurrence) return x.t;
  seen = 0;
  for (const x of pool) if (norm(x.word).startsWith(w.word) && ++seen === w.occurrence) return x.t;
  return undefined;
}

export interface ShotTime {
  shot: Shot;
  start: number;
  end: number;
}

/** Start of a shot: its scene's start, or just before its word. */
export function shotStart(timing: Timing, shot: Shot): number | undefined {
  const scene = timing.scenes.find((s) => s.sceneId === shot.scene);
  if (!scene) return undefined;
  if (shot.from === "start") return scene.start;
  if (shot.from.startsWith("sec:")) return scene.start + Number(shot.from.slice(4));
  const w = parseWord(shot.from);
  if (!w) return undefined;
  let seen = 0;
  for (const x of timing.words)
    if (x.scene === shot.scene && norm(x.word) === w.word && ++seen === w.occurrence)
      return Math.max(scene.start, x.t - CUT_LEAD);
  return undefined;
}

/** Every shot with its start and end (the next shot's start; the last one holds after the last word). */
export function shotTimes(timing: Timing, plan: FilmPlan): ShotTime[] {
  const starts = plan.shots.map((s, i) => (i === 0 ? 0 : (shotStart(timing, s) ?? NaN)));
  return plan.shots.map((shot, i) => ({
    shot,
    start: starts[i] as number,
    end: i + 1 < starts.length ? (starts[i + 1] as number) : timing.duration + TAIL,
  }));
}
