/**
 * Body-mechanics measurements of a prepared film, read from the performance data (not from pixels):
 *   foot slide   how far a planted foot moves along the floor while it carries the weight (px per frame)
 *   jerk         the largest change of the body's speed from one frame to the next (px/frame²)
 *   turn width   how thin the body gets while turning around (1 = full, 0.05 = a sheet of paper)
 *   gait by mood walking speed and stride under different moods
 * Run: pnpm w0:mech  (prints a JSON report)
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "@erkasa/contracts";
import { skeleton, toWorld } from "../rig.js";
import { FPS } from "../style.js";
import { parsePlan, prepare, type Prepared } from "./composer.js";

export interface MechReport {
  walks: number;
  footSlideMaxPx: number;
  footSlideMeanPx: number;
  jerkMaxPx: number;
  footJumpMaxPx: number;
  footJumpAt: string;
  turnMinWidth: number;
  turns: number;
  speedByMood: Record<string, number>;
}

/** Stance windows by gait phase, independent of the engine (so old and new versions are measured the same way). */
function stanceOf(w: { t0: number; t1: number; cycle?: number }, t: number, near: boolean): { contact: number; weight: number } | undefined {
  const c = w.cycle ?? 1.25;
  const off = near ? 0 : 0.5 * c;
  const n = Math.floor((t - w.t0 - off) / c);
  if (n < 0) return undefined;
  const contact = w.t0 + off + n * c;
  if (contact > w.t1 || t > w.t1 - 0.3) return undefined;
  return t < contact + 0.5 * c ? { contact, weight: 1 } : undefined;
}

export function measure(P: Prepared): MechReport {
  const slides: number[] = [];
  let jerk = 0;
  let turnMin = 1;
  let turns = 0;
  let walks = 0;
  let pops = 0;
  let popAt = "";
  const speeds: Record<string, number[]> = {};
  for (const s of P.shots) {
    if (!s.perf) continue;
    for (const a of s.perf.actors.values()) {
      for (const w of a.walks) {
        walks++;
        const ankles = (t: number): Array<[number, number]> => {
          const sk = skeleton(a.pose(t));
          const pl = a.placed(t);
          return [toWorld(pl, sk.ankle), toWorld(pl, sk.ankleF)];
        };
        let prevV: number | undefined;
        for (let t = w.t0; t + 1 / FPS <= Math.min(w.t1, s.dur); t += 1 / FPS) {
          const A = ankles(t);
          const B = ankles(t + 1 / FPS);
          // slide: the foot that carries the weight (per the gait's phase) must not move along the floor
          for (const [k, near] of [[0, true], [1, false]] as Array<[number, boolean]>) {
            const s0 = stanceOf(w, t, near);
            const s1 = stanceOf(w, t + 1 / FPS, near);
            if (s0?.weight === 1 && s1?.weight === 1 && s0.contact === s1.contact)
              slides.push(Math.abs((B[k] as [number, number])[0] - (A[k] as [number, number])[0]));
            // pop: any foot jumping more than a stride's worth in one frame
            const jump = Math.hypot((B[k] as [number, number])[0] - (A[k] as [number, number])[0], (B[k] as [number, number])[1] - (A[k] as [number, number])[1]);
            if (jump > pops) { pops = jump; popAt = `${s.w.shot.id}@${(t - w.t0).toFixed(2)}s/${near ? "near" : "far"}`; }
          }
          const v = a.x.at(t + 1 / FPS) - a.x.at(t);
          if (prevV !== undefined) jerk = Math.max(jerk, Math.abs(v - prevV));
          prevV = v;
        }
        // a mood label for the gait: the actor's mood track at the middle of the walk
        const mood = s.w.shot.actors.find((x) => x.id === a.id)?.mood ?? "neutral";
        const dist = Math.abs(a.x.at(w.t1) - a.x.at(w.t0));
        (speeds[mood] ??= []).push(dist / Math.max(0.01, w.t1 - w.t0));
      }
      const tdur = s.dur;
      let inTurn = false;
      for (let t = 0; t < tdur; t += 1 / FPS) {
        const v = a.turn.at(t);
        if (v < 0.98 && !inTurn) {
          turns++;
          inTurn = true;
        }
        if (v >= 0.98) inTurn = false;
        turnMin = Math.min(turnMin, v);
      }
    }
  }
  const r = (x: number): number => Math.round(x * 100) / 100;
  return {
    walks,
    footSlideMaxPx: r(Math.max(0, ...slides)),
    footSlideMeanPx: r(slides.reduce((p, q) => p + q, 0) / Math.max(1, slides.length)),
    jerkMaxPx: r(jerk),
    footJumpMaxPx: r(pops),
    footJumpAt: popAt,
    turnMinWidth: r(turnMin),
    turns,
    speedByMood: Object.fromEntries(Object.entries(speeds).map(([m, v]) => [m, r(v.reduce((p, q) => p + q, 0) / v.length)])),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const script = Script.parse(JSON.parse(readFileSync(join(ROOT, "benchmark/scripts/b1-why-we-stay.script.json"), "utf8")));
  const plan = parsePlan(JSON.parse(readFileSync(join(ROOT, "film/w0/plan.json"), "utf8")));
  console.info(JSON.stringify(measure(prepare(plan, script)), null, 1));
}
