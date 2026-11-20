/**
 * Character continuity across shots.
 *
 * A film is one story, not a set of independent shots: what a person is doing, where they are, which way they
 * face, what they hold and how they feel when one shot cuts is where the next shot picks them up. This module
 * holds the shared contract (CharacterState), reads it from a performance at any time (the temporal debugger
 * uses the same function), and checks every cut.
 *
 * What is carried is only what a later shot actually uses: position, facing, seated or standing, the pose
 * channels (so a gesture cut halfway finishes instead of popping), mood, gaze, the held prop, and an action
 * that was still going (a walk continues, a sit finishes). Intentional changes are declared by the plan
 * (`continuity: "reset"`, or a different set); those cuts are reported, never flagged as errors.
 */
import { INTENT_CH } from "./acting.js";
import type { Mood, Shot } from "./contract.js";
import type { ActorPerf, Issue, Performance } from "./perform.js";
import { skeleton, toWorld, type Pose } from "./rig.js";
import { FPS } from "./style.js";

export type Movement = "still" | "walking" | "turning" | "sitting_down" | "standing_up" | "gesturing";

/** Actions that must finish or continue across a cut; anything else may be cut on and settle to rest. */
export const SUSTAINED = new Set(["walk_to", "sit_down", "stand_up", "pick_up", "put_down", "give", "drink"]);

export interface CharacterState {
  id: string;
  set: string;
  x: number;
  y: number;
  facing: 1 | -1;
  scale: number;
  seated: boolean;
  /** The pose as drawn (mood, walk and breathing included): what the viewer saw at that frame. */
  pose: Pose;
  /** The animated channels under it (without mood and gait): what the next shot continues from. */
  channels: Partial<Pose>;
  mood: Mood;
  /**
   * What the person wanted at the cut (acting.ts intent layer: posture and face of a worried explanation...), when
   * they had an intent: the next shot picks it up instead of starting relaxed (W2).
   */
  intent?: Partial<Pose>;
  /** World point the eyes are on, if they were sent somewhere. */
  gaze: [number, number] | null;
  holding: string | null;
  /** The action in progress (sustained or not) and how far it is. */
  action: { kind: string; target?: string; progress: number } | null;
  movement: Movement;
  /** Which leg carries the weight (walking), both feet (standing) or the seat. */
  support: "both" | "near" | "far" | "seat";
  /** While walking: seconds since the walk began, the body's speed (px/s, signed) and the cycle length. */
  walk?: { elapsed: number; speed: number; cycle: number };
}

export interface PropCarry {
  holder: string | null;
  at: [number, number];
}

/** What one shot hands to the next on the same set. */
export interface Carry {
  set: string;
  actors: Record<string, CharacterState>;
  props: Record<string, PropCarry>;
  /** False when other shots (a cutaway) came between: in-progress actions have finished off screen. */
  adjacent: boolean;
}

export function stateOf(perf: Performance, a: ActorPerf, t: number, set: string): CharacterState {
  const pl = a.placed(t);
  const pose = a.pose(t);
  const walk = a.walks.find((w) => t >= w.t0 && t <= w.t1);
  // a sustained action in progress (a walk, a sit) is what the person is doing, even if a glance starts too
  const live = [...a.acts].reverse().filter((x) => t >= x.t0 && t < x.t1);
  const act = live.find((x) => SUSTAINED.has(x.kind)) ?? live[0];
  const dy = a.y.at(t + 0.05) - a.y.at(t - 0.05);
  let movement: Movement = "still";
  if (walk) movement = "walking";
  else if (a.turn.at(t) < 0.98) movement = "turning";
  else if (Math.abs(dy) > 1.5) movement = a.seatedAt(t + 0.3) ? "sitting_down" : "standing_up";
  else if (act && !SUSTAINED.has(act.kind)) movement = "gesturing";
  let support: CharacterState["support"] = a.seatedAt(t) ? "seat" : "both";
  if (walk) {
    const n = a.stance(walk, t, true);
    const f = a.stance(walk, t, false);
    support = n && (!f || n.weight >= f.weight) ? "near" : f ? "far" : "both";
  }
  let holding: string | null = null;
  for (const [id, pr] of perf.props) {
    let h: string | null = null;
    for (const e of pr.events) if (e.t <= t) h = e.holder;
    if (h === a.id) holding = id;
  }
  // at a shot's first instant, what the eyes and the mood ARE (carried), not where they are about to go
  const gaze = ([...a.gazes].reverse().find((g) => g.t < t) ?? a.gazes.find((g) => g.t <= t))?.at ?? null;
  return {
    id: a.id,
    set,
    x: pl.x,
    y: a.y.at(t),
    facing: pl.facing,
    scale: pl.scale,
    seated: a.seatedAt(t),
    pose,
    channels: Object.fromEntries(Object.entries(a.ch).map(([k, tr]) => [k, tr.at(t)])) as Partial<Pose>,
    mood: a.moodAt(t - 1e-6),
    ...(a.intentOn ? { intent: Object.fromEntries(INTENT_CH.map((c) => [c, a.intentCh[c].at(t)])) } : {}),
    gaze,
    holding,
    action: act
      ? {
          kind: act.kind,
          ...(act.target ? { target: act.target } : {}),
          progress: Math.min(1, (t - act.t0) / Math.max(0.01, act.t1 - act.t0)),
        }
      : null,
    movement,
    support,
    ...(walk
      ? {
          walk: {
            elapsed: t - walk.t0,
            speed:
              t < 0.02 ? (a.x.at(t + 0.04) - a.x.at(t)) / 0.04 : (a.x.at(t + 0.02) - a.x.at(t - 0.02)) / 0.04,
            cycle: walk.cycle,
          },
        }
      : {}),
  };
}

