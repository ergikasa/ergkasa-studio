import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTRACTS, type ContractName } from "../src/index.js";

export const CONTRACTS_DIR = fileURLToPath(new URL("..", import.meta.url));
export const REPO_ROOT = join(CONTRACTS_DIR, "..");

export interface Fixture {
  file: string;
  contract: ContractName;
  data: unknown;
}

/** Fixture files are named `<contract>.<case>.json`; the prefix picks the contract. */
export function loadFixtures(kind: "valid" | "invalid"): Fixture[] {
  const dir = join(CONTRACTS_DIR, "fixtures", kind);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((file) => {
      const name = file.split(".")[0] ?? "";
      if (!(name in CONTRACTS)) throw new Error(`fixture ${file}: unknown contract '${name}'`);
      return {
        file,
        contract: name as ContractName,
        data: JSON.parse(readFileSync(join(dir, file), "utf8")) as unknown,
      };
    });
}

/** Recursively lists files with the given name under a directory. */
export function findFiles(dir: string, fileName: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findFiles(p, fileName));
    else if (entry.name === fileName) out.push(p);
  }
  return out;
}
