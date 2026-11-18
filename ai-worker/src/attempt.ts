import { createHash } from "node:crypto";
import { cpSync, createReadStream, existsSync, lstatSync, mkdirSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { TaskResult } from "@erkasa/contracts";
import { TaskFailure } from "./failure.js";

/**
 * Attempt isolation (E1.6). With a fence in the command, a step runs in `<run>/attempts/<stepId>-<fence>/`:
 * a copy of the run's published files (its inputs), never the run folder itself. When the step succeeds the
 * worker reports every file it created or changed there, with its sha256, and the orchestrator publishes them
 * only if that fence is still current. A late, cancelled or concurrent attempt therefore cannot touch what
 * is published.
 */

type ArtifactPointer = TaskResult["outputs"][number];

/** Top-level entries of a run folder never copied into an attempt nor published from one. */
export const NOT_SEEDED = new Set(["attempts", "film", "film-package-work"]);
/** Working folders inside an attempt: never reported for publication. */
export const NOT_PUBLISHED = new Set(["film", "film-package-work"]);

export const attemptDirName = (stepId: string, fence: number): string => `attempts/${stepId}-${fence}`;

export interface Attempt {
  dir: string;
  runId: string;
  stepId: string;
  fence: number;
  /** sha256 of every file copied in, by path relative to the attempt folder (posix separators). */
  seed: Map<string, string>;
}

export async function sha256File(file: string): Promise<string> {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(file)) h.update(chunk as Buffer);
  return h.digest("hex");
}

/** Files under `dir` (regular files only, symlinks skipped), relative and with posix separators. */
function listFiles(dir: string, skipTop: Set<string>): string[] {
  const out: string[] = [];
  const walk = (d: string, top: boolean): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (top && skipTop.has(e.name)) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p, false);
      else if (e.isFile()) out.push(relative(dir, p).split(sep).join("/"));
    }
  };
  if (existsSync(dir)) walk(dir, true);
  return out.sort();
}

/**
 * Creates the attempt folder and copies the run's published files into it. A folder that already exists means
 * this exact attempt ran before (a redelivery) or is running elsewhere: refused, the orchestrator retries
 * with a new fence instead of two processes sharing one folder.
 */
export async function prepareAttempt(
  storageDir: string,
  runId: string,
  stepId: string,
  fence: number,
): Promise<Attempt> {
  const runDir = join(storageDir, runId);
  const dir = join(runDir, attemptDirName(stepId, fence));
  mkdirSync(join(runDir, "attempts"), { recursive: true });
  try {
    mkdirSync(dir); // not recursive: fails if it exists
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST")
      throw new TaskFailure(
        "ATTEMPT_DIR_EXISTS",
        `${attemptDirName(stepId, fence)} already exists (a redelivered or duplicated task); another attempt will run`,
        true,
      );
    throw e;
  }
  const seed = new Map<string, string>();
  for (const entry of readdirSync(runDir, { withFileTypes: true })) {
    if (NOT_SEEDED.has(entry.name)) continue;
    if (!entry.isFile() && !entry.isDirectory()) continue;
    cpSync(join(runDir, entry.name), join(dir, entry.name), {
      recursive: true,
      dereference: false,
      verbatimSymlinks: true,
      filter: (src) => !lstatSync(src).isSymbolicLink(),
    });
  }
  for (const f of listFiles(dir, new Set())) seed.set(f, await sha256File(join(dir, f)));
  return { dir, runId, stepId, fence, seed };
}

export interface Primary {
  role: string;
  file: string;
  mediaType: string;
}

/**
 * The outputs to report: the step's primary files (always, with their role) plus every other file the step
 * created or changed in the attempt folder (role `file`), each with its sha256 and a ref inside the attempt.
 */
export async function attemptOutputs(attempt: Attempt, primary: Primary[]): Promise<ArtifactPointer[]> {
  const base = `file://${attempt.runId}/${attemptDirName(attempt.stepId, attempt.fence)}/`;
  const out: ArtifactPointer[] = [];
  const listed = new Set<string>();
  for (const p of primary) {
    const file = join(attempt.dir, p.file);
    if (!existsSync(file)) throw new TaskFailure("OUTPUT_MISSING", `the step did not write ${p.file}`, true);
    out.push({ role: p.role, ref: base + p.file, sha256: await sha256File(file), mediaType: p.mediaType });
    listed.add(p.file);
  }
  for (const f of listFiles(attempt.dir, NOT_PUBLISHED)) {
    if (listed.has(f)) continue;
    const sha = await sha256File(join(attempt.dir, f));
    if (attempt.seed.get(f) === sha) continue; // an input, unchanged
    out.push({ role: "file", ref: base + f, sha256: sha });
  }
  return out;
}
