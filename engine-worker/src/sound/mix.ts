import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import type { AudioPlan } from "@erkasa/contracts";
import { measureLoudness, probeDurationSec } from "./measure.js";

/**
 * FFmpeg filter graph for an Audio Plan. Narration on top; music segments trimmed, faded, levelled and
 * placed on the timeline, then ducked under the voice; effects placed and levelled; the sum is
 * mastered in a second pass: one linear gain to the target loudness (-14 LUFS for TikTok by default)
 * plus a peak limiter. A linear gain keeps the dynamics we designed (the breath before a twist, the
 * swell of the turn); single-pass `loudnorm` would ride them flat.
 *
 * Ducking depth is exact: the sidechain compressor runs hard and its dry/wet `mix` sets how deep the
 * music goes while someone speaks: depth D dB -> mix = 1 - 10^(-D/20).
 */

export interface MixGraph {
  inputs: string[];
  filter: string;
  /** Output label of the final mix, e.g. `[a]`. */
  out: string;
}

/** Turns plan references (voice artifact URIs, catalog asset ids) into file paths. */
export type Resolve = (ref: string) => string;

export function mixGraph(plan: AudioPlan, resolve: Resolve, firstInput = 1): MixGraph {
  const inputs: string[] = [];
  const graph: string[] = [];
  let next = firstInput;
  const fmt = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";
  const ms = (sec: number): number => Math.max(0, Math.round(sec * 1000));
  const n = (v: number): string => v.toFixed(3);

  const voice = plan.voice.map((v, i) => {
    inputs.push("-i", resolve(v.audio));
    graph.push(`[${next++}:a]${fmt},adelay=delays=${ms(v.startSec)}:all=1[v${i}]`);
    return `[v${i}]`;
  });
  const music = plan.music.map((m, i) => {
    const len = m.endSec - m.startSec;
    // loop the file so a segment longer than its track never runs dry
    inputs.push("-stream_loop", "-1", "-i", resolve(m.assetId));
    const fadeOutAt = Math.max(0, len - m.fadeOutSec);
    graph.push(
      `[${next++}:a]${fmt},atrim=start=${n(m.offsetSec)}:duration=${n(len)},asetpts=PTS-STARTPTS,` +
        `afade=t=in:d=${n(m.fadeInSec)}:curve=qsin,afade=t=out:st=${n(fadeOutAt)}:d=${n(m.fadeOutSec)}:curve=qsin,` +
        `volume=${m.gainDb.toFixed(2)}dB,adelay=delays=${ms(m.startSec)}:all=1[m${i}]`,
    );
    return `[m${i}]`;
  });
  const sfx = plan.sfx.map((s, i) => {
    inputs.push("-i", resolve(s.assetId));
    const trim =
      s.offsetSec !== undefined || s.maxSec !== undefined
        ? `atrim=start=${n(s.offsetSec ?? 0)}${s.maxSec !== undefined ? `:duration=${n(s.maxSec)}` : ""},asetpts=PTS-STARTPTS,`
        : "";
    const tail = s.maxSec !== undefined ? `afade=t=out:st=${n(Math.max(0, s.maxSec - 0.25))}:d=0.25,` : "";
    graph.push(
      `[${next++}:a]${fmt},${trim}${tail}volume=${s.gainDb.toFixed(2)}dB,adelay=delays=${ms(s.atSec)}:all=1[x${i}]`,
    );
    return `[x${i}]`;
  });

  const sum = (labels: string[], out: string): string | undefined => {
    if (!labels.length) return undefined;
    if (labels.length === 1) graph.push(`${labels[0]}anull${out}`);
    else graph.push(`${labels.join("")}amix=inputs=${labels.length}:normalize=0:dropout_transition=0${out}`);
    return out;
  };
  const voiceL = sum(voice, "[voice]");
  let musicL = sum(music, "[music]");
  const fxL = sum(sfx, "[fx]");

  const layers: string[] = [];
  if (voiceL && musicL && plan.ducking.amountDb > 0) {
    graph.push(`${voiceL}asplit=2[vo][sc]`);
    const wet = Math.min(0.99, 1 - 10 ** (-plan.ducking.amountDb / 20));
    graph.push(
      `${musicL}[sc]sidechaincompress=threshold=0.015:ratio=20:attack=${plan.ducking.attackMs}:release=${plan.ducking.releaseMs}:mix=${wet.toFixed(3)}[ducked]`,
    );
    layers.push("[vo]");
    musicL = "[ducked]";
  } else if (voiceL) layers.push(voiceL);
  if (musicL) layers.push(musicL);
  if (fxL) layers.push(fxL);
  if (!layers.length) {
    inputs.push("-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${n(plan.durationSec)}`);
    layers.push(`[${next++}:a]`);
  }
  const dur = n(plan.durationSec);
  graph.push(
    `${layers.join("")}amix=inputs=${layers.length}:normalize=0:dropout_transition=0,apad,atrim=duration=${dur}[a]`,
  );
  return { inputs, filter: graph.join(";"), out: "[a]" };
}

/** Narration loudness over all clips (energy-weighted by duration). */
export function measureVoiceLufs(files: string[]): number | undefined {
  let energy = 0;
  let total = 0;
  for (const f of files) {
    try {
      const d = probeDurationSec(f);
      const l = measureLoudness(f).integrated;
      if (l <= -69) continue;
      energy += d * 10 ** (l / 10);
      total += d;
    } catch {
      // a clip that cannot be measured is left out of the average
    }
  }
  return total > 0 ? Math.round(10 * Math.log10(energy / total) * 10) / 10 : undefined;
}

/** Gain that brings `measured` to the target, held back so peaks stay under the ceiling after limiting. */
export function masterGain(
  measured: { integrated: number; truePeakDb: number },
  target: AudioPlan["loudness"],
): number {
  return Math.round((target.targetLufs - measured.integrated) * 100) / 100;
}

async function ffmpegRun(args: string[], ffmpeg?: string): Promise<void> {
  const ff = spawn(
    ffmpeg ?? process.env["ERKASA_FFMPEG"] ?? "ffmpeg",
    ["-y", "-hide_banner", "-loglevel", "error", ...args],
    {
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  const code = await new Promise<number>((res, rej) => {
    ff.on("error", (e) =>
      rej(new Error(`cannot start ffmpeg (${e.message}). Install FFmpeg or set ERKASA_FFMPEG.`)),
    );
    ff.on("close", (c) => res(c ?? 1));
  });
  if (code !== 0) throw new Error(`ffmpeg failed (exit ${code})`);
}

export interface MixResult {
  file: string;
  /** Loudness of the finished mix. */
  lufs: number;
  truePeakDb: number;
  gainDb: number;
}

/**
 * Renders the soundtrack to a 48 kHz WAV in two passes: mix, measure, then one linear gain + limiter
 * to the plan's loudness target. The video render muxes this file; `pnpm audio:mix` writes it for listening.
 */
export async function renderMix(
  plan: AudioPlan,
  resolve: Resolve,
  out: string,
  ffmpeg?: string,
): Promise<MixResult> {
  const g = mixGraph(plan, resolve, 0);
  const raw = out.replace(/\.wav$/i, "") + ".premaster.wav";
  await ffmpegRun(
    [...g.inputs, "-filter_complex", g.filter, "-map", g.out, "-c:a", "pcm_f32le", raw],
    ffmpeg,
  );
  const pre = measureLoudness(raw);
  const gainDb = pre.integrated <= -69 ? 0 : masterGain(pre, plan.loudness);
  // limiter ceiling half a dB under the true-peak target: sample peaks are not true peaks
  const ceiling = 10 ** ((plan.loudness.truePeakDb - 0.5) / 20);
  await ffmpegRun(
    [
      "-i",
      raw,
      "-af",
      `volume=${gainDb.toFixed(2)}dB,alimiter=limit=${ceiling.toFixed(4)}:level=false:attack=1:release=60,aresample=48000`,
      "-c:a",
      "pcm_s16le",
      out,
    ],
    ffmpeg,
  );
  rmSync(raw, { force: true });
  const done = measureLoudness(out);
  return { file: out, lufs: done.integrated, truePeakDb: done.truePeakDb, gainDb };
}
