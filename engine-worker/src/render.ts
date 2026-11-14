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

export interface VoiceClip {
  file: string;
  /** Where the clip starts on the video timeline, in seconds. */
  startSec: number;
}

export interface AudioArgs {
  inputs: string[];
  filter?: string;
  map: string[];
}

const PAD_FREQS = [220, 261.63, 329.63];

/**
 * FFmpeg inputs and filter graph for the soundtrack. Input 0 is always the video pipe, so audio
 * inputs start at 1. Voice clips are delayed to their scene start and summed; the placeholder pad
 * is ducked under the voice (sidechain); the result is normalized to -14 LUFS / -1 dBTP.
 */
export function audioArgs(
  opts: Pick<RenderOptions, "audio" | "musicPlaceholder" | "voice">,
  duration: number,
): AudioArgs {
  const aac = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"];
  if (opts.audio) return { inputs: ["-i", opts.audio], map: ["-map", "0:v", "-map", "1:a", ...aac] };

  const voice = opts.voice ?? [];
  if (!voice.length && !opts.musicPlaceholder) return { inputs: [], map: [] };

  const inputs: string[] = [];
  const graph: string[] = [];
  let next = 1;
  let voiceLabel: string | undefined;
  if (voice.length) {
    const labels = voice.map((clip, i) => {
      inputs.push("-i", clip.file);
      const ms = Math.max(0, Math.round(clip.startSec * 1000));
      graph.push(
        `[${next++}:a]aresample=48000,aformat=channel_layouts=mono,adelay=delays=${ms}:all=1[v${i}]`,
      );
      return `[v${i}]`;
    });
    graph.push(`${labels.join("")}amix=inputs=${labels.length}:normalize=0:dropout_transition=0[voice]`);
    voiceLabel = "[voice]";
  }
  let mixLabel = voiceLabel;
  if (opts.musicPlaceholder) {
    // Placeholder bed: a soft A-minor pad. Clearly not production music.
    const pads = PAD_FREQS.map((f) => {
      inputs.push("-f", "lavfi", "-i", `sine=frequency=${f}:sample_rate=48000:duration=${duration}`);
      return `[${next++}:a]`;
    });
    graph.push(
      `${pads.join("")}amix=inputs=3,volume=0.10,tremolo=f=0.4:d=0.35,aecho=0.6:0.5:120:0.3,afade=t=in:d=1,afade=t=out:st=${Math.max(0, duration - 1.5).toFixed(3)}:d=1.5[bed]`,
    );
    if (voiceLabel) {
      graph.push(`${voiceLabel}asplit=2[vo][sc]`);
      graph.push(`[bed][sc]sidechaincompress=threshold=0.02:ratio=8:attack=150:release=400[ducked]`);
      graph.push(`[vo][ducked]amix=inputs=2:normalize=0[mix]`);
      mixLabel = "[mix]";
    } else mixLabel = "[bed]";
  }
  graph.push(`${mixLabel}loudnorm=I=-14:TP=-1:LRA=11,aresample=48000,apad[a]`);
  return { inputs, filter: graph.join(";"), map: ["-map", "0:v", "-map", "[a]", ...aac] };
}

export interface RenderOptions {
  /** A parsed Render Timeline (see loadInput). */
  timeline: unknown;
  /** The studio library, or several roots (a world's assets first, then the library). */
  assetsDir: string | string[];
  out: string;
  /** A finished soundtrack (e.g. the designed mix.wav), used as is. */
  audio?: string;
  /** Generate a quiet placeholder music bed (until real music arrives). Ducked under the voice. */
  musicPlaceholder?: boolean;
  /** Narration clips placed on the video timeline (one per scene). Mixed and loudness-normalized. */
  voice?: VoiceClip[];

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
  assetsDir: string | string[],
  opts: { captions?: boolean } = {},
): { timeline?: unknown; issues: Issue[]; compiled: boolean } {
  const json = JSON.parse(readFileSync(path, "utf8")) as { schema?: string };
  if (json.schema !== "erkasa.video-plan/1") return { timeline: json, issues: [], compiled: false };
  const res = compileVideo(json, {
    assets: new FsAssetSource(assetsDir),
    seed: 20261108,
    ...(opts.captions === false ? { captions: false } : {}),
  });
  return { ...(res.timeline ? { timeline: res.timeline } : {}), issues: res.issues, compiled: true };
}

export function loadEngine(timeline: unknown, assetsDir: string | string[]): Engine {
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
  const audio = audioArgs(opts, duration);
  args.push(...audio.inputs);
  if (audio.filter) args.push("-filter_complex", audio.filter);
  args.push(
    ...audio.map,
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

export interface SvgCoverage {
  width: number;
  height: number;
  /** Share of pixels that are drawn (alpha > 0), 0..1. */
  coverage: number;
  /** Bounding box of drawn pixels as fractions of the image (0..1). */
  bbox: { x0: number; y0: number; x1: number; y1: number } | null;
}

/** How much of its canvas a drawing fills and where (transparent background), to catch empty or clipped assets. */
export function svgCoverage(svg: string, height = 128): SvgCoverage {
  const r = new Resvg(svg, { fitTo: { mode: "height", value: height } }).render();
  const px = r.pixels;
  const { width, height: h } = r;
  let n = 0;
  let x0 = width;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < width; x++)
      if ((px[(y * width + x) * 4 + 3] ?? 0) > 8) {
        n++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return {
    width,
    height: h,
    coverage: n / (width * h),
    bbox: n ? { x0: x0 / width, y0: y0 / h, x1: (x1 + 1) / width, y1: (y1 + 1) / h } : null,
  };
}

/** One SVG document to PNG (for previews and asset checks); throws if resvg cannot render it. */
export function svgToPng(svg: string, height: number, background = "#EDE5DA"): Buffer {
  return Buffer.from(
    new Resvg(svg, { fitTo: { mode: "height", value: height }, background }).render().asPng(),
  );
}
