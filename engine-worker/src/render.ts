import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { compileVideo, type Issue } from "@erkasa/compiler";
import { Engine } from "@erkasa/engine";
import { FsAssetSource } from "./fs-assets.js";

const require = createRequire(import.meta.url);

/** Bundled fonts (Montserrat, SIL OFL): frames never depend on the machine's installed fonts. */
export function fontFiles(): string[] {
  const dir = dirname(require.resolve("@expo-google-fonts/montserrat/package.json"));
  return [
    "700Bold/Montserrat_700Bold.ttf",
    "800ExtraBold/Montserrat_800ExtraBold.ttf",
    "900Black/Montserrat_900Black.ttf",
  ].map((f) => join(dir, f));
}

export interface RenderOptions {
  /** A parsed Render Timeline (see loadInput). */
  timeline: unknown;
  assetsDir: string;
  out: string;
  /** Optional audio file mixed under the video. */
  audio?: string;
  /** Generate a quiet placeholder music bed (until real music/voice arrive in Phase E). */
  musicPlaceholder?: boolean;
  /** Render only [from, to) global frames. */
  range?: [number, number];
  ffmpeg?: string;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Reads a Render Timeline, or a Video Plan which is compiled into one first.
 * Compile errors are returned (not thrown) so the caller can show all of them at once.
 */
export function loadInput(
  path: string,
  assetsDir: string,
): { timeline?: unknown; issues: Issue[]; compiled: boolean } {
  const json = JSON.parse(readFileSync(path, "utf8")) as { schema?: string };
  if (json.schema !== "erkasa.video-plan/1") return { timeline: json, issues: [], compiled: false };
  const res = compileVideo(json, { assets: new FsAssetSource(assetsDir), seed: 20261108 });
  return { ...(res.timeline ? { timeline: res.timeline } : {}), issues: res.issues, compiled: true };
}

export function loadEngine(timeline: unknown, assetsDir: string): Engine {
  return new Engine(timeline, { assets: new FsAssetSource(assetsDir) });
}

function rasterize(svg: string, fonts: string[]): { pixels: Buffer; width: number; height: number } {
  const img = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: "Montserrat" },
    shapeRendering: 2,
    textRendering: 1,
  }).render();
  return { pixels: img.pixels, width: img.width, height: img.height };
}

/** Writes one frame as PNG (for quick visual checks). */
export function renderStill(engine: Engine, frame: number, out: string): void {
  mkdirSync(dirname(out), { recursive: true });
  const img = new Resvg(engine.renderFrame(frame), {
    fitTo: { mode: "original" },
    font: { fontFiles: fontFiles(), loadSystemFonts: false, defaultFontFamily: "Montserrat" },
  }).render();
  writeFileSync(out, img.asPng());
}

/** Renders the timeline to an H.264 MP4 by piping raw RGBA frames into FFmpeg. */
export async function renderVideo(opts: RenderOptions): Promise<{ frames: number; seconds: number }> {
  const engine = loadEngine(opts.timeline, opts.assetsDir);
  const [from, to] = opts.range ?? [0, engine.totalFrames];
  const frames = to - from;
  const duration = frames / engine.fps;
  const fonts = fontFiles();
  mkdirSync(dirname(opts.out), { recursive: true });

  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgba",
    "-s",
    `${engine.width}x${engine.height}`,
    "-r",
    String(engine.fps),
    "-i",
    "-",
  ];
  let audioMap: string[] = [];
  if (opts.audio) {
    args.push("-i", opts.audio);
    audioMap = ["-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k"];
  } else if (opts.musicPlaceholder) {
    // Placeholder bed: a soft A-minor pad. Clearly not production music.
    for (const f of [220, 261.63, 329.63])
      args.push("-f", "lavfi", "-i", `sine=frequency=${f}:sample_rate=48000:duration=${duration}`);
    args.push(
      "-filter_complex",
      `[1][2][3]amix=inputs=3,volume=0.10,tremolo=f=0.4:d=0.35,aecho=0.6:0.5:120:0.3,afade=t=in:d=1,afade=t=out:st=${Math.max(0, duration - 1.5)}:d=1.5[a]`,
    );
    audioMap = ["-map", "0:v", "-map", "[a]", "-c:a", "aac", "-b:a", "160k"];
  }
  args.push(
    ...audioMap,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-t",
    duration.toFixed(3),
    opts.out,
  );

  const ff = spawn(opts.ffmpeg ?? process.env["ERKASA_FFMPEG"] ?? "ffmpeg", args, {
    stdio: ["pipe", "inherit", "inherit"],
  });
  const exited = new Promise<number>((resolve, reject) => {
    ff.on("error", (e) =>
      reject(new Error(`cannot start ffmpeg (${e.message}). Install FFmpeg or set ERKASA_FFMPEG.`)),
    );
    ff.on("close", (code) => resolve(code ?? 1));
  });

  const started = Date.now();
  for (let f = from; f < to; f++) {
    const { pixels } = rasterize(engine.renderFrame(f), fonts);
    if (!ff.stdin.write(pixels)) await new Promise<void>((r) => ff.stdin.once("drain", () => r()));
    opts.onProgress?.(f - from + 1, frames);
  }
  ff.stdin.end();
  const code = await exited;
  if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
  return { frames, seconds: (Date.now() - started) / 1000 };
}
