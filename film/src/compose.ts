/**
 * Composition: turns each shot of a Film Plan into a function of time that returns the frame. Staged shots are
 * framed by shot size (wide, medium, close, over the shoulder, insert) around their subject, with lead room in
 * the direction the subject faces, and a camera that moves for a reason (push in on a realisation, follow a
 * walk, a slow drift so the frame breathes). Editorial shots come from the templates. Text sits on a scrim.
 */
import type { Script } from "@erkasa/contracts";
import type { CastMember, FilmPlan, Shot } from "./contract.js";
import { K, clamp, fmt, ramp, EASES } from "./motion.js";
import { perform, propAt, type Issue, type Performance } from "./perform.js";
import { carryFrom, checkFilm, type Carry } from "./continuity.js";
import { drawProp } from "./props.js";
import { SETS, type SetDef } from "./sets.js";
import { FPS, H, PALETTE as C, W, frame, kineticType } from "./style.js";
import { PARAMS, TEMPLATES, templateEvents, type TemplateCtx } from "./templates.js";
import { anchorTime, shotTimes, type Timing } from "./timing.js";

export interface ComposedShot {
  shot: Shot;
  index: number;
  start: number;
  end: number;
  dur: number;
  /** Frame body (inside the frame) and background colour at local time t. */
  draw(t: number): { body: string; bg: string };
  /** Visible events, local seconds. */
  events: number[];
  /** The people's performance (staged shots): continuity reads it. */
  perf?: Performance;
}

export interface Composed {
  shots: ComposedShot[];
  duration: number;
  issues: Issue[];
}

const LIGHT = { day: 0, golden: 1, dusk: 2, night: 3 } as const;
/** Editorial templates drawn on a light background: their text is dark. */
const LIGHT_BG = new Set(["clock", "word_shadow", "window_dream"]);
/** Templates that already move their own camera. */
const SELF_MOVING = new Set(["clock", "scale", "window_dream", "statement"]);

/** Visible height (world px) for each shot size around a person. */
const SIZE = { wide: 0, medium: 1250, close: 640, ots: 1100, insert: 560 } as const;

