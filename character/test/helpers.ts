import { join } from "node:path";
import { packageFiles, testMinimalSpec, type PackageSpec } from "../src/builder/index.js";
import { LIBRARY_ROOT } from "../src/library/index.js";
import { loadCharacter, loadCharacterBytes, type LoadedCharacter } from "../src/runtime/index.js";

export const TEST_DIR = join(LIBRARY_ROOT, "characters", "chr_test_minimal", "1");

let cached: Promise<LoadedCharacter> | undefined;
/** The published test character, loaded once per test file. */
export const testCharacter = (): Promise<LoadedCharacter> => (cached ??= loadCharacter(TEST_DIR));

/** The test character's spec, changed by `edit`, built and loaded in memory (never written). */
export async function loadEdited(edit: (s: PackageSpec) => void): Promise<LoadedCharacter> {
  const spec = structuredClone(testMinimalSpec());
  edit(spec);
  const files = packageFiles(spec);
  return loadCharacterBytes({
    index: files.get("character.json") as Uint8Array,
    file: (p) => files.get(p),
    present: [...files.keys()].filter((p) => p !== "character.json"),
  });
}

/** The codes of a CharacterError's findings (or its own code). */
export async function codesOf(p: Promise<unknown>): Promise<string[]> {
  try {
    await p;
    return [];
  } catch (e) {
    const err = e as { code?: string; findings?: Array<{ code: string; level: string }> };
    const fs = (err.findings ?? []).filter((f) => f.level === "error").map((f) => f.code);
    return fs.length ? fs : [err.code ?? "?"];
  }
}

export const maxAbsDiff = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs((a[i] as number) - (b[i] as number)));
  return m;
};

/** The value, or a failed test: the lint-clean replacement for a non-null assertion. */
export function must<T>(v: T | null | undefined, what = "value"): T {
  if (v === null || v === undefined) throw new Error(`expected ${what}`);
  return v;
}
