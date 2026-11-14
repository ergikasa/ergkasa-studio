/**
 * Sound design for a film: a music bed whose harmony follows the story's beats (unease in the hook and the
 * problem, suspension in the concept and the analysis, resolution in the conclusion), and effects on what is
 * seen (a clock ticks, blocks land, a door swings, a whip cut whooshes). Synthesised here, so a film never waits
 * on a library; the real audio library can replace the bed later.
 */
import { writeFileSync } from "node:fs";
import type { Script } from "@erkasa/contracts";
import type { Composed } from "./compose.js";
import { hash01 } from "./motion.js";
import type { Timing } from "./timing.js";

const SR = 48000;

const CHORDS: Record<string, number[]> = {
  tense: [110, 130.81, 164.81], // A minor
  open: [130.81, 164.81, 196, 261.63], // C major
  dark: [98, 116.54, 146.83], // G minor
  suspended: [146.83, 196, 220, 293.66], // D sus4
  resolve: [130.81, 164.81, 196, 246.94], // Cmaj7
};
const BEAT_CHORD: Record<string, keyof typeof CHORDS> = {
  hook: "tense",
  problem: "tense",
  relate: "tense",
  tension: "dark",
  situation: "dark",
  concept: "suspended",
  explain: "suspended",
  analysis: "dark",
  twist: "suspended",
  turn: "open",
  conclusion: "resolve",
  resolve: "resolve",
};

export interface Sfx {
  t: number;
  kind: "tick" | "thud" | "door" | "whoosh" | "chime" | "rise";
}

/** Effects implied by the shots (what the viewer sees happen). */
export function sfxFor(c: Composed): Sfx[] {
  const out: Sfx[] = [];
  for (const s of c.shots) {
    if (s.shot.transition === "whip") out.push({ t: s.start - 0.05, kind: "whoosh" });
    if (s.shot.kind === "editorial") {
      if (s.shot.template === "clock")
        for (let k = 0; k < s.dur; k += 1) out.push({ t: s.start + k + 0.02, kind: "tick" });
      if (s.shot.template === "scale")
        (s.shot.params["items"] as unknown[] | undefined)?.forEach((_, i) =>
          out.push({ t: s.start + (s.events[i + 1] ?? 0.6 + i * 0.42), kind: "thud" }),
        );
      if (s.shot.template === "calendar")
        for (let k = 0.5; k < s.dur - 0.5; k += 0.9) out.push({ t: s.start + k, kind: "whoosh" });
    } else {
      for (const a of s.shot.actions) {
        const t = s.events.find((e) => e > 0) ?? 0;
        if (a.do === "open") out.push({ t: s.start + t, kind: "door" });
        if (a.do === "glow") out.push({ t: s.start + t, kind: "rise" });
      }
    }
  }
  const last = c.shots[c.shots.length - 1];
  if (last?.shot.text) out.push({ t: last.start + 0.2, kind: "chime" });
  return out;
}

/** Writes a stereo 16-bit WAV with the music bed and the effects. */
export function writeBed(file: string, script: Script, timing: Timing, sfx: Sfx[], duration: number): void {
  const n = Math.ceil(duration * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const add = (i: number, v: number, pan = 0): void => {
    if (i < 0 || i >= n) return;
    L[i] = (L[i] as number) + v * (1 - pan * 0.6);
    R[i] = (R[i] as number) + v * (1 + pan * 0.6);
  };
  // music: one chord per scene, cross-faded
  timing.scenes.forEach((sc, k) => {
    const beat = script.scenes.find((s) => s.sceneId === sc.sceneId)?.beat ?? "concept";
    const freqs = CHORDS[BEAT_CHORD[beat] ?? "suspended"] as number[];
    const s0 = Math.max(0, sc.start - 0.8),
      s1 = Math.min(duration, sc.start + sc.duration + 0.8);
    for (let i = Math.floor(s0 * SR); i < Math.floor(s1 * SR); i++) {
      const t = i / SR;
      const w = Math.min(1, (t - s0) / 0.9, (s1 - t) / 0.9);
      let v = 0;
      for (const f of freqs)
        v += Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * 2 * f * t + 0.3);
      v = (v / freqs.length) * (1 + 0.08 * Math.sin(2 * Math.PI * 0.21 * t + k));
      add(i, v * w * 0.06);
    }
  });
  // effects
  const env = (t: number, a: number, d: number): number =>
    t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / d);
  for (const e of sfx) {
    const i0 = Math.floor(e.t * SR);
    const len = Math.floor(
      SR * (e.kind === "chime" ? 3 : e.kind === "rise" || e.kind === "door" ? 1.4 : 0.6),
    );
    let lp = 0;
    for (let j = 0; j < len; j++) {
      const t = j / SR;
      const noise = hash01(i0, j) * 2 - 1;
      lp += (noise - lp) * 0.08;
      let v = 0;
      switch (e.kind) {
        case "tick":
          v =
            (Math.sin(2 * Math.PI * 2400 * t) * env(t, 0.001, 0.012) + noise * env(t, 0.001, 0.006) * 0.4) *
            0.35;
          break;
        case "thud":
          v =
            (Math.sin(2 * Math.PI * 92 * t) * env(t, 0.002, 0.12) + noise * env(t, 0.001, 0.02) * 0.3) * 0.55;
          break;
        case "door":
          v =
            lp * env(t, 0.35, 0.5) * 1.6 +
            Math.sin(2 * Math.PI * (180 + 120 * Math.min(1, t)) * t) * env(t, 0.05, 0.3) * 0.12;
          break;
        case "whoosh":
          v = lp * env(t, 0.12, 0.18) * 1.8;
          break;
        case "rise":
          v = Math.sin(2 * Math.PI * (330 + 330 * Math.min(1, t)) * t) * env(t, 0.5, 0.5) * 0.08;
          break;
        case "chime":
          for (const [k, f] of [523.25, 659.25, 783.99].entries())
            v += Math.sin(2 * Math.PI * f * (t - k * 0.12)) * env(t - k * 0.12, 0.005, 1.4) * 0.08;
          break;
      }
      add(i0 + j, v, e.kind === "door" ? 0.4 : 0);
    }
  }
  // fade out and normalise
  let peak = 1e-6;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = Math.min(1, t / 0.15, (duration - t) / 1.2);
    L[i] = (L[i] as number) * f;
    R[i] = (R[i] as number) * f;
    peak = Math.max(peak, Math.abs(L[i] as number), Math.abs(R[i] as number));
  }
  const gain = 0.8 / peak;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, (L[i] as number) * gain)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, (R[i] as number) * gain)) * 32767), 46 + i * 4);
  }
  writeFileSync(file, buf);
}
