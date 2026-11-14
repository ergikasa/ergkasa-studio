import { SETS, type Issue } from "@erkasa/compiler";
import type { Script, VideoPlan } from "@erkasa/contracts";
import type { StrictSchema } from "./llm.js";

/**
 * The planner model answers in a flat "draft" shape instead of the full Video Plan: every field is
 * required (sentinel values mean "not used"), there are no unions, and time anchors are short
 * strings. That keeps the schema inside the structured-outputs limits and makes answers easy to
 * repair. `draftToPlan` turns a draft into a real Video Plan; the compiler then checks everything.
 */

const ANCHOR_DOC =
  'When: "start" | "sec:1.5" (seconds into the scene) | "word:habits" (when that narration word is spoken; "word:habits#2" for its 2nd occurrence) | "after:drini.walk" (when that layer\'s action ends; "after:drini.walk+0.3" to add seconds)';

const ENTER = ["none", "fade", "pop", "slide_left", "slide_right", "slide_up", "draw_on", "grow"] as const;
const CHART = ["none", "bar", "line", "counter", "compare", "pie", "linear_vs_exponential"] as const;
const TRANSITION = ["cut", "fade", "slide", "wipe", "zoom", "whip"] as const;
const CAMERA = [
  "static",
  "push_in",
  "pull_out",
  "pan_left",
  "pan_right",
  "follow",
  "shake",
  "punch_in",
  "travel",
] as const;

const BLOCKING = ["seated", "standing", "enter", "walk_to", "sit", "stand_up", "give", "exit"] as const;

const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const arr = (items: unknown) => ({ type: "array", items });

export const DRAFT_SCHEMA: StrictSchema = obj({
  scenes: arr(
    obj({
      sceneId: str("Same id as the script scene, e.g. s01."),
      direction: obj({
        idea: str("The one idea this scene must make the viewer understand, in a sentence."),
        demonstration: {
          type: "string",
          enum: ["story_moment", "comparison", "metaphor_change", "diagram", "statement"],
          description:
            "How the idea is SHOWN: story_moment = people in a concrete situation doing something; comparison = two cases side by side; metaphor_change = an object or metaphor that changes; diagram = a chart or process built up; statement = only a title or the host (rare).",
        },
        before: str("What the viewer sees at the start of the scene."),
        after: str("What the viewer sees at the end: the visible change that proves the idea."),
        focus: str("Layer id the eye follows."),
      }),
      background: str("Background asset id (on a set: the set's background)."),
      set: {
        type: "string",
        enum: ["none", ...Object.keys(SETS)],
        description:
          "A staged set where actors walk, sit and hand things over (see Staged sets); none otherwise.",
      },
      shot: obj({
        size: { type: "string", enum: ["wide", "medium", "close", "insert"] },
        subject: str('Layer id to frame; "" = the speaking actor (or the first object for insert).'),
        zone: str(
          'Wide place: the zone the scene starts in (see the background\'s zones); "" for ordinary places.',
        ),
      }),
      layers: arr(
        obj({
          id: str("Unique within the scene, lowercase, e.g. drini, coin, title."),
          purpose: str(
            "Why this layer is here: what it does for the scene's idea (an actor's role in the moment, an object's job). A layer without a job does not belong in the scene.",
          ),
          type: { type: "string", enum: ["actor", "object", "icon", "metaphor", "text", "chart"] },
          assetId: str('Asset id for actor/object/icon/metaphor; "" for text and chart.'),
          x: num("Horizontal position, 0 = left edge, 0.5 = center, 1 = right edge of the 9:16 frame."),
          y: num(
            "Vertical position 0 = top, 1 = bottom. Use -1 for actors (they stand on the ground) or to use `region`.",
          ),
          scale: num("Size multiplier, 1 = default size."),
          region: { type: "string", enum: ["none", "top-safe", "center", "bottom-safe"] },
          zone: str(
            'Wide place: the zone this layer stands in (x is then relative to that zone); "" = the scene\'s own view.',
          ),
          facing: { type: "string", enum: ["front", "left", "right"] },
          expression: str('Actor expression, e.g. neutral. "" for non-actors.'),
          speaks: {
            type: "boolean",
            description: "Actor lip-syncs the narration. At most one speaker per scene.",
          },
          holding: {
            type: "string",
            enum: ["none", "phone", "document"],
            description: "Item in the actor's right hand.",
          },
          outfit: str(
            'Actor outfit from the character\'s outfits; "" = their usual clothes. The person stays the same.',
          ),
          blocking: arr(
            obj({
              do: { type: "string", enum: [...BLOCKING] },
              mark: str('A mark of the scene\'s set (door, chair_left...), "" if the step needs none.'),
              to: str('give: the id of the actor who receives; "" otherwise.'),
              at: str(`When; "" = right after the previous step. ${ANCHOR_DOC}`),
            }),
          ),
          attachTo: str(
            'Objects/metaphors on a set: "<actorId>:above_head" or "<actorId>:beside" to stay with that actor; "" otherwise.',
          ),
          enter: { type: "string", enum: [...ENTER] },
          enterAt: str(ANCHOR_DOC),
          actions: arr(
            obj({
              action: str("Exact action name from the character's list for its facing."),
              at: str(ANCHOR_DOC),
              durationSec: num("0 = default duration."),
              toX: num("Walk/run destination x (0..1), or -1 if the action does not move."),
              toZone: str('Wide place: the zone the walk ends in; "" = the scene\'s own view.'),
              expression: str('Face from this moment on (an expression name), or "" to keep it.'),
            }),
          ),
          animations: arr(obj({ name: str("Exact animation name from the asset."), at: str(ANCHOR_DOC) })),
          label: str(
            'A short sign next to an object, in the world (at most 24 characters, e.g. "LOCKED", "ONLY 3 CUTS"); "" = none. Key concepts only: at most 6 labels in the whole film.',
          ),
          labelAt: str(`When the sign appears; "" = with the object. ${ANCHOR_DOC}`),
          text: str('Text layers: the words to show (max 40 characters). "" otherwise.'),
          textStyle: str('Text style name, or "".'),
          highlight: arr(str("Word inside `text` to color with the accent.")),
          chart: { type: "string", enum: [...CHART] },
          chartData: arr(obj({ label: str("Short label."), value: num("Number.") })),
          unit: str('Value prefix/suffix such as "$", "%", "k", or "".'),
        }),
      ),
      camera: arr(
        obj({
          move: { type: "string", enum: [...CAMERA] },
          at: str(ANCHOR_DOC),
          to: num("Zoom target for push_in/pull_out/punch_in (e.g. 1.08), pan amount for pans; 0 = default."),
          zone: str('travel: the zone of a wide place the camera moves to; "" otherwise.'),
          target: str(
            'travel: the layer id the camera travels WITH (it walks, the camera follows it); "" otherwise.',
          ),
        }),
      ),
      effects: arr(
        obj({ preset: str("Particle effect name or a screen overlay id (fx_...)."), intensity: num("0..1") }),
      ),
      transition: { type: "string", enum: [...TRANSITION], description: "Transition into the next scene." },
      transitionDirection: { type: "string", enum: ["none", "left", "right", "up", "down"] },
    }),
  ),
});

