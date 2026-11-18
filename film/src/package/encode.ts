/**
 * From a Render Package to an MP4 (E1.5). The Validation Gate runs first: a refused package yields its findings
 * and nothing else (no process, no file, no encoder). An accepted one is encoded as the capabilities publish it
 * (encoding.ts): every cut on its own, in this process or in `workers` child processes, each of which opens and
 * verifies the very same package again; the cuts are joined without re-encoding; the package's audio is mixed
 * over them (mixdown.ts) from the bytes the gate verified. The MP4 is written under a temporary name and
 * renamed only when everything succeeded; on failure or cancellation nothing is left at `out`.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { wavInfo } from "@erkasa/contracts";
import { segmentArgs } from "./encoding.js";
import { mixdownArgs } from "./mixdown.js";
import { openPackage, type GateOptions, type PackageInput, type PackageRenderer } from "./render.js";
import type { Finding } from "@erkasa/gate";

export interface EncodeOptions {
  /** The MP4 to write. */
  out: string;
  /** A folder of the encoder's own (emptied first): the cuts, the joined video, the audio files. */
  workDir: string;
  /** Cuts encoded at once, in child processes when more than 1 (default 1, in this process). */
  workers?: number;
  signal?: AbortSignal;
  ffmpeg?: string;
  progress?: (done: number, total: number) => void;
}

export interface EncodeOutcome {
  ok: boolean;
  errors: Finding[];
  warnings: Finding[];
  /** Frames encoded (0 for a refused package). */
  frames: number;
  file?: string;
}

/** The frames of each cut: [from, to). */
export function cutSegments(r: PackageRenderer): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  for (let k = 0; k < r.frames; k++) {
    const i = r.cutIndex(k);
    const last = out[out.length - 1];
    if (last && r.cutIndex(last.from) === i) last.to = k + 1;
    else out.push({ from: k, to: k + 1 });
  }
  return out;
}

const ffmpegOf = (o: { ffmpeg?: string }): string => o.ffmpeg ?? process.env["ERKASA_FFMPEG"] ?? "ffmpeg";

/**
 * The processes the encoder started. Each runs in its own process group, so stopping one stops what it started
 * too (a child's FFmpeg); `killAll` resolves once every one has exited.
 */
const WINDOWS = process.platform === "win32";

