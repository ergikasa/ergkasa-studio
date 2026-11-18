/**
 * E1.5: the audio arithmetic the stager, the gate and the engine share (contracts/src/audio-clip.ts) and the
 * additive mix fields of erkasa.render/1.
 */
import { describe, expect, it } from "vitest";
import { audibleDuration, clipStartMs, gainLinear, Mix, toWholeMs, wavInfo } from "../src/index.js";

function wav(o: {
  frames: number;
  rate?: number;
  channels?: number;
  bits?: number;
  format?: number;
  extensible?: boolean;
  dataSize?: number;
  junk?: boolean;
}): Buffer {
  const rate = o.rate ?? 48000;
  const ch = o.channels ?? 2;
  const bits = o.bits ?? 16;
  const block = (ch * bits) / 8;
  const data = o.frames * block;
  const fmtSize = o.extensible ? 40 : 16;
  const junk = o.junk ? 8 + 3 + 1 : 0; // a 3-byte chunk, padded to even
  const b = Buffer.alloc(12 + junk + 8 + fmtSize + 8 + data);
  let at = 0;
  b.write("RIFF", at, "latin1");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVE", 8, "latin1");
  at = 12;
  if (o.junk) {
    b.write("LIST", at, "latin1");
    b.writeUInt32LE(3, at + 4);
    at += 12;
  }
  b.write("fmt ", at, "latin1");
  b.writeUInt32LE(fmtSize, at + 4);
  b.writeUInt16LE(o.extensible ? 0xfffe : (o.format ?? 1), at + 8);
  b.writeUInt16LE(ch, at + 10);
  b.writeUInt32LE(rate, at + 12);
  b.writeUInt32LE(rate * block, at + 16);
  b.writeUInt16LE(block, at + 20);
  b.writeUInt16LE(bits, at + 22);
  if (o.extensible) b.writeUInt16LE(o.format ?? 1, at + 8 + 24);
  at += 8 + fmtSize;
  b.write("data", at, "latin1");
  b.writeUInt32LE(o.dataSize ?? data, at + 4);
  return b;
}

describe("wavInfo: what a WAV holds, from its header", () => {
  it("16-bit PCM stereo: frames over the rate, exactly", () => {
    expect(wavInfo(wav({ frames: 48000 * 3 + 7 }))).toEqual({
      format: 1,
      bitsPerSample: 16,
      channels: 2,
      sampleRate: 48000,
      frames: 144007,
      durationSec: 144007 / 48000,
    });
  });
  it("32-bit float mono at 44.1 kHz (the voice as the stager writes it), after another chunk, and extensible", () => {
    expect(
      wavInfo(wav({ frames: 44100, rate: 44100, channels: 1, bits: 32, format: 3, junk: true })),
    ).toMatchObject({
      format: 3,
      channels: 1,
      sampleRate: 44100,
      durationSec: 1,
    });
    expect(wavInfo(wav({ frames: 10, bits: 24, extensible: true }))).toMatchObject({
      format: 1,
      bitsPerSample: 24,
      frames: 10,
    });
  });
  it.each([
    ["not RIFF", Buffer.from("ID3\u0003 not a wave"), "not a RIFF/WAVE file"],
    ["8-bit PCM", wav({ frames: 4, bits: 8 }), "format 1 with 8-bit samples"],
    [
      "a data chunk past the end",
      wav({ frames: 4, dataSize: 400 }),
      "the data chunk says 400 bytes, the file has 16",
    ],
    ["a partial frame", wav({ frames: 4, dataSize: 15 }), "the data is not a whole number of sample frames"],
    ["no samples", wav({ frames: 0 }), "no samples"],
  ])("refuses %s", (_, b, error) => {
    expect(wavInfo(b)).toEqual({ error });
  });
});

describe("audibleDuration: how long a clip is heard", () => {
  it("the whole file when it ends inside the film", () => {
    expect(audibleDuration(1, 1.2, 35)).toBe(1.2);
    expect(audibleDuration(33.8, 1.2, 35)).toBe(1.2);
  });
  it("up to the film's end otherwise, never a float step past it", () => {
    const film = 8.033333333333333;
    const d = audibleDuration(3.511, 9, film);
    expect(3.511 + d).toBeLessThanOrEqual(film);
    const up = new Float64Array([d]);
    const bits = new BigInt64Array(up.buffer);
    bits[0] = (bits[0] as bigint) + 1n;
    expect(3.511 + (up[0] as number)).toBeGreaterThan(film);
  });
});

describe("clip starts and gains", () => {
  it("whole milliseconds only", () => {
    expect(clipStartMs(3.511)).toBe(3511);
    expect(clipStartMs(0)).toBe(0);
    expect(clipStartMs(1.0005)).toBeUndefined();
    expect(toWholeMs(3.5106)).toBe(3.511);
    expect(clipStartMs(toWholeMs(12.3456789))).toBe(12346);
  });
  it("the v2 bed's 0.55 round-trips through dB exactly", () => {
    expect(gainLinear(20 * Math.log10(0.55))).toBe(0.55);
    expect(String(gainLinear(20 * Math.log10(0.55)))).toBe("0.55");
  });
});

describe("erkasa.render/1 mix: additive fields", () => {
  it("a mix without them is valid as before; with them, they are checked", () => {
    expect(
      Mix.safeParse({ duckMusicDb: 0, loudness: { integratedLufs: -14, truePeakDb: -1.5 } }).success,
    ).toBe(true);
    const full = {
      duckMusicDb: 0,
      ducking: { kind: "sidechain", threshold: 0.03, ratio: 6, attackMs: 80, releaseMs: 500 },
      loudness: { integratedLufs: -14, truePeakDb: -1.5, rangeLu: 11 },
    };
    expect(Mix.parse(full)).toEqual(full);
    expect(Mix.safeParse({ ...full, ducking: { ...full.ducking, kind: "fixed" } }).success).toBe(false);
    expect(Mix.safeParse({ ...full, ducking: { ...full.ducking, ratio: 30 } }).success).toBe(false);
    expect(Mix.safeParse({ ...full, loudness: { ...full.loudness, rangeLu: 0 } }).success).toBe(false);
  });
});