/** The state once everything that was started has finished (used across a cutaway). */
export function settledState(perf: Performance, a: ActorPerf, set: string): CharacterState {
  const end = Math.max(0, ...a.acts.map((x) => x.t1), ...a.walks.map((w) => w.t1 + 0.7)) + 0.05;
  return { ...stateOf(perf, a, end, set), action: null, movement: "still" };
}

export function carryFrom(perf: Performance, set: string, at: number, adjacent: boolean): Carry {
  const actors: Record<string, CharacterState> = {};
  for (const a of perf.actors.values())
    actors[a.id] = adjacent ? stateOf(perf, a, at, set) : settledState(perf, a, set);
  const props: Record<string, PropCarry> = {};
  for (const [id, pr] of perf.props) {
    let holder: string | null = null;
    let restAt = pr.events[0]?.at ?? [0, 0];
    for (const e of pr.events)
      if (e.t <= at || !adjacent) {
        holder = e.holder;
        if (!e.holder) restAt = e.at;
      }
    props[id] = { holder, at: restAt };
  }
  return { set, actors, props, adjacent };
}

// ------------------------------------------------------------------------------------ the checks

/** World positions of the joints, for comparing two poses of the same person. */
function joints(s: CharacterState): Array<[number, number]> {
  const pl = { x: s.x, y: s.y, facing: s.facing, turn: 1, scale: s.scale };
  const sk = skeleton(s.pose);
  return [
    sk.head,
    sk.neck,
    sk.shL,
    sk.hand,
    sk.handF,
    sk.elbow,
    sk.elbowF,
    sk.knee,
    sk.kneeF,
    sk.ankle,
    sk.ankleF,
  ].map((p) => toWorld(pl, p));
}

export interface Tolerances {
  /** Largest body move between two frames inside shots (p99, px). */
  position: number;
  /** Largest joint move between two frames inside shots (p99, px). */
  joint: number;
}

/**
 * Thresholds from the film's own animation, not from round numbers: a cut is a jump when the person moves more
 * across it than they ever move in one frame while the camera keeps rolling (the 99th percentile, with half
 * again as margin, and a floor of a few pixels for rounding).
 */
export function tolerances(shots: Array<{ perf?: Performance; dur: number }>): Tolerances {
  const root: number[] = [];
  const joint: number[] = [];
  for (const s of shots)
    for (const a of s.perf?.actors.values() ?? [])
      for (let t = 0; t + 1 / FPS < s.dur; t += 1 / FPS) {
        const p0 = a.placed(t);
        const p1 = a.placed(t + 1 / FPS);
        root.push(Math.hypot(p1.x - p0.x, p1.y - p0.y));
        const j0 = joints(stateLite(a, t));
        const j1 = joints(stateLite(a, t + 1 / FPS));
        joint.push(
          Math.max(
            ...j0.map((p, i) =>
              Math.hypot(p[0] - (j1[i] as [number, number])[0], p[1] - (j1[i] as [number, number])[1]),
            ),
          ),
        );
      }
  const p99 = (v: number[]): number => {
    if (!v.length) return 0;
    const s = [...v].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * 0.99))] as number;
  };
  return { position: Math.max(3, p99(root) * 1.5), joint: Math.max(6, p99(joint) * 1.5) };
}

function stateLite(a: ActorPerf, t: number): CharacterState {
  const pl = a.placed(t);
  return {
    id: a.id,
    set: "",
    x: pl.x,
    y: pl.y,
    facing: pl.facing,
    scale: pl.scale,
    seated: false,
    pose: a.pose(t),
    channels: {},
    mood: "neutral",
    gaze: null,
    holding: null,
    action: null,
    movement: "still",
    support: "both",
  };
}

export interface Transition {
  from: string;
  to: string;
  actor: string;
  intentional: false | "reset" | "set_change";
  prev: CharacterState;
  next: CharacterState;
  issues: Issue[];
}

const angle = (a: [number, number], b: [number, number]): number => Math.atan2(b[1] - a[1], b[0] - a[0]);

