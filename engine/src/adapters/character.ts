import { Rig, type AssetMeta, type Rig as RigT } from "@erkasa/contracts";
import { hashString, mulberry32 } from "../core/random.js";
import { OPACITY_GUARD, SvgTemplate, fmt } from "../core/svg-template.js";
import { sampleDiscrete, sampleNumber, type Tracks } from "../core/tracks.js";
import { ACTIONS_BY_SKELETON, blendPoses, type Action, type Pose } from "./actions.js";

export interface SpeechSample {
  word: string;
  /** 0..1 progress through the word. */
  progress: number;
}

export interface CharacterContext {
  frame: number;
  fps: number;
  seed: number;
  /** The word being spoken right now, if any (from captions/alignment), for lip-sync. */
  speech?: SpeechSample;
}

/** One drawable view of a character (front or side) with its own skeleton. */
export interface CharacterView {
  rig: RigT;
  template: SvgTemplate;
  actions: Record<string, Action>;
  rootId: string;
}

export interface PreparedCharacter {
  meta: AssetMeta;
  front: CharacterView;
  side?: CharacterView;
}

export type Facing = "front" | "left" | "right";

function prepareView(meta: AssetMeta, svgText: string, rigText: string): CharacterView {
  const rig = Rig.parse(JSON.parse(rigText));
  const template = SvgTemplate.compile(svgText, meta.assetId);
  template.requireParts(
    rig.bones.filter((b) => b.parent !== null && b.id !== "hips").map((b) => b.svgGroup),
    `${meta.assetId} (${rig.skeleton})`,
  );
  for (const slot of Object.keys(rig.slots)) {
    if (!template.slots.has(slot)) throw new Error(`${meta.assetId}: missing face slot ${slot}`);
  }
  const actions = ACTIONS_BY_SKELETON[rig.skeleton];
  if (!actions) throw new Error(`${meta.assetId}: no actions for skeleton ${rig.skeleton}`);
  const rootId = template.parts.keys().next().value;
  if (!rootId) throw new Error(`${meta.assetId}: SVG has no root group`);
  return { rig, template, actions, rootId };
}

export function prepareCharacter(
  meta: AssetMeta,
  svgText: string,
  rigText: string,
  side?: { svg: string; rig: string },
): PreparedCharacter {
  const c: PreparedCharacter = { meta, front: prepareView(meta, svgText, rigText) };
  if (side) c.side = prepareView(meta, side.svg, side.rig);
  return c;
}

/** Actions a character can perform when facing a given way. */
export function actionsFor(c: PreparedCharacter, facing: Facing): string[] {
  const view = facing === "front" ? c.front : c.side;
  return view ? Object.keys(view.actions) : [];
}

/** Picks a mouth shape for the letter currently being spoken. */
export function visemeFor(sample: SpeechSample): string {
  const letters = sample.word.toLowerCase().replace(/[^a-z]/g, "");
  if (!letters) return "neutral";
  const ch = letters[Math.min(letters.length - 1, Math.floor(sample.progress * letters.length))] ?? "";
  if ("a".includes(ch)) return "talk_a";
  if ("ou".includes(ch)) return "talk_o";
  if ("mbp".includes(ch)) return "neutral";
  if ("eiy".includes(ch)) return "talk_e";
  return sample.progress < 0.85 ? "talk_e" : "neutral";
}

/** Automatic blinks every ~2.5-5 s, 4 frames long, deterministic per character. */
function isBlinking(nodeSeed: number, frame: number, fps: number): boolean {
  const rnd = mulberry32(nodeSeed);
  let t = Math.round((1 + rnd() * 2) * fps);
  while (t <= frame) {
    if (frame < t + 4) return true;
    t += Math.round((2.5 + rnd() * 2.5) * fps);
  }
  return false;
}

export function renderCharacter(
  c: PreparedCharacter,
  nodeId: string,
  tracks: Tracks,
  props: Record<string, unknown>,
  ctx: CharacterContext,
): string {
  const { frame, fps } = ctx;
  const nodeSeed = hashString(nodeId, ctx.seed);
  const phase = (nodeSeed % 1000) / 159;

  // --- which view: `facing` track, else props.facing, else front ---
  const defaultFacing = typeof props["facing"] === "string" ? props["facing"] : "front";
  const facing = sampleDiscrete(tracks["facing"], frame, defaultFacing).value as Facing;
  const view = facing === "front" ? c.front : c.side;
  if (!view) throw new Error(`${c.meta.assetId}: no side view for facing '${facing}'`);

  // --- body: action clips with cross-fade ---
  const clip = sampleDiscrete(tracks["clip"], frame, "idle");
  const act = (name: string, since: number): Pose => {
    const fn = view.actions[name];
    if (!fn) throw new Error(`${c.meta.assetId}: unknown action '${name}' for ${facing} view`);
    return fn((frame - since) / fps, phase);
  };
  let pose = act(clip.value, clip.since);
  // A blend is only meaningful within the same view; across a turn the new view starts clean.
  if (clip.previous && view.actions[clip.previous.value]) {
    pose = blendPoses(act(clip.previous.value, clip.previous.since), pose, smooth(clip.blend));
  }
  const root = pose["root"];
  if (root) {
    delete pose["root"];
    pose[view.rootId] = root;
  }

  // --- face: expression, blinks, lip-sync ---
  const expression = sampleDiscrete(tracks["expression"], frame, "neutral").value;
  const states: Record<string, string> = {
    ...(view.rig.expressions[expression] ?? view.rig.expressions["neutral"] ?? {}),
  };
  const mouthTrack = tracks["mouth"] ? sampleDiscrete(tracks["mouth"], frame, "rest").value : "rest";
  const speech = props["speaks"] === true ? ctx.speech : undefined;
  if (mouthTrack !== "rest") states["mouth"] = mouthTrack;
  else if (speech) states["mouth"] = visemeFor(speech);
  if (states["eyes"] !== "happy" && isBlinking(nodeSeed, frame, fps)) states["eyes"] = "blink";
  // hand item (phone, document): a slot inside the hand, so it follows every gesture
  const item = sampleDiscrete(
    tracks["item"],
    frame,
    typeof props["holding"] === "string" ? props["holding"] : "neutral",
  ).value;
  if (item !== "neutral" && item !== "none") states["item"] = item;

  // --- placement: ground anchor at (x, y) in world pixels; side view is drawn facing right ---
  const [gx, gy] = view.rig.ground;
  const x = sampleNumber(tracks["x"], frame, 1280);
  const y = sampleNumber(tracks["y"], frame, 1690);
  const scale = sampleNumber(tracks["scale"], frame, 1);
  const opacity = sampleNumber(tracks["opacity"], frame, 1);
  const flip = facing === "left" ? -1 : 1;
  const body = view.template.render({ parts: pose, states });
  const op = opacity < 1 ? ` opacity="${fmt(Math.max(0, opacity))}"` : "";
  return `<g data-node="${nodeId}" data-facing="${facing}"${op} transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale * flip)} ${fmt(scale)}) translate(${-gx} ${-gy})">${op ? OPACITY_GUARD : ""}${body}</g>`;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);
