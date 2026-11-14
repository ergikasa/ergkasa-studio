// Renders one shot of a film job in its own process (parallel rendering).
import { renderShotFromJob } from "./film.js";

const [jobFile, idx, out] = process.argv.slice(2);
if (!jobFile || idx === undefined || !out) {
  console.error("usage: shot-child <job.json> <shot index> <out.mp4>");
  process.exit(2);
}
await renderShotFromJob(jobFile, Number(idx), out);
