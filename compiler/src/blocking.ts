import type { AssetMeta, Keyframe, RenderTimeline, ScenePlan } from "@erkasa/contracts";
import { SEAT } from "@erkasa/engine";
import type { Issue } from "./compile.js";
import { standX, type StageSet } from "./sets.js";
import { FLOOR, SCALE, SIT_FRAMES, handPoint, kf, walkKeys, type Facing } from "./staging.js";
import type { TimedWord } from "./words.js";

/**
 * The blocking resolver: turns an actor's steps on a set ("enter by the door, walk to chair_left,
 * sit, give the CV to maria") into tracks that obey the set: walks at step speed, sits land on the
 * seat, hands meet above the desk, nobody walks while seated. Gestures from `actions` are mapped to
 * the current pose (talk while seated = seated_talk). Anything it has to change is reported.
 */

type TimelineNode = RenderTimeline["scenes"][number]["nodes"][number];
type Layer = ScenePlan["layers"][number];
type ActorLayer = Extract<Layer, { type: "actor" }>;
type Anchor = NonNullable<ActorLayer["blocking"][number]["at"]>;
type Pose = "offstage" | "standing" | "seated" | "moving";

export interface StageContext {
  fps: number;
  duration: number;
  path: string;
  issues: Issue[];
  words: TimedWord[];
  resolveAt(at: Anchor | undefined, path: string): number | undefined;
}

export interface StagedActor {
  layer: ActorLayer;
  path: string;
  meta: AssetMeta;
}

export interface StageResult {
  nodes: TimelineNode[];
  /** Frames where someone passes the door. */
  doorOpen: number[];
  /** Pose of each actor over time (for the camera and attached props). */
  poses: Map<string, Array<{ from: number; pose: Pose }>>;
  handovers: Array<{ from: string; to: string; at: number }>;
}

/** Same-meaning gesture in each pose (side view). Missing = keep the base pose. */
const SEATED: Record<string, string> = {
  talk: "seated_talk",
  nod: "seated_nod",
  read: "seated_read",
  type: "seated_type",
  give: "seated_give",
  idle: "seated",
  think: "seated",
  shrug: "seated_talk",
};
const STANDING: Record<string, string> = {
  nod: "talk",
  think: "idle",
  shrug: "talk",
  point_side: "point_forward",
  point_side_left: "point_forward",
  read: "idle",
  use_phone: "walk_phone",
};

const NATURAL_SEATED = new Set([
  "talk",
  "nod",
  "read",
  "type",
  "give",
  "idle",
  "seated",
  "seated_talk",
  "seated_nod",
  "seated_read",
  "seated_type",
  "seated_give",
]);

const GIVE_REACH = 22; // frames from the start of `give` until both arms are out

interface Planned {
  actor: StagedActor;
  /** Hand-overs where this actor receives (frame of the give start, giver id). */
  receives: Array<{ at: number; from: string; item: string }>;
}

export function stageActors(ctx: StageContext, set: StageSet, actors: StagedActor[]): StageResult {
  const result: StageResult = { nodes: [], doorOpen: [], poses: new Map(), handovers: [] };
  const planned = new Map<string, Planned>(actors.map((a) => [a.layer.id, { actor: a, receives: [] }]));
  // givers first: their hand-overs fix the moment the receivers must be ready
  const order = [...actors].sort(
    (a, b) =>
      Number(b.layer.blocking.some((s) => s.do === "give")) -
      Number(a.layer.blocking.some((s) => s.do === "give")),
  );
  for (const a of order) {
    const node = stageOne(ctx, set, a, planned, result);
    if (node) result.nodes.push(node);
  }
  return result;
}

