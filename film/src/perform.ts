/**
 * Performance: turns the verbs of a shot ("look at the window", "stand up", "pick up the cup", "give the CV to
 * Maria") into key poses on the rig's channels. Layers: stance and locomotion (legs, hips), gestures and reaching
 * (arms, via two-bone IK), gaze (eyes lead, the head follows), face, mood (a posture that colours everything), and
 * micro-acting (breath, blinks, weight shifts, small head moves) so nobody ever freezes.
 */
import { Mood, type Action, type ActorPlacement, type CastMember, type Shot } from "./contract.js";
import { EASES, K, clamp, hash01, type Ease, type Key } from "./motion.js";
import type { Garment } from "@erkasa/contracts";
import {
  CLOTH_LAG,
  drawPerson,
  featuresOf,
  isDressedLook,
  lookFor,
  swayOf,
  reachArm,
  RIG,
  skeleton,
  SEATED,
  STANDING,
  toLocal,
  toWorld,
  type Drawn,
  type Look,
  type Placed,
  type Pose,
} from "./rig.js";
import { type SetDef, standingHipY } from "./sets.js";
import type { Carry, CharacterState } from "./continuity.js";
import type { PropKind } from "./props.js";
import type { Worn } from "./wardrobe.js";
import { deliver, INTENT_CH, REACTION, type GestureEvent } from "./acting.js";

export interface Issue {
  level: "error" | "warning";
  code: string;
  path: string;
  message: string;
}

type Ch = keyof Pose;

/** Posture of each mood, added on top of every pose. */
const MOOD: Record<Mood, Partial<Pose>> = {
  neutral: {},
  tired: { torso: 7, head: 9, shrug: -0.35, lid: 0.28, brow: -0.25, mouth: -0.3 },
  sad: { torso: 9, head: 13, shrug: -0.2, lid: 0.18, brow: -0.8, mouth: -0.8, gy: 0.5 },
  anxious: { torso: 3, head: 4, shrug: 0.55, brow: -1, mouth: -0.45 },
  hopeful: { torso: -2, head: -7, brow: -0.45, mouth: 0.45 },
  determined: { torso: -3, head: -3, brow: 0.8, mouth: 0.1 },
  happy: { torso: -2, head: -4, brow: -0.3, mouth: 1 },
  thinking: { head: -8, gy: -0.5, brow: -0.25, mouth: -0.1 },
};
const MOOD_CH: Ch[] = ["torso", "head", "shrug", "lid", "brow", "mouth", "gy"];

/** Walk cycle key poses of one leg over a cycle (phase 0..1): contact, recoil, push-off, swing, passing, reach. */
const WALK_THIGH: Array<[number, number]> = [
  [0, 18],
  [0.22, 6],
  [0.48, -18],
  [0.62, -8],
  [0.8, 12],
  [0.95, 20],
  [1, 18],
];
const WALK_SHIN: Array<[number, number]> = [
  [0, -3],
  [0.22, -14],
  [0.48, -8],
  [0.62, -52],
  [0.78, -40],
  [0.9, -16],
  [1, -3],
];
const CYCLE = 1.25; // seconds per two steps
const STRIDE = 2 * 2 * (RIG.thigh + RIG.shin) * Math.sin((18 * Math.PI) / 180); // world px per cycle at scale 1
export const WALK_SPEED = STRIDE / CYCLE;

const cyc = (keys: Array<[number, number]>, ph: number): number => {
  const x = ((ph % 1) + 1) % 1;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1] as [number, number];
    const b = keys[i] as [number, number];
    if (x <= b[0]) return a[1] + (b[1] - a[1]) * EASES.io((x - a[0]) / (b[0] - a[0] || 1));
  }
  return (keys[0] as [number, number])[1];
};

class Track {
  keys: Key[];
  constructor(v: number) {
    this.keys = [[0, v]];
  }
  at(t: number): number {
    return K(t, this.keys);
  }
  /** Hold the current value until t0, then move to v by t1. Later keys are replaced (a new action overrides). */
  to(t0: number, t1: number, v: number, ease: Ease = "io"): void {
    // a change that starts at the shot's first instant and lasts under a frame is the starting state, not a move:
    // it holds from frame 0 (before: frame 0 showed the body before its state, then it jumped on frame 1)
    if (t0 <= 0 && t1 <= 0.02) {
      this.keys = [[0, v]];
      return;
    }
    const cur = this.at(t0);
    this.keys = this.keys.filter((k) => k[0] < t0);
    this.keys.push([t0, cur], [Math.max(t0 + 1e-3, t1), v, ease]);
  }
  /** Append a key after the last one. */
  then(t: number, v: number, ease: Ease = "io"): void {
    const last = this.keys[this.keys.length - 1] as Key;
    if (t <= last[0]) this.keys = this.keys.filter((k) => k[0] < t);
    this.keys.push([t, v, ease]);
  }
}

export interface Walk {
  t0: number;
  t1: number;
  /** Seconds per two steps, stride scale and arm swing of this walk (from the walker's mood). */
  cycle: number;
  amp: number;
  arm: number;
  lean: number;
}

/** How a mood walks: slower and shorter when low, longer and faster when resolved. */
export const GAIT: Record<Mood, { cycle: number; amp: number; arm: number; lean: number }> = {
  neutral: { cycle: 1.2, amp: 1, arm: 0.9, lean: 3 },
  tired: { cycle: 1.55, amp: 0.78, arm: 0.45, lean: 7 },
  sad: { cycle: 1.5, amp: 0.8, arm: 0.45, lean: 8 },
  anxious: { cycle: 1.05, amp: 0.82, arm: 0.55, lean: 5 },
  hopeful: { cycle: 1.15, amp: 1.05, arm: 1, lean: 1 },
  determined: { cycle: 1.02, amp: 1.12, arm: 1.15, lean: 5 },
  happy: { cycle: 1.1, amp: 1.05, arm: 1.1, lean: 0 },
  thinking: { cycle: 1.4, amp: 0.9, arm: 0.6, lean: 3 },
};

export interface PropState {
  kind: PropKind;
  /** Attach events: who holds it from t (null = rests at `at`). */
  events: Array<{ t: number; holder: string | null; at: [number, number] }>;
}

/** Two-bone leg IK, knee forward: thigh angle (0 = down, + forward) and shin angle relative to the thigh. */
export function solveLeg(hip: [number, number], target: [number, number]): { thigh: number; shin: number } {
  const L1 = RIG.thigh;
  const L2 = RIG.shin;
  const dx = target[0] - hip[0];
  const dy = target[1] - hip[1];
  const d = Math.max(20, Math.min(L1 + L2 - 0.5, Math.hypot(dx, dy)));
  const deg = (r: number): number => (r * 180) / Math.PI;
  const alpha = deg(Math.atan2(dx, dy));
  const beta = deg(Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)))));
  const gamma = deg(Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2)))));
  return { thigh: alpha + beta, shin: -(180 - gamma) };
}