export function compose(plan: FilmPlan, timing: Timing, opts: { cast?: CastMember[] } = {}): Composed {
  const issues: Issue[] = [];
  const times = shotTimes(timing, plan);
  const cast = opts.cast ?? plan.cast;
  // continuity: the last staged shot on each set hands its people on to the next one
  const lastOnSet = new Map<string, { perf: Performance; dur: number; index: number }>();
  const carryFor = (setId: string, index: number): Carry | undefined => {
    const l = lastOnSet.get(setId);
    return l ? carryFrom(l.perf, setId, l.dur, l.index === index - 1) : undefined;
  };
  const shots: ComposedShot[] = times.map(({ shot, start, end }, index) => {
    const path = `shots[${index}]`;
    if (!Number.isFinite(start)) {
      issues.push({
        level: "error",
        code: "SHOT_START",
        path: `${path}.from`,
        message: `'${shot.from}' is not a word of scene ${shot.scene}`,
      });
      start = 0;
    }
    const dur = Math.max(0.4, end - start);
    if (end - start < 0.9)
      issues.push({
        level: "error",
        code: "SHOT_TOO_SHORT",
        path,
        message: `shot ${shot.id} lasts ${(end - start).toFixed(2)} s (under 0.9 s): merge it or start it earlier`,
      });
    const at = (a: string): number | undefined => {
      const abs = anchorTime(timing, a as Shot["from"], start, shot.scene);
      return abs === undefined ? undefined : abs - start;
    };
    const words = timing.words
      .filter((w) => w.t >= start && w.t < end)
      .map((w) => ({ word: w.word, t: w.t - start, end: w.end - w.start + w.t - start }));
    const text = shot.text;
    const textAt = text ? at(text.at) : undefined;
    const textOut = text?.out ? at(text.out) : undefined;
    if (text && textAt === undefined)
      issues.push({
        level: "error",
        code: "ANCHOR_UNRESOLVED",
        path: `${path}.text.at`,
        message: `'${text.at}' is not in this shot's narration`,
      });
    const typeLayer = (t: number): string => {
      if (!text || textAt === undefined) return "";
      const y = text.place === "bottom" ? 1430 : text.place === "center" ? 860 : 250;
      const scrim =
        shot.kind === "set"
          ? text.place === "bottom"
            ? `<rect x="0" y="1150" width="${W}" height="770" fill="url(#scrimB)"/>`
            : `<rect x="0" y="0" width="${W}" height="${text.place === "center" ? 1100 : 620}" fill="url(#scrimT)"/>`
          : "";
      const light = shot.kind === "editorial" && LIGHT_BG.has(shot.template ?? "statement");
      return (
        scrim +
        kineticType(t, text.lines, { id: `kt-${index}`, y, at: textAt, out: textOut ?? null, dark: light })
      );
    };
    const events = [...(textAt !== undefined ? [textAt] : [])];

    if (shot.kind === "editorial") {
      const tpl = shot.template ?? "statement";
      const parsed = PARAMS[tpl].safeParse(shot.params);
      if (!parsed.success)
        issues.push({
          level: "error",
          code: "TEMPLATE_PARAMS",
          path: `${path}.params`,
          message: `${tpl}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
        });
      if (tpl === "statement" && !text)
        issues.push({
          level: "error",
          code: "STATEMENT_NO_TEXT",
          path,
          message: "a statement shot needs text",
        });
      const draw = TEMPLATES[tpl];
      const tctx = (t: number): TemplateCtx => ({ t, dur, params: shot.params, at });
      events.push(...templateEvents(tpl, tctx(0)));
      return {
        shot,
        index,
        start,
        end,
        dur,
        events,
        draw: (t) => {
          if (!parsed.success) return { body: typeLayer(t), bg: C.night };
          const d = draw(tctx(t));
          // the editorial camera: a slow push (or a held still for templates that move the camera themselves)
          const z = SELF_MOVING.has(tpl) ? 1 : 1 + 0.07 * (t / Math.max(1, dur));
          const dy = SELF_MOVING.has(tpl) ? 0 : -24 * (t / Math.max(1, dur));
          return {
            body: `<g transform="translate(540 ${fmt(960 + dy)}) scale(${fmt(z)}) translate(-540 -960)">${d.svg}</g>${typeLayer(t)}`,
            bg: d.bg,
          };
        },
      };
    }

    // ---------------------------------------------------------------- staged shot
    const set = SETS[shot.set ?? "office"];
    const carry = carryFor(set.id, index);
    const perf = perform({ set, shot, path, dur, cast, at, words, ...(carry ? { carry } : {}) });
    lastOnSet.set(set.id, { perf, dur, index });
    issues.push(...perf.issues);
    events.push(...perf.events);
    const lightKeys: Array<[number, number]> = [[0, LIGHT[shot.light ?? "golden"]]];
    if (shot.lightTo) {
      const t1 = at(shot.lightTo.at);
      if (t1 === undefined)
        issues.push({
          level: "error",
          code: "ANCHOR_UNRESOLVED",
          path: `${path}.lightTo.at`,
          message: `'${shot.lightTo.at}' is not in this shot's narration`,
        });
      else lightKeys.push([t1, LIGHT[shot.light ?? "golden"]], [t1 + 2.2, LIGHT[shot.lightTo.to]]);
    }
    const subject = subjectOf(shot, perf, set);
    if (shot.subject && !subject.known)
      issues.push({
        level: "error",
        code: "SUBJECT_UNKNOWN",
        path: `${path}.subject`,
        message: `'${shot.subject}' is not a person, prop or target of the shot`,
      });
    const camAt = camera(shot, set, subject, dur);
    return {
      shot,
      index,
      start,
      end,
      dur,
      events,
      perf,
      draw: (t) => {
        const light = K(
          t,
          lightKeys.map(([a, b]) => [a, b, "io"]),
        );
        const state = { t: start + t, light, door: perf.door.at(t) };
        const cam = camAt(t);
        const drawn = [...perf.actors.values()]
          .sort((a, b) => a.x.at(t) - b.x.at(t))
          .map((a) => ({ a, d: a.draw(t) }));
        const restingBack: string[] = [];
        const restingFront: string[] = [];
        const held: string[] = [];
        for (const [id, pr] of perf.props) {
          let holder: string | null = null;
          for (const e of pr.events) if (e.t <= t) holder = e.holder;
          const p = propAt(pr, t, perf.actors);
          if (holder) {
            const a = perf.actors.get(holder);
            held.push(
              drawProp(pr.kind, p[0], p[1] - 4, {
                facing: a?.facingAt(t) ?? 1,
                rot: pr.kind === "paper" ? -12 * (a?.facingAt(t) ?? 1) : 0,
              }),
            );
          } else
            (set.id === "interview" ? restingFront : restingBack).push(
              drawProp(pr.kind, p[0], p[1], { resting: true }),
            );
          void id;
        }
        const world =
          set.back(state) +
          restingBack.join("") +
          drawn.map((x) => x.d.svg).join("") +
          held.join("") +
          set.front(state) +
          restingFront.join("");
        const s = H / cam.height;
        const ots = shot.framing === "ots" ? otsShoulder(t, dur, subject.facing) : "";
        return {
          body: `<g transform="translate(${W / 2} ${H / 2}) scale(${fmt(s)}) translate(${fmt(-cam.cx)} ${fmt(-cam.cy)})">${world}</g>${ots}${typeLayer(t)}`,
          bg: C.night,
        };
      },
    };
  });
  const duration = shots.length ? (shots[shots.length - 1] as ComposedShot).end : 0;
  issues.push(...checkFilm(shots).issues);
  return { shots, duration, issues };
}