function stageOne(
  ctx: StageContext,
  set: StageSet,
  a: StagedActor,
  planned: Map<string, Planned>,
  out: StageResult,
): TimelineNode | undefined {
  const { layer, path, meta } = a;
  const issue = (level: Issue["level"], code: string, p: string, message: string, hint?: string): void => {
    ctx.issues.push({ level, code, path: p, message, ...(hint ? { hint } : {}) });
  };
  const last = ctx.duration - 1;
  const x: Keyframe[] = [];
  const facing: Keyframe[] = [];
  const clip: Keyframe[] = [];
  const opacity: Keyframe[] = [];
  const item: Keyframe[] = [kf(0, layer.holding ?? "neutral")];
  const poses: Array<{ from: number; pose: Pose }> = [];
  let pose: Pose = "offstage";
  let at: { x: number; facing: Facing; mark?: string } | undefined;
  let cursor = 0;
  let holding = layer.holding;

  const setPose = (f: number, p: Pose): void => {
    pose = p === "moving" ? pose : p;
    poses.push({ from: f, pose: p });
  };
  const play = (f: number, name: string, blend = 6): void => {
    clip.push(kf(Math.min(last, f), name, f > 0 ? { blend } : {}));
  };
  const markOf = (name: string | undefined, p: string, kinds?: string[]): ReturnType<typeof getMark> => {
    const m = getMark(set, name);
    if (!m) {
      issue(
        "error",
        "BLOCKING_MARK_UNKNOWN",
        p,
        `the set '${set.id}' has no mark '${name ?? ""}'`,
        `marks: ${Object.keys(set.marks).join(", ")}`,
      );
      return undefined;
    }
    if (kinds && !kinds.includes(m.kind)) {
      issue("error", "BLOCKING_MARK_KIND", p, `'${name ?? ""}' is a ${m.kind}, not a ${kinds.join(" or ")}`);
      return undefined;
    }
    return m;
  };
  const standUp = (f: number, p: string, why: string, warn = true): number => {
    if (warn) issue("warning", "POSE_CONTINUITY", p, `${layer.id} was seated: stands up first (${why})`);
    play(f, "stand_up", 4);
    setPose(f, "moving");
    play(f + SIT_FRAMES, "idle", 6);
    setPose(f + SIT_FRAMES, "standing");
    return f + SIT_FRAMES;
  };
  const walkTo = (f0: number, tx: number, p: string): number => {
    if (!at) return f0;
    let f = f0;
    if (pose === "seated") f = standUp(f, p, "to walk");
    const dir: Facing = tx >= at.x ? "right" : "left";
    if (Math.abs(tx - at.x) < 4) return f;
    facing.push(kf(f, dir));
    play(f, holding === "phone" ? "walk_phone" : "walk", 4);
    setPose(f, "moving");
    const w = walkKeys(f, at.x, tx, holding === "phone" ? "walk_phone" : "walk");
    x.push(...w.keys);
    play(w.arrive, "idle", 6);
    setPose(w.arrive, "standing");
    at = { ...at, x: tx, facing: dir };
    return w.arrive;
  };

  // receptions injected by givers become steps of this actor, placed by time
  type Step = ActorLayer["blocking"][number] & { _receive?: { at: number; from: string; item: string } };
  const steps: Step[] = [...layer.blocking];
  for (const r of planned.get(layer.id)?.receives ?? []) {
    let idx = steps.length;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const sf = s?.at ? ctx.resolveAt(s.at, `${path}.blocking[${i}].at`) : undefined;
      if (sf !== undefined && sf > r.at) {
        idx = i;
        break;
      }
    }
    steps.splice(idx, 0, { do: "standing", _receive: r });
  }
  if (!steps.length) {
    issue(
      "error",
      "BLOCKING_EMPTY",
      `${path}.blocking`,
      `${layer.id} is on the set '${set.id}' but has no blocking`,
      "start with seated, standing or enter at a mark",
    );
    return undefined;
  }

  steps.forEach((s, i) => {
    const p = `${path}.blocking[${i}]`;
    const anchored = s.at ? ctx.resolveAt(s.at, `${p}.at`) : undefined;
    let f = Math.max(cursor, anchored ?? cursor);
    if (f > last) f = last;

    if (s._receive) {
      // the giver's arm reaches out at r.at; be standing at the desk with the arm out by then
      const r = s._receive;
      const wasSeated = pose === "seated";
      let ready = r.at - 2;
      if (wasSeated) {
        const up = Math.max(cursor, r.at - SIT_FRAMES - 4);
        play(up, "stand_up", 4);
        setPose(up, "moving");
        setPose(up + SIT_FRAMES, "standing");
        ready = Math.max(ready, up + SIT_FRAMES);
      }
      play(ready, "give", 6);
      const swap = r.at + GIVE_REACH;
      item.push(kf(swap, r.item));
      holding = r.item;
      play(swap + 6, "idle", 8);
      cursor = swap + 6;
      if (wasSeated) {
        play(cursor + 10, "sit", 4);
        setPose(cursor + 10, "moving");
        play(cursor + 10 + SIT_FRAMES, r.item === "document" ? "seated_read" : "seated", 8);
        setPose(cursor + 10 + SIT_FRAMES, "seated");
        cursor = cursor + 10 + SIT_FRAMES;
      }
      return;
    }

    switch (s.do) {
      case "seated":
      case "standing": {
        const m = markOf(s.mark, `${p}.mark`, s.do === "seated" ? ["chair"] : undefined);
        if (!m) return;
        const fx = standX(m);
        at = { x: fx, facing: m.facing, mark: s.mark };
        x.push(kf(f, fx));
        facing.push(kf(f, m.facing));
        opacity.push(kf(f, 1));
        play(f, s.do === "seated" ? "seated" : "idle", 0);
        setPose(f, s.do === "seated" ? "seated" : "standing");
        cursor = f;
        return;
      }
      case "enter": {
        const m = markOf(s.mark ?? "door", `${p}.mark`, ["door", "spot"]);
        if (!m) return;
        at = { x: m.x, facing: m.facing, mark: s.mark ?? "door" };
        x.push(kf(f, m.x));
        facing.push(kf(f, m.facing));
        opacity.push(kf(0, 0), kf(f, 0), kf(f + 8, 1));
        play(f, "idle", 0);
        setPose(f, "standing");
        if (m.kind === "door") out.doorOpen.push(f);
        cursor = f;
        return;
      }
      case "walk_to": {
        if (!at) {
          issue(
            "error",
            "BLOCKING_NO_START",
            p,
            `${layer.id} walks before being anywhere`,
            "first step: seated, standing or enter",
          );
          return;
        }
        const m = markOf(s.mark, `${p}.mark`);
        if (!m) return;
        cursor = walkTo(f, standX(m), p);
        at = { ...at, mark: s.mark };
        return;
      }
      case "sit": {
        const m = getMark(set, at?.mark);
        if (!at || !m || m.kind !== "chair") {
          issue(
            "error",
            "BLOCKING_SIT_NO_CHAIR",
            p,
            `${layer.id} can only sit at a chair mark`,
            "walk_to a chair first",
          );
          return;
        }
        if (pose === "seated") return;
        if (Math.abs(at.x - standX(m)) > 4) f = walkTo(f, standX(m), p);
        if (at.facing !== m.facing) facing.push(kf(f, m.facing));
        at = { ...at, facing: m.facing };
        play(f, "sit", 4);
        setPose(f, "moving");
        play(f + SIT_FRAMES, "seated", 6);
        setPose(f + SIT_FRAMES, "seated");
        cursor = f + SIT_FRAMES;
        return;
      }
      case "stand_up": {
        if (pose !== "seated") return;
        cursor = standUp(f, p, "asked to", false);
        return;
      }
      case "give": {
        const to = s.to ? planned.get(s.to) : undefined;
        if (!to) {
          issue(
            "error",
            "GIVE_TARGET_UNKNOWN",
            `${p}.to`,
            `${layer.id} gives to '${s.to ?? ""}', who is not on the set`,
          );
          return;
        }
        if (!holding) {
          issue(
            "error",
            "GIVE_NOTHING",
            p,
            `${layer.id} holds nothing to give`,
            "set holding: document (or phone) on the actor",
          );
          return;
        }
        const theirChair =
          to.actor.layer.blocking.find((b) => getMark(set, b.mark)?.kind === "chair")?.mark ?? "";
        const pair = set.handover.find((h) => h.includes(at?.mark ?? "") && h.includes(theirChair));
        if (!pair)
          issue(
            "warning",
            "HANDOVER_FAR",
            p,
            `${layer.id} and ${s.to ?? ""} are not across the desk: their hands may not meet`,
            `hand-overs: ${set.handover.map((h) => h.join(" <-> ")).join(", ")}`,
          );
        if (pose === "seated") f = standUp(f, p, "to hand something over");
        play(f, "give", 6);
        const swap = f + GIVE_REACH;
        item.push(kf(swap, "neutral"));
        to.receives.push({ at: f, from: layer.id, item: holding });
        out.handovers.push({ from: layer.id, to: s.to ?? "", at: swap });
        holding = undefined;
        play(swap + 6, "idle", 8);
        cursor = swap + 6;
        return;
      }
      case "exit": {
        const m = markOf(s.mark ?? "door", `${p}.mark`, ["door", "spot"]);
        if (!m || !at) return;
        const arrive = walkTo(f, m.x, p);
        if (m.kind === "door") out.doorOpen.push(arrive - 10);
        opacity.push(kf(arrive - 10, 1), kf(arrive, 0));
        cursor = arrive;
        return;
      }
    }
  });

  if (!x.length) return undefined;
  out.poses.set(layer.id, poses);

  // gestures: mapped to the pose they happen in; never during a move
  const poseAt = (f: number): Pose => {
    let cur: Pose = "offstage";
    for (const p of poses) if (p.from <= f) cur = p.pose;
    return cur;
  };
  const side = new Set((meta.capabilities["actions"] as { side?: string[] } | undefined)?.side ?? []);
  const expr: Keyframe[] = [kf(0, layer.expression)];
  layer.actions.forEach((g, i) => {
    const p = `${path}.actions[${i}]`;
    const f = ctx.resolveAt(g.at, `${p}.at`);
    if (f === undefined) return;
    if (g.expression) expr.push(kf(f, g.expression));
    const ps = poseAt(f);
    if (ps === "moving" || ps === "offstage") {
      issue(
        "warning",
        "ACTION_DURING_MOVE",
        p,
        `'${g.action}' falls while ${layer.id} is ${ps === "moving" ? "moving" : "off the set"}; skipped`,
      );
      return;
    }
    const base = ps === "seated" ? "seated" : "idle";
    const name =
      ps === "seated"
        ? (SEATED[g.action] ?? (side.has(g.action) && g.action.startsWith("seated") ? g.action : undefined))
        : side.has(g.action)
          ? g.action
          : STANDING[g.action];
    if (!name) {
      issue(
        "warning",
        "ACTION_SUBSTITUTED",
        p,
        `${layer.id} cannot '${g.action}' while ${ps} on the set; kept still`,
      );
      return;
    }
    // the seated version of the same gesture is what was meant; anything else is a real substitution
    const natural = ps === "seated" ? NATURAL_SEATED.has(g.action) : name === g.action;
    if (!natural) issue("warning", "ACTION_SUBSTITUTED", p, `'${g.action}' while ${ps} -> '${name}'`);
    const end = Math.min(last, f + Math.round((g.durationSec ?? 2.2) * ctx.fps));
    // do not run over the next blocking change
    const nextChange = poses.find((q) => q.from > f)?.from ?? last;
    play(f, name, 6);
    if (Math.min(end, nextChange - 2) > f + 4) play(Math.min(end, nextChange - 2), base, 8);
  });
  // speakers talk in their pose unless they gesture
  if (layer.speaks) {
    const first = Math.round((ctx.words[0]?.start ?? 0) * ctx.fps);
    if (poseAt(first) === "seated" || poseAt(first) === "standing")
      play(first, poseAt(first) === "seated" ? "seated_talk" : "talk", 8);
  }

  const tracks: Record<string, Keyframe[]> = {
    x: dedupe(x),
    y: [kf(0, FLOOR)],
    scale: [kf(0, SCALE)],
    facing: dedupe(facing),
    clip: dedupe(clip.sort((p, q) => p.f - q.f)),
    item: dedupe(item),
    expression: dedupe(expr.sort((p, q) => p.f - q.f)),
  };
  if (opacity.length) tracks["opacity"] = dedupe(opacity);
  return {
    id: layer.id,
    adapter: "character",
    asset: `${meta.assetId}@${meta.version}`,
    z: layer.zIndex ?? 10,
    space: "world",
    props: { speaks: layer.speaks, ...(layer.outfit ? { outfit: layer.outfit } : {}) },
    tracks,
  } as TimelineNode;
}

