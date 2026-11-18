/**
 * E1.6 subphase 2, worker side: with a fence, every attempt works in its own folder and reports what it made
 * with hashes; nothing lands in the run folder until the orchestrator publishes it. Also: cancellation, the
 * deadline, two attempts at once, a duplicated attempt, and a whole run (script → voice → plan → render)
 * through attempt folders giving the same MP4 as without them.
 */
import { useTestLibrary } from "./test-library.js";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { TaskCommand, TaskResult } from "@erkasa/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attemptDirName, prepareAttempt } from "../src/attempt.js";
import { FILM_FILES } from "../src/film-steps.js";
import type { JsonRequest, JsonResponse, Llm } from "../src/llm.js";
import { PACKAGE_FILES } from "../src/package-steps.js";
import { AttemptStopped, handleCommand } from "../src/worker.js";
import { RUN, cmd, deps, makeRun } from "./e2e-fixture.js";
import { processesWith } from "./processes.js";

// E1.6: the package's music is the licensed score by default; tests use the catalog over generated tones
let restoreLibrary: () => void = () => undefined;
beforeAll(() => {
  restoreLibrary = useTestLibrary();
}, 600_000);
afterAll(() => restoreLibrary());

const noop = (): void => undefined;
const sha = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");

const fenced = (base: TaskCommand, fence: number, over: Partial<TaskCommand> = {}): TaskCommand =>
  TaskCommand.parse({ ...base, fence, ...over });

const scriptCmd = (fence: number, over: Partial<TaskCommand> = {}): TaskCommand =>
  fenced(
    cmd("script.write", "script", { topic: "saving vs investing", theme: "money", seconds: 20 }),
    fence,
    over,
  );

/** Lists every file under a folder (relative paths), for "the run folder did not change" checks. */
function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string, rel: string): void => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p, r);
      else if (e.isFile()) out[r] = sha(readFileSync(p));
    }
  };
  walk(dir, "");
  return out;
}

/** What the orchestrator does for an accepted result (ArtifactPublisher.java): verify, then rename into place. */
function publish(storage: string, result: TaskResult): void {
  expect(result.status, JSON.stringify(result.error)).toBe("SUCCEEDED");
  const prefix = `file://${RUN}/${attemptDirName(result.stepId, result.fence as number)}/`;
  for (const o of result.outputs) {
    expect(o.ref.startsWith(prefix), o.ref).toBe(true);
    const rel = o.ref.slice(prefix.length);
    const src = join(storage, RUN, attemptDirName(result.stepId, result.fence as number), rel);
    expect(sha(readFileSync(src)), rel).toBe(o.sha256);
    const target = join(storage, RUN, rel);
    mkdirSync(dirname(target), { recursive: true });
    renameSync(src, target);
  }
}

