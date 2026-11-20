/* Builds chr_daniel@1 (Daniel Vos, human cartoon v1) into the library from the approved concept construction.
 * The package is written and verified, not published: a reference character needs the PO's approval first.
 *
 *   pnpm --filter @erkasa/character build:daniel [report.json]
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { LIBRARY_ROOT, readCatalog, verifyPackage } from "../library/index.js";
import { danielSpec } from "./sources/daniel.js";
import { writePackage } from "./writer.js";

const { spec, report } = await danielSpec();
const dir = join(LIBRARY_ROOT, "characters", spec.manifest.id, String(spec.manifest.version));
// an unpublished candidate may be rebuilt; a published version never is (the writer refuses other bytes)
const published = readCatalog().characters.some(
  (e) => e.id === spec.manifest.id && e.version === spec.manifest.version,
);
if (!published && existsSync(dir)) rmSync(dir, { recursive: true });
const c = await writePackage(dir, spec);
const { findings } = await verifyPackage(dir);
console.info(
  `wrote ${dir}: ${c.parts.length} parts, ${report.vertices} vertices, ${report.morphs} morph targets ` +
    `(${report.deltas} deltas) in ${report.seconds} s; self-check ${findings.length ? findings.map((f) => f.code).join(", ") : "clean"}`,
);
if (report.formFallbacks.length)
  console.info(`followed the form instead of the drawing: ${report.formFallbacks.join(", ")}`);
const out = process.argv[2];
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify({ ...report, findings }, null, 2)}\n`);
}
