import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** The monorepo root: the nearest folder (from cwd up) that has pnpm-workspace.yaml. */
export function repoRoot(from = process.cwd()): string {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir)
      throw new Error(`not inside the erkasa-studio repo (no pnpm-workspace.yaml above ${from})`);
    dir = parent;
  }
}

let loaded = false;

/**
 * Loads `<repo>/.env` into process.env once (Node's built-in loader; variables already set in the
 * environment win). The file is git-ignored: keys live only on the machine that runs the studio.
 */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const file = join(repoRoot(), ".env");
  if (existsSync(file)) process.loadEnvFile(file);
}

export class MissingConfigError extends Error {}

/** A required setting. The message says exactly where to put it, never what its value was. */
export function required(name: string, hint: string): string {
  loadEnv();
  const v = process.env[name]?.trim();
  if (!v)
    throw new MissingConfigError(`${name} is not set. Add it to the .env file at the repo root (${hint}).`);
  return v;
}

export function optional(name: string, fallback: string): string {
  loadEnv();
  return process.env[name]?.trim() || fallback;
}