export interface DraftLayer {
  id: string;
  type: "actor" | "object" | "icon" | "metaphor" | "text" | "chart";
  assetId: string;
  x: number;
  y: number;
  scale: number;
  region: "none" | "top-safe" | "center" | "bottom-safe";
  zone?: string;
  facing: "front" | "left" | "right";
  expression: string;
  speaks: boolean;
  holding: "none" | "phone" | "document";
  outfit?: string;
  blocking?: Array<{ do: (typeof BLOCKING)[number]; mark: string; to: string; at: string }>;
  attachTo?: string;
  enter: (typeof ENTER)[number];
  enterAt: string;
  actions: Array<{
    action: string;
    at: string;
    durationSec: number;
    toX: number;
    toZone?: string;
    expression: string;
  }>;
  animations: Array<{ name: string; at: string }>;
  label?: string;
  labelAt?: string;
  text: string;
  textStyle: string;
  highlight: string[];
  chart: (typeof CHART)[number];
  chartData: Array<{ label: string; value: number }>;
  unit: string;
  purpose?: string;
}

export interface DraftScene {
  sceneId: string;
  direction?: { idea: string; demonstration: string; before: string; after: string; focus: string };
  background: string;
  set?: string;
  shot: { size: "wide" | "medium" | "close" | "insert"; subject: string; zone?: string };
  layers: DraftLayer[];
  camera: Array<{ move: (typeof CAMERA)[number]; at: string; to: number; zone?: string; target?: string }>;
  effects: Array<{ preset: string; intensity: number }>;
  transition: (typeof TRANSITION)[number];
  transitionDirection: "none" | "left" | "right" | "up" | "down";
}

export interface Draft {
  scenes: DraftScene[];
}

type Anchor =
  | "start"
  | { sec: number }
  | { word: string; occurrence: number; offsetSec?: number }
  | { after: string; offsetSec: number };

const DEMONSTRATIONS = ["story_moment", "comparison", "metaphor_change", "diagram", "statement"] as const;

