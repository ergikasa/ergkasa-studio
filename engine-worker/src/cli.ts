#!/usr/bin/env -S npx tsx
/**
 * erkasa-render <timeline.json> -o out.mp4 [--audio file] [--music-placeholder] [--frames 0:90] [--still N]
 *
 * Examples (from the repo root):
 *   pnpm --filter @erkasa/engine-worker demo
 *   pnpm --filter @erkasa/engine-worker render demo/phase-b-demo.timeline.json --still 120 -o out/frame-120.png
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEngine, renderStill, renderVideo } from "./render.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const timelinePath = process.argv[2];
  if (!timelinePath || timelinePath.startsWith("-")) {
    console.error(
      "usage: erkasa-render <timeline.json> -o <out.mp4|out.png> [--still N] [--frames a:b] [--audio file] [--music-placeholder]",
    );
    process.exit(2);
  }
  const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const assetsDir = process.env["ERKASA_ASSETS_DIR"] ?? resolve(repoRoot, "assets");
  const out = resolve(arg("-o") ?? "out/render.mp4");
  const still = arg("--still");

  if (still !== undefined) {
    const engine = loadEngine(resolve(timelinePath), assetsDir);
    renderStill(engine, Number(still), out);
    console.info(`frame ${still} -> ${out}`);
    return;
  }

  const frames = arg("--frames")?.split(":").map(Number);
  const audio = arg("--audio");
  let lastPct = -1;
  const res = await renderVideo({
    timelinePath: resolve(timelinePath),
    assetsDir,
    out,
    ...(audio ? { audio: resolve(audio) } : {}),
    musicPlaceholder: process.argv.includes("--music-placeholder"),
    ...(frames && frames.length === 2 ? { range: [frames[0] ?? 0, frames[1] ?? 0] as [number, number] } : {}),
    onProgress: (done, total) => {
      const pct = Math.floor((done / total) * 10) * 10;
      if (pct !== lastPct) {
        lastPct = pct;
        console.info(`rendering ${pct}% (${done}/${total} frames)`);
      }
    },
  });
  console.info(`done: ${res.frames} frames in ${res.seconds.toFixed(1)} s -> ${out}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
