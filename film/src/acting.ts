/**
 * Acting direction (Character Acting Engine; Standard v2.1 CA-P1, CA-P2, CA-P4; CA-B1, CA-B2, CA-C4).
 *
 * `talk` with a `how` ("worry", "convince"...) is not a loop of arm poses: the intent becomes a whole-body
 * performance, deterministically:
 *
 *   posture   lean, shoulders, head, brows, mouth, eyelids: a layer added on top of mood and action (intent layer)
 *   gestures  a vocabulary per intent; every gesture has preparation, a stroke ON a stressed word, a hold and a
 *             retraction (or flows into the next); never the same gesture more than twice in 10 s
 *   rhythm    gesture rate and amplitude from the intent and its intensity; the head beats on strokes
 *   gaze      how much of the time the speaker holds the listener's eyes, and where they look away (down when
 *             worried or confessing, up and aside when thinking it through)
 *
 * The tables are the art direction of acting: tuned by eye, measured by the tests (acting.test.ts).
 */
import type { Delivery } from "./contract.js";
import { clamp, hash01, type Ease } from "./motion.js";
import type { ActorPerf } from "./perform.js";
import type { Pose } from "./rig.js";

type Ch = keyof Pose;

/** A gesture's held shape: near arm (arm, fore, hand), optionally the far arm, and a shoulder accent. */
interface GestureShape {
  arm: number;
  fore: number;
  hand: number;
  armF?: number;
  foreF?: number;
  shrug?: number;
  /** The stroke: how the forearm moves at the stroke (+ = down/out), for beat gestures. */
  beat?: number;
}

export const GESTURES = {
  open_palm: { arm: 30, fore: 70, hand: 0, armF: 18, foreF: 62, beat: -8 },
  count: { arm: 24, fore: 96, hand: 0.55, beat: 10 },
  palms_up: { arm: 20, fore: 84, hand: 0, armF: 16, foreF: 78, shrug: 0.3 },
  beat: { arm: 34, fore: 52, hand: 1, beat: 18 },
  point_forward: { arm: 58, fore: 14, hand: 0.8, beat: 6 },
  self_touch: { arm: 4, fore: 118, hand: 0.3 },
  wring: { arm: 16, fore: 92, hand: 0.7, armF: 16, foreF: 92, beat: 6 },
  small_open: { arm: 14, fore: 58, hand: 0.1 },
  rub_neck: { arm: -18, fore: 150, hand: 0.4 },
  block: { arm: 42, fore: 38, hand: 0, beat: -10 },
  sweep: { arm: 62, fore: 26, hand: 0, armF: 30, foreF: 30, beat: -14 },
  calm_down: { arm: 26, fore: 60, hand: 0, armF: 20, foreF: 56, beat: 8 },
} satisfies Record<string, GestureShape>;
export type GestureId = keyof typeof GESTURES;

interface Profile {
  gestures: GestureId[];
  /** Seconds between strokes at intensity 0.6. */
  period: number;
  /** Size of the gestures at intensity 0.6 (1 = the shapes above). */
  amp: number;
  /** Posture and face (the intent layer), at intensity 0.6. */
  posture: Partial<Record<Ch, number>>;
  /** Share of the time the eyes are on the listener. */
  eyeContact: number;
  /** Where the eyes go when they leave the listener. */
  away: "down" | "up";
  /** Head dip on a stroke, degrees (+ = down). */
  headBeat: number;
}

