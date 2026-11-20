/* Builds chr_test_minimal@1 into the library and publishes it to the catalog (Phase 2 technical test).
 *
 *   pnpm --filter @erkasa/character build:test-character
 */
import { join } from "node:path";
import { immutableRef, LIBRARY_ROOT, publish } from "../library/index.js";
import { testMinimalSpec } from "./sources/parametric/test-minimal.js";
import { writePackage } from "./writer.js";

const spec = testMinimalSpec();
const dir = join(LIBRARY_ROOT, "characters", spec.manifest.id, String(spec.manifest.version));
const c = await writePackage(dir, spec);
console.info(`wrote ${dir} (${c.parts.length} parts, ${c.manifest.files.length} files)`);
const e = await publish(dir);
console.info(`published ${immutableRef(e)}`);
