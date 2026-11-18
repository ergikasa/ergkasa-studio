/**
 * E1.6 subphase 4a: the score of a v2 film from the licensed audio catalog (audio/catalog.json, files in
 * ERKASA_AUDIO_DIR). The sound designer of the v1 engine (engine-worker designSoundtrack: music roles from the
 * story beats, sections, crossfades, effects with budgets and gaps, all explained in its notes) receives the v2
 * film's timing through a thin adapter; its plan is staged by the stager (stager/src/score.ts).
 *
 * No placeholder: a catalog without usable music, or a file whose sha256 is not the recorded one, fails the
 * render (AUDIO_LIBRARY_MISSING, not retryable): commercial output never falls back to the synthetic bed (D2).
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AudioCatalogEntry, AudioPlan, RenderTimeline, Script } from "@erkasa/contracts";
import {
  designSoundtrack,
  loadAudioCatalog,
  measureVoiceLufs,
  openLibrary,
  type SceneStory,
} from "@erkasa/engine-worker";
import { v2SoundTiming, type ScoreFile } from "@erkasa/stager";
import { TaskFailure } from "./failure.js";
import type { FilmPlan } from "@erkasa/film";

export const SCORE_SEED = 20261108;
export const SCORE_FILES = { plan: "audio-plan.json", notes: "audio-notes.txt" } as const;

/** The v2 effect kinds (film/src/sound.ts) as the catalog's effect events. */
export const EFFECT_EVENT: Record<string, string> = {
  whoosh: "scene_cut",
  tick: "clock_object",
  thud: "object_in",
  door: "object_in",
  chime: "resolve_win",
  rise: "turn_insight",
};

/** An SPDX-style LicenseRef for a catalog licence name (`Pixabay Content License` → `LicenseRef-Pixabay-Content-License`). */
export const licenseRef = (name: string): string =>
  `LicenseRef-${name.trim().replace(/[^A-Za-z0-9.]+/g, "-")}`;

const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

export interface DesignedScore {
  plan: AudioPlan;
  notes: string[];
  /** The catalog entries the plan uses, by id (for the WAVs and the credits). */
  used: Map<string, AudioCatalogEntry & { path: string }>;
}

/** Designs the film's score from the catalog; writes audio-plan.json and audio-notes.txt into `dir`. */
export function designScore(
  dir: string,
  runId: string,
  plan: FilmPlan,
  script: Script,
  voice: NonNullable<Parameters<typeof v2SoundTiming>[2]> & { voiceFiles?: Record<string, string> },
): DesignedScore {
  let library;
  try {
    library = openLibrary(loadAudioCatalog(), { verify: sha256 });
  } catch (e) {
    throw new TaskFailure(
      "AUDIO_LIBRARY_MISSING",
      `the audio catalog cannot be read: ${e instanceof Error ? e.message : String(e)}`,
      false,
    );
  }
  if (!library.music.length)
    throw new TaskFailure(
      "AUDIO_LIBRARY_MISSING",
      `no licensed music is usable (${library.skipped.length} catalog entries left out, e.g. ${library.skipped
        .slice(0, 3)
        .map((s) => `${s.id}: ${s.reason}`)
        .join(
          "; ",
        )}); set ERKASA_AUDIO_DIR to the imported library. Commercial output has no placeholder music.`,
      false,
    );
  const t = v2SoundTiming(plan, script, {
    ...(voice.alignments ? { alignments: voice.alignments } : {}),
    ...(voice.clipDurations ? { clipDurations: voice.clipDurations } : {}),
  });
  const FPS = 30;
  // the v1 designer reads a v1 timeline: here only what it needs for music roles and timed effects
  const timeline = {
    fps: FPS,
    scenes: t.scenes.map((s) => ({
      sceneId: s.sceneId,
      from: Math.round(s.start * FPS),
      duration: Math.max(1, Math.round(s.duration * FPS)),
      transitionIn: { type: "cut" },
      camera: {},
      nodes: [],
    })),
  } as unknown as RenderTimeline;
  const story: SceneStory[] = script.scenes.map((s) => ({
    sceneId: s.sceneId,
    ...(s.beat ? { beat: s.beat } : {}),
    ...(s.emotion ? { emotion: s.emotion } : {}),
    ...(s.emphasis ? { emphasis: s.emphasis } : {}),
  }));
  const words: Record<string, Array<{ word: string; start: number; end: number }>> = {};
  for (const w of t.words) (words[w.sceneId] ??= []).push({ word: w.word, start: w.start, end: w.end });
  const sceneAt = (sec: number): string =>
    [...t.scenes].reverse().find((s) => s.start <= sec)?.sceneId ?? t.scenes[0]?.sceneId ?? "s01";
  const planned = t.effects.flatMap((e) => {
    const tag = EFFECT_EVENT[e.kind];
    return tag ? [{ sceneId: sceneAt(e.t), tag, atSec: Math.max(0, e.t), gainDb: 0 }] : [];
  });
  const voiceFiles = voice.voiceFiles ?? {};
  const voicePlan: AudioPlan["voice"] = t.scenes.flatMap((s) =>
    voiceFiles[s.sceneId]
      ? [{ sceneId: s.sceneId, audio: `file://${runId}/voice/${s.sceneId}`, startSec: s.start }]
      : [],
  );
  const files = Object.values(voiceFiles);
  const voiceLufs = files.length ? measureVoiceLufs(files) : undefined;
  const res = designSoundtrack({
    timeline,
    story,
    words,
    planned,
    voice: voicePlan,
    ...(voiceLufs !== undefined ? { voiceLufs } : {}),
    library,
    seed: SCORE_SEED,
  });
  const notes = [...res.notes, ...library.skipped.map((s) => `left out ${s.id}: ${s.reason}`)];
  writeFileSync(join(dir, SCORE_FILES.plan), `${JSON.stringify(res.plan, null, 2)}\n`);
  writeFileSync(join(dir, SCORE_FILES.notes), `${notes.join("\n")}\n`);
  const byId = new Map([...library.music, ...library.sfx].map((i) => [i.id, i]));
  const used = new Map<string, AudioCatalogEntry & { path: string }>();
  for (const id of [...res.plan.music.map((m) => m.assetId), ...res.plan.sfx.map((s) => s.assetId)]) {
    const item = byId.get(id);
    if (!item) throw new Error(`the score uses '${id}', which is not in the library`);
    used.set(id, item);
  }
  return { plan: res.plan, notes, used };
}

/** The package file of a used catalog entry, once its WAV is written at `uri` under the package root. */
export function scoreFile(entry: AudioCatalogEntry, uri: string, bytes: Uint8Array): ScoreFile {
  return {
    uri,
    bytes,
    catalogId: entry.id,
    license: licenseRef(entry.license.name),
    provenance: { origin: "kit", by: `audio catalog ${entry.id}`.slice(0, 128) },
    approval: {
      status: "approved",
      by: "audio catalog",
      note: `${entry.license.name}, checked ${entry.checkedAt ?? "?"}: ${entry.sourceUrl}`.slice(0, 500),
    },
  };
}
