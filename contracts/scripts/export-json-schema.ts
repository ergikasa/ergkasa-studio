/**
 * Exports every contract to `json-schema/<name>.schema.json` (JSON Schema draft 2020-12).
 * The Java backend validates incoming JSON against these files.
 *
 *   pnpm contracts:gen          write the files
 *   pnpm contracts:gen --check  fail if the committed files are out of date (used by CI and tests)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSchemas } from "../src/json-schema.js";

const outDir = join(fileURLToPath(new URL(".", import.meta.url)), "..", "json-schema");
const check = process.argv.includes("--check");
let stale = 0;

for (const [name, text] of Object.entries(renderSchemas())) {
  const file = join(outDir, `${name}.schema.json`);
  if (check) {
    let current: string;
    try {
      current = readFileSync(file, "utf8");
    } catch {
      current = "";
    }
    if (current !== text) {
      console.error(`stale: ${file}`);
      stale++;
    }
  } else {
    writeFileSync(file, text);
    console.info(`wrote ${file}`);
  }
}

if (stale > 0) {
  console.error(`${stale} schema file(s) out of date: run \`pnpm contracts:gen\``);
  process.exit(1);
}
