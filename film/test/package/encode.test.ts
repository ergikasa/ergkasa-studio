/**
 * E1.5: the engine's encoder (package/encode.ts) and mixdown (package/mixdown.ts).
 *   - cuts: the frames of every cut are the frames of the v2 engine's shot (each is encoded on its own);
 *   - a refused package starts no process and writes nothing; its findings are the gate's;
 *   - 1 and 2 workers write the same bytes; the video is silent when the package has no audio clip;
 *   - failure: a failing encoder leaves no MP4; the next attempt writes the same bytes as an untroubled one;
 *   - cancellation: every process stops, no MP4, no partial file;
 *   - the mixdown graph for each kind of mix;
 *   - the encoder's modules: no planner, stager or worker; files only in encode.ts and its child.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { validate } from "@erkasa/gate";
import type { RenderPackage } from "@erkasa/contracts";
import { renderCapabilities } from "../../src/capabilities.js";
import { shotFrames } from "../../src/compose.js";
import { BENCH } from "../../src/golden.js";
import { cutSegments, encodePackage } from "../../src/package/encode.js";
import { mixdownArgs } from "../../src/package/mixdown.js";
import { fixtureB, planPath, renderer, ROOT, staged, type Film } from "./helpers.js";

const sha = (f: string): string => createHash("sha256").update(readFileSync(f)).digest("hex");
const tmp = (p: string): string => mkdtempSync(join(tmpdir(), p));

/** An ffmpeg that logs every call to `log`, and fails its `failOn`-th call (1-based) if given. */
function spyFfmpeg(log: string, failOn = 0): string {
  const f = join(tmp("ffspy-"), "ffmpeg");
  writeFileSync(
    f,
    `#!/bin/sh\necho "$*" >> "${log}"\nn=$(wc -l < "${log}")\nif [ "$n" -eq ${failOn} ]; then echo "spy: failing call $n" >&2; exit 7; fi\nexec ffmpeg "$@"\n`,
  );
  chmodSync(f, 0o755);
  return f;
}
const calls = (log: string): string[] =>
  existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [];

describe("cuts: the v2 engine's shots", () => {
  it.each(BENCH.map((f) => [f]))("%s: each cut has its shot's frames, in order", (f) => {
    const r = renderer(staged(f as Film));
    const shots = planPath(f).composed.shots.map((s) => shotFrames(s));
    expect(cutSegments(r).map((s) => s.to - s.from)).toEqual(shots);
    expect(cutSegments(r).at(-1)?.to).toBe(r.frames);
  });
});

describe("a refused package", () => {
  it("returns the gate's findings, starts no process, writes no file", async () => {
    // office-clock with a type.kinetic y written as a word (F1): refused before anything is drawn
    const pkg = JSON.parse(fixtureB("office-clock").text) as RenderPackage;
    const node = pkg.scenes
      .flatMap((s) => [...s.layers, ...(s.screen ?? [])].flatMap((l) => l.nodes))
      .find((n) => n.kind === "asset" && n.params && "y" in n.params && "lines" in n.params);
    if (node?.kind !== "asset" || !node.params) throw new Error("no kinetic type in office-clock");
    node.params["y"] = "top";
    const text = JSON.stringify(pkg);
    const log = join(tmp("fflog-"), "calls");
    const work = join(tmp("enc-"), "work");
    const out = join(dirname(work), "video.mp4");
    const r = await encodePackage(
      { package: text, root: ROOT },
      { out, workDir: work, workers: 2, ffmpeg: spyFfmpeg(log) },
    );
    const g = validate({ package: text, root: ROOT, capabilities: renderCapabilities() });
    expect(r.ok).toBe(false);
    expect(r.frames).toBe(0);
    expect(r.errors).toEqual(g.errors);
    expect(calls(log)).toEqual([]);
    expect(existsSync(work)).toBe(false);
    expect(existsSync(out)).toBe(false);
  }, 120_000);
});

