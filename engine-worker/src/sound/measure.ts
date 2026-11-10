import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { MusicSection } from "@erkasa/contracts";

/** Measurements of an audio file, all done with FFmpeg so they match what the mixer hears. */

const ffmpeg = (): string => process.env["ERKASA_FFMPEG"] ?? "ffmpeg";
const ffprobe = (): string => process.env["ERKASA_FFPROBE"] ?? "ffprobe";

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function probeDurationSec(path: string): number {
  const out = execFileSync(
    ffprobe(),
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path],
    { encoding: "utf8" },
  );
  const d = Number(out.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`cannot read the duration of ${path}`);
  return d;
}

export interface Loudness {
  /** Integrated loudness, LUFS. */
  integrated: number;
  truePeakDb: number;
  /** Short-term loudness (3 s window) every 0.1 s: the shape of the track. */
  curve: { t: number; lufs: number }[];
}

const SILENT = -70;

/**
 * EBU R128 loudness via `ebur128`, one FFmpeg pass: the short-term curve is printed to stdout, the
 * summary (integrated, true peak) to stderr. Very short sounds have no integrated value; their peak
 * minus 12 dB stands in.
 */
export function measureLoudness(path: string): Loudness {
  const res = spawnSync(
    ffmpeg(),
    [
      "-hide_banner",
      "-nostats",
      "-i",
      path,
      "-af",
      "ebur128=metadata=1:peak=true,ametadata=mode=print:key=lavfi.r128.S:file=-",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (res.error)
    throw new Error(`cannot start ffmpeg (${res.error.message}). Install FFmpeg or set ERKASA_FFMPEG.`);
  if (res.status !== 0) throw new Error(`ffmpeg could not measure ${path}: ${res.stderr.slice(-400)}`);
  const curve: { t: number; lufs: number }[] = [];
  let t = 0;
  for (const line of res.stdout.split("\n")) {
    const time = /pts_time:([\d.]+)/.exec(line);
    if (time?.[1]) t = Number(time[1]);
    const st = /lavfi\.r128\.S=(-?[\d.]+|-inf)/.exec(line);
    if (st?.[1]) curve.push({ t, lufs: st[1] === "-inf" ? SILENT : Math.max(SILENT, Number(st[1])) });
  }
  const tail = res.stderr.slice(res.stderr.lastIndexOf("Summary:"));
  const i = /I:\s+(-?[\d.]+|-inf) LUFS/.exec(tail);
  const p = /Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(tail);
  const truePeakDb = p?.[1] && p[1] !== "-inf" ? Math.min(6, Number(p[1])) : SILENT;
  const measured = i?.[1] && i[1] !== "-inf" ? Number(i[1]) : SILENT;
  const integrated = measured > SILENT ? measured : Math.min(-1, truePeakDb - 12);
  return { integrated: round1(Math.max(SILENT, integrated)), truePeakDb: round1(truePeakDb), curve };
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Proposes intro / build / peak / outro from the loudness curve. This is a starting point for the
 * listener, never the final word: sections confirmed by ear (`source: listened`) always win.
 *
 *   peak  = the loudest 20 % window (at least 8 s)
 *   intro = from 0 until the curve first reaches the track's median level
 *   build = intro end -> peak start
 *   outro = from where the curve falls below the median after the peak, to the end
 */
export function autoSections(curve: Loudness["curve"], durationSec: number): MusicSection[] {
  const pts = curve.filter((p) => p.lufs > SILENT + 1);
  if (pts.length < 20 || durationSec < 20) return [];
  const sorted = [...pts.map((p) => p.lufs)].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? SILENT;
  const win = Math.max(8, durationSec * 0.2);
  let best = { start: 0, mean: -Infinity };
  for (let s = 0; s + win <= durationSec; s += 0.5) {
    const inWin = pts.filter((p) => p.t >= s && p.t < s + win);
    if (!inWin.length) continue;
    const mean = inWin.reduce((n, p) => n + p.lufs, 0) / inWin.length;
    if (mean > best.mean + 0.05) best = { start: s, mean };
  }
  const peakStart = best.start;
  const peakEnd = Math.min(durationSec, peakStart + win);
  // short-term loudness lags 3 s behind the music; shift its events back by half the window
  const lag = 1.5;
  const reach = pts.find((p) => p.lufs >= median);
  const introEnd = clamp((reach?.t ?? 0) - lag, 2, Math.max(2, peakStart - 2));
  const fall = pts.find((p) => p.t > peakEnd && p.lufs < median - 3);
  const outroStart = clamp((fall?.t ?? durationSec - 8) - lag, peakEnd, durationSec - 2);
  const r = (n: number): number => Math.round(n * 10) / 10;
  const out: MusicSection[] = [{ name: "intro", start: 0, end: r(introEnd), source: "auto" }];
  if (peakStart - introEnd >= 2)
    out.push({ name: "build", start: r(introEnd), end: r(peakStart), source: "auto" });
  out.push({ name: "peak", start: r(peakStart), end: r(peakEnd), source: "auto" });
  if (durationSec - outroStart >= 2)
    out.push({ name: "outro", start: r(outroStart), end: r(durationSec), source: "auto" });
  return out;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
