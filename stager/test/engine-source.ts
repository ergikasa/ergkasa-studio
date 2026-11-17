/**
 * Runs a piece of the engine's own source, verbatim, where the engine keeps it private.
 *
 * Some logic the stager copies lives inside module-private functions of the engine (the W0 frame index in
 * w0/cli.ts, the W0 prop assembly inside composer.ts drawShot). The engine is not modified to export them.
 * Instead the tests cut the exact text out of the engine file, strip the types with the TypeScript compiler and
 * run it, so the stager's copy is compared with the engine's code itself, not with a second copy. If the engine
 * text changes, the markers stop matching and the test fails: the copy must be reviewed again.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { ROOT } from "../src/manifest.js";

/** The engine text from the line that starts with `from` to the end of the line that contains `to`. */
export function engineText(file: string, from: string, to: string): string {
  const src = readFileSync(join(ROOT, file), "utf8");
  const a = src.indexOf(from);
  if (a < 0) throw new Error(`${file}: start marker not found: ${from}`);
  const b = src.indexOf(to, a);
  if (b < 0) throw new Error(`${file}: end marker not found: ${to}`);
  if (src.indexOf(from, a + 1) >= 0) throw new Error(`${file}: start marker is not unique: ${from}`);
  const end = src.indexOf("\n", b + to.length);
  return src.slice(a, end < 0 ? undefined : end);
}

/** Compiles `body` (TypeScript statements) into a function of the named arguments. */
export function engineFunction<T>(body: string, args: string[]): (...values: unknown[]) => T {
  const js = ts
    .transpileModule(`export function __engine(${args.join(", ")}) {\n${body}\n}`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    })
    .outputText.replace(/^export /m, "");
  return new Function(`${js}; return __engine;`)() as (...values: unknown[]) => T;
}
