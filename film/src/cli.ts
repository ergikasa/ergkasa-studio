/**
 * pnpm film check <script.json> <film.json>             the plan's errors and warnings, shot lengths
 * pnpm film storyboard <script.json> <film.json> <dir>  one still per shot (PNG)
 * pnpm film render <script.json> <film.json> <out.mp4> [--workers 2] [--no-music]
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Script } from "@erkasa/contracts";
import { FilmPlan } from "./contract.js";
import { makeFilm, prepare, storyboard } from "./film.js";
import { medianShot } from "./qa.js";

const [cmd, scriptFile, planFile, out, ...rest] = process.argv.slice(2);
if (!cmd || !scriptFile || !planFile) {
  console.error(
    "usage: film check|storyboard|render <script.json> <film.json> [out] [--workers n] [--no-music]",
  );
  process.exit(2);
}
const job = {
  script: Script.parse(JSON.parse(readFileSync(scriptFile, "utf8"))),
  plan: FilmPlan.parse(JSON.parse(readFileSync(planFile, "utf8"))),
};
const { composed, issues } = prepare(job);
const report = (): void => {
  for (const s of composed.shots)
    console.info(
      `${s.shot.id.padEnd(6)} ${s.start.toFixed(2).padStart(6)}-${s.end.toFixed(2).padStart(6)}  ${s.dur.toFixed(1).padStart(4)} s  ${s.shot.kind === "set" ? `${s.shot.set}/${s.shot.framing ?? "medium"}` : s.shot.template}  ${s.shot.moment.slice(0, 60)}`,
    );
  console.info(
    `\n${composed.shots.length} shots, ${composed.duration.toFixed(1)} s, median shot ${medianShot(composed).toFixed(1)} s`,
  );
  for (const i of issues)
    console.info(`${i.level === "error" ? "ERROR" : "warn "} ${i.code} ${i.path}: ${i.message}`);
};
if (cmd === "check") {
  report();
  process.exit(issues.some((i) => i.level === "error") ? 1 : 0);
} else if (cmd === "storyboard") {
  report();
  const files = storyboard(job, resolve(out ?? "storyboard"));
  console.info(`${files.length} stills in ${dirname(files[0] ?? ".")}`);
} else if (cmd === "render") {
  report();
  const workers = rest.includes("--workers") ? Number(rest[rest.indexOf("--workers") + 1]) : 2;
  const target = resolve(out ?? "film.mp4");
  const t0 = Date.now();
  const res = await makeFilm(job, {
    dir: dirname(target) + "/film-work",
    out: target,
    workers,
    music: !rest.includes("--no-music"),
    progress: (p, m) => console.info(`${p}% ${m}`),
  });
  console.info(
    `done: ${res.file} (${res.durationSec.toFixed(1)} s) in ${((Date.now() - t0) / 1000).toFixed(0)} s`,
  );
} else {
  console.error(`unknown command ${cmd}`);
  process.exit(2);
}
