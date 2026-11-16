/**
 * pnpm w0 check                       shot times, errors
 * pnpm w0 stills <dir> [t=0.6]        one still per shot at a fraction of its length
 * pnpm w0 render <out.mp4> [--workers 2]
 * (internal) pnpm w0 frames <from> <to> <file.raw>
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GlobalFonts, loadImage } from "@napi-rs/canvas";
import { Script } from "@erkasa/contracts";
import { FPS, H, W, fontFiles, DEFS } from "../style.js";
import { parsePlan, prepare, renderFrame, typeSvg, TYPE_DEFS, type Prepared } from "./composer.js";
import { writeSoundtrack } from "./sound.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
for (const f of fontFiles()) GlobalFonts.registerFromPath(f, "Montserrat");

function load(): Prepared {
  const script = Script.parse(JSON.parse(readFileSync(join(ROOT, "benchmark/scripts/b1-why-we-stay.script.json"), "utf8")));
  const plan = parsePlan(JSON.parse(readFileSync(join(ROOT, "film/w0/plan.json"), "utf8")));
  return prepare(plan, script);
}

/** Total frames and, for every frame, the shot and the local time. */
function frameIndex(P: Prepared): Array<{ i: number; t: number }> {
  const n = Math.round(P.duration * FPS);
  const out: Array<{ i: number; t: number }> = [];
  for (let k = 0; k < n; k++) {
    const T = k / FPS;
    let i = P.shots.findIndex((s) => T >= s.start && T < s.end);
    if (i < 0) i = P.shots.length - 1;
    out.push({ i, t: T - (P.shots[i] as { start: number }).start });
  }
  return out;
}

async function frame(P: Prepared, i: number, t: number): Promise<Buffer> {
  const c = await renderFrame(P, i, t);
  const ctx = c.getContext("2d");
  const ty = typeSvg(P, P.shots[i] as Prepared["shots"][number], t);
  if (ty) {
    const img = await loadImage(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${DEFS}${TYPE_DEFS}</defs>${ty}</svg>`));
    ctx.drawImage(img, 0, 0);
  }
  return Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer);
}

const [cmd, ...args] = process.argv.slice(2);
const P = load();

if (cmd === "check") {
  for (const s of P.shots)
    console.info(`${s.w.shot.id.padEnd(5)} ${s.start.toFixed(2).padStart(6)}-${s.end.toFixed(2).padStart(6)} ${s.dur.toFixed(1).padStart(5)} s  ${s.w.shot.moment}`);
  console.info(`${P.shots.length} shots, ${P.duration.toFixed(1)} s`);
  for (const i of P.issues) console.info(`${i.level} ${i.code} ${i.path}: ${i.message}`);
} else if (cmd === "stills") {
  const dir = resolve(args[0] ?? "stills");
  const at = Number(args[1] ?? 0.6);
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < P.shots.length; i++) {
    const s = P.shots[i] as Prepared["shots"][number];
    const c = await renderFrame(P, i, s.dur * at);
    const ty = typeSvg(P, s, s.dur * at);
    if (ty) c.getContext("2d").drawImage(await loadImage(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${DEFS}${TYPE_DEFS}</defs>${ty}</svg>`)), 0, 0);
    writeFileSync(join(dir, `${String(i + 1).padStart(2, "0")}-${s.w.shot.id}.png`), await c.encode("png"));
  }
  console.info(`${P.shots.length} stills in ${dir}`);
} else if (cmd === "frames") {
  // render a range of frames straight into a lossless-quality segment (no raw files on disk)
  const [from, to, file] = [Number(args[0]), Number(args[1]), args[2] as string];
  const idx = frameIndex(P);
  const ff = spawn(process.env["ERKASA_FFMPEG"] ?? "ffmpeg", ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "fast", "-crf", "12", "-pix_fmt", "yuv420p", file], { stdio: ["pipe", "inherit", "inherit"] });
  for (let k = from; k < to; k++) {
    const f = idx[k] as { i: number; t: number };
    const buf = await frame(P, f.i, f.t);
    if ((k - from) % 3 === 2) (globalThis as { gc?: () => void }).gc?.();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
} else if (cmd === "render") {
  const out = resolve(args[0] ?? "w0.mp4");
  const workers = args.includes("--workers") ? Number(args[args.indexOf("--workers") + 1]) : 2;
  const work = join(dirname(out), "w0-work");
  mkdirSync(work, { recursive: true });
  const idx = frameIndex(P);
  const n = idx.length;
  const t0 = Date.now();
  const TSX = createRequire(import.meta.url).resolve("tsx/esm");
  const me = fileURLToPath(import.meta.url);
  const chunks: string[] = [];
  const SEG = 24;
  const jobs: Array<[number, number, string]> = [];
  for (let a = 0, k = 0; a < n; a += SEG, k++) jobs.push([a, Math.min(n, a + SEG), join(work, `seg${String(k).padStart(3, "0")}.mp4`)]);
  chunks.push(...jobs.map((j) => j[2]));
  let next = 0;
  let done = 0;
  const runOne = (j: [number, number, string]): Promise<void> =>
    new Promise<void>((ok, bad) => {
      const p = spawn(process.execPath, ["--expose-gc", "--max-old-space-size=1500", "--import", pathToFileURL(TSX).href, me, "frames", String(j[0]), String(j[1]), j[2]], { stdio: ["ignore", "inherit", "inherit"] });
      p.on("close", (code, sig) => (code === 0 ? ok() : bad(new Error(`segment ${j[2]} failed: ${code} ${sig}`))));
    });
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (next < jobs.length) {
        const j = jobs[next++] as [number, number, string];
        if (!(args.includes("--reuse") && existsSync(j[2]))) await runOne(j);
        done++;
        console.info(`${done}/${jobs.length} segments (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      }
    }),
  );
  console.info(`frames: ${n} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const wav = join(work, "sound.wav");
  writeSoundtrack(wav, P);
  const list = join(work, "parts.txt");
  writeFileSync(list, chunks.map((c) => `file '${c}'`).join("\n"));
  await new Promise<void>((ok, bad) => {
    const p = spawn(process.env["ERKASA_FFMPEG"] ?? "ffmpeg",
      ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-i", wav, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-af", "loudnorm=I=-16:TP=-1.5", "-movflags", "+faststart", "-shortest", out],
      { stdio: ["ignore", "inherit", "inherit"] });
    p.on("close", (code) => (code === 0 ? ok() : bad(new Error("ffmpeg failed"))));
  });
  console.info(`done: ${out} (${P.duration.toFixed(1)} s) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
} else {
  console.error("usage: w0 check | stills <dir> [frac] | render <out.mp4> [--workers n]");
  process.exit(2);
}