/** Compare the end of one shot with the start of the next, for one person. */
export function checkCut(
  prev: CharacterState,
  next: CharacterState,
  tol: Tolerances,
  ctx: { from: string; to: string; intentional: Transition["intentional"] },
): Transition {
  const issues: Issue[] = [];
  const path = `${ctx.from}->${ctx.to}.${prev.id}`;
  const add = (code: string, message: string, level: Issue["level"] = "error"): void => {
    issues.push({
      level: ctx.intentional ? "warning" : level,
      code,
      path,
      message: ctx.intentional ? `${message} (declared: ${ctx.intentional})` : message,
    });
  };
  const d = Math.hypot(next.x - prev.x, next.y - prev.y);
  if (d > tol.position)
    add(
      "POSITION_JUMP",
      `${prev.id} moves ${d.toFixed(0)} px across the cut (one frame of motion is at most ${tol.position.toFixed(0)} px)`,
    );
  if (next.facing !== prev.facing && prev.movement !== "turning")
    add("ORIENTATION_FLIP", `${prev.id} faces the other way after the cut without turning`);
  if (next.seated !== prev.seated && prev.movement !== "sitting_down" && prev.movement !== "standing_up")
    add(
      "POSE_SEATED",
      `${prev.id} is ${prev.seated ? "seated" : "standing"} at the cut and ${next.seated ? "seated" : "standing"} after it`,
    );
  else {
    const j0 = joints(prev);
    const j1 = joints(next);
    const jd = Math.max(
      ...j0.map((p, i) =>
        Math.hypot(p[0] - (j1[i] as [number, number])[0], p[1] - (j1[i] as [number, number])[1]),
      ),
    );
    if (jd > tol.joint + Math.max(0, d - tol.position) && d <= tol.position)
      add(
        "POSE_JUMP",
        `a limb of ${prev.id} jumps ${jd.toFixed(0)} px across the cut (one frame of motion is at most ${tol.joint.toFixed(0)} px)`,
        "warning",
      );
  }
  if (prev.action && prev.action.progress < 0.98 && SUSTAINED.has(prev.action.kind)) {
    const goesOn =
      next.action?.kind === prev.action.kind && (next.action.target ?? "") === (prev.action.target ?? "");
    if (!goesOn)
      add(
        "ACTION_INTERRUPTED",
        `${prev.id}'s ${prev.action.kind}${prev.action.target ? ` to ${prev.action.target}` : ""} is ${(prev.action.progress * 100).toFixed(0)}% done at the cut and does not go on`,
      );
  }
  if (next.mood !== prev.mood)
    add("MOOD_JUMP", `${prev.id} is ${prev.mood} at the cut and ${next.mood} right after it`, "warning");
  if ((next.holding ?? "") !== (prev.holding ?? ""))
    add(
      "HOLDING_MISMATCH",
      `${prev.id} holds ${prev.holding ?? "nothing"} at the cut and ${next.holding ?? "nothing"} after it`,
    );
  if (Math.abs(next.scale - prev.scale) > 1e-3)
    add("SCALE_MISMATCH", `${prev.id}'s scale changes ${prev.scale} -> ${next.scale}`);
  if (prev.gaze && next.gaze) {
    const h0: [number, number] = [prev.x, prev.y - 345];
    const h1: [number, number] = [next.x, next.y - 345];
    const da = Math.abs(
      ((angle(h0, prev.gaze) - angle(h1, next.gaze) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI,
    );
    if (da > Math.PI / 3)
      add(
        "GAZE_JUMP",
        `${prev.id} looks somewhere else after the cut (${((da * 180) / Math.PI).toFixed(0)}°)`,
        "warning",
      );
  }
  return { from: ctx.from, to: ctx.to, actor: prev.id, intentional: ctx.intentional, prev, next, issues };
}

/** One shot as the checker needs it (both composers provide this). */
export interface ShotPerf {
  shot: Shot;
  dur: number;
  perf?: Performance;
}

/** Every cut between shots on the same set that share a person. */
export function checkFilm(shots: ShotPerf[]): {
  tol: Tolerances;
  transitions: Transition[];
  issues: Issue[];
} {
  const tol = tolerances(shots);
  const transitions: Transition[] = [];
  const last = new Map<string, { i: number; s: ShotPerf }>();
  shots.forEach((s, i) => {
    if (s.shot.kind !== "set" || !s.perf) return;
    const set = s.shot.set ?? "office";
    for (const a of s.perf.actors.values()) {
      const key = a.id;
      const prev = last.get(key);
      if (prev?.s.perf) {
        const pa = prev.s.perf.actors.get(a.id) as ActorPerf;
        const prevSet = prev.s.shot.set ?? "office";
        const adjacent = prev.i === i - 1;
        const intentional: Transition["intentional"] =
          s.shot.continuity === "reset" ? "reset" : prevSet !== set ? "set_change" : false;
        const ps = adjacent
          ? stateOf(prev.s.perf, pa, prev.s.dur, prevSet)
          : settledState(prev.s.perf, pa, prevSet);
        const ns = stateOf(s.perf, a, 0, set);
        transitions.push(checkCut(ps, ns, tol, { from: prev.s.shot.id, to: s.shot.id, intentional }));
      }
      last.set(key, { i, s });
    }
  });
  return { tol, transitions, issues: transitions.flatMap((t) => t.issues) };
}
