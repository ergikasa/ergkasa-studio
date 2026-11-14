/**
 * Quality checks on a composed film, from the standard: no dead time, shots of a readable length, varied
 * framing, the same people in the same clothes, shots in story order. Errors go back to the director for repair;
 * warnings are reported.
 */
import type { Script } from "@erkasa/contracts";
import type { Composed } from "./compose.js";
import type { FilmPlan } from "./contract.js";
import type { Issue } from "./perform.js";

export const MAX_SHOT = 7.5;
export const DEAD = 3.0;

export function checkFilm(plan: FilmPlan, c: Composed, script: Script): Issue[] {
  const out: Issue[] = [];
  const castIds = new Set(plan.cast.map((m) => m.id));
  const scenes = new Set(script.scenes.map((s) => s.sceneId));
  c.shots.forEach((s, i) => {
    const path = `shots[${i}]`;
    if (!scenes.has(s.shot.scene))
      out.push({
        level: "error",
        code: "SCENE_UNKNOWN",
        path: `${path}.scene`,
        message: `'${s.shot.scene}' is not a scene of the script`,
      });
    const prev = c.shots[i - 1];
    if (prev && s.start <= prev.start)
      out.push({
        level: "error",
        code: "SHOT_ORDER",
        path: `${path}.from`,
        message: `shot ${s.shot.id} starts before the previous one ends: shots must follow the narration`,
      });
    if (s.dur > MAX_SHOT)
      out.push({
        level: "error",
        code: "SHOT_TOO_LONG",
        path,
        message: `shot ${s.shot.id} lasts ${s.dur.toFixed(1)} s: split it into two shots (a new framing, a reaction, an insert) at a word`,
      });
    const ev = [...new Set(s.events.map((e) => Math.round(e * 10) / 10))]
      .filter((e) => e >= 0 && e <= s.dur)
      .sort((a, b) => a - b);
    ev.push(s.dur);
    let last = 0;
    for (const e of ev) {
      if (e - last > DEAD && s.shot.camera !== "follow")
        out.push({
          level: "error",
          code: "DEAD_TIME",
          path,
          message: `nothing happens in shot ${s.shot.id} from ${last.toFixed(1)} s to ${e.toFixed(1)} s: add an action, a reaction or a text beat`,
        });
      last = e;
    }
    for (const a of s.shot.actors)
      if (castIds.size && !castIds.has(a.id))
        out.push({
          level: "warning",
          code: "NOT_IN_CAST",
          path: `${path}.actors`,
          message: `${a.id} is not in the cast (drawn with default looks)`,
        });
    if (
      prev &&
      prev.shot.kind === "set" &&
      s.shot.kind === "set" &&
      prev.shot.set === s.shot.set &&
      (prev.shot.framing ?? "medium") === (s.shot.framing ?? "medium") &&
      (prev.shot.subject ?? "") === (s.shot.subject ?? "")
    )
      out.push({
        level: "error",
        code: "SAME_FRAMING",
        path: `${path}.framing`,
        message: `same place, subject and framing as the previous shot: it reads as a jump cut; change the shot size or the subject`,
      });
  });
  const statements = plan.shots.filter((s) => s.template === "statement").length;
  if (plan.shots.length >= 6 && statements > plan.shots.length / 4)
    out.push({
      level: "error",
      code: "TOO_MANY_STATEMENTS",
      path: "shots",
      message: `${statements} of ${plan.shots.length} shots are only text; show the idea instead`,
    });
  return out;
}

/** Median shot length, for reports. */
export function medianShot(c: Composed): number {
  const d = c.shots.map((s) => s.dur).sort((a, b) => a - b);
  return d.length ? (d[Math.floor(d.length / 2)] as number) : 0;
}