export class Procs {
  private readonly live = new Map<ChildProcess, Promise<void>>();
  private stopped = false;
  /** `group`: each process leads a group of its own (the encoder's); false in a child, whose group it shares. */
  constructor(
    private readonly signal?: AbortSignal,
    private readonly group = true,
  ) {}
  run(cmd: string, args: string[], feed?: (stdin: NodeJS.WritableStream) => Promise<void>): Promise<void> {
    this.signal?.throwIfAborted();
    if (this.stopped) return Promise.reject(new Error("the encoder is stopping"));
    return new Promise((resolve, reject) => {
      const p = spawn(cmd, args, {
        stdio: [feed ? "pipe" : "ignore", "ignore", "pipe"],
        // Windows has no process groups (a detached process gets its own console): its tree is killed with taskkill
        detached: this.group && !WINDOWS,
        windowsHide: true,
      });
      this.live.set(p, new Promise<void>((r) => p.once("close", () => r())));
      let err = "";
      p.stderr?.on("data", (d: Buffer) => (err = (err + d.toString()).slice(-3000)));
      p.on("error", reject);
      p.on("close", (code, sig) => {
        this.live.delete(p);
        if (this.signal?.aborted) reject(this.signal.reason ?? new Error("aborted"));
        else if (code === 0) resolve();
        else reject(new Error(`${cmd} ${sig ? `killed by ${sig}` : `exited ${code}`}: ${err.trim()}`));
      });
      if (feed && p.stdin) {
        p.stdin.on("error", () => undefined); // a dying encoder's EPIPE surfaces through 'close'
        feed(p.stdin).then(
          () => p.stdin?.end(),
          (e: unknown) => {
            this.kill(p);
            reject(e instanceof Error ? e : new Error(String(e)));
          },
        );
      }
    });
  }
  private kill(p: ChildProcess): void {
    if (WINDOWS && p.pid) {
      // the process and everything it started (a child's FFmpeg)
      spawnSync("taskkill", ["/pid", String(p.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      return;
    }
    try {
      if (this.group && p.pid) process.kill(-p.pid, "SIGKILL");
      else p.kill("SIGKILL");
    } catch {
      p.kill("SIGKILL");
    }
  }
  killAll(): Promise<void> {
    this.stopped = true;
    const waiting = [...this.live.values()];
    for (const p of this.live.keys()) this.kill(p);
    return Promise.all(waiting).then(() => undefined);
  }
}

/** Encodes frames [from, to) of an opened package into `out` (one cut). */
export async function encodeSegment(
  r: PackageRenderer,
  from: number,
  to: number,
  out: string,
  opts: { ffmpeg?: string; signal?: AbortSignal; onFrame?: () => void; procs?: Procs } = {},
): Promise<void> {
  // in a child process the encoder shares the child's group: stopping the child stops it
  const procs = opts.procs ?? new Procs(opts.signal, false);
  const abort = (): void => void procs.killAll();
  opts.signal?.addEventListener("abort", abort, { once: true });
  const tmp = out.replace(/\.mp4$/, ".part.mp4");
  try {
    await procs.run(ffmpegOf(opts), segmentArgs(r.width, r.height, r.fps, tmp), async (stdin) => {
      for (let k = from; k < to; k++) {
        opts.signal?.throwIfAborted();
        const ok = stdin.write(await r.pixels(k));
        opts.onFrame?.();
        if (!ok) await new Promise<void>((res) => stdin.once("drain", () => res()));
      }
    });
    renameSync(tmp, out);
  } catch (e) {
    await procs.killAll();
    throw e;
  } finally {
    opts.signal?.removeEventListener("abort", abort);
    rmSync(tmp, { force: true });
  }
}

const CHILD = fileURLToPath(new URL("./encode-child.ts", import.meta.url));
/** The child runs TypeScript whatever started the parent (tsx, vitest, node --import): load tsx explicitly. */
const TSX = createRequire(import.meta.url).resolve("tsx/esm");

/** Validates, then encodes the package into an MP4. A refused package never starts a process. */
export async function encodePackage(
  input: PackageInput,
  opts: EncodeOptions,
  gate: GateOptions = {},
): Promise<EncodeOutcome> {
  const o = openPackage(input, gate);
  if (!o.ok) return { ok: false, errors: o.errors, warnings: o.warnings, frames: 0 };
  opts.signal?.throwIfAborted();
  const r = o.renderer;
  const segs = cutSegments(r);
  const work = opts.workDir;
  rmSync(work, { recursive: true, force: true });
  mkdirSync(join(work, "cuts"), { recursive: true });
  const files = segs.map((_, i) => join(work, "cuts", `cut-${String(i + 1).padStart(3, "0")}.mp4`));
  const tmpOut = opts.out.replace(/\.mp4$/, ".part.mp4");
  const procs = new Procs(opts.signal);
  const abort = (): void => void procs.killAll();
  opts.signal?.addEventListener("abort", abort, { once: true });
  let done = 0;
  try {
    const workers = Math.max(1, Math.min(opts.workers ?? 1, segs.length));
    let pkgFile = "";
    if (workers > 1) {
      pkgFile = join(work, "package.json");
      writeFileSync(pkgFile, input.package);
    }
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < segs.length) {
        const i = next++;
        const s = segs[i] as { from: number; to: number };
        if (workers > 1) {
          await procs.run(process.execPath, [
            ...["--import", pathToFileURL(TSX).href, CHILD],
            ...[pkgFile, input.root, String(s.from), String(s.to), files[i] as string, ffmpegOf(opts)],
          ]);
          done += s.to - s.from;
          opts.progress?.(done, r.frames);
        } else
          await encodeSegment(r, s.from, s.to, files[i] as string, {
            procs,
            ffmpeg: ffmpegOf(opts),
            ...(opts.signal ? { signal: opts.signal } : {}),
            onFrame: () => {
              done++;
              if (done % 15 === 0) opts.progress?.(done, r.frames);
            },
          });
      }
    };
    await Promise.all(Array.from({ length: workers }, worker));
    const list = join(work, "cuts", "list.txt");
    writeFileSync(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
    const joined = join(work, "cuts", "joined.mp4");
    await procs.run(ffmpegOf(opts), [
      "-y",
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
    // the audio: the verified bytes of every clip's asset, written for FFmpeg to read
    mkdirSync(join(work, "audio"), { recursive: true });
    const written = new Map<string, string>();
    const fileOf = (c: { asset: string }): string => {
      let f = written.get(c.asset);
      if (!f) {
        f = join(work, "audio", `${written.size + 1}.wav`);
        writeFileSync(f, r.assetBytes(c.asset));
        written.set(c.asset, f);
      }
      return f;
    };
    const fileSecOf = (c: { asset: string }): number => {
      const w = wavInfo(r.assetBytes(c.asset));
      if ("error" in w) throw new Error(`${c.asset}: ${w.error} (the gate verified it)`);
      return w.durationSec;
    };
    const mux = mixdownArgs(r.pkg, joined, fileOf, tmpOut, fileSecOf);
    if (mux) await procs.run(ffmpegOf(opts), mux);
    else renameSync(joined, tmpOut);
    opts.signal?.throwIfAborted();
    renameSync(tmpOut, opts.out);
    opts.progress?.(r.frames, r.frames);
    return { ok: true, errors: [], warnings: o.warnings, frames: r.frames, file: opts.out };
  } catch (e) {
    // every process this encoder started has exited before the failure is reported
    await procs.killAll();
    rmSync(tmpOut, { force: true });
    throw e;
  } finally {
    opts.signal?.removeEventListener("abort", abort);
  }
}
