/**
 * The arithmetic of audio in a Render Package that the stager, the gate and the engine share (E1.5).
 *
 * - `wavInfo`: what a WAV file holds, read from its header (RIFF/WAVE, `fmt ` PCM 16/24/32-bit or IEEE float
 *   32/64-bit, `data`). The duration is the number of sample frames over the sample rate, exactly.
 * - `audibleDuration`: how long a clip is heard in the film. The engine mixes the whole file from the clip's
 *   start; the output ends with the film, so a clip that runs past the end is heard until the end. The value is
 *   the largest duration whose end, start + duration, is not after the film's end in floating point.
 * - `clipStartMs`: the engine places a clip with millisecond resolution; a package writes starts that are whole
 *   milliseconds (start × 1000 rounds to an integer n with n / 1000 === start).
 * - `gainLinear`: a gain in dB as the linear factor the engine writes (0 dB: no gain stage).
 */

export interface WavInfo {
  /** 1: integer PCM, 3: IEEE float. */
  format: 1 | 3;
  bitsPerSample: number;
  channels: number;
  sampleRate: number;
  frames: number;
  durationSec: number;
}

/** The header of a WAV file, or a reason it is not one the engine reads. */
export function wavInfo(bytes: Uint8Array): WavInfo | { error: string } {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (b.length < 12 || b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WAVE")
    return { error: "not a RIFF/WAVE file" };
  let at = 12;
  let fmt:
    { format: number; channels: number; sampleRate: number; blockAlign: number; bits: number } | undefined;
  while (at + 8 <= b.length) {
    const id = b.toString("latin1", at, at + 4);
    const size = b.readUInt32LE(at + 4);
    const body = at + 8;
    if (id === "fmt ") {
      if (size < 16 || body + 16 > b.length) return { error: "a short fmt chunk" };
      let format = b.readUInt16LE(body);
      if (format === 0xfffe && size >= 40) format = b.readUInt16LE(body + 24); // WAVE_FORMAT_EXTENSIBLE
      fmt = {
        format,
        channels: b.readUInt16LE(body + 2),
        sampleRate: b.readUInt32LE(body + 4),
        blockAlign: b.readUInt16LE(body + 12),
        bits: b.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      if (!fmt) return { error: "data before fmt" };
      if (body + size > b.length)
        return { error: `the data chunk says ${size} bytes, the file has ${b.length - body}` };
      const okInt = fmt.format === 1 && [16, 24, 32].includes(fmt.bits);
      const okFloat = fmt.format === 3 && [32, 64].includes(fmt.bits);
      if (!okInt && !okFloat) return { error: `format ${fmt.format} with ${fmt.bits}-bit samples` };
      if (fmt.channels < 1 || fmt.sampleRate < 1 || fmt.blockAlign !== (fmt.channels * fmt.bits) / 8)
        return { error: "an inconsistent fmt chunk" };
      if (size % fmt.blockAlign !== 0) return { error: "the data is not a whole number of sample frames" };
      const frames = size / fmt.blockAlign;
      if (frames === 0) return { error: "no samples" };
      return {
        format: fmt.format as 1 | 3,
        bitsPerSample: fmt.bits,
        channels: fmt.channels,
        sampleRate: fmt.sampleRate,
        frames,
        durationSec: frames / fmt.sampleRate,
      };
    }
    at = body + size + (size % 2);
  }
  return { error: "no data chunk" };
}

const nextDown = (v: number): number => {
  const f = new Float64Array([v]);
  const i = new BigInt64Array(f.buffer);
  i[0] = (i[0] as bigint) + (v > 0 ? -1n : 1n);
  return f[0] as number;
};

/** How long a clip of `fileSec` starting at `start` is heard in a film of `filmSec`. */
export function audibleDuration(start: number, fileSec: number, filmSec: number): number {
  if (start + fileSec <= filmSec) return fileSec;
  let d = filmSec - start;
  while (d > 0 && start + d > filmSec) d = nextDown(d);
  return d;
}

/** A start in whole milliseconds, or undefined if `start` is not one. */
export function clipStartMs(start: number): number | undefined {
  const n = Math.round(start * 1000);
  return n / 1000 === start ? n : undefined;
}

/** A start rounded to whole milliseconds (how the engine places it). */
export const toWholeMs = (sec: number): number => Math.round(sec * 1000) / 1000;

/** The linear factor of a gain in dB. */
export const gainLinear = (db: number): number => 10 ** (db / 20);