export class ActorPerf {
  readonly id: string;
  readonly look: Look;
  readonly scale = 1;
  ch = {} as Record<Ch, Track>;
  moodCh = {} as Record<Ch, Track>;
  x: Track;
  y: Track;
  turn = new Track(1);
  glow = new Track(0);
  facings: Array<{ t: number; f: 1 | -1 }>;
  walks: Walk[] = [];
  seated: Array<{ t: number; v: boolean }>;
  /** Where the gaze rests when nothing else is looked at. */
  gazeHome: [number, number] | undefined;
  holding: string | undefined;
  seed: number;
  /** What the person did and when (for continuity: an action still going at a cut). */
  acts: Array<{ kind: string; t0: number; t1: number; target?: string }> = [];
  /** A walk that was going on when the previous shot cut: the next walk picks up its stride and speed. */
  continueWalk: { elapsed: number; speed: number } | undefined;
  /** Where the eyes were sent and when. */
  gazes: Array<{ t: number; at: [number, number] }> = [];
  /** The mood the person is in (latest set), for how they move. */
  moods: Array<{ t: number; m: Mood }> = [];
  /** The intent layer (acting.ts): posture and face of what the person wants, on top of mood and actions. */
  intentCh = {} as Record<Ch, Track>;
  /** Whether this person has an intent at all (the layer is added only then: the plain films stay bit for bit). */
  intentOn = false;
  /** Every gesture delivered with an intent, for continuity and measurement. */
  gestures: GestureEvent[] = [];

  constructor(p: ActorPlacement, cast: CastMember | undefined, set: SetDef, idx: number, worn?: Garment[]) {
    this.id = p.id;
    this.look = lookFor({ ...(cast ?? { build: "man" }), wardrobe: worn, features: featuresOf(cast) });
    const mark = set.marks[p.at];
    const facing = (p.facing ? (p.facing === "right" ? 1 : -1) : (mark?.facing ?? 1)) as 1 | -1;
    const seated = p.pose === "seated";
    const base = seated ? SEATED : STANDING;
    for (const c of Object.keys(base) as Ch[]) {
      this.ch[c] = new Track(base[c]);
      this.moodCh[c] = new Track(0);
      this.intentCh[c] = new Track(0);
    }
    const mx = mark?.x ?? set.w / 2;
    this.x = new Track(seated ? mx + 30 * facing : mx);
    this.y = new Track(seated ? (mark?.seatY ?? set.floor - 300) : standingHipY(set));
    this.facings = [{ t: 0, f: facing }];
    this.seated = [{ t: 0, v: seated }];
    this.gazeHome = mark?.look;
    this.holding = p.holding;
    this.seed = idx * 101 + p.id.length * 7;
    this.setMood(0, p.mood, 0.01);
  }

  facingAt(t: number): 1 | -1 {
    let f: 1 | -1 = 1;
    for (const e of this.facings) if (e.t <= t) f = e.f;
    return f;
  }
  seatedAt(t: number): boolean {
    let v = false;
    for (const e of this.seated) if (e.t <= t) v = e.v;
    return v;
  }
  placed(t: number): Placed {
    return {
      x: this.x.at(t),
      y: this.y.at(t) + this.bob(t),
      facing: this.facingAt(t),
      turn: this.turn.at(t),
      scale: this.scale,
    };
  }
  headWorld(t: number): [number, number] {
    const pl = this.placed(t);
    return [pl.x + pl.facing * 30, pl.y - 345];
  }

  moodAt(t: number): Mood {
    let m: Mood = this.moods[0]?.m ?? "neutral";
    for (const e of this.moods) if (e.t <= t) m = e.m;
    return m;
  }

  setMood(t: number, mood: Mood, dur = 0.7): void {
    this.moods.push({ t, m: mood });
    this.moods.sort((p, q) => p.t - q.t);
    const m = MOOD[mood];
    for (const c of MOOD_CH) this.moodCh[c].to(t, t + dur, m[c] ?? 0);
  }

  bob(t: number): number {
    for (const w of this.walks)
      if (t >= w.t0 && t <= w.t1) {
        const k = Math.min(1, (t - w.t0) / 0.3, (w.t1 - t) / 0.3);
        return (Math.abs(Math.sin(((t - w.t0) / w.cycle) * 2 * Math.PI)) * -8 + 4) * w.amp * k;
      }
    return 0;
  }

  /** The pose at t: tracks + walk cycle + mood + micro-acting. */
  /**
   * The pose at t with planted feet: while walking, the leg that carries the weight is solved (two-bone IK)
   * so its foot stays where it touched the floor, whatever the body does; the swinging leg follows the cycle.
   */
  pose(t: number): Pose {
    const p = this.rawPose(t);
    for (const w of this.walks) {
      if (t < w.t0 || t > w.t1) continue;
      for (const near of [true, false]) {
        const st = this.stance(w, t, near);
        if (!st) continue;
        const target = toLocal(this.placed(t), this.footWorld(Math.max(0, st.contact), near));
        const leg = solveLeg(near ? [6, 0] : [0, 0], target);
        const k = st.weight;
        if (near) {
          p.thigh = p.thigh * (1 - k) + leg.thigh * k;
          p.shin = p.shin * (1 - k) + leg.shin * k;
        } else {
          p.thighF = p.thighF * (1 - k) + leg.thigh * k;
          p.shinF = p.shinF * (1 - k) + leg.shin * k;
        }
      }
    }
    return p;
  }

  /**
   * Is this leg carrying the weight at t? The near leg lands at the start of each cycle, the far leg half a cycle
   * later; a leg stays planted for half a cycle, then is released over 0.15 s (no pop into the swing).
   */
  stance(w: Walk, t: number, near: boolean): { contact: number; weight: number } | undefined {
    const off = near ? 0 : 0.5 * w.cycle;
    const n = Math.floor((t - w.t0 - off) / w.cycle);
    if (n < 0) return undefined;
    const contact = w.t0 + off + n * w.cycle;
    if (contact > w.t1) return undefined;
    const end = contact + 0.5 * w.cycle;
    // the last step settles: the weight blends back to both feet as the gait fades out
    const settle = Math.max(0, Math.min(1, (w.t1 - t) / 0.3));
    if (t < end) return { contact, weight: settle };
    if (t < end + 0.15) return { contact, weight: (1 - (t - end) / 0.15) * settle };
    return undefined;
  }

  /** World position of a foot (ankle) in the uncorrected pose: where it lands. */
  footWorld(t: number, near: boolean): [number, number] {
    const sk = skeleton(this.rawPose(t));
    return toWorld(this.placed(t), near ? sk.ankle : sk.ankleF);
  }

