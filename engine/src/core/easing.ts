import type { Easing } from "@erkasa/contracts";

/** An easing maps progress t in [0, 1] to eased progress (may overshoot for back/spring). */
export type EaseFn = (t: number) => number;

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

const BACK = 1.70158;

const NAMED: Record<string, EaseFn> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutBack: (t) => 1 + (BACK + 1) * Math.pow(t - 1, 3) + BACK * Math.pow(t - 1, 2),
  easeInOutBack: (t) => {
    const c2 = BACK * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
  hold: () => 0,
};

/** CSS-style cubic-bezier(x1, y1, x2, y2): solve x(s) = t, return y(s). */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): EaseFn {
  const bez = (s: number, a: number, b: number): number =>
    3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s;
  return (t) => {
    let lo = 0;
    let hi = 1;
    let s = t;
    for (let i = 0; i < 40; i++) {
      s = (lo + hi) / 2;
      if (bez(s, x1, x2) < t) lo = s;
      else hi = s;
    }
    return bez(s, y1, y2);
  };
}

/** Damped spring settling over the segment; ends exactly at 1. */
function spring(mass: number, stiffness: number, damping: number): EaseFn {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  return (t) => {
    if (t >= 1) return 1;
    const tau = t * 1.2; // the segment spans ~1.2 s of spring time
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * w0 * tau) * (Math.cos(wd * tau) + ((zeta * w0) / wd) * Math.sin(wd * tau));
    }
    return 1 - Math.exp(-w0 * tau) * (1 + w0 * tau);
  };
}

export function easeFn(e: Easing | undefined): EaseFn {
  if (e === undefined) return NAMED["linear"] as EaseFn;
  if (typeof e === "string") return NAMED[e] ?? (NAMED["linear"] as EaseFn);
  if ("cubicBezier" in e) return cubicBezier(...e.cubicBezier);
  if ("spring" in e) return spring(e.spring.mass, e.spring.stiffness, e.spring.damping);
  const n = e.steps;
  return (t) => Math.floor(clamp01(t) * n) / n;
}

export function isHold(e: Easing | undefined): boolean {
  return e === "hold";
}

/** Smooth 0..1 ramp, used for blends. */
export const smoothstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
