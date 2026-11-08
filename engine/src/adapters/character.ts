import { Rig, type AssetMeta, type Rig as RigT } from "@erkasa/contracts";
import { hashString, mulberry32 } from "../core/random.js";
import { OPACITY_GUARD, SvgTemplate, fmt } from "../core/svg-template.js";
import { sampleDiscrete, sampleNumber, type Tracks } from "../core/tracks.js";
import { ACTIONS, blendPoses, type Pose } from "./actions.js";

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

export interface PreparedCharacter {
  meta: AssetMeta;
  rig: RigT;
  template: SvgTemplate;
}

export function prepareCharacter(meta: AssetMeta, svgText: string, rigText: string): PreparedCharacter {
  const rig = Rig.parse(JSON.parse(rigText));
  const template = SvgTemplate.compile(svgText, meta.assetId);
  template.requireParts(
    rig.bones.filter((b) => b.parent !== null && b.id !== "hips").map((b) => b.svgGroup),
    meta.assetId,
  );
  for (const slot of Object.keys(rig.slots)) {
    if (!template.slots.has(slot)) throw new Error(`${meta.assetId}: missing face slot ${slot}`);
  }
  return { meta, rig, template };
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

  // --- body: action clips with cross-fade ---
  const clip = sampleDiscrete(tracks["clip"], frame, "idle");
  const act = (name: string, since: number): Pose => {
    const fn = ACTIONS[name];
    if (!fn) throw new Error(`${c.meta.assetId}: unknown action '${name}'`);
    return fn((frame - since) / fps, phase);
  };
  let pose = act(clip.value, clip.since);
  if (clip.previous)
    pose = blendPoses(act(clip.previous.value, clip.previous.since), pose, smooth(clip.blend));

  // --- face: expression, blinks, lip-sync ---
  const expression = sampleDiscrete(tracks["expression"], frame, "neutral").value;
  const faceStates = c.rig.expressions[expression] ?? c.rig.expressions["neutral"] ?? {};
  const states: Record<string, string> = { ...faceStates };
  const mouthTrack = tracks["mouth"] ? sampleDiscrete(tracks["mouth"], frame, "rest").value : "rest";
  const speaks = props["speaks"] === true;
  const speech = speaks ? ctx.speech : undefined;
  if (mouthTrack !== "rest") states["mouth"] = mouthTrack;
  else if (speech) states["mouth"] = visemeFor(speech);
  if (states["eyes"] !== "happy" && isBlinking(nodeSeed, frame, fps)) states["eyes"] = "blink";

  // --- placement: ground anchor at (x, y) in world pixels ---
  const [gx, gy] = c.rig.ground;
  const x = sampleNumber(tracks["x"], frame, 1280);
  const y = sampleNumber(tracks["y"], frame, 1690);
  const scale = sampleNumber(tracks["scale"], frame, 1);
  const opacity = sampleNumber(tracks["opacity"], frame, 1);
  const flip = props["facing"] === "left" ? -1 : 1;
  const body = c.template.render({ parts: pose, states });
  const op = opacity < 1 ? ` opacity="${fmt(Math.max(0, opacity))}"` : "";
  return `<g data-node="${nodeId}"${op} transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale * flip)} ${fmt(scale)}) translate(${-gx} ${-gy})">${op ? OPACITY_GUARD : ""}${body}</g>`;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);
