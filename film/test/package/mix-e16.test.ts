/**
 * E1.6 subphase 4a: the mixdown applies what the capabilities now publish (several music clips, sfx, trim, fades,
 * duck depth). The graph is checked as text, then rendered by the real FFmpeg and measured in the decoded audio:
 * each clip is a sine of its own frequency, so its level over time is read with a Goertzel filter.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RenderPackage } from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { duckMix, mixdownArgs, playsPart } from "../../src/package/mixdown.js";

type Clip = RenderPackage["audio"][number];
const RATE = 48000;
const ffmpeg = process.env["ERKASA_FFMPEG"] ?? "ffmpeg";

/** Mono 16-bit WAV: `silence` s of nothing, then a sine of `hz` until `sec`. */
function sine(hz: number, sec: number, amp = 0.3, silence = 0): Buffer {
  const n = Math.round(sec * RATE);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8, "latin1");
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36, "latin1");
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const v = t < silence ? 0 : Math.sin(2 * Math.PI * hz * t) * amp;
    b.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return b;
}

const clip = (
  id: string,
  role: Clip["role"],
  start: number,
  duration: number,
  over: Partial<Clip> = {},
): Clip => ({
  id,
  asset: `${id}@1`,
  role,
  start,
  trim: 0,
  duration,
  gainDb: 0,
  fadeIn: 0,
  fadeOut: 0,
  pan: 0,
  ...over,
});

const pkgOf = (audio: Clip[], duration: number, duckMusicDb = 0, ducking = false): RenderPackage =>
  ({
    output: { width: 64, height: 64, fps: 30, duration },
    audio,
    mix: {
      duckMusicDb,
      ...(ducking
        ? { ducking: { kind: "sidechain", threshold: 0.015, ratio: 20, attackMs: 120, releaseMs: 500 } }
        : {}),
      loudness: { integratedLufs: -16, truePeakDb: -1, rangeLu: 11 },
    },
  }) as unknown as RenderPackage;