describe("an attempt with a fence", () => {
  it("works only in attempts/<step>-<fence>/ and reports its files with sha256; the run folder is untouched", async () => {
    const d = deps(mkdtempSync(join(tmpdir(), "erkasa-attempt-")));
    const run = join(d.storageDir, RUN);
    const r = await handleCommand(scriptCmd(7), d, noop);
    expect(r.status, JSON.stringify(r.error)).toBe("SUCCEEDED");
    expect(r.fence).toBe(7);
    expect(TaskResult.safeParse(r).success).toBe(true);
    // nothing public: only the attempt folder exists
    expect(readdirSync(run)).toEqual(["attempts"]);
    expect(readdirSync(join(run, "attempts"))).toEqual(["script-7"]);
    const script = r.outputs.find((o) => o.role === "script");
    expect(script?.ref).toBe(`file://${RUN}/attempts/script-7/script.json`);
    expect(script?.sha256).toBe(sha(readFileSync(join(run, "attempts/script-7/script.json"))));
    for (const o of r.outputs) expect(o.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("starts from a copy of the published files and reports only what it created or changed", async () => {
    const d = deps(mkdtempSync(join(tmpdir(), "erkasa-attempt-")));
    const run = join(d.storageDir, RUN);
    mkdirSync(join(run, "voice"), { recursive: true });
    writeFileSync(join(run, "voice/voice.json"), "{}");
    writeFileSync(join(run, "notes.txt"), "kept");
    mkdirSync(join(run, "film"), { recursive: true });
    writeFileSync(join(run, "film/frame.png"), "work");
    mkdirSync(join(run, "attempts/plan-3"), { recursive: true });
    writeFileSync(join(run, "attempts/plan-3/x.json"), "other attempt");
    symlinkSync("/etc/hostname", join(run, "link.txt"));
    const before = tree(run);

    const a = await prepareAttempt(d.storageDir, RUN, "script", 9);
    expect(existsSync(join(a.dir, "voice/voice.json"))).toBe(true);
    expect(existsSync(join(a.dir, "notes.txt"))).toBe(true);
    expect(existsSync(join(a.dir, "film"))).toBe(false); // work folders are not inputs
    expect(existsSync(join(a.dir, "attempts"))).toBe(false); // other attempts are never visible
    expect(existsSync(join(a.dir, "link.txt"))).toBe(false); // links are not followed or copied
    expect([...a.seed.keys()].sort()).toEqual(["notes.txt", "voice/voice.json"]);

    const r = await handleCommand(scriptCmd(10), d, noop);
    const reported = r.outputs.map((o) => o.ref.replace(`file://${RUN}/attempts/script-10/`, ""));
    expect(reported).toContain("script.json");
    expect(reported).not.toContain("notes.txt"); // an unchanged input
    expect(reported).not.toContain("voice/voice.json");
    const after = tree(run);
    for (const [f, h] of Object.entries(before)) expect(after[f], f).toBe(h);
    for (const f of Object.keys(after))
      expect(
        f in before || f.startsWith("attempts/script-9/") || f.startsWith("attempts/script-10/"),
        f,
      ).toBe(true);
  });

  it("refuses an attempt whose folder already exists (a duplicate): FAILED, retryable, nothing reported", async () => {
    const d = deps(mkdtempSync(join(tmpdir(), "erkasa-attempt-")));
    mkdirSync(join(d.storageDir, RUN, "attempts/script-4"), { recursive: true });
    writeFileSync(join(d.storageDir, RUN, "attempts/script-4/script.json"), "the other process's file");
    const r = await handleCommand(scriptCmd(4), d, noop);
    expect(r.status).toBe("FAILED");
    expect(r.error).toMatchObject({ code: "ATTEMPT_DIR_EXISTS", retryable: true });
    expect(readFileSync(join(d.storageDir, RUN, "attempts/script-4/script.json"), "utf8")).toBe(
      "the other process's file",
    );
  });

  it("two attempts of one step at the same time write into separate folders", async () => {
    const d = deps(mkdtempSync(join(tmpdir(), "erkasa-attempt-")));
    const [a, b] = await Promise.all([
      handleCommand(scriptCmd(21), d, noop),
      handleCommand(scriptCmd(22, { attempt: 2 }), d, noop),
    ]);
    expect(a.status).toBe("SUCCEEDED");
    expect(b.status).toBe("SUCCEEDED");
    expect(a.outputs[0]?.ref).toContain("/attempts/script-21/");
    expect(b.outputs[0]?.ref).toContain("/attempts/script-22/");
    expect(readdirSync(join(d.storageDir, RUN))).toEqual(["attempts"]);
  });

  it("stops at the deadline even when the step does not listen (an LLM call): DEADLINE_EXCEEDED, retryable", async () => {
    const d = deps(mkdtempSync(join(tmpdir(), "erkasa-attempt-")));
    const hanging: Llm = { json: () => new Promise<JsonResponse>(() => undefined) };
    d.llm = () => hanging;
    const t0 = Date.now();
    const r = await handleCommand(
      scriptCmd(31, { deadline: new Date(Date.now() + 400).toISOString() }),
      d,
      noop,
    );
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(r.status).toBe("FAILED");
    expect(r.error).toMatchObject({ code: "DEADLINE_EXCEEDED", retryable: true });
    expect(r.outputs).toEqual([]);
  });

  it("stops when cancelled (the signal a cancel message aborts): CANCELLED, not retryable, nothing reported", async () => {
    const d = deps(mkdtempSync(join(tmpdir(), "erkasa-attempt-")));
    let started!: () => void;
    const begun = new Promise<void>((r) => (started = r));
    const slow: Llm = {
      json: (req: JsonRequest) => {
        started();
        return new Promise<JsonResponse>(() => void req);
      },
    };
    d.llm = () => slow;
    const stop = new AbortController();
    const p = handleCommand(scriptCmd(41), d, noop, stop.signal);
    await begun;
    stop.abort(new AttemptStopped("CANCELLED"));
    const r = await p;
    expect(r.status).toBe("FAILED");
    expect(r.error).toMatchObject({ code: "CANCELLED", retryable: false });
    expect(existsSync(join(d.storageDir, RUN, "script.json"))).toBe(false);
  });

  it("without a fence (isolation off: the rollback) writes straight into the run folder as before", async () => {
    const d = deps(mkdtempSync(join(tmpdir(), "erkasa-attempt-")));
    const r = await handleCommand(
      cmd("script.write", "script", { topic: "x y z", theme: "money", seconds: 20 }),
      d,
      noop,
    );
    expect(r.status).toBe("SUCCEEDED");
    expect(r.fence).toBeUndefined();
    expect(r.outputs[0]?.ref).toBe(`file://${RUN}/script.json`);
    expect(existsSync(join(d.storageDir, RUN, "script.json"))).toBe(true);
    expect(existsSync(join(d.storageDir, RUN, "attempts"))).toBe(false);
  });
});

describe("a whole run through attempt folders", () => {
  it("script → voice → plan → render (package) published step by step gives the same MP4 as without isolation", async () => {
    const reference = await makeRun();
    const ref = await handleCommand(
      cmd("render.finalize", "render", { music: true, pipeline: "package" }),
      deps(reference),
      noop,
    );
    expect(ref.status, JSON.stringify(ref.error)).toBe("SUCCEEDED");

    const storage = mkdtempSync(join(tmpdir(), "erkasa-attempt-run-"));
    const d = deps(storage);
    let fence = 100;
    const steps: Array<[string, string, Record<string, unknown>]> = [
      ["script.write", "script", { topic: "saving vs investing", theme: "money", seconds: 20 }],
      ["voice.synthesize", "voice", { voice: "" }],
      ["visual.plan", "plan", { voice: "", projectId: RUN, engine: "film" }],
      ["render.finalize", "render", { music: true, pipeline: "package" }],
    ];
    for (const [type, step, params] of steps) {
      const before = tree(join(storage, RUN));
      const r = await handleCommand(fenced(cmd(type, step, params), ++fence), d, noop);
      expect(r.status, `${type}: ${JSON.stringify(r.error)}`).toBe("SUCCEEDED");
      // nothing public changed while the step ran
      const during = tree(join(storage, RUN));
      for (const [f, h] of Object.entries(during))
        if (!f.startsWith("attempts/")) expect(before[f], `${type} wrote ${f} outside its attempt`).toBe(h);
      publish(storage, r);
    }
    const video = readFileSync(join(storage, RUN, FILM_FILES.video));
    expect(sha(video)).toBe(sha(readFileSync(join(reference, RUN, FILM_FILES.video))));
    expect(existsSync(join(storage, RUN, PACKAGE_FILES.render))).toBe(true);
    expect(existsSync(join(storage, RUN, PACKAGE_FILES.gate))).toBe(true);
  }, 600_000);

  it("a render cancelled mid-way through its attempt: CANCELLED, no process left, nothing public", async () => {
    const storage = await makeRun();
    const run = join(storage, RUN);
    const before = tree(run);
    const stop = new AbortController();
    const r = await handleCommand(
      fenced(cmd("render.finalize", "render", { music: true, pipeline: "package" }), 501),
      deps(storage),
      (pct) => {
        if (pct >= 10) stop.abort(new AttemptStopped("CANCELLED"));
      },
      stop.signal,
    );
    expect(r.status).toBe("FAILED");
    expect(r.error).toMatchObject({ code: "CANCELLED", retryable: false });
    const after = tree(run);
    for (const f of Object.keys(after)) if (!f.startsWith("attempts/")) expect(before[f], f).toBe(after[f]);
    expect(existsSync(join(run, FILM_FILES.video))).toBe(false);
    // give the killed process group a moment to be reaped
    await new Promise((res) => setTimeout(res, 300));
    const live = processesWith(join(run, "attempts"));
    expect(live).toBe("");
  }, 600_000);
});