interface Subject {
  known: boolean;
  at(t: number): [number, number];
  facing: 1 | -1;
  kind: "person" | "thing";
}

function subjectOf(shot: Shot, perf: Performance, set: SetDef): Subject {
  const id = shot.subject ?? shot.actors[0]?.id;
  const actor = id ? perf.actors.get(id) : undefined;
  if (actor) return { known: true, at: (t) => actor.draw(t).head, facing: actor.facingAt(0), kind: "person" };
  const pr = id ? perf.props.get(id) : undefined;
  if (pr) return { known: true, at: (t) => propAt(pr, t, perf.actors), facing: 1, kind: "thing" };
  const tg = id
    ? (set.targets[id] ??
      (set.marks[id] ? ([set.marks[id].x, set.floor - 400] as [number, number]) : undefined))
    : undefined;
  if (tg) return { known: true, at: () => tg, facing: 1, kind: "thing" };
  return { known: !id, at: () => [set.wide.cx, set.wide.cy], facing: 1, kind: "thing" };
}

interface Cam {
  cx: number;
  cy: number;
  height: number;
}

function camera(shot: Shot, set: SetDef, subject: Subject, dur: number): (t: number) => Cam {
  const framing = shot.framing ?? (shot.actors.length ? "medium" : "wide");
  const base = (t: number): Cam => {
    if (framing === "wide") return { cx: set.wide.cx, cy: set.wide.cy, height: set.wide.height };
    const [sx, sy] = subject.at(t);
    const height = SIZE[framing];
    const vw = (height * W) / H;
    if (subject.kind === "thing") return { cx: sx, cy: sy + height * 0.05, height };
    const lead = framing === "ots" ? 0 : subject.facing * vw * (framing === "close" ? 0.12 : 0.16);
    // leave room for the type: with text at the top the person sits lower in the frame, and the other way round
    const room =
      shot.text?.place === "top"
        ? -height * (framing === "close" ? 0.2 : 0.13)
        : shot.text?.place === "bottom"
          ? height * 0.08
          : 0;
    const cy =
      (framing === "close"
        ? sy + height * 0.12
        : framing === "ots"
          ? sy + height * 0.1
          : sy + height * 0.27) + room;
    return { cx: sx + lead, cy, height };
  };
  const clampCam = (c: Cam): Cam => {
    const height = Math.min(c.height, set.h);
    const vw = (height * W) / H;
    const cx = vw >= set.w ? set.w / 2 : clamp(c.cx, vw / 2, set.w - vw / 2);
    const cy = clamp(c.cy, height / 2, set.h - height / 2);
    return { cx, cy, height };
  };
  const start = base(0);
  return (t) => {
    const follow = shot.camera === "follow";
    const b = follow ? smoothFollow(base, t) : start;
    const p = t / Math.max(0.1, dur);
    let zoom = 1;
    let dx = 0;
    switch (shot.camera) {
      case "push_in":
        zoom = 1 + 0.12 * EASES.io(clamp(p));
        break;
      case "pull_out":
        zoom = 1.14 - 0.14 * EASES.out(clamp(p));
        break;
      case "drift":
        zoom = 1 + 0.035 * p;
        dx = 18 * p * subject.facing;
        break;
      default:
        break;
    }
    return clampCam({ cx: b.cx + dx, cy: b.cy, height: b.height / zoom });
  };
}

