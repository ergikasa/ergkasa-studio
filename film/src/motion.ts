/**
 * Motion: key poses joined by curves. Every movement in a film is a list of keys `[time, value, ease]`, where
 * the ease says how the value arrives at that key. Holds are two keys with the same value. There is no
 * sine-wave "animation" here: a pose is reached, held, and left with intent.
 */

export const clamp = (x: number, a = 0, b = 1): number => Math.max(a, Math.min(b, x));

export const EASES = {
  lin: (t: number) => t,
  io: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
  /** Overshoots the target and settles back: follow-through. */
  back: (t: number) => {
    const c1 = 1.9;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  /** Moves the other way first: anticipation. */
  antic: (t: number) => {
    const c1 = 1.6;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  /** A damped spring, for things that swing (a beam, a door). */
  spring: (t: number) => 1 - Math.exp(-6 * t) * Math.cos(10 * t),
} as const;
export type Ease = keyof typeof EASES;

export type Key = readonly [number, number, Ease?];

/** Value of a key track at time t. Before the first key: its value; after the last: the last value. */
export function K(t: number, keys: readonly Key[]): number {
  const first = keys[0];
  if (!first) return 0;
  if (t <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i] as Key;
    const k0 = keys[i - 1] as Key;
    if (t <= k1[0]) {
      const span = k1[0] - k0[0];
      const p = span <= 0 ? 1 : (t - k0[0]) / span;
      return k0[1] + (k1[1] - k0[1]) * EASES[k1[2] ?? "io"](clamp(p));
    }
  }
  return (keys[keys.length - 1] as Key)[1];
}

/** 0 -> 1 between t0 and t1 with an ease. */
export const ramp = (t: number, t0: number, t1: number, ease: Ease = "io"): number =>
  EASES[ease](clamp((t - t0) / Math.max(1e-6, t1 - t0)));

/** Deterministic pseudo-random in [0, 1) from integers (no global state). */
export function hash01(...n: number[]): number {
  let h = 2166136261;
  for (const v of n) {
    h ^= Math.floor(v * 1000) | 0;
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export const fmt = (n: number): string => String(Math.round(n * 100) / 100);
export const rad = (d: number): number => (d * Math.PI) / 180;
