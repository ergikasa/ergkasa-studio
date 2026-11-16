/**
 * W0 soundtrack, synthesised (the real library replaces it later): a soft pad that follows the story's beats,
 * a felt-piano note on the cuts that matter, room tone, and effects on what is seen (clock, footsteps, the
 * binder landing, the lamp, the door). No narration: W0 has no voice key; the captions carry the words.
 */
import { writeFileSync } from "node:fs";
import type { Prepared } from "./composer.js";

const SR = 48000;
const CHORD: Record<string, number[]> = {
  s01: [110, 164.81, 220, 261.63], // A minor
  s02: [87.31, 130.81, 174.61, 220], // F major
  s03: [98, 146.83, 196, 233.08], // G minor
  s04: [73.42, 146.83, 196, 220], // D sus
  s05: [87.31, 130.81, 174.61, 207.65], // F minor
  s06: [65.41, 130.81, 196, 246.94, 329.63], // C maj7
};

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}

export function writeSoundtrack(file: string, P: Prepared): void {
  const dur = P.duration + 0.5;
  const n = Math.ceil(dur * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const add = (i: number, v: number, pan = 0): void => {
    if (i < 0 || i >= n) return;
    L[i] = (L[i] as number) + v * (1 - pan * 0.5);
    R[i] = (R[i] as number) + v * (1 + pan * 0.5);
  };

  // pad: one chord per scene, slow swells, slightly detuned left and right
  for (const sc of P.timing.scenes) {
    const fr = CHORD[sc.sceneId] ?? CHORD["s04"];
    const s0 = Math.max(0, sc.start - 1.2);
    const s1 = Math.min(dur, sc.start + sc.duration + 1.2);
    const last = sc === P.timing.scenes[P.timing.scenes.length - 1];
    const end = last ? dur : s1;
    for (let i = Math.floor(s0 * SR); i < Math.floor(end * SR); i++) {
      const t = i / SR;
      const env = Math.min(1, (t - s0) / 1.4, last ? (dur - t) / 2.5 : (s1 - t) / 1.4);
      if (env <= 0) continue;
      let l = 0,
        r = 0;
      (fr as number[]).forEach((f, k) => {
        const amp = k === 0 ? 0.55 : 0.32 / (1 + k * 0.2);
        const trem = 0.85 + 0.15 * Math.sin(2 * Math.PI * (0.13 + k * 0.05) * t + k);
        l += amp * trem * (Math.sin(2 * Math.PI * f * 0.9985 * t) + 0.18 * Math.sin(2 * Math.PI * 2 * f * t));
        r += amp * trem * (Math.sin(2 * Math.PI * f * 1.0015 * t + 0.4) + 0.18 * Math.sin(2 * Math.PI * 2 * f * t + 0.7));
      });
      const g = 0.05 * env * (last ? 1.25 : 1);
      L[i] = (L[i] as number) + l * g;
      R[i] = (R[i] as number) + r * g;
    }
  }

  // felt piano: a soft note on chosen cuts
  const note = (t0: number, f: number, vel: number, pan = 0): void => {
    const i0 = Math.floor(t0 * SR);
    for (let k = 0; k < SR * 3.2; k++) {
      const t = k / SR;
      const env = Math.min(1, t / 0.006) * Math.exp(-t * 1.6);
      const v = vel * env * (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * 2 * f * t) * Math.exp(-t * 2) + 0.12 * Math.sin(2 * Math.PI * 3.01 * f * t) * Math.exp(-t * 4));
      add(i0 + k, v, pan);
    }
  };
  const melody = [523.25, 440, 392, 349.23, 329.63, 293.66, 329.63, 392, 349.23, 293.66, 261.63, 329.63, 392, 523.25];
  P.shots.forEach((s, k) => note(s.start + 0.02, melody[k % melody.length] as number, 0.09, k % 2 ? 0.3 : -0.3));

  // room tone
  const rnd = rng(11);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    lp += 0.02 * (rnd() - lp);
    add(i, lp * 0.05);
  }

  // effects
  const tick = (t0: number, vel = 0.25): void => {
    const r2 = rng(Math.floor(t0 * 1000));
    for (let k = 0; k < SR * 0.03; k++) {
      const t = k / SR;
      add(Math.floor(t0 * SR) + k, vel * Math.exp(-t * 260) * (Math.sin(2 * Math.PI * 3200 * t) * 0.6 + r2() * 0.4), 0.2);
    }
  };
  const thump = (t0: number, f: number, vel: number, decay: number, noise = 0.3): void => {
    const r2 = rng(Math.floor(t0 * 977));
    let nl = 0;
    for (let k = 0; k < SR * 0.6; k++) {
      const t = k / SR;
      nl += 0.15 * (r2() - nl);
      add(Math.floor(t0 * SR) + k, vel * Math.exp(-t * decay) * (Math.sin(2 * Math.PI * f * t * (1 + 0.6 * Math.exp(-t * 30))) + noise * nl * 4));
    }
  };
  const creak = (t0: number, len: number, vel: number): void => {
    const r2 = rng(Math.floor(t0 * 331));
    let y1 = 0,
      y2 = 0;
    for (let k = 0; k < SR * len; k++) {
      const t = k / SR;
      const f = 380 + 260 * Math.sin((Math.PI * t) / len) + 40 * Math.sin(2 * Math.PI * 7 * t);
      const w = (2 * Math.PI * f) / SR;
      const q = 0.995;
      const x = r2() * (0.6 + 0.4 * Math.sin(2 * Math.PI * 23 * t));
      const y = x + 2 * q * Math.cos(w) * y1 - q * q * y2;
      y2 = y1;
      y1 = y;
      add(Math.floor(t0 * SR) + k, vel * y * 0.02 * Math.sin((Math.PI * t) / len), -0.4);
    }
  };

  for (const s of P.shots) {
    const id = s.w.shot.id;
    const subj = s.w.cam.subject ?? "";
    // the clock: ticks once a second, a rush of ticks while time is spent
    if (subj.startsWith("wall:1060")) {
      const fast = id === "sh12";
      for (let t = 0.1; t < s.dur; t += fast ? Math.max(0.07, 0.45 - t * 0.12) : 1) tick(s.start + t, fast ? 0.18 : 0.3);
    }
    // footsteps while someone walks
    for (const a of s.perf?.actors.values() ?? []) for (const w of a.walks) for (let t = w.t0 + 0.3; t < w.t1; t += 0.625) thump(s.start + t, 95, 0.16, 38, 0.6);
    // the door
    const dOpen = s.w.shot.actions.find((a) => a.do === "open");
    if (dOpen && s.perf) {
      let t0 = 0;
      for (let t = 0; t < s.dur; t += 1 / 60) if (s.perf.door.at(t) > 0.02) { t0 = t; break; }
      tick(s.start + t0 - 0.05, 0.5);
      creak(s.start + t0, 1.1, 0.5);
      note(s.start + t0 + 0.1, 523.25, 0.12, 0);
      note(s.start + t0 + 0.6, 659.25, 0.1, 0.3);
      note(s.start + t0 + 1.1, 783.99, 0.09, -0.3);
    }
  }
  for (const e of P.absEvents) {
    if (e.kind === "binders") thump(e.t + 0.45, 62, 0.75, 14, 0.5);
    if (e.kind === "lamp") tick(e.t, 0.55);
  }

  // master: soft limiter and peak normalisation
  let peak = 0;
  for (let i = 0; i < n; i++) {
    L[i] = Math.tanh((L[i] as number) * 1.2);
    R[i] = Math.tanh((R[i] as number) * 1.2);
    peak = Math.max(peak, Math.abs(L[i] as number), Math.abs(R[i] as number));
  }
  const g = 0.85 / Math.max(1e-6, peak);
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
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, (L[i] as number) * g)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, (R[i] as number) * g)) * 32767), 46 + i * 4);
  }
  writeFileSync(file, buf);
}
