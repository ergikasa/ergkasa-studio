import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileVideo } from "@erkasa/compiler";
import { Script, VideoPlan } from "@erkasa/contracts";
import { Catalog } from "./src/catalog.js";
import { reviewDirection } from "./src/direction.js";
import { repoRoot } from "./src/env.js";
const catalog = new Catalog(join(repoRoot(), "assets"));
const plan = VideoPlan.parse(JSON.parse(readFileSync("/tmp/v2/video-plan.json", "utf8")));
const script = Script.parse(JSON.parse(readFileSync("/tmp/v2/script.json", "utf8")));
const res = compileVideo(plan, { assets: catalog.source, seed: 20261108 });
for (const i of res.issues) console.info(`compile ${i.level} ${i.code} ${i.path}: ${i.message}`);
if (!res.timeline) process.exit(1);
const durations = Object.fromEntries(res.scenes.map((s) => [s.sceneId, s.duration / 30]));
for (const i of reviewDirection({ plan, script, durations, compileIssues: res.issues }))
  console.info(`review ${i.code} ${i.path}: ${i.message}`);
console.info(
  res.timeline.scenes
    .map(
      (s) =>
        `${s.sceneId} ${(s.duration / 30).toFixed(1)}s zoom ${s.camera["zoom"]?.[0]?.v} cap ${s.captionY}`,
    )
    .join("\n"),
);