/** The camera follows a moving subject with a short lag (a camera operator, not a lock). */
function smoothFollow(base: (t: number) => Cam, t: number): Cam {
  let cx = 0,
    cy = 0,
    n = 0;
  for (let k = 0; k <= 6; k++) {
    const s = Math.max(0, t - k * 0.06);
    const c = base(s);
    cx += c.cx;
    cy += c.cy;
    n++;
  }
  const c0 = base(t);
  return { cx: cx / n, cy: cy / n, height: c0.height };
}

/** Over the shoulder: the near shoulder and head of the subject, dark, in the foreground. */
function otsShoulder(t: number, dur: number, facing: 1 | -1): string {
  const sh = ramp(t, 0, dur, "lin");
  const mirror = facing === 1 ? "" : ` transform="translate(${W} 0) scale(-1 1)"`;
  return `<g${mirror}><g transform="translate(${fmt(-90 * sh)} ${fmt(60 * sh)})"><path d="M-80 1920 Q-40 1500 200 1430 Q420 1380 520 1560 L560 1920Z" fill="#141B2E"/><ellipse cx="300" cy="1270" rx="190" ry="210" fill="#141B2E"/></g></g>`;
}

// ---------------------------------------------------------------- frames and transitions

const SCRIMS = `<linearGradient id="scrimT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0C1529" stop-opacity=".78"/><stop offset="1" stop-color="#0C1529" stop-opacity="0"/></linearGradient>
<linearGradient id="scrimB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0C1529" stop-opacity="0"/><stop offset="1" stop-color="#0C1529" stop-opacity=".8"/></linearGradient>`;

const TRANSITION_SEC = { cut: 0, fade: 0.45, whip: 0.32 } as const;

/** The full SVG of frame `n` of shot `i` (local frame), with the transition from the previous shot inside. */
export function frameAt(c: Composed, i: number, n: number): string {
  const s = c.shots[i] as ComposedShot;
  const t = n / FPS;
  const cur = s.draw(t);
  const prev = c.shots[i - 1];
  const tr = TRANSITION_SEC[s.shot.transition];
  let body = `<rect width="${W}" height="${H}" fill="${cur.bg}"/>${cur.body}`;
  if (prev && tr > 0 && t < tr) {
    const p = EASES.io(t / tr);
    const pd = prev.draw(prev.dur + t);
    const pb = `<rect width="${W}" height="${H}" fill="${pd.bg}"/>${pd.body}`;
    if (s.shot.transition === "fade") body = `${pb}<g opacity="${fmt(p)}">${body}</g>`;
    else
      body = `<g transform="translate(${fmt(-W * p)} 0)">${pb}</g><g transform="translate(${fmt(W * (1 - p))} 0)">${body}</g>`;
  }
  return frame(`<defs>${SCRIMS}</defs>${body}`, cur.bg);
}

/** Total frames of a shot. */
export const shotFrames = (s: ComposedShot): number =>
  Math.max(1, Math.round(s.end * FPS) - Math.round(s.start * FPS));

export type { Script };