/** The draft's direction as the plan contract has it (absent or unusable = undefined). */
function direction(d: DraftScene["direction"]) {
  if (!d?.idea?.trim() || !DEMONSTRATIONS.includes(d.demonstration as (typeof DEMONSTRATIONS)[number]))
    return undefined;
  return {
    idea: d.idea.trim().slice(0, 200),
    demonstration: d.demonstration as (typeof DEMONSTRATIONS)[number],
    before: (d.before.trim() || "-").slice(0, 160),
    after: (d.after.trim() || "-").slice(0, 160),
    ...(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(d.focus.trim()) ? { focus: d.focus.trim() } : {}),
  };
}

/** How long a text overlay stays before it fades out. */
export const TEXT_HOLD_SEC = 2.6;

/** The same anchor, `sec` seconds later. */
function later(a: Anchor, sec: number): Anchor {
  if (a === "start") return { sec };
  if ("sec" in a) return { sec: a.sec + sec };
  if ("word" in a) return { ...a, offsetSec: (a.offsetSec ?? 0) + sec };
  return { ...a, offsetSec: a.offsetSec + sec };
}

/** Parses the short anchor syntax. Bad input gives `{ error }`. */
export function parseAnchor(s: string): Anchor | { error: string } {
  const t = s.trim();
  if (t === "" || t === "start") return "start";
  let m = /^sec:(\d+(?:\.\d+)?)$/.exec(t);
  if (m) return { sec: Number(m[1]) };
  m = /^word:([^#\s]+)(?:#(\d+))?$/.exec(t);
  if (m) return { word: m[1] as string, occurrence: m[2] ? Number(m[2]) : 1 };
  m = /^after:([A-Za-z][\w-]*\.[a-z_]+)([+-]\d+(?:\.\d+)?)?$/.exec(t);
  if (m) return { after: m[1] as string, offsetSec: m[2] ? Number(m[2]) : 0 };
  return { error: `bad time anchor "${s}"; use ${ANCHOR_DOC}` };
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Builds the Video Plan. Narration always comes from the script (the planner cannot change what is
 * said). Structural problems are returned as issues in the compiler's format, so the repair loop
 * handles them the same way as compile errors.
 */
export function draftToPlan(
  draft: Draft,
  script: Script,
  opts: { projectId: string; voiceId: string },
): { plan?: VideoPlan; issues: Issue[] } {
  const issues: Issue[] = [];
  const err = (path: string, message: string, hint?: string): void => {
    issues.push({ level: "error", code: "DRAFT", path, message, ...(hint ? { hint } : {}) });
  };
  if (draft.scenes.length !== script.scenes.length)
    err(
      "scenes",
      `plan has ${draft.scenes.length} scenes, the script has ${script.scenes.length}`,
      "one plan scene per script scene, same order",
    );

  const at = (s: string, path: string): Anchor => {
    const a = parseAnchor(s);
    if (typeof a === "object" && "error" in a) {
      err(path, a.error);
      return "start";
    }
    return a;
  };

  const scenes = script.scenes.map((sc, i) => {
    const d = draft.scenes[i];
    const path = `scenes[${i}]`;
    const last = i === script.scenes.length - 1;
    if (!d) return undefined;
    const layers = d.layers.map((l, li) => {
      const lp = `${path}.layers[${li}]`;
      const base = {
        id: l.id,
        place: placement(l),
        ...(l.purpose?.trim() ? { purpose: l.purpose.trim().slice(0, 160) } : {}),
        ...(l.enter !== "none"
          ? {
              in: {
                effect: l.enter,
                at: at(l.enterAt, `${lp}.enterAt`),
                durationSec: l.enter === "draw_on" ? 1.4 : 0.45,
              },
            }
          : {}),
      };
      switch (l.type) {
        case "actor":
          return {
            ...base,
            type: "actor" as const,
            assetId: l.assetId,
            facing: l.facing,
            expression: l.expression || "neutral",
            speaks: l.speaks,
            ...(l.holding && l.holding !== "none" ? { holding: l.holding } : {}),
            ...(l.outfit?.trim() ? { outfit: l.outfit.trim() } : {}),
            blocking: (l.blocking ?? []).map((b, bi) => ({
              do: b.do,
              ...(b.mark.trim() ? { mark: b.mark.trim() } : {}),
              ...(b.to.trim() ? { to: b.to.trim() } : {}),
              ...(b.at.trim() ? { at: at(b.at, `${lp}.blocking[${bi}].at`) } : {}),
            })),
            actions: l.actions.map((a, ai) => ({
              action: a.action,
              at: at(a.at, `${lp}.actions[${ai}].at`),
              ...(a.durationSec > 0 ? { durationSec: a.durationSec } : {}),
              ...(a.toX >= 0
                ? {
                    to: {
                      x: clamp(a.toX, -0.5, 1.5),
                      ...(a.toZone?.trim() ? { zone: a.toZone.trim() } : {}),
                    },
                  }
                : {}),
              ...(a.expression?.trim() ? { expression: a.expression.trim() } : {}),
            })),
          };
        case "object":
        case "icon":
        case "metaphor":
          return {
            ...base,
            type: l.type,
            assetId: l.assetId,
            ...attachOf(l.attachTo, `${lp}.attachTo`, err),
            ...(l.label?.trim()
              ? {
                  label: {
                    text: l.label.trim().slice(0, 24),
                    at: l.labelAt?.trim() ? at(l.labelAt, `${lp}.labelAt`) : ("start" as const),
                  },
                }
              : {}),
            animations: l.animations.map((a, ai) => ({
              name: a.name,
              at: at(a.at, `${lp}.animations[${ai}].at`),
            })),
          };
        case "text":
          return {
            ...base,
            // a title supports the moment, then gets out of the way
            out: {
              effect: "fade" as const,
              at: later(l.enter === "none" ? "start" : at(l.enterAt, `${lp}.enterAt`), TEXT_HOLD_SEC),
              durationSec: 0.35,
            },
            type: "text" as const,
            content: l.text.trim(),
            style: l.textStyle || "hook_impact",
            highlight: l.highlight,
          };
        case "chart":
          if (l.chart === "none") err(`${lp}.chart`, "chart layer needs a chart kind");
          return {
            ...base,
            type: "chart" as const,
            chart: l.chart === "none" ? ("bar" as const) : l.chart,
            data: l.chartData,
            ...(l.unit ? { unit: l.unit } : {}),
          };
      }
    });
    return {
      schema: "erkasa.scene-plan/1" as const,
      sceneId: sc.sceneId,
      engine: "2d" as const,
      ...(direction(d.direction) ? { direction: direction(d.direction) } : {}),
      narration: sc.narration,
      durationPolicy: { mode: "fitNarration" as const, padAfterSec: last ? 1.2 : 0.45 },
      background: { assetId: d.background },
      ...(d.set && d.set !== "none" ? { set: { id: d.set } } : {}),
      ...(d.shot
        ? {
            shot: {
              size: d.shot.size,
              ...(d.shot.subject?.trim() ? { subject: d.shot.subject.trim() } : {}),
              ...(d.shot.zone?.trim() ? { zone: d.shot.zone.trim() } : {}),
            },
          }
        : {}),
      layers,
      effects: d.effects.map((e) => ({ preset: e.preset, intensity: clamp(e.intensity, 0, 1) })),
      camera: d.camera.map((c, ci) => ({
        move: c.move,
        at: at(c.at, `${path}.camera[${ci}].at`),
        ...(c.to > 0 ? { to: c.to } : {}),
        ...(c.zone?.trim() ? { zone: c.zone.trim() } : {}),
        ...(c.target?.trim() ? { target: c.target.trim() } : {}),
      })),
      transitionOut: last
        ? { type: "cut" as const, durationSec: 0 }
        : {
            type: d.transition,
            ...(d.transitionDirection !== "none" ? { direction: d.transitionDirection } : {}),
            durationSec: d.transition === "cut" ? 0 : 0.35,
          },
    };
  });
  if (issues.length) return { issues };
  const plan = {
    schema: "erkasa.video-plan/1" as const,
    projectId: opts.projectId,
    language: "en" as const,
    format: "9:16" as const,
    fps: 30 as const,
    voiceId: opts.voiceId,
    scenes: scenes.filter((s) => s !== undefined),
  };
  return { plan: plan as VideoPlan, issues };
}

function placement(l: DraftLayer): VideoPlan["scenes"][number]["layers"][number]["place"] {
  const scale = l.scale > 0 ? clamp(l.scale, 0.1, 10) : 1;
  const x = clamp(l.x, -0.5, 1.5);
  const zone = l.zone?.trim() ? { zone: l.zone.trim() } : {};
  if (l.type === "actor" && l.y < 0) return { anchor: "ground", x, scale, ...zone };
  return {
    ...zone,
    anchor: "free",
    x,
    ...(l.y >= 0 ? { y: clamp(l.y, -0.5, 1.5) } : {}),
    scale,
    ...(l.region !== "none" ? { region: l.region } : {}),
  };
}

/** "alex:above_head" -> attach; "" -> nothing. */
function attachOf(
  s: string | undefined,
  path: string,
  err: (path: string, message: string, hint?: string) => void,
): { attach?: { to: string; at: "above_head" | "beside" } } {
  const t = (s ?? "").trim();
  if (!t) return {};
  const m = /^([A-Za-z][\w-]*):(above_head|beside)$/.exec(t);
  if (!m) {
    err(path, `bad attachTo "${t}"`, 'use "<actorId>:above_head" or "<actorId>:beside"');
    return {};
  }
  return { attach: { to: m[1] as string, at: m[2] as "above_head" | "beside" } };
}