describe("encoding a silent package (office-clock, 150 frames)", () => {
  const fx = fixtureB("office-clock");
  const input = { package: fx.text, root: fx.root };
  const encode = async (workers: number, ffmpeg?: string, signal?: AbortSignal) => {
    const dir = tmp("enc-");
    const out = join(dir, "video.mp4");
    const r = await encodePackage(input, {
      out,
      workDir: join(dir, "work"),
      workers,
      ...(ffmpeg ? { ffmpeg } : {}),
      ...(signal ? { signal } : {}),
    });
    return { r, out, dir };
  };
  let first = "";

  it("1 and 2 workers write the same bytes; no audio stream; every frame, at 30 fps", async () => {
    const a = await encode(1);
    const b = await encode(2);
    expect(a.r.ok && b.r.ok).toBe(true);
    first = sha(a.out);
    expect(sha(b.out)).toBe(first);
    const p = spawnSync("ffprobe", ["-v", "error", "-count_frames", "-show_streams", "-of", "json", a.out], {
      encoding: "utf8",
    });
    const streams = (JSON.parse(p.stdout) as { streams: Array<Record<string, unknown>> }).streams;
    expect(streams.map((s) => s["codec_type"])).toEqual(["video"]);
    expect(streams[0]).toMatchObject({
      codec_name: "h264",
      width: 1080,
      height: 1920,
      r_frame_rate: "30/1",
      pix_fmt: "yuv420p",
      nb_read_frames: "150",
    });
    expect(readdirSync(a.dir).sort()).toEqual(["video.mp4", "work"]);
  }, 600_000);

  it("a failing encoder leaves no MP4 and no partial file; the retry writes the same bytes", async () => {
    const log = join(tmp("fflog-"), "calls");
    const failing = encode(2, spyFfmpeg(log, 2));
    await expect(failing).rejects.toThrow(/exited 7|exit|spy/);
    const again = await encode(2);
    expect(sha(again.out)).toBe(first);
  }, 600_000);

  it("cancellation stops every process and leaves no MP4 and no partial file", async () => {
    const ac = new AbortController();
    const dir = tmp("enc-");
    const out = join(dir, "video.mp4");
    const work = join(dir, "work");
    let seen = 0;
    const p = encodePackage(input, {
      out,
      workDir: work,
      workers: 1,
      signal: ac.signal,
      progress: (d) => {
        seen = d;
        if (d >= 30) ac.abort(new DOMException("test cancel", "AbortError"));
      },
    });
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(seen).toBeGreaterThanOrEqual(30);
    expect(existsSync(out)).toBe(false);
    expect(existsSync(out.replace(/\.mp4$/, ".part.mp4"))).toBe(false);
    const live = spawnSync("pgrep", ["-f", work], { encoding: "utf8" }).stdout.trim();
    expect(live).toBe("");
  }, 600_000);
});

