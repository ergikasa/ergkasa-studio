import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { audioArgs, loadEngine, type RenderOptions } from "./render.js";

/** Frame ranges for `n` workers: equal shares, cut where scenes change when a boundary is near. */
export function splitRanges(total: number, n: number, cuts: number[] = []): Array<[number, number]> {
  const parts = Math.max(1, Math.min(n, Math.floor(total / 30)));
  const bounds = [0];
  for (let k = 1; k < parts; k++) {
    const ideal = Math.round((total * k) / parts);
    const near = cuts.filter((c) => c > (bounds.at(-1) ?? 0) + 15 && c < total - 15);
    const best = near.sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal))[0];
    bounds.push(best !== undefined && Math.abs(best - ideal) < total / parts / 3 ? best : ideal);
  }
  bounds.push(total);
  return bounds.slice(0, -1).map((b, i) => [b, bounds[i + 1] as number]);
}

function nodeArgs(): string[] {
  if (process.execArgv.some((a) => /tsx/.test(a))) return process.execArgv;
  return ["--import", pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href];
}

/**
 * Renders a timeline with several processes at once (one frame range each), joins the parts without
 * re-encoding and mixes the soundtrack in. Same picture as renderVideo, in roughly `workers` times less time.
 */
export async function renderParallel(
  opts: RenderOptions & { workers?: number },
): Promise<{ frames: number; seconds: number; parts: number }> {
  const engine = loadEngine(opts.timeline, opts.assetsDir);
  const total = engine.totalFrames;
  const cuts = (opts.timeline as { scenes: Array<{ from: number }> }).scenes.map((s) => s.from);
  const ranges = splitRanges(total, opts.workers ?? 2, cuts);
  const work = mkdtempSync(join(tmpdir(), "erkasa-par-"));
  const started = Date.now();
  try {
    const timelineFile = join(work, "timeline.json");
    writeFileSync(timelineFile, JSON.stringify(opts.timeline));
    const script = fileURLToPath(new URL("./render-part.ts", import.meta.url));
    const done = new Array<number>(ranges.length).fill(0);
    void done;
    await Promise.all(
      ranges.map(
        (range, i) =>
          new Promise<void>((resolve, reject) => {
            const child = spawn(
              process.execPath,
              [
                ...nodeArgs(),
                script,
                JSON.stringify({
                  timelineFile,
                  assetsDir: opts.assetsDir,
                  out: join(work, `part-${i}.mp4`),
                  range,
                }),
              ],
              { stdio: ["ignore", "inherit", "inherit"] },
            );
            child.on("error", reject);
            child.on("close", (code) =>
              code === 0 ? resolve() : reject(new Error(`render part ${i} failed (code ${code})`)),
            );
          }),
      ),
    );
    const list = join(work, "parts.txt");
    writeFileSync(list, ranges.map((_, i) => `file '${join(work, `part-${i}.mp4`)}'`).join("\n"));
    const joined = join(work, "joined.mp4");
    const ffmpeg = opts.ffmpeg ?? process.env["ERKASA_FFMPEG"] ?? "ffmpeg";
    execFileSync(ffmpeg, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-c",
      "copy",
      joined,
    ]);
    mkdirSync(dirname(opts.out), { recursive: true });
    const duration = total / engine.fps;
    const audio = audioArgs(opts, duration);
    execFileSync(ffmpeg, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      joined,
      ...audio.inputs,
      ...(audio.filter ? ["-filter_complex", audio.filter] : []),
      ...(audio.map.length ? audio.map : ["-map", "0:v"]),
      "-c:v",
      "copy",
      "-movflags",
      "+faststart",
      "-t",
      duration.toFixed(3),
      opts.out,
    ]);
    opts.onProgress?.(total, total);
    return { frames: total, seconds: (Date.now() - started) / 1000, parts: ranges.length };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