export const DELIVERY: Record<Delivery, Profile> = {
  explain: {
    gestures: ["open_palm", "count", "palms_up", "beat"],
    period: 1.6,
    amp: 1,
    posture: { torso: 2, head: -2, brow: -0.15, mouth: 0.2 },
    eyeContact: 0.75,
    away: "up",
    headBeat: 3,
  },
  convince: {
    gestures: ["beat", "point_forward", "open_palm", "count"],
    period: 1.2,
    amp: 1.15,
    posture: { torso: 7, head: 2, brow: 0.55, mouth: 0.15 },
    eyeContact: 0.92,
    away: "up",
    headBeat: 5,
  },
  worry: {
    gestures: ["self_touch", "wring", "small_open", "rub_neck"],
    period: 2.0,
    amp: 0.7,
    posture: { torso: 5, head: 7, shrug: 0.45, brow: -1, mouth: -0.5, lid: 0.08 },
    eyeContact: 0.45,
    away: "down",
    headBeat: 1,
  },
  question: {
    gestures: ["palms_up", "open_palm", "small_open"],
    period: 1.8,
    amp: 0.9,
    posture: { torso: 3, head: -4, brow: -0.7, mouth: 0, shrug: 0.15 },
    eyeContact: 0.85,
    away: "up",
    headBeat: 2,
  },
  reassure: {
    gestures: ["calm_down", "open_palm"],
    period: 2.2,
    amp: 0.8,
    posture: { torso: 3, head: 4, brow: -0.3, mouth: 0.6 },
    eyeContact: 0.9,
    away: "down",
    headBeat: 2,
  },
  defend: {
    gestures: ["block", "beat", "palms_up"],
    period: 1.3,
    amp: 1.05,
    posture: { torso: -5, head: -4, brow: 0.6, mouth: -0.4, shrug: 0.2 },
    eyeContact: 0.7,
    away: "up",
    headBeat: 4,
  },
  confess: {
    gestures: ["self_touch", "small_open", "palms_up"],
    period: 2.4,
    amp: 0.65,
    posture: { torso: 8, head: 11, brow: -0.7, mouth: -0.4, shrug: 0.25, lid: 0.12 },
    eyeContact: 0.3,
    away: "down",
    headBeat: 1,
  },
  announce: {
    gestures: ["sweep", "open_palm", "point_forward"],
    period: 1.5,
    amp: 1.2,
    posture: { torso: -3, head: -5, brow: 0.2, mouth: 0.45 },
    eyeContact: 0.95,
    away: "up",
    headBeat: 4,
  },
};

/** The channels of the intent layer. */
export const INTENT_CH: Ch[] = ["torso", "head", "shrug", "lid", "brow", "mouth"];

export interface GestureEvent {
  id: GestureId;
  /** Preparation starts, stroke apex, hold ends, the gesture is released (retracted or flowing on). */
  prep: number;
  stroke: number;
  hold: number;
  end: number;
  /** The word the stroke lands on, and its onset. */
  word: string;
  wordT: number;
}

export interface DeliverContext {
  words: Array<{ word: string; t: number; end: number }>;
  /** Where the listener's eyes are at t (undefined: nobody in particular). */
  listener?: ((t: number) => [number, number]) | undefined;
  gazeTo(t: number, target: [number, number]): void;
  rest(t0: number, t1: number): void;
}

/** Words worth a stroke: content words (length ≥ 4, not a function word), the longest first. */
const FUNCTION_WORDS = new Set(
  "that this with have from they them their there what when where which while would could should about into than then just your yours were been being does will".split(
    " ",
  ),
);
const stressed = (w: string): boolean => w.length >= 4 && !FUNCTION_WORDS.has(w.toLowerCase());

/**
 * Performs `talk` with an intent from t0 for `dur` seconds. Returns the end time. Arm channels belong to the
 * talk while it lasts (like the plain talk); posture and face go to the intent layer.
 */