describe("the mixdown graph", () => {
  const clip = (
    id: string,
    role: "voice" | "music",
    start: number,
    gainDb = 0,
  ): RenderPackage["audio"][number] => ({
    id,
    asset: `${id}_a@1`.replace(/^([a-z]+)_/, "$1_"),
    role,
    start,
    trim: 0,
    duration: 1,
    gainDb,
    fadeIn: 0,
    fadeOut: 0,
    pan: 0,
  });
  const pkg = (audio: RenderPackage["audio"], ducking = true): RenderPackage =>
    ({
      audio,
      mix: {
        duckMusicDb: 0,
        ...(ducking
          ? { ducking: { kind: "sidechain", threshold: 0.03, ratio: 6, attackMs: 80, releaseMs: 500 } }
          : {}),
        loudness: { integratedLufs: -14, truePeakDb: -1.5, rangeLu: 11 },
      },
    }) as unknown as RenderPackage;
  const graph = (p: RenderPackage): string[] => {
    const a = mixdownArgs(p, "v.mp4", (c) => `${c.id}.wav`, "out.mp4") as string[];
    return (a[a.indexOf("-filter_complex") + 1] as string).split(";");
  };
  const tail = "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,apad[a]";

  it("voice and music, ducked: the v2 engine's graph, with the key and the end padded", () => {
    const p = pkg([
      clip("music", "music", 0, 20 * Math.log10(0.55)),
      clip("voice_1", "voice", 0),
      clip("voice_2", "voice", 3.511),
    ]);
    expect(graph(p)).toEqual([
      "[2:a]aresample=48000,aformat=channel_layouts=stereo,adelay=delays=0:all=1[v0]",
      "[3:a]aresample=48000,aformat=channel_layouts=stereo,adelay=delays=3511:all=1[v1]",
      "[v0][v1]amix=inputs=2:normalize=0:dropout_transition=0[voice]",
      "[voice]asplit=2[vo][sc]",
      "[sc]apad[scp]",
      "[1:a]volume=0.55[bedq]",
      "[bedq][scp]sidechaincompress=threshold=0.03:ratio=6:attack=80:release=500[ducked]",
      "[vo][ducked]amix=inputs=2:normalize=0[mix]",
      `[mix]${tail}`,
    ]);
    const a = mixdownArgs(p, "v.mp4", (c) => `${c.id}.wav`, "out.mp4") as string[];
    expect(a.slice(0, 11)).toEqual([
      "-y",
      "-loglevel",
      "error",
      "-i",
      "v.mp4",
      "-i",
      "music.wav",
      "-i",
      "voice_1.wav",
      "-i",
      "voice_2.wav",
    ]);
    expect(a.slice(a.indexOf("-map"))).toEqual([
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
      "out.mp4",
    ]);
  });
  it("voice only; music only (no gain: no stage); voice gain; no clip: no mixdown", () => {
    expect(graph(pkg([clip("voice_1", "voice", 1.25)], false))).toEqual([
      "[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=delays=1250:all=1[v0]",
      "[v0]amix=inputs=1:normalize=0:dropout_transition=0[voice]",
      `[voice]${tail}`,
    ]);
    expect(graph(pkg([clip("music", "music", 0)], false))).toEqual([`[1:a]${tail}`]);
    expect(graph(pkg([clip("voice_1", "voice", 0, -6)], false))[0]).toBe(
      `[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=delays=0:all=1,volume=${10 ** (-6 / 20)}[v0]`,
    );
    expect(mixdownArgs(pkg([], false), "v.mp4", () => "", "out.mp4")).toBeUndefined();
  });
});

describe("the encoder's modules", () => {
  const IMPORT =
    /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|^\s*import\s*["']([^"']+)["']/gm;
  function graphOf(entry: string): string[] {
    const seen = new Set<string>();
    const walk = (f: string): void => {
      if (seen.has(f)) return;
      seen.add(f);
      for (const m of readFileSync(f, "utf8").matchAll(IMPORT)) {
        if (/^(?:import|export)\s+type\b/.test(m[0])) continue;
        const spec = (m[1] ?? m[2] ?? m[3]) as string;
        if (!spec.startsWith(".")) continue;
        const next = resolve(dirname(f), spec.replace(/\.js$/, ".ts"));
        if (existsSync(next)) walk(next);
      }
    };
    walk(entry);
    return [...seen].map((f) => relative(ROOT, f)).sort();
  }
  const files = [
    ...graphOf(join(ROOT, "film/src/package/encode.ts")),
    ...graphOf(join(ROOT, "film/src/package/encode-child.ts")),
  ];

  it("reach no planner, stager, worker, timing, performance, composition or sound code", () => {
    const forbidden =
      /film\/src\/(timing|perform|continuity|compose|film|cli|qa|sound|render)\.ts$|stager\/|ai-worker\/|planner\//;
    expect([...new Set(files)].filter((f) => forbidden.test(f))).toEqual([]);
  });
  it("only the encoder and its child touch files; the mixdown reads no validated or metadata field", () => {
    for (const f of new Set(files.filter((x) => x.startsWith("film/src/package/"))))
      expect(/node:fs/.test(readFileSync(join(ROOT, f), "utf8")), f).toBe(/encode(-child)?\.ts$/.test(f));
    for (const f of ["film/src/package/mixdown.ts", "film/src/package/encoding.ts"])
      expect(
        readFileSync(join(ROOT, f), "utf8").match(
          // package and manifest fields (AUDIO.encode.sampleRate is the engine's own output rate)
          /(?<!encode)\.(durationSec|sampleRate|provenance|approval|license)\b/,
        )?.[0],
        f,
      ).toBeUndefined();
  });
});