/** Renders the package's mix over a black video of its duration; returns the decoded mono PCM (float). */
function render(pkg: RenderPackage, files: Record<string, Buffer>): Float32Array {
  const dir = mkdtempSync(join(tmpdir(), "mix16-"));
  const video = join(dir, "v.mp4");
  const v = spawnSync(ffmpeg, [
    ...["-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=black:s=64x64:r=30:d=${pkg.output.duration}`],
    ...["-c:v", "libx264", "-pix_fmt", "yuv420p", video],
  ]);
  if (v.status !== 0) throw new Error(v.stderr.toString());
  const secs: Record<string, number> = {};
  for (const [id, b] of Object.entries(files)) {
    writeFileSync(join(dir, `${id}.wav`), b);
    secs[id] = (b.length - 44) / 2 / RATE;
  }
  const out = join(dir, "out.mp4");
  const args = mixdownArgs(
    pkg,
    video,
    (c) => join(dir, `${c.id}.wav`),
    out,
    (c) => secs[c.id] as number,
  ) as string[];
  const r = spawnSync(ffmpeg, args);
  if (r.status !== 0) throw new Error(r.stderr.toString());
  const pcm = spawnSync(
    ffmpeg,
    ["-loglevel", "error", "-i", out, "-f", "f32le", "-ac", "1", "-ar", `${RATE}`, "-"],
    {
      maxBuffer: 1 << 28,
    },
  );
  const buf = pcm.stdout as Buffer;
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}

/** Amplitude of the `hz` component between `a` and `b` seconds (Goertzel). */
function level(p: Float32Array, hz: number, a: number, b: number): number {
  const i0 = Math.floor(a * RATE);
  const i1 = Math.min(p.length, Math.floor(b * RATE));
  const w = (2 * Math.PI * hz) / RATE;
  const k = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = i0; i < i1; i++) {
    const s0 = (p[i] as number) + k * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const n = Math.max(1, i1 - i0);
  return (2 * Math.sqrt(s1 * s1 + s2 * s2 - k * s1 * s2)) / n;
}
const db = (x: number): number => 20 * Math.log10(Math.max(x, 1e-9));

describe("the mixdown graph (E1.6)", () => {
  it("two music segments (trim, fades, a start), an sfx, a duck depth: the published stages, in order", () => {
    const p = pkgOf(
      [
        clip("m1", "music", 0, 3, { fadeOut: 1, gainDb: -6 }),
        clip("m2", "music", 2, 4, { trim: 1.5, fadeIn: 1, fadeOut: 0.5 }),
        clip("v1", "voice", 0.5, 1),
        clip("s1", "sfx", 2.25, 0.3, { gainDb: -3 }),
      ],
      6,
      7,
      true,
    );
    const a = mixdownArgs(
      p,
      "v.mp4",
      (c) => `${c.id}.wav`,
      "o.mp4",
      (c) => (c.role === "music" ? 10 : 1),
    ) as string[];
    expect(a.filter((x, i) => a[i - 1] === "-i")).toEqual(["v.mp4", "m1.wav", "m2.wav", "v1.wav", "s1.wav"]);
    const g = (a[a.indexOf("-filter_complex") + 1] as string).split(";");
    expect(g).toEqual([
      "[1:a]atrim=start=0:duration=3,asetpts=PTS-STARTPTS,afade=t=out:st=2:d=1:curve=qsin,aresample=48000,aformat=channel_layouts=stereo,volume=0.5011872336272722[m0]",
      "[2:a]atrim=start=1.5:duration=4,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1:curve=qsin,afade=t=out:st=3.5:d=0.5:curve=qsin,aresample=48000,aformat=channel_layouts=stereo,adelay=delays=2000:all=1[m1]",
      "[3:a]aresample=48000,aformat=channel_layouts=stereo,adelay=delays=500:all=1[v0]",
      "[4:a]atrim=start=0:duration=0.3,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,adelay=delays=2250:all=1,volume=0.7079457843841379[s0]",
      "[m0][m1]amix=inputs=2:normalize=0:dropout_transition=0[music]",
      "[v0]amix=inputs=1:normalize=0:dropout_transition=0[voice]",
      "[voice]asplit=2[vo][sc]",
      "[sc]apad[scp]",
      `[music][scp]sidechaincompress=threshold=0.015:ratio=20:attack=120:release=500:mix=${duckMix(7)}[ducked]`,
      "[vo][ducked][s0]amix=inputs=3:normalize=0[mix]",
      "[mix]loudnorm=I=-16:TP=-1:LRA=11,aresample=48000[a]",
    ]);
  });

  it("a clip is cut only if it is trimmed or stops before both its file's end and the film's end", () => {
    const c = clip("m", "music", 0, 5);
    expect(playsPart(c, 9, 10)).toBe(true); // stops at 5 s, file and film go on
    expect(playsPart(c, 5, 10)).toBe(false); // the whole file
    expect(playsPart(c, 9, 5)).toBe(false); // to the film's end: the whole file is mixed, as in E1.5
    expect(playsPart({ ...c, trim: 0.5, duration: 4.5 }, 5, 10)).toBe(true);
    expect(duckMix(0)).toBe(0);
    expect(db(1 - duckMix(7))).toBeCloseTo(-7, 9);
  });
});

describe("the mix, rendered and measured (real FFmpeg)", () => {
  it("segments start and stop where placed, the trim skips the file's start, fades ramp, the sfx sits at its time", () => {
    // m1 220 Hz 0..3 s with a 1 s fade out; m2 is a file of 1.5 s silence then 330 Hz, trimmed by 1.5 s, at 2..6 s
    // with a 1 s fade in; an sfx of 880 Hz at 4.5..4.8 s
    const p = pkgOf(
      [
        clip("m1", "music", 0, 3, { fadeOut: 1 }),
        clip("m2", "music", 2, 4, { trim: 1.5, fadeIn: 1 }),
        clip("s1", "sfx", 4.5, 0.3),
      ],
      6,
    );
    const pcm = render(p, {
      m1: sine(220, 8),
      m2: sine(330, 8, 0.3, 1.5),
      s1: sine(880, 1),
    });
    expect(pcm.length / RATE).toBeGreaterThan(5.9);
    const m1 = (a: number, b: number): number => level(pcm, 220, a, b);
    const m2 = (a: number, b: number): number => level(pcm, 330, a, b);
    const s1 = (a: number, b: number): number => level(pcm, 880, a, b);
    // m1: steady, then fading over its last second, then gone
    expect(db(m1(2.15, 2.35)) - db(m1(1.0, 1.5))).toBeLessThan(-0.5);
    expect(db(m1(3.3, 5.5)) - db(m1(1.0, 1.5))).toBeLessThan(-40);
    // m2: nothing before 2 s; thanks to the trim the tone is there from its first moments (no 1.5 s of silence)
    expect(db(m2(0.2, 1.8)) - db(m2(3.5, 4.4))).toBeLessThan(-40);
    expect(db(m2(2.6, 2.9))).toBeGreaterThan(db(m2(3.5, 4.4)) - 10);
    // its fade in: quieter at 2.1 s than at 2.8 s, full after 3 s
    expect(m2(2.05, 2.25)).toBeLessThan(m2(2.75, 2.95));
    // the sfx only at 4.5..4.8 s
    expect(db(s1(4.55, 4.75)) - db(s1(0.5, 4.3))).toBeGreaterThan(30);
    expect(db(s1(5.0, 5.9)) - db(s1(4.55, 4.75))).toBeLessThan(-30);
  }, 120_000);

  it("the duck depth: under a voice the music drops by about duckMusicDb, and much more without a depth", () => {
    // music 220 Hz for 9 s; a voice (550 Hz, loud) from 3 s to 6 s; a reference sfx (880 Hz) for the whole film,
    // never ducked: loudnorm changes the level of everything alike, so the music is measured against it
    const clips = [
      clip("m", "music", 0, 9, { gainDb: -12 }),
      clip("v", "voice", 3, 3),
      clip("r", "sfx", 0, 9, { gainDb: -12 }),
    ];
    const files = { m: sine(220, 9, 0.3), v: sine(550, 3, 0.6), r: sine(880, 9, 0.3) };
    const rel = (pcm: Float32Array, a: number, b: number): number =>
      db(level(pcm, 220, a, b)) - db(level(pcm, 880, a, b));
    const drop = (pcm: Float32Array): number => rel(pcm, 4.0, 5.5) - rel(pcm, 1.0, 2.5);
    const deep7 = drop(render(pkgOf(clips, 9, 7, true), files));
    const full = drop(render(pkgOf(clips, 9, 0, true), files));
    console.info(
      `music under the voice: ${deep7.toFixed(2)} dB with duckMusicDb 7, ${full.toFixed(2)} dB without`,
    );
    // the 7 dB depth, within ±1.5 dB (the compressor's knee and timing)
    expect(deep7).toBeLessThan(-5.5);
    expect(deep7).toBeGreaterThan(-8.5);
    expect(full).toBeLessThan(deep7 - 5);
  }, 120_000);
});