export function deliver(
  actor: ActorPerf,
  how: Delivery,
  intensity: number,
  t0: number,
  dur: number,
  ctx: DeliverContext,
): number {
  const prof = DELIVERY[how];
  const k = 0.55 + intensity * 0.75; // 0.55 .. 1.3, 1.0 at intensity 0.6
  const end = t0 + dur;
  const c = actor.ch;
  const I = actor.intentCh;
  actor.intentOn = true;

  // ---- posture and face: in over 0.8 s (an emotional transition builds, never pops), out over 0.8 s after
  for (const ch of INTENT_CH) {
    const v = (prof.posture[ch] ?? 0) * k;
    I[ch].to(t0, t0 + 0.8, v, "io");
  }

  // ---- strokes: on stressed words, about one per period, never closer than 0.55 s
  const period = prof.period / (0.7 + intensity * 0.5);
  const inside = ctx.words.filter((w) => w.t >= t0 + 0.25 && w.t <= end - 0.35);
  const candidates = inside.filter((w) => stressed(w.word));
  const pool = candidates.length ? candidates : inside;
  const strokes: Array<{ t: number; word: string }> = [];
  let next = t0 + 0.35;
  while (next < end - 0.35) {
    const near = pool.filter(
      (w) => Math.abs(w.t - next) <= period * 0.5 && (strokes.at(-1)?.t ?? -9) + 0.55 <= w.t,
    );
    const best = near.sort(
      (a, b) => b.word.length - a.word.length || Math.abs(a.t - next) - Math.abs(b.t - next),
    )[0];
    if (best) {
      strokes.push({ t: best.t, word: best.word });
      next = best.t + period;
    } else next += period * 0.5;
  }

  // ---- gestures: preparation → stroke on the word → hold → flow into the next, or retract to rest
  const used: Array<{ id: GestureId; t: number }> = [];
  const pick = (t: number, n: number): GestureId => {
    const vocab = prof.gestures;
    for (let j = 0; j < vocab.length; j++) {
      const id = vocab[
        (Math.floor(hash01(actor.seed, n, 31) * vocab.length) + j) % vocab.length
      ] as GestureId;
      const recent = used.filter((u) => u.id === id && t - u.t < 10).length;
      const last = used.at(-1)?.id;
      if (recent < 2 && (id !== last || vocab.length === 1)) return id;
    }
    return vocab[0] as GestureId;
  };
  const amp = prof.amp * k;
  const shape = (g: GestureShape): GestureShape => ({
    arm: g.arm * amp,
    fore: g.fore * (0.6 + 0.4 * amp),
    hand: g.hand,
    ...(g.armF !== undefined ? { armF: g.armF * amp } : {}),
    ...(g.foreF !== undefined ? { foreF: g.foreF * (0.6 + 0.4 * amp) } : {}),
    ...(g.shrug !== undefined ? { shrug: g.shrug * amp } : {}),
    beat: (g.beat ?? 0) * amp,
  });
  const free = !actor.holding;
  strokes.forEach((s, n) => {
    const id = pick(s.t, n);
    used.push({ id, t: s.t });
    const g = shape(GESTURES[id]);
    // preparation: longer for a bigger move (the arm travels at a human speed, never snaps into the shape)
    const earliest = (actor.gestures.at(-1)?.hold ?? t0) + 0.02;
    const from = {
      arm: c.arm.at(Math.max(earliest, s.t - 0.32)),
      fore: c.fore.at(Math.max(earliest, s.t - 0.32)),
    };
    const travel = Math.abs(g.arm - from.arm) + Math.abs(g.fore - from.fore);
    const prepLen = clamp(0.24 + travel / 300, 0.24, 0.6);
    const prepT = Math.max(t0 + 0.02, s.t - 0.08 - prepLen, earliest);
    const nextStroke = strokes[n + 1]?.t;
    const hold = Math.min(
      s.t + 0.25 + 0.3 * (1 - intensity),
      nextStroke !== undefined ? nextStroke - 0.34 : end,
      end,
    );
    const last = nextStroke === undefined;
    const flows = !last && nextStroke - hold < 0.75;
    // released: flowing into the next preparation, retracted to a low ready pose between distant strokes, or (the
    // last one) back to rest after the talk
    const release = flows
      ? Math.max(hold, nextStroke - 0.32)
      : last
        ? Math.min(hold + 0.45, end + 0.45)
        : hold + 0.4;
    if (free) {
      const ease: Ease = "io";
      // preparation: into the gesture's shape, a little before (anticipation: the forearm cocks the other way)
      c.arm.to(prepT, s.t - 0.08, g.arm, ease);
      c.fore.to(prepT, s.t - 0.08, g.fore - (g.beat ?? 0) * 0.5, ease);
      c.hand.to(prepT, s.t - 0.08, g.hand, ease);
      // stroke: the accent lands on the word
      c.fore.then(s.t, g.fore + (g.beat ?? 0), "out");
      // hold: settles back a touch (follow-through)
      c.fore.then(hold, g.fore + (g.beat ?? 0) * 0.35, "io");
      c.arm.then(hold, g.arm, "io");
      if (g.armF !== undefined && g.foreF !== undefined) {
        c.armF.to(prepT + 0.04, s.t, g.armF, ease); // the far arm a touch later (overlap)
        c.foreF.to(prepT + 0.04, s.t, g.foreF, ease);
      }
      if (!flows && !last) {
        c.arm.then(release, 12, "io");
        c.fore.then(release, 44, "io");
        c.hand.then(release, 0.2, "io");
      }
    }
    if (g.shrug) {
      I.shrug.to(prepT, s.t, (prof.posture.shrug ?? 0) * k + g.shrug, "out");
      I.shrug.then(hold + 0.2, (prof.posture.shrug ?? 0) * k, "io");
    }
    // the head beats with the stroke
    const h = (prof.posture.head ?? 0) * k;
    I.head.to(s.t - 0.06, s.t + 0.08, h + prof.headBeat * k, "out");
    I.head.then(s.t + 0.36, h, "io");
    actor.gestures.push({ id, prep: prepT, stroke: s.t, hold, end: release, word: s.word, wordT: s.t });
  });
  if (free) ctx.rest(Math.min(end, (actor.gestures.at(-1)?.hold ?? t0) + 0.02), end + 0.45);

  // ---- gaze: hold the listener, look away between strokes as the intent says
  if (ctx.listener) {
    const listener = ctx.listener;
    ctx.gazeTo(t0, listener(t0));
    const awayShare = 1 - prof.eyeContact;
    let t = t0 + 0.9;
    let n = 0;
    while (t < end - 0.8 && awayShare > 0.05) {
      const len = clamp(0.45 + awayShare * 1.4, 0.5, 1.4);
      // a confident speaker brings the eyes back for every accent; a worried or ashamed one gestures while looking
      // away
      const clash = prof.eyeContact >= 0.6 && strokes.some((s) => s.t > t - 0.1 && s.t < t + len + 0.1);
      if (!clash && hash01(actor.seed, n, 7) < awayShare * 1.6) {
        const head = actor.headWorld(t);
        const f = actor.facingAt(t);
        const away: [number, number] =
          prof.away === "down" ? [head[0] + f * 160, head[1] + 300] : [head[0] + f * 260, head[1] - 220];
        ctx.gazeTo(t, away);
        ctx.gazeTo(t + len, listener(t + len));
        t += len + 0.6;
      } else t += 0.5;
      n++;
    }
  }

  // ---- lip-sync (as the plain talk)
  for (const w of ctx.words.filter((w) => w.t >= t0 && w.t < end)) {
    c.open.to(w.t, w.t + 0.06, 0.55 + hash01(w.t * 10) * 0.4, "out");
    c.open.then((w.t + w.end) / 2 + 0.02, 0.25);
    c.open.then(w.end, 0, "in");
  }

  // ---- out of the intent: the posture eases back once the talk is over
  for (const ch of INTENT_CH) I[ch].then(end + 0.8, 0, "io");
  return end;
}

/** Physical beats of a reaction, by the mood it lands in: anticipation, accent, then the mood settles. */
export const REACTION: Record<
  string,
  { torso: number; head: number; brow: number; lid: number; hand: number }
> = {
  anxious: { torso: -6, head: -7, brow: -1.1, lid: -0.15, hand: 0.6 },
  sad: { torso: 6, head: 10, brow: -0.9, lid: 0.2, hand: 0.2 },
  tired: { torso: 6, head: 8, brow: -0.3, lid: 0.3, hand: 0 },
  hopeful: { torso: -5, head: -8, brow: -0.6, lid: -0.1, hand: 0 },
  happy: { torso: -6, head: -8, brow: -0.5, lid: -0.1, hand: 0 },
  determined: { torso: -4, head: -3, brow: 0.9, lid: 0, hand: 1 },
  thinking: { torso: 2, head: -9, brow: -0.4, lid: 0.05, hand: 0.3 },
  neutral: { torso: -3, head: -4, brow: -0.4, lid: -0.1, hand: 0 },
};
