import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Script } from "@erkasa/contracts";
import { ROOT } from "../src/manifest.js";

const json = (p: string): unknown => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
export const loadPlan = (name: string): unknown =>
  name === "w0-office" ? json("film/w0/plan.json") : json(`film/plans/${name}.film.json`);
export const loadScript = (name: string): Script =>
  Script.parse(json(`benchmark/scripts/${name}.script.json`));
