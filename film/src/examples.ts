import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "@erkasa/contracts";
import { FilmPlan } from "./contract.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/**
 * A hand-directed film shown to the AI director as an example of the craft: the benchmark film B1, or B4
 * when the script being directed is B1 itself (the model must not copy its own answer).
 */
export function directorExample(forTitle?: string): { script: Script; plan: FilmPlan } | undefined {
  for (const name of ["b1-why-we-stay", "b4-one-percent"]) {
    const s = join(ROOT, "benchmark", "scripts", `${name}.script.json`);
    const p = join(ROOT, "film", "plans", `${name}.film.json`);
    if (!existsSync(s) || !existsSync(p)) continue;
    const script = Script.parse(JSON.parse(readFileSync(s, "utf8")));
    if (forTitle && script.title === forTitle) continue;
    return { script, plan: FilmPlan.parse(JSON.parse(readFileSync(p, "utf8"))) };
  }
  return undefined;
}
