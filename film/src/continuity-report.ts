/**
 * pnpm film continuity            every cut of the five benchmark films and the W0 film: what changes for each
 *                                 person across it, and what the checker finds (JSON with --json <file>)
 * pnpm film continuity --at <film> <seconds>   the temporal debugger: everyone's state at that moment
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "@erkasa/contracts";
import { checkFilm, stateOf, type ShotPerf } from "./continuity.js";
import { FilmPlan } from "./contract.js";
import { prepare as prepareV2 } from "./film.js";
import { parsePlan, prepare as prepareW0 } from "./w0/composer.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BENCH = ["b1-why-we-stay", "b2-same-answers", "b3-every-yes", "b4-one-percent", "b5-planning-fallacy"];

export interface FilmShots {
  name: string;
  shots: Array<ShotPerf & { start: number }>;
}

export function loadFilms(): FilmShots[] {
  const out: FilmShots[] = [];
  for (const b of BENCH) {
    const script = Script.parse(
      JSON.parse(readFileSync(join(ROOT, `benchmark/scripts/${b}.script.json`), "utf8")),
    );
    const plan = FilmPlan.parse(JSON.parse(readFileSync(join(ROOT, `film/plans/${b}.film.json`), "utf8")));
    const { composed } = prepareV2({ script, plan });
    out.push({
      name: `v2/${b}`,
      shots: composed.shots.map((s) => ({
        shot: s.shot,
        dur: s.dur,
        start: s.start,
        ...(s.perf ? { perf: s.perf } : {}),
      })),
    });
  }
  const script = Script.parse(
    JSON.parse(readFileSync(join(ROOT, "benchmark/scripts/b1-why-we-stay.script.json"), "utf8")),
  );
  const P = prepareW0(parsePlan(JSON.parse(readFileSync(join(ROOT, "film/w0/plan.json"), "utf8"))), script);
  out.push({
    name: "w0/b1-why-we-stay",
    shots: P.shots.map((s) => ({
      shot: s.w.shot,
      dur: s.dur,
      start: s.start,
      ...(s.perf ? { perf: s.perf } : {}),
    })),
  });
  return out;
}

export function report(films: FilmShots[]) {
  return films.map((f) => {
    const r = checkFilm(f.shots);
    const errors = r.issues.filter((i) => i.level === "error");
    const byCode: Record<string, number> = {};
    for (const i of r.issues) byCode[`${i.level}:${i.code}`] = (byCode[`${i.level}:${i.code}`] ?? 0) + 1;
    return {
      film: f.name,
      cuts: r.transitions.length,
      clean: r.transitions.filter((t) => !t.issues.some((i) => i.level === "error")).length,
      tolerances: { position: +r.tol.position.toFixed(1), joint: +r.tol.joint.toFixed(1) },
      errors: errors.length,
      byCode,
      details: r.transitions
        .filter((t) => t.issues.length)
        .map((t) => ({
          cut: `${t.from}->${t.to}`,
          actor: t.actor,
          intentional: t.intentional,
          issues: t.issues.map((i) => `${i.level} ${i.code}: ${i.message}`),
        })),
    };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const films = loadFilms();
  if (args[0] === "--at") {
    const f = films.find((x) => x.name.includes(args[1] ?? "")) ?? films[0];
    const T = Number(args[2] ?? 0);
    const s = f?.shots.find((x) => T >= x.start && T < x.start + x.dur);
    if (!f || !s?.perf) throw new Error("no staged shot at that time");
    const perf = s.perf;
    console.info(`${f.name} @ ${T}s: shot ${s.shot.id} (${(T - s.start).toFixed(2)} s in)`);
    for (const a of perf.actors.values()) {
      const st = stateOf(perf, a, T - s.start, s.shot.set ?? "office");
      const { pose, ...rest } = st;
      console.info(
        JSON.stringify({
          ...rest,
          x: +rest.x.toFixed(1),
          y: +rest.y.toFixed(1),
          torso: +pose.torso.toFixed(1),
          head: +pose.head.toFixed(1),
        }),
      );
    }
  } else {
    const r = report(films);
    for (const f of r) {
      console.info(
        `${f.film.padEnd(26)} cuts ${String(f.cuts).padStart(2)}  clean ${String(f.clean).padStart(2)}  errors ${String(f.errors).padStart(2)}  tol pos ${f.tolerances.position}px joint ${f.tolerances.joint}px`,
      );
      for (const d of f.details) for (const i of d.issues) console.info(`    ${d.cut.padEnd(12)} ${i}`);
    }
    const out = args.indexOf("--json");
    if (out >= 0) writeFileSync(args[out + 1] as string, JSON.stringify(r, null, 1));
  }
}