function getMark(set: StageSet, name: string | undefined): StageSet["marks"][string] | undefined {
  return name ? set.marks[name] : undefined;
}

/** Keeps the last keyframe of each frame, in frame order. */
function dedupe(k: Keyframe[]): Keyframe[] {
  const byFrame = new Map<number, Keyframe>();
  for (const key of k) byFrame.set(key.f, key);
  return [...byFrame.values()].sort((a, b) => a.f - b.f);
}

/**
 * Head top of an actor at a frame (world px), for props attached above someone's head
 * and for framing. Uses the pose (standing / seated) and where the actor is.
 */
export function headPoint(
  node: TimelineNode,
  poses: Array<{ from: number; pose: string }>,
  f: number,
): [number, number] {
  let pose = "standing";
  for (const p of poses) if (p.from <= f) pose = p.pose;
  const xs = node.tracks["x"] ?? [];
  let xv = Number(xs[0]?.v ?? 0);
  for (const k of xs) if (k.f <= f) xv = Number(k.v);
  const fac = node.tracks["facing"] ?? [];
  let face = String(fac[0]?.v ?? "right");
  for (const k of fac) if (k.f <= f) face = String(k.v);
  const d = face === "left" ? -1 : 1;
  const standingTop = FLOOR - 820 * SCALE;
  if (pose === "seated") return [xv - d * (SEAT.back - 16) * SCALE, standingTop + SEAT.down * SCALE];
  return [xv + d * 16 * SCALE, standingTop];
}

export { handPoint };
