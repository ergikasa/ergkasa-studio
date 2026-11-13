#!/usr/bin/env -S npx tsx
/**
 * erkasa-render <timeline.json | video-plan.json> -o out.mp4 [--audio file] [--music-placeholder] [--frames 0:90] [--still N]
 *
 * Examples (from the repo root):
 *   pnpm --filter @erkasa/engine-worker demo
 *   pnpm --filter @erkasa/engine-worker render demo/phase-b-demo.timeline.json --still 120 -o out/frame-120.png
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEngine, loadInput, renderStill, renderVideo } from "./render.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const timelinePath = process.argv[2];
  if (!timelinePath || timelinePath.startsWith("-")) {
    console.error(
      "usage: erkasa-render <timeline.json> -o <out.mp4|out.png> [--still N] [--frames a:b] [--audio file] [--music-placeholder] [--world out/worlds/<id>] [--no-captions]",
    );
    process.exit(2);
  }
  const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const library = process.env["ERKASA_ASSETS_DIR"] ?? resolve(repoRoot, "assets");
  // --world <folder>: the assets the World Builder made for this video, searched before the library
  const world = arg("--world");
  const assetsDir = world ? [resolve(world), library] : library;
  const out = resolve(arg("-o") ?? "out/render.mp4");
  const still = arg("--still");

  const input = loadInput(resolve(timelinePath), assetsDir, {
    captions: !process.argv.includes("--no-captions"),
  });
  for (const i of input.issues) {
    const line = `${i.level.toUpperCase()} ${i.code} at ${i.path}: ${i.message}${i.hint ? `\n    hint: ${i.hint}` : ""}`;
    if (i.level === "error") console.error(line);
    else console.warn(line);
  }
  if (!input.timeline) {
    console.error("plan has errors: nothing rendered");
    process.exit(1);
  }
  if (input.compiled) {
    const tlPath = resolve(dirname(out), `${basename(out).replace(/\.[^.]+$/, "")}.timeline.json`);
    mkdirSync(dirname(tlPath), { recursive: true });
    writeFileSync(tlPath, JSON.stringify(input.timeline, null, 1));
    console.info(`compiled plan -> ${tlPath}`);
  }

  if (still !== undefined) {
    const engine = loadEngine(input.timeline, assetsDir);
    renderStill(engine, Number(still), out);
    console.info(`frame ${still} -> ${out}`);
    return;
  }

  const frames = arg("--frames")?.split(":").map(Number);
  const audio = arg("--audio");
  let lastPct = -1;
  const res = await renderVideo({
    timeline: input.timeline,
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
