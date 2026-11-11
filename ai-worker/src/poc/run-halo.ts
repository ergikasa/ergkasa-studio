/**
 * Renders the Visual PoC "The Halo Effect" (hand-directed).
 *
 *   pnpm poc:halo               with the ElevenLabs voice (ELEVENLABS_API_KEY in .env) and the H1 music
 *   pnpm poc:halo --silent      no voice: timing estimated (for checking the picture only)
 *   pnpm poc:halo --voice friendly_woman
 *
 * Output: out/poc/halo/ (video.mp4, timeline.json, audio-plan.json, audio-notes.txt, frames/*.png)
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { VoiceAlignment, type AudioPlan } from "@erkasa/contracts";
import {
  designSoundtrack,
  loadAudioCatalog,
  loadEngine,
  measureVoiceLufs,
  openLibrary,
  renderMix,
  renderStill,
  renderVideo,
  type Resolve,
} from "@erkasa/engine-worker";
import { repoRoot } from "../env.js";
import { stepVoice } from "../steps.js";
import { ElevenLabsVoice } from "../voice.js";
import { loadVoiceCatalog, resolvePreset } from "../voice-catalog.js";
import { HALO_SCRIPT, buildHaloTimeline, estimateTiming, sceneStarts, type SceneTiming } from "./halo.js";

export async function runHalo(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      silent: { type: "boolean", default: false },
      voice: { type: "string" },
      out: { type: "string" },
      "no-music": { type: "boolean", default: false },
    },
  });
  const root = repoRoot();
  const dir = resolve(values.out ?? join(root, "out", "poc", "halo"));
  rmSync(join(dir, "frames"), { recursive: true, force: true }); // stills of a previous run
  mkdirSync(join(dir, "frames"), { recursive: true });
  const assets = join(root, "assets");
  const log = (l: string): void => console.info(l);

  // 1. narration (or estimated timing)
  let timing: SceneTiming[];
  let clips: { sceneId: string; file: string; audio: string }[] = [];
  if (values.silent) {
    timing = estimateTiming();
    log("silent preview: word timing estimated");
  } else {
    const voiceJson = join(dir, "voice", "voice.json");
    const preset = resolvePreset(loadVoiceCatalog(), values.voice);
    let track: { scenes: Array<{ sceneId: string; audio: string; alignment: string; durationSec: number }> };
    if (existsSync(voiceJson) && !values.voice) {
      track = JSON.parse(readFileSync(voiceJson, "utf8")) as typeof track;
      log("voice: reusing out/poc/halo/voice (delete the folder to record again)");
    } else {
      log(`voice: ${preset.id} (ElevenLabs)`);
      track = await stepVoice(
        dir,
        HALO_SCRIPT.map((s) => ({ sceneId: s.sceneId, narration: s.narration })),
        new ElevenLabsVoice(preset),
      );
    }
    timing = track.scenes.map((s) => {
      const a = VoiceAlignment.parse(JSON.parse(readFileSync(join(dir, s.alignment), "utf8")));
      return { sceneId: s.sceneId, durationSec: s.durationSec, words: a.words };
    });
    clips = track.scenes.map((s) => ({
      sceneId: s.sceneId,
      file: join(dir, s.audio),
      audio: `file://halo/${s.audio}`,
    }));
  }

  // 2. picture
  const timeline = buildHaloTimeline(timing);
  writeFileSync(join(dir, "timeline.json"), JSON.stringify(timeline, null, 1));
  const starts = sceneStarts(timeline);
  log(
    `timeline: ${timeline.scenes.length} scenes, ${(timeline.scenes.reduce((n, s) => n + s.duration, 0) / 30).toFixed(1)} s`,
  );

  // 3. sound: designed soundtrack when the library is imported, else voice only
  let audio: string | undefined;
  const voice = clips.map((c) => ({ file: c.file, startSec: starts[c.sceneId] ?? 0 }));
  if (values["no-music"] !== true) {
    const library = openLibrary(loadAudioCatalog());
    if (library.music.length || library.sfx.length) {
      const voiceLufs = clips.length ? measureVoiceLufs(clips.map((c) => c.file)) : undefined;
      const designed = designSoundtrack({
        timeline,
        story: HALO_SCRIPT.map((s) => ({ sceneId: s.sceneId, beat: s.beat, emotion: s.emotion })),
        words: Object.fromEntries(
          timing.map((t) => [
            t.sceneId,
            t.words.map((w) => ({
              ...w,
              start: w.start + (starts[t.sceneId] ?? 0),
              end: w.end + (starts[t.sceneId] ?? 0),
            })),
          ]),
        ),
        voice: clips.map((c) => ({
          sceneId: c.sceneId,
          audio: c.audio,
          startSec: starts[c.sceneId] ?? 0,
        })) as AudioPlan["voice"],
        ...(voiceLufs !== undefined ? { voiceLufs } : {}),
        library,
        seed: 7,
      });
      writeFileSync(join(dir, "audio-plan.json"), JSON.stringify(designed.plan, null, 2));
      writeFileSync(join(dir, "audio-notes.txt"), `${designed.notes.join("\n")}\n`);
      const byId = new Map([...library.music, ...library.sfx].map((i) => [i.id, i.path]));
      const resolveRef: Resolve = (ref) => {
        const clip = clips.find((c) => c.audio === ref);
        if (clip) return clip.file;
        const p = byId.get(ref);
        if (!p) throw new Error(`unknown audio ${ref}`);
        return p;
      };
      const mixed = await renderMix(designed.plan, resolveRef, join(dir, "mix.wav"));
      audio = mixed.file;
      log(
        `audio: designed (${designed.plan.music.length} music segments, ${designed.plan.sfx.length} effects), ${mixed.lufs} LUFS`,
      );
    } else log("audio: library not imported (pnpm audio:import); voice only");
  }

  // 4. stills for a quick look, then the video
  const engine = loadEngine(timeline, assets);
  for (const s of timeline.scenes)
    for (const k of [0.15, 0.5, 0.85]) {
      const f = s.from + Math.round(s.duration * k);
      renderStill(engine, f, join(dir, "frames", `${s.sceneId}-${String(f).padStart(4, "0")}.png`));
    }
  let last = -1;
  const out = join(dir, "video.mp4");
  await renderVideo({
    timeline,
    assetsDir: assets,
    out,
    ...(audio ? { audio } : voice.length ? { voice } : {}),
    onProgress: (done, total) => {
      const pct = Math.floor((done / total) * 10) * 10;
      if (pct !== last) {
        last = pct;
        log(`render ${pct}%`);
      }
    },
  });
  log(`done: ${out}`);
}