  rawPose(t: number): Pose {
    const p = {} as Pose;
    for (const c of Object.keys(this.ch) as Ch[]) p[c] = this.ch[c].at(t) + this.moodCh[c].at(t);
    if (this.intentOn) for (const c of INTENT_CH) p[c] += this.intentCh[c].at(t);
    for (const w of this.walks) {
      if (t >= w.t0 && t <= w.t1) {
        const k = Math.min(1, (t - w.t0) / 0.3, (w.t1 - t) / 0.3);
        const ph = (t - w.t0) / w.cycle;
        p.thigh = p.thigh * (1 - k) + cyc(WALK_THIGH, ph) * w.amp * k;
        p.shin = p.shin * (1 - k) + cyc(WALK_SHIN, ph) * w.amp * k;
        p.thighF = p.thighF * (1 - k) + cyc(WALK_THIGH, ph + 0.5) * w.amp * k;
        p.shinF = p.shinF * (1 - k) + cyc(WALK_SHIN, ph + 0.5) * w.amp * k;
        if (!this.holding) {
          // arms swing against the legs, the far arm a touch later (overlap)
          p.arm = p.arm * (1 - k) + -cyc(WALK_THIGH, ph - 0.03) * w.arm * k;
          p.armF = p.armF * (1 - k) + -cyc(WALK_THIGH, ph + 0.47) * w.arm * k;
          p.fore = p.fore * (1 - k) + (14 + 10 * Math.max(0, -Math.sin(ph * 2 * Math.PI))) * k;
          p.foreF = p.foreF * (1 - k) + (14 + 10 * Math.max(0, Math.sin(ph * 2 * Math.PI))) * k;
        }
        // lean into the walk; a little more on the first steps (taking the weight)
        const start = Math.max(0, 1 - (t - w.t0) / 0.6);
        p.torso += (w.lean + 5 * start) * k;
        // the head stays level: it counters part of the body's lean and bobs a little late
        p.head -= w.lean * 0.45 * k;
        p.head += Math.sin(((t - w.t0) / w.cycle) * 4 * Math.PI - 0.6) * 1.2 * k;
      }
      // follow-through after a stop: the torso rocks back past upright and settles
      if (t > w.t1 && t < w.t1 + 0.6) {
        const u = (t - w.t1) / 0.6;
        p.torso += -4 * Math.sin(u * Math.PI) * (1 - u) * w.amp;
        p.head += 2.5 * Math.sin(u * Math.PI * 1.4) * (1 - u);
      }
    }
    // micro-acting: breath, blinks, weight shifts, small head moves and eye darts (seeded, deterministic)
    p.breath = 0.5 + 0.5 * Math.sin(t * 1.7 + this.seed);
    const blinkEvery = 2.6 + hash01(this.seed) * 1.8;
    const bt = (t + hash01(this.seed, 1) * blinkEvery) % blinkEvery;
    if (bt < 0.14) p.lid = Math.max(p.lid, 1 - Math.abs(bt - 0.07) / 0.07);
    const beat = Math.floor(t / 2.3);
    const into = t - beat * 2.3;
    const shift = (n: number): number => (hash01(this.seed, n, 7) - 0.5) * 2;
    const k = clamp(into / 0.6);
    const ease = EASES.io(k);
    const prev = shift(beat - 1);
    const cur = shift(beat);
    p.head += (prev + (cur - prev) * ease) * 2.2;
    p.torso += (prev + (cur - prev) * ease) * (this.seatedAt(t) ? 0.8 : 1.6);
    p.gx += shift(beat * 3 + 1) * 0.15 * ease;
    return p;
  }

  draw(t: number): Drawn {
    const pl = this.placed(t);
    const sway = isDressedLook(this.look) ? swayOf(this.placed(t - CLOTH_LAG).x, pl.x, pl.facing) : 0;
    return drawPerson(this.pose(t), pl, this.look, { glow: this.glow.at(t), id: this.id, sway });
  }
}

export interface Performance {
  actors: Map<string, ActorPerf>;
  props: Map<string, PropState>;
  door: Track;
  /** Local times of visible events (for the dead-time check). */
  events: number[];
  issues: Issue[];
}

export interface PerformContext {
  set: SetDef;
  shot: Shot;
  path: string;
  dur: number;
  cast: CastMember[];
  /** Local time of an anchor, or undefined if it cannot be resolved. */
  at(anchor: string): number | undefined;
  /** Words spoken inside the shot, local times (for lip-sync). */
  words: Array<{ word: string; t: number; end: number }>;
  /** Where the previous shot on this set left people and props (continuity.ts). Absent: start from the plan. */
  carry?: Carry;
  /** What each person wears in this shot (wardrobe.ts); people absent keep the plain look. */
  wardrobe?: Map<string, Worn> | undefined;
}

const GESTURE_SEC: Partial<Record<Action["do"], number>> = {
  sigh: 1.8,
  nod: 1.0,
  shake_head: 1.2,
  shrug: 1.2,
  hand_on_face: 2.0,
  point: 1.6,
  glance: 1.4,
  hesitate: 2.2,
  lean_in: 1.2,
};

