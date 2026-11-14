/** Child process of renderParallel: renders one frame range of a timeline to a silent MP4. */
import { readFileSync } from "node:fs";
import { renderVideo } from "./render.js";

const job = JSON.parse(process.argv[2] ?? "{}") as {
  timelineFile: string;
  assetsDir: string | string[];
  out: string;
  range: [number, number];
};
renderVideo({
  timeline: JSON.parse(readFileSync(job.timelineFile, "utf8")),
  assetsDir: job.assetsDir,
  out: job.out,
  range: job.range,
}).then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  },
);
