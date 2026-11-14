/**
 * Rendering: each shot becomes its own MP4 (same size, rate and encoder settings), written under a temporary
 * name and renamed only when FFmpeg succeeds; the shots are joined without re-encoding and the soundtrack is
 * added on top (music bed and effects, plus the narration ducked over it). Shots render in parallel processes.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { safeOpacity } from "@erkasa/engine";
import { Resvg } from "@resvg/resvg-js";
import type { Composed } from "./compose.js";
import { frameAt, shotFrames } from "./compose.js";
import { FPS, H, W, fontFiles } from "./style.js";

const ffmpeg = (): string => process.env["ERKASA_FFMPEG"] ?? "ffmpeg";
let fonts: string[] | undefined;

export function rasterize(svg: string): Buffer {
  fonts ??= fontFiles();
  // resvg 2.6 aborts on an element with opacity that lies entirely outside the frame; the engine's guard fixes it
  const img = new Resvg(safeOpacity(svg), {
    fitTo: { mode: "original" },
    font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: "Montserrat" },
  }).render();
  return img.pixels;
}
export function png(svg: string): Buffer {
  fonts ??= fontFiles();
  return new Resvg(safeOpacity(svg), {
    fitTo: { mode: "original" },
    font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: "Montserrat" },
  })
    .render()
    .asPng();
}

function run(args: string[], input?: (stdin: NodeJS.WritableStream) => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg(), args, { stdio: [input ? "pipe" : "ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr?.on("data", (d: Buffer) => (err = (err + d.toString()).slice(-2000)));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.trim()}`)),
    );
    if (input && p.stdin) input(p.stdin).then(() => p.stdin?.end(), reject);
  });
}

/** Renders shot `i` to `out` (one file). */
export async function renderShot(c: Composed, i: number, out: string, onFrame?: () => void): Promise<void> {
  const s = c.shots[i];
  if (!s) throw new Error(`no shot ${i}`);
  const n = shotFrames(s);
  const tmp = out.replace(/\.mp4$/, ".part.mp4");
  await run(
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-s",
      `${W}x${H}`,
      "-r",
      `${FPS}`,
      "-i",
      "-",
      "-vf",
      "noise=alls=4:allf=t,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-r",
      `${FPS}`,
      "-f",
      "mp4",
      tmp,
    ],
    async (stdin) => {
      for (let f = 0; f < n; f++) {
        const ok = stdin.write(rasterize(frameAt(c, i, f)));
        onFrame?.();
        if (!ok) await new Promise<void>((r) => stdin.once("drain", () => r()));
      }
    },
  );
  renameSync(tmp, out);
}

export interface RenderOptions {
  dir: string;
  /** Narration clips placed on the film timeline. */
  voice?: Array<{ file: string; startSec: number }>;
  /** Music bed + effects WAV. */
  bed?: string;
  out: string;
  workers?: number;
  progress?: (done: number, total: number) => void;
  /** A function that renders shot i into a file in another process (for parallel rendering). */
  renderInChild?: (i: number, out: string) => Promise<void>;
}

export async function renderFilm(
  c: Composed,
  opts: RenderOptions,
): Promise<{ file: string; frames: number }> {
  const shotsDir = join(opts.dir, "shots");
  rmSync(shotsDir, { recursive: true, force: true });
  mkdirSync(shotsDir, { recursive: true });
  const total = c.shots.reduce((n, s) => n + shotFrames(s), 0);
  let done = 0;
  const files = c.shots.map((_, i) => join(shotsDir, `shot-${String(i + 1).padStart(3, "0")}.mp4`));
  const workers = Math.max(1, Math.min(opts.workers ?? 1, c.shots.length));
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < c.shots.length) {
      const i = next++;
      if (opts.renderInChild && workers > 1) {
        await opts.renderInChild(i, files[i] as string);
        done += shotFrames(c.shots[i] as Parameters<typeof shotFrames>[0]);
        opts.progress?.(done, total);
      } else
        await renderShot(c, i, files[i] as string, () => {
          done++;
          if (done % 15 === 0) opts.progress?.(done, total);
        });
    }
  };
  await Promise.all(Array.from({ length: workers }, worker));
  const list = join(shotsDir, "list.txt");
  writeFileSync(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  const silent = join(shotsDir, "joined.mp4");
  await run(["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", silent]);
  const tmp = opts.out.replace(/\.mp4$/, ".part.mp4");
  const voice = opts.voice ?? [];
  if (!opts.bed && !voice.length) renameSync(silent, tmp);
  else {
    const inputs = ["-i", silent];
    const graph: string[] = [];
    let idx = 1;
    let bed = "";
    if (opts.bed && existsSync(opts.bed)) {
      inputs.push("-i", opts.bed);
      bed = `[${idx++}:a]`;
    }
    const vl = voice.map((v, k) => {
      inputs.push("-i", v.file);
      graph.push(
        `[${idx++}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=delays=${Math.round(v.startSec * 1000)}:all=1[v${k}]`,
      );
      return `[v${k}]`;
    });
    let mix: string;
    if (vl.length) {
      graph.push(`${vl.join("")}amix=inputs=${vl.length}:normalize=0:dropout_transition=0[voice]`);
      if (bed) {
        graph.push(
          `[voice]asplit=2[vo][sc]`,
          `${bed}volume=0.55[bedq]`,
          `[bedq][sc]sidechaincompress=threshold=0.03:ratio=6:attack=80:release=500[ducked]`,
          `[vo][ducked]amix=inputs=2:normalize=0[mix]`,
        );
        mix = "[mix]";
      } else mix = "[voice]";
    } else mix = bed;
    graph.push(`${mix}loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]`);
    await run([
      "-y",
      "-loglevel",
      "error",
      ...inputs,
      "-filter_complex",
      graph.join(";"),
      "-map",
      "0:v",
      "-map",
      "[a]",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      tmp,
    ]);
  }
  renameSync(tmp, opts.out);
  return { file: opts.out, frames: total };
}

export const defaultWorkers = (): number => Math.max(1, Math.min(4, cpus().length));
export const HERE = fileURLToPath(new URL(".", import.meta.url));