/** Builds the performance of a staged shot. */
export function perform(ctx: PerformContext): Performance {
  const { set, shot } = ctx;
  const issues: Issue[] = [];
  const events: number[] = [0];
  const actors = new Map<string, ActorPerf>();
  shot.actors.forEach((p, i) => {
    if (!set.marks[p.at])
      issues.push({
        level: "error",
        code: "MARK_UNKNOWN",
        path: `${ctx.path}.actors[${i}].at`,
        message: `set ${set.id} has no mark '${p.at}' (marks: ${Object.keys(set.marks).join(", ")})`,
      });
    const m = set.marks[p.at];
    if (m && p.pose === "seated" && m.kind !== "seat")
      issues.push({
        level: "error",
        code: "NOT_A_SEAT",
        path: `${ctx.path}.actors[${i}].pose`,
        message: `mark '${p.at}' is not a seat`,
      });
    actors.set(
      p.id,
      new ActorPerf(
        p,
        ctx.cast.find((c) => c.id === p.id),
        set,
        i,
        ctx.wardrobe?.get(p.id)?.garments,
      ),
    );
  });
  const props = new Map<string, PropState>();
  for (const [id, pr] of Object.entries(set.props))
    props.set(id, { kind: pr.kind, events: [{ t: 0, holder: null, at: [pr.x, pr.y] }] });
  for (const a of actors.values()) {
    if (a.holding) {
      const pr = props.get(a.holding);
      if (!pr)
        issues.push({
          level: "error",
          code: "PROP_UNKNOWN",
          path: `${ctx.path}.actors`,
          message: `set ${set.id} has no prop '${a.holding}'`,
        });
      else {
        pr.events = [{ t: 0, holder: a.id, at: [0, 0] }];
        holdPose(a, 0, 0.01);
      }
    }
  }
  const door = new Track(0);

  // ---- continuity: pick people and props up where the previous shot on this set left them
  const injected: Array<{ a: Action; i: number; t: number }> = [];
  const carried = new Set<string>();
  if (ctx.carry && shot.continuity !== "reset") {
    for (const [id, cp] of Object.entries(ctx.carry.props)) {
      const pr = props.get(id);
      if (pr)
        pr.events = [{ t: 0, holder: cp.holder && actors.has(cp.holder) ? cp.holder : null, at: cp.at }];
    }
    shot.actors.forEach((placement, i) => {
      const a = actors.get(placement.id);
      const cs = ctx.carry?.actors[placement.id];
      if (!a || !cs) return;
      carried.add(a.id);
      carryInto(a, cs, placement, i);
    });
  }

  function carryInto(
    a: ActorPerf,
    cs: CharacterState,
    placement: (typeof shot.actors)[number],
    i: number,
  ): void {
    // the plan said where this person is; continuity says where they actually are
    const m = set.marks[placement.at];
    const planned = m ? (placement.pose === "seated" ? m.x + 30 * m.facing : m.x) : cs.x;
    // already on the way there (walking to it, or halfway into the seat) is not a contradiction
    const goingThere =
      (cs.action?.kind === "walk_to" && cs.action.target === placement.at) ||
      (cs.movement === "sitting_down" && placement.pose === "seated" && m?.kind === "seat") ||
      (cs.movement === "standing_up" && placement.pose !== "seated");
    if (Math.abs(planned - cs.x) > 40 && !goingThere)
      issues.push({
        level: "error",
        code: "PLACEMENT_CONTRADICTS_CONTINUITY",
        path: `${ctx.path}.actors[${i}]`,
        message: `${a.id} is at x=${cs.x.toFixed(0)} when the previous shot cuts, but this shot places them at '${placement.at}' (x=${planned.toFixed(0)}); walk them there, or declare continuity "reset" if time has passed`,
      });
    if (
      (placement.pose === "seated") !== cs.seated &&
      cs.movement !== "sitting_down" &&
      cs.movement !== "standing_up" &&
      !goingThere
    )
      issues.push({
        level: "error",
        code: "PLACEMENT_CONTRADICTS_CONTINUITY",
        path: `${ctx.path}.actors[${i}].pose`,
        message: `${a.id} is ${cs.seated ? "seated" : "standing"} when the previous shot cuts, but this shot has them ${placement.pose}`,
      });
    a.x = new Track(cs.x);
    a.y = new Track(cs.y);
    a.facings = [{ t: 0, f: cs.facing }];
    a.seated = [{ t: 0, v: cs.seated }];
    // the pose continues from the last frame and settles into this shot's starting pose
    const base = cs.seated ? SEATED : STANDING;
    for (const c of Object.keys(a.ch) as Ch[]) {
      const v = cs.channels[c];
      if (v === undefined) continue;
      a.ch[c] = new Track(v);
      if (c !== "thigh" && c !== "shin" && c !== "thighF" && c !== "shinF")
        a.ch[c].to(0, 0.45, base[c], "io");
    }
    // the feeling continues; if the plan wants another one, it arrives on screen, not on the cut
    a.moods = [];
    a.setMood(0, cs.mood, 0.01);
    if (placement.mood !== cs.mood) a.setMood(0.05, placement.mood, 0.7);
    // the intent goes on through the cut, then relaxes unless the shot gives the person a new one (W2)
    if (cs.intent) {
      a.intentOn = true;
      for (const c of INTENT_CH) {
        a.intentCh[c] = new Track(cs.intent[c] ?? 0);
        a.intentCh[c].then(1.2, 0, "io");
      }
    }
    a.gazeHome = cs.gaze ?? a.gazeHome;
    if (cs.gaze) a.gazes = [{ t: 0, at: cs.gaze }];
    if (cs.holding) {
      a.holding = cs.holding;
      const pr = props.get(cs.holding);
      if (pr) pr.events = [{ t: 0, holder: a.id, at: [0, 0] }];
    }
    // an action that was still going does not vanish at the cut
    const own = shot.actions.filter((x) => x.who === a.id).map((x) => ({ x, t: ctx.at(x.at) ?? 99 }));
    const first = own.sort((p, q) => p.t - q.t)[0];
    if (cs.action?.kind === "walk_to" && cs.action.progress < 0.98 && cs.walk) {
      a.continueWalk = { elapsed: cs.walk.elapsed, speed: Math.abs(cs.walk.speed) };
      if (!(first && first.t < 0.1 && first.x.do === "walk_to"))
        injected.push({
          a: { who: a.id, do: "walk_to", target: cs.action.target, at: "start" } as Action,
          i: -1,
          t: 0,
        });
    } else if (cs.movement === "sitting_down") {
      const seatMark = Object.values(set.marks).find(
        (mk) => mk.kind === "seat" && Math.abs(mk.x + 30 * mk.facing - cs.x) < 160,
      );
      a.seated = [{ t: 0, v: false }];
      const done = sitDown(
        a,
        0,
        ctx.path,
        seatMark ? seatMark.x + 30 * seatMark.facing : undefined,
        seatMark?.seatY,
      );
      a.acts.push({
        kind: cs.action?.kind ?? "sit_down",
        t0: 0,
        t1: done,
        ...(cs.action?.target ? { target: cs.action.target } : {}),
      });
    } else if (cs.movement === "standing_up") {
      a.y.to(0, 0.5, standingHipY(set), "out");
      for (const c of ["thigh", "shin", "thighF", "shinF"] as Ch[]) a.ch[c].to(0, 0.5, STANDING[c], "out");
      a.seated = [{ t: 0.2, v: false }];
      a.acts.push({
        kind: cs.action?.kind ?? "stand_up",
        t0: 0,
        t1: 0.5,
        ...(cs.action?.target ? { target: cs.action.target } : {}),
      });
    }
  }

  const point = (target: string | undefined, t: number): [number, number] | undefined => {
    if (!target) return undefined;
    const actor = actors.get(target);
    if (actor) return actor.headWorld(t);
    const pr = props.get(target);
    if (pr) return propAt(pr, t, actors);
    const m = set.marks[target];
    if (m) return m.look ?? [m.x, set.floor - 420];
    return set.targets[target];
  };

  // initial gaze: what each person's mark looks at, or straight ahead
  for (const a of actors.values()) if (a.gazeHome && !carried.has(a.id)) gazeTo(a, 0, a.gazeHome, 0.01);

  // `then`: an action that waits for the same person's previous action in the plan (performance sequencing)
  const followers = new Map<number, Array<{ a: Action; i: number }>>();
  shot.actions.forEach((a, i) => {
    if (a.at !== "then") return;
    let j = i - 1;
    while (j >= 0 && (shot.actions[j] as Action).who !== a.who) j--;
    if (j < 0)
      issues.push({
        level: "error",
        code: "ANCHOR_UNRESOLVED",
        path: `${ctx.path}.actions[${i}].at`,
        message: `'then' needs an earlier action of ${a.who ?? "the same person"} in this shot`,
      });
    else followers.set(j, [...(followers.get(j) ?? []), { a, i }]);
  });
  const sorted: Array<{ a: Action; i: number; t: number | undefined }> = shot.actions
    .map((a, i) => ({ a, i, t: a.at === "then" ? -1 : ctx.at(a.at) }))
    .filter((x) => x.t !== -1)
    .filter((x) => {
      if (x.t === undefined)
        issues.push({
          level: "error",
          code: "ANCHOR_UNRESOLVED",
          path: `${ctx.path}.actions[${x.i}].at`,
          message: `'${x.a.at}' is not in this shot's narration`,
        });
      return x.t !== undefined;
    })
    .concat(injected)
    .sort((p, q) => (p.t as number) - (q.t as number));

  while (sorted.length) {
    const { a, i, t: t0r } = sorted.shift() as (typeof sorted)[number];
    const t0 = Math.max(0, Math.min(ctx.dur - 0.2, t0r as number));
    const path = `${ctx.path}.actions[${i}]`;
    events.push(t0);
    if (a.do === "open") {
      if (t0 < 0.05)
        door.to(0, 0.001, 1, "lin"); // already open when the shot begins
      else door.to(t0, t0 + 0.7, 1, "back");
      continue;
    }
    const actor = a.who ? actors.get(a.who) : undefined;
    if (!actor) {
      issues.push({
        level: "error",
        code: "WHO_UNKNOWN",
        path,
        message: `'${a.who ?? ""}' is not in this shot (actors: ${[...actors.keys()].join(", ")})`,
      });
      continue;
    }
    const tgt = point(a.target, t0);
    const needsTarget = [
      "look",
      "glance",
      "walk_to",
      "pick_up",
      "give",
      "lean_in",
      "hesitate",
      "point",
      "turn_to",
    ].includes(a.do);
    if (needsTarget && !tgt && !(a.do === "walk_to" && a.target && set.marks[a.target]))
      issues.push({
        level: "error",
        code: "TARGET_UNKNOWN",
        path,
        message: `'${a.target ?? ""}' is not a mark, prop, person or target of set ${set.id}`,
      });
    const dur = a.sec ?? GESTURE_SEC[a.do] ?? 1.2;
    const before = actor.gestures.length;
    const end = do_(a, actor, t0, dur, tgt, path);
    // every gesture stroke of an intent is something the viewer sees happen
    for (const g of actor.gestures.slice(before)) events.push(g.stroke);
    actor.acts.push({
      kind: a.do,
      t0,
      t1: Math.max(end, t0 + 0.05),
      ...(a.target ? { target: a.target } : {}),
    });
    events.push(end);
    // the actions waiting for this one start as it ends, a few frames into its settle (overlapping action)
    for (const f of followers.get(i) ?? []) {
      const t = Math.max(t0 + 0.05, end - 0.1);
      const k = sorted.findIndex((x) => (x.t as number) > t);
      sorted.splice(k < 0 ? sorted.length : k, 0, { a: f.a, i: f.i, t });
    }
  }

  function do_(
    a: Action,
    actor: ActorPerf,
    t0: number,
    dur: number,
    tgt: [number, number] | undefined,
    path: string,
  ): number {
    const c = actor.ch;
    switch (a.do) {
      case "look":
        if (tgt) gazeTo(actor, t0, tgt);
        return t0 + 0.6;
      case "glance": {
        if (!tgt) return t0;
        const back = actor.gazeHome;
        gazeTo(actor, t0, tgt);
        if (back) gazeTo(actor, t0 + dur, back);
        return t0 + dur + 0.6;
      }
      case "mood":
        actor.setMood(t0, (a.target as Mood | undefined) ?? "neutral");
        return t0 + 0.7;
      case "glow":
        actor.glow.to(t0, t0 + 0.8, 1, "back");
        return t0 + 0.8;
      case "sigh":
        c.shrug.to(t0, t0 + 0.55, 0.9, "io");
        c.shrug.then(t0 + 0.75, 0.9);
        c.shrug.then(t0 + 1.6, -0.5, "out");
        c.lid.to(t0 + 0.3, t0 + 0.6, 0.55);
        c.lid.then(t0 + 1.3, 0.55);
        c.lid.then(t0 + 1.6, 0);
        c.head.to(t0 + 0.6, t0 + 1.4, c.head.at(t0) + 6, "out");
        return t0 + 1.6;
      case "type":
      case "write": {
        if (!actor.seatedAt(t0))
          issues.push({
            level: "warning",
            code: "TYPE_STANDING",
            path,
            message: `${actor.id} types while standing`,
          });
        const work = workPoint(actor, t0);
        const step = a.do === "type" ? 0.16 : 0.32;
        reach(actor, t0, t0 + 0.4, work);
        for (let s = t0 + 0.4; s < t0 + dur; s += step) {
          const j = Math.floor((s - t0) / step) % 2 ? 1 : -1;
          c.fore.then(s + step, c.fore.at(t0 + 0.4) + j * (a.do === "type" ? 5 : 3), "io");
        }
        c.head.to(t0, t0 + 0.4, 10);
        return t0 + dur;
      }
      case "stand_up":
        return standUp(actor, t0, path);
      case "sit_down":
        return sitDown(actor, t0, path);
      case "walk_to": {
        const m = a.target ? set.marks[a.target] : undefined;
        if (!m) return t0;
        let t = t0;
        if (actor.seatedAt(t)) t = standUp(actor, t, path);
        const toX = m.kind === "seat" ? m.x + 150 * m.facing : m.x;
        t = walkTo(actor, t, toX);
        if (actor.facingAt(t) !== m.facing) t = turn(actor, t, m.facing);
        if (m.look) gazeTo(actor, t, m.look);
        actor.gazeHome = m.look;
        if (m.kind === "seat") t = sitDown(actor, t, path, m.x + 30 * m.facing, m.seatY);
        return t;
      }
      case "pick_up": {
        const pr = a.target ? props.get(a.target) : undefined;
        if (!pr || !a.target) {
          issues.push({
            level: "error",
            code: "PROP_UNKNOWN",
            path,
            message: `set ${set.id} has no prop '${a.target ?? ""}'`,
          });
          return t0;
        }
        const at = propAt(pr, t0, actors);
        if (!within(actor, t0, at)) {
          issues.push({
            level: "error",
            code: "OUT_OF_REACH",
            path,
            message: `${a.target} is out of ${actor.id}'s reach; walk_to a mark next to it first`,
          });
          return t0;
        }
        gazeTo(actor, t0, at);
        c.torso.to(t0, t0 + 0.45, c.torso.at(t0) + 8, "out");
        reach(actor, t0 + 0.1, t0 + 0.55, at, "back");
        c.hand.to(t0 + 0.5, t0 + 0.6, 1);
        pr.events.push({ t: t0 + 0.58, holder: actor.id, at });
        actor.holding = a.target;
        c.torso.then(t0 + 1.1, c.torso.at(t0), "io");
        holdPose(actor, t0 + 0.6, t0 + 1.15);
        if (actor.gazeHome) gazeTo(actor, t0 + 1.0, actor.gazeHome);
        return t0 + 1.2;
      }
      case "put_down": {
        const id = actor.holding;
        const pr = id ? props.get(id) : undefined;
        if (!pr || !id) {
          issues.push({
            level: "warning",
            code: "NOTHING_HELD",
            path,
            message: `${actor.id} holds nothing to put down`,
          });
          return t0;
        }
        const m = a.target ? set.marks[a.target] : undefined;
        const rest = pr.events.find((e) => e.holder === null)?.at;
        const at: [number, number] | undefined = m?.surfaceY !== undefined ? [m.x, m.surfaceY - 28] : rest;
        if (!at || !within(actor, t0, at)) {
          issues.push({
            level: "error",
            code: "OUT_OF_REACH",
            path,
            message: `${actor.id} cannot reach '${a.target ?? "where it was"}' from here`,
          });
          return t0;
        }
        gazeTo(actor, t0, at);
        reach(actor, t0, t0 + 0.55, at, "out");
        pr.events.push({ t: t0 + 0.6, holder: null, at });
        actor.holding = undefined;
        c.hand.to(t0 + 0.6, t0 + 0.7, 0);
        restArms(actor, t0 + 0.7, t0 + 1.2);
        if (actor.gazeHome) gazeTo(actor, t0 + 1.0, actor.gazeHome);
        return t0 + 1.2;
      }
      case "drink": {
        if (!actor.holding) {
          issues.push({
            level: "warning",
            code: "NOTHING_HELD",
            path,
            message: `${actor.id} drinks with nothing in the hand`,
          });
          return t0;
        }
        const pl = actor.placed(t0);
        const mouth: [number, number] = [pl.x + pl.facing * 70, pl.y - 318];
        reach(actor, t0, t0 + 0.5, mouth, "out");
        c.head.to(t0 + 0.2, t0 + 0.6, -12);
        c.head.then(t0 + 1.3, -12);
        c.head.then(t0 + 1.7, c.head.at(t0));
        c.lid.to(t0 + 0.4, t0 + 0.6, 0.6);
        c.lid.then(t0 + 1.3, 0.6);
        c.lid.then(t0 + 1.5, 0);
        holdPose(actor, t0 + 1.3, t0 + 1.8);
        return t0 + 1.8;
      }
      case "give": {
        const other = a.target ? actors.get(a.target) : undefined;
        const id = actor.holding;
        const pr = id ? props.get(id) : undefined;
        if (!other || !pr || !id) {
          issues.push({
            level: "error",
            code: "GIVE_INVALID",
            path,
            message: `${actor.id} needs to hold something and give it to a person of the shot`,
          });
          return t0;
        }
        const a1 = actor.placed(t0);
        const b1 = other.placed(t0);
        const mid: [number, number] = [(a1.x + b1.x) / 2, Math.min(a1.y, b1.y) - 150];
        if (Math.abs(a1.x - b1.x) > 2 * (RIG.upperArm + RIG.foreArm) + 140)
          issues.push({
            level: "error",
            code: "OUT_OF_REACH",
            path,
            message: `${actor.id} and ${other.id} are too far apart to hand something over`,
          });
        gazeTo(actor, t0, other.headWorld(t0));
        gazeTo(other, t0 + 0.1, mid);
        reach(actor, t0, t0 + 0.6, mid, "out");
        reach(other, t0 + 0.2, t0 + 0.7, mid, "out");
        c.torso.to(t0, t0 + 0.6, c.torso.at(t0) + 10, "out");
        pr.events.push({ t: t0 + 0.72, holder: other.id, at: mid });
        actor.holding = undefined;
        other.holding = id;
        other.ch.hand.to(t0 + 0.65, t0 + 0.75, 1);
        c.hand.to(t0 + 0.7, t0 + 0.8, 0);
        restArms(actor, t0 + 0.8, t0 + 1.4);
        c.torso.then(t0 + 1.4, c.torso.at(t0));
        holdPose(other, t0 + 0.8, t0 + 1.4);
        gazeTo(other, t0 + 1.0, pr.kind === "paper" ? [mid[0], mid[1] + 40] : actor.headWorld(t0));
        return t0 + 1.4;
      }
      case "lean_in":
        if (tgt) gazeTo(actor, t0, tgt);
        c.torso.to(t0, t0 + 0.6, c.torso.at(t0) + 15, "back");
        c.head.to(t0 + 0.1, t0 + 0.6, c.head.at(t0) - 4, "out");
        return t0 + dur;
      case "hesitate": {
        if (tgt) gazeTo(actor, t0, tgt);
        const base = c.torso.at(t0);
        c.torso.to(t0, t0 + 0.3, base - 5, "out");
        c.torso.then(t0 + 1.0, base + 24, "back");
        c.torso.then(t0 + 1.6, base + 24);
        c.torso.then(t0 + 2.4, base - 3, "io");
        c.brow.to(t0 + 0.8, t0 + 1.2, -1);
        c.head.to(t0 + 1.6, t0 + 2.4, c.head.at(t0) + 10, "io");
        if (actor.seatedAt(t0)) {
          c.arm.to(t0 + 0.3, t0 + 1.0, 46, "out");
          c.fore.to(t0 + 0.3, t0 + 1.0, 26, "out");
        }
        return t0 + 2.4;
      }
      case "cross_arms":
        c.arm.to(t0, t0 + 0.5, 30, "back");
        c.fore.to(t0, t0 + 0.5, 118, "back");
        c.armF.to(t0, t0 + 0.5, 24, "back");
        c.foreF.to(t0, t0 + 0.5, 112, "back");
        c.shrug.to(t0, t0 + 0.4, 0.4);
        c.shrug.then(t0 + 1.0, 0.1);
        return t0 + 0.6;
      case "hand_on_face": {
        const h = actor.headWorld(t0);
        const pl = actor.placed(t0);
        reach(actor, t0, t0 + 0.45, [h[0] + pl.facing * 40, h[1] + 10], "out");
        c.head.to(t0 + 0.1, t0 + 0.5, c.head.at(t0) + 10, "out");
        c.lid.to(t0 + 0.3, t0 + 0.5, 0.8);
        c.lid.then(t0 + dur, 0.8);
        c.lid.then(t0 + dur + 0.3, 0);
        restArms(actor, t0 + dur, t0 + dur + 0.5);
        c.head.then(t0 + dur + 0.5, c.head.at(t0));
        return t0 + dur + 0.5;
      }
      case "point": {
        if (!tgt) return t0;
        gazeTo(actor, t0, tgt);
        const sh = actor.headWorld(t0);
        const d = Math.hypot(tgt[0] - sh[0], tgt[1] - sh[1]) || 1;
        reach(
          actor,
          t0 + 0.1,
          t0 + 0.45,
          [sh[0] + ((tgt[0] - sh[0]) / d) * 300, sh[1] + 60 + ((tgt[1] - sh[1]) / d) * 300],
          "back",
        );
        restArms(actor, t0 + dur, t0 + dur + 0.5);
        return t0 + dur + 0.5;
      }
      case "nod": {
        const h = c.head.at(t0);
        c.head.to(t0, t0 + 0.2, h + 10, "out");
        c.head.then(t0 + 0.42, h - 2);
        c.head.then(t0 + 0.62, h + 7);
        c.head.then(t0 + 0.95, h, "out");
        return t0 + 1;
      }
      case "shake_head": {
        const g = c.gx.at(t0);
        c.gx.to(t0, t0 + 0.15, -0.6);
        c.gx.then(t0 + 0.4, 1);
        c.gx.then(t0 + 0.65, -0.6);
        c.gx.then(t0 + 0.95, g);
        const h = c.head.at(t0);
        c.head.to(t0, t0 + 0.2, h + 4);
        c.head.then(t0 + 1.0, h);
        return t0 + 1.0;
      }
      case "shrug":
        c.shrug.to(t0, t0 + 0.3, 1, "out");
        c.shrug.then(t0 + 0.75, 1);
        c.shrug.then(t0 + 1.1, 0);
        if (!actor.holding) {
          c.arm.to(t0, t0 + 0.3, -6, "out");
          c.fore.to(t0, t0 + 0.3, 82, "out");
          c.arm.then(t0 + 0.75, -6);
          c.fore.then(t0 + 0.75, 82);
        }
        c.mouth.to(t0, t0 + 0.3, -0.5);
        c.mouth.then(t0 + 1.1, c.mouth.at(t0));
        if (!actor.holding) restArms(actor, t0 + 0.75, t0 + 1.2);
        return t0 + 1.2;
      case "talk": {
        if (a.how) {
          const listener =
            a.target &&
            (actors.get(a.target) || props.get(a.target) || set.marks[a.target] || set.targets[a.target])
              ? (t: number): [number, number] => point(a.target, t) as [number, number]
              : undefined;
          return deliver(actor, a.how, a.intensity ?? 0.6, t0, dur, {
            words: ctx.words,
            listener,
            gazeTo: (t, p) => gazeTo(actor, t, p),
            rest: (s0, s1) => restArms(actor, s0, s1),
          });
        }
        const end = t0 + dur;
        const poses: Array<[number, number]> = [
          [18, 70],
          [10, 95],
          [26, 58],
          [4, 80],
        ];
        let s = t0;
        let i = 0;
        if (!actor.holding)
          while (s < end - 0.3) {
            const [ar, fo] = poses[i % poses.length] as [number, number];
            c.arm.to(s, s + 0.35, ar, "back");
            c.fore.to(s, s + 0.35, fo, "back");
            s += 0.65 + hash01(i, actor.seed) * 0.4;
            i++;
          }
        for (const w of ctx.words.filter((w) => w.t >= t0 && w.t < end)) {
          c.open.to(w.t, w.t + 0.06, 0.55 + hash01(w.t * 10) * 0.4, "out");
          c.open.then((w.t + w.end) / 2 + 0.02, 0.25);
          c.open.then(w.end, 0, "in");
        }
        if (!actor.holding) restArms(actor, end, end + 0.5);
        return end;
      }
      case "read": {
        const id = actor.holding;
        const pr = id ? props.get(id) : undefined;
        if (!pr || !["paper", "notebook", "phone"].includes(pr.kind)) {
          issues.push({
            level: "error",
            code: "NOTHING_TO_READ",
            path,
            message: `${actor.id} holds ${id ?? "nothing"}: pick up a paper, notebook or phone first`,
          });
          return t0;
        }
        const len = a.sec ?? 2.2;
        const head = actor.headWorld(t0);
        const f = actor.facingAt(t0);
        const page: [number, number] = [head[0] + f * 175, head[1] + 120];
        // the eyes go to the page first, the hand brings it up a few frames later (gaze leads the hand)
        gazeTo(actor, t0, [page[0], page[1] + 20]);
        reach(actor, t0 + 0.12, t0 + 0.6, page, "out");
        c.hand.to(t0 + 0.12, t0 + 0.3, 1);
        c.head.to(t0 + 0.1, t0 + 0.6, c.head.at(t0) + 9, "io");
        // line by line: the eyes sweep forward and step down; a small nod at each line
        const lines = Math.max(2, Math.round((len - 0.7) / 0.55));
        for (let n = 0; n < lines; n++) {
          const s0 = t0 + 0.6 + n * ((len - 0.8) / lines);
          c.gx.to(s0, s0 + 0.08, 0.2, "out");
          c.gx.then(s0 + 0.42, 1, "lin");
          c.gy.to(s0, s0 + 0.08, 0.35 + (n / lines) * 0.5, "out");
        }
        c.head.then(t0 + len - 0.1, c.head.at(t0) + 9);
        holdPose(actor, t0 + len - 0.1, t0 + len + 0.4);
        c.head.then(t0 + len + 0.4, c.head.at(t0), "io");
        if (actor.gazeHome) gazeTo(actor, t0 + len + 0.1, actor.gazeHome);
        return t0 + len + 0.4;
      }
      case "turn_to": {
        if (!tgt) return t0;
        const h = actor.headWorld(t0);
        const f = actor.facingAt(t0);
        // gazeTo turns the whole body when the target is behind (eyes first, the body follows)
        gazeTo(actor, t0, tgt);
        const behind = (tgt[0] - h[0]) * f < -60 && !actor.seatedAt(t0);
        // the torso follows the head toward the target, a little later, and settles (overlap)
        const tor = c.torso.at(t0);
        c.torso.to(t0 + 0.15, t0 + 0.45, tor + 4, "out");
        c.torso.then(t0 + 0.85, tor, "io");
        actor.gazeHome = tgt;
        return t0 + (behind ? 0.95 : 0.85);
      }
      case "react": {
        const mood = Mood.safeParse(a.target ?? "neutral");
        if (!mood.success) {
          issues.push({
            level: "error",
            code: "REACT_TARGET",
            path,
            message: `react's target is the mood it lands in (${Mood.options.join(", ")}), not '${a.target ?? ""}'`,
          });
          return t0;
        }
        const r = REACTION[mood.data] ?? (REACTION.neutral as (typeof REACTION)[string]);
        const tor = c.torso.at(t0);
        const hd = c.head.at(t0);
        // anticipation (4 frames): a small intake of breath the other way
        c.torso.to(t0, t0 + 0.13, tor - r.torso * 0.25, "out");
        c.head.to(t0, t0 + 0.13, hd - r.head * 0.25, "out");
        c.brow.to(t0, t0 + 0.13, c.brow.at(t0) - 0.3, "out");
        // the accent: the body takes the hit
        c.torso.then(t0 + 0.38, tor + r.torso, "back");
        c.head.then(t0 + 0.38, hd + r.head, "back");
        c.lid.to(t0 + 0.13, t0 + 0.3, r.lid);
        c.brow.then(t0 + 0.3, r.brow * 0.5, "out");
        if (!actor.holding) c.hand.to(t0 + 0.13, t0 + 0.3, r.hand, "out");
        // follow-through (≥ 4 frames) and settle into the mood
        c.torso.then(t0 + 0.75, tor + r.torso * 0.35, "io");
        c.head.then(t0 + 0.75, hd + r.head * 0.4, "io");
        c.lid.then(t0 + 0.9, 0, "io");
        c.brow.then(t0 + 0.9, 0, "io");
        actor.setMood(t0 + 0.2, mood.data, 0.8);
        return t0 + 1.0;
      }
      default:
        return t0;
    }
  }

  // ---------------------------------------------------------------- building blocks
  function gazeTo(a: ActorPerf, t0: number, target: [number, number], speed = 1): void {
    a.gazes.push({ t: t0, at: target });
    a.gazes.sort((p, q) => p.t - q.t);
    const h = a.headWorld(t0);
    const f = a.facingAt(t0);
    const dx = (target[0] - h[0]) * f;
    const dy = target[1] - h[1];
    if (dx < -60 && speed > 0.1 && !a.seatedAt(t0)) {
      turn(a, t0, f === 1 ? -1 : 1);
      return gazeTo(a, t0 + 0.35, target, speed);
    }
    if (dx < -60) {
      // seated: a look over the shoulder (eyes back, head up and turned), no full turn
      const up = clamp((Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI / 35, -1, 1);
      a.ch.gx.to(t0, t0 + 0.15, -1, "out");
      a.ch.gy.to(t0, t0 + 0.15, up, "out");
      a.ch.head.to(t0 + 0.1, t0 + 0.6, clamp(up * 18, -20, 12), "back");
      a.ch.torso.to(t0 + 0.1, t0 + 0.6, a.ch.torso.at(t0) - 6, "out");
      return;
    }
    const ang = (Math.atan2(dy, Math.max(40, Math.abs(dx))) * 180) / Math.PI;
    const headV = clamp(ang * 0.55, -22, 24);
    const gy = clamp(ang / 35, -1, 1);
    // speed < 0.1: where the eyes already are (the starting gaze), not a look: no time at all
    const d = speed < 0.1 ? 0 : 1;
    a.ch.gx.to(t0, t0 + 0.12 * d, 1, "out");
    a.ch.gy.to(t0, t0 + 0.12 * d, gy, "out");
    a.ch.head.to(t0 + 0.12 * d, t0 + 0.62 * d, headV, d < 1 ? "lin" : "back");
  }

  function turn(a: ActorPerf, t0: number, f: 1 | -1): number {
    // the eyes go first, the body follows with a small dip of the knees, the flip happens at the narrowest
    // moment (a body seen nearly from the front), never as a sheet of paper
    a.ch.gx.to(t0, t0 + 0.1, -1, "out");
    a.ch.gx.then(t0 + 0.32, 1, "io");
    a.turn.to(t0 + 0.06, t0 + 0.16, 0.6, "in");
    a.facings.push({ t: t0 + 0.16, f });
    a.facings.sort((p, q) => p.t - q.t);
    a.turn.then(t0 + 0.3, 1, "out");
    const y0 = a.y.at(t0);
    a.y.to(t0 + 0.04, t0 + 0.16, y0 + 7, "io");
    a.y.then(t0 + 0.3, y0, "out");
    return t0 + 0.3;
  }

  function within(a: ActorPerf, t: number, w: [number, number]): boolean {
    const l = toLocal(a.placed(t), w);
    return Math.hypot(l[0], l[1] + 250) < RIG.upperArm + RIG.foreArm + 120 && l[0] > -60;
  }

  function reach(a: ActorPerf, t0: number, t1: number, w: [number, number], ease: Ease = "io"): void {
    const pose = { ...a.pose(t1) };
    const l = toLocal(a.placed(t1), w);
    const r = reachArm(pose, l);
    a.ch.arm.to(t0, t1, r.arm, ease);
    a.ch.fore.to(t0, t1, r.fore, ease);
  }

  function workPoint(a: ActorPerf, t: number): [number, number] {
    for (const m of Object.values(set.marks))
      if (m.kind === "seat" && m.work && Math.abs(m.x + 30 * m.facing - a.x.at(t)) < 60) return m.work;
    const pl = a.placed(t);
    return [pl.x + pl.facing * 200, pl.y - 130];
  }

  function holdPose(a: ActorPerf, t0: number, t1: number): void {
    a.ch.arm.to(t0, t1, 22, "out");
    a.ch.fore.to(t0, t1, 84, "out");
  }

  function restArms(a: ActorPerf, t0: number, t1: number): void {
    const base = a.seatedAt(t1) ? SEATED : STANDING;
    const work = a.seatedAt(t1) ? workPoint(a, t1) : undefined;
    if (work && a.seatedAt(t1) && Object.values(set.marks).some((m) => m.work === work)) {
      reach(a, t0, t1, work, "io");
    } else {
      a.ch.arm.to(t0, t1, base.arm, "io");
      a.ch.fore.to(t0, t1, base.fore, "io");
    }
    a.ch.armF.to(t0, t1, base.armF, "io");
    a.ch.foreF.to(t0, t1, base.foreF, "io");
  }

  function standUp(a: ActorPerf, t0: number, path: string): number {
    if (!a.seatedAt(t0)) {
      issues.push({
        level: "warning",
        code: "ALREADY_STANDING",
        path,
        message: `${a.id} is already standing`,
      });
      return t0;
    }
    const c = a.ch;
    const f = a.facingAt(t0);
    const tor = c.torso.at(t0);
    c.torso.to(t0, t0 + 0.35, tor - 6, "out"); // anticipation: lean back
    c.torso.then(t0 + 0.75, tor + 26, "io"); // weight over the feet
    c.torso.then(t0 + 1.35, STANDING.torso, "back");
    a.y.to(t0 + 0.55, t0 + 1.25, standingHipY(set), "back");
    a.x.to(t0 + 0.45, t0 + 1.15, a.x.at(t0) + 120 * f, "io");
    for (const [ch, v] of [
      ["thigh", 0],
      ["shin", 0],
      ["thighF", -2],
      ["shinF", 2],
    ] as Array<[Ch, number]>)
      c[ch].to(t0 + 0.5, t0 + 1.25, v, "back");
    restArmsStanding(a, t0 + 0.4, t0 + 1.2);
    a.seated.push({ t: t0 + 0.9, v: false });
    return t0 + 1.35;
  }

  function restArmsStanding(a: ActorPerf, t0: number, t1: number): void {
    if (a.holding) holdPose(a, t0, t1);
    else {
      a.ch.arm.to(t0, t1, STANDING.arm, "io");
      a.ch.fore.to(t0, t1, STANDING.fore, "io");
    }
    a.ch.armF.to(t0, t1, STANDING.armF, "io");
    a.ch.foreF.to(t0, t1, STANDING.foreF, "io");
  }

  function sitDown(a: ActorPerf, t0: number, path: string, hipX?: number, seatY?: number): number {
    if (a.seatedAt(t0)) {
      issues.push({ level: "warning", code: "ALREADY_SEATED", path, message: `${a.id} is already seated` });
      return t0;
    }
    const f = a.facingAt(t0);
    const seat = Object.values(set.marks).find(
      (m) => m.kind === "seat" && Math.abs(m.x + 150 * m.facing - a.x.at(t0)) < 90,
    );
    const sx = hipX ?? (seat ? seat.x + 30 * seat.facing : a.x.at(t0) - 120 * f);
    const sy = seatY ?? seat?.seatY;
    if (sy === undefined) {
      issues.push({
        level: "error",
        code: "NO_SEAT",
        path,
        message: `${a.id} is not at a seat; walk_to a seat mark first`,
      });
      return t0;
    }
    const c = a.ch;
    c.head.to(t0, t0 + 0.3, c.head.at(t0) + 8, "out"); // a glance down at the seat
    c.torso.to(t0, t0 + 0.5, 24, "io");
    a.y.to(t0 + 0.2, t0 + 1.0, sy, "io");
    a.x.to(t0 + 0.2, t0 + 0.95, sx, "io");
    for (const [ch, v] of [
      ["thigh", SEATED.thigh],
      ["shin", SEATED.shin],
      ["thighF", SEATED.thighF],
      ["shinF", SEATED.shinF],
    ] as Array<[Ch, number]>)
      c[ch].to(t0 + 0.2, t0 + 1.0, v, "io");
    c.torso.then(t0 + 1.4, SEATED.torso, "out");
    a.seated.push({ t: t0 + 0.6, v: true });
    if (!a.holding) restArms(a, t0 + 0.9, t0 + 1.4);
    return t0 + 1.4;
  }

  function walkTo(a: ActorPerf, t0: number, toX: number): number {
    const from = a.x.at(t0);
    const dist = Math.abs(toX - from);
    if (dist < 8) return t0;
    const dir = (toX > from ? 1 : -1) as 1 | -1;
    let t = t0;
    if (a.facingAt(t) !== dir) t = turn(a, t, dir);
    const g = GAIT[a.moodAt(t)];
    const cont = a.continueWalk && t < 0.1 ? a.continueWalk : undefined;
    a.continueWalk = undefined;
    // one cycle is two steps; a step spans about the legs' reach at the gait's stride
    const perCycle = 4 * (RIG.thigh + RIG.shin) * Math.sin((18 * g.amp * Math.PI) / 180);
    let tw: number;
    let w: Walk;
    a.x.keys = a.x.keys.filter((k) => k[0] < t);
    if (cont && cont.speed > 20) {
      // the walk began in the previous shot: same stride phase, same speed, only the arrival eases out
      const ramp = Math.min(0.5, dist / cont.speed);
      const rd = (cont.speed * ramp) / 2;
      tw = Math.max(ramp, (dist - rd) / cont.speed + ramp);
      w = { t0: t - cont.elapsed, t1: t + tw, ...g };
      a.x.keys.push([t, from], [t + tw - ramp, toX - dir * rd, "lin"], [t + tw, toX, "out"]);
    } else {
      const cycles = Math.max(1, Math.round((dist / perCycle) * 2) / 2);
      tw = cycles * g.cycle + 0.3;
      w = { t0: t, t1: t + tw, ...g };
      // speed: ease in over the first step, constant, ease out; the joins have the same velocity
      const ramp = Math.min(0.5, tw / 3);
      const rd = (ramp * dist) / (2 * (tw - ramp));
      a.x.keys.push(
        [t, from],
        [t + ramp, from + dir * rd, "in"],
        [t + tw - ramp, toX - dir * rd, "lin"],
        [t + tw, toX, "out"],
      );
    }
    a.walks.push(w);
    events.push(t + tw);
    return t + tw + 0.15;
  }

  return {
    actors,
    props,
    door,
    events: [...new Set(events.map((e) => Math.round(e * 10) / 10))].sort((p, q) => p - q),
    issues,
  };
}

/** Where a prop is at t: in its holder's hand, or where it rests. */
export function propAt(pr: PropState, t: number, actors: Map<string, ActorPerf>): [number, number] {
  let cur = pr.events[0] as PropState["events"][number];
  for (const e of pr.events) if (e.t <= t) cur = e;
  if (cur.holder) {
    const a = actors.get(cur.holder);
    if (a) return a.draw(t).hand;
  }
  return cur.at;
}
