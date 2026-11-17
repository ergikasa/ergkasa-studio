/**
 * The engine boundary (E0). The film engine executes plans: it must not depend on the planning layer, the
 * worker, the UI or a language model, and it must render the benchmark films exactly as the recorded baseline.
 * Until the stager is split out (E1) the engine still reads the script for timing; the files allowed to do so
 * are frozen here so that dependency cannot spread.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { capabilities, CAPABILITIES_VERSION, FilmPlan } from "../src/index.js";
import { BENCH, diffGolden, readGolden, w0Golden } from "../src/golden.js";
import { readEvidence, v2Svgs, verifyV2 } from "../src/golden-evidence.js";

const SRC = join(import.meta.dirname, "..", "src");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
const sources = files(SRC).map((p) => ({ path: relative(SRC, p), text: readFileSync(p, "utf8") }));
const imports = (text: string): string[] =>
  [...text.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1] as string);

/** Files that read the script, all for timing or reports; the stager takes this over in E1. */
const SCRIPT_READERS = [
  "cli.ts",
  "compose.ts",
  "continuity-report.ts",
  "film.ts",
  "golden.ts",
  // E1.4: captures the pre-change evidence by staging the films the old way, exactly like golden.ts
  "golden-evidence.ts",
  "qa.ts",
  "sound.ts",
  "timing.ts",
  "w0/cli.ts",
  "w0/composer.ts",
  "w0/mechanics.ts",
];

describe("engine boundary", () => {
  it("imports nothing from the planning layer, the worker, the UI or a model SDK", () => {
    const bad = sources.flatMap((s) =>
      imports(s.text)
        .filter((m) =>
          /^@erkasa\/(planner|ai-worker|studio)(\/|$)|^@anthropic-ai\/|^openai(\/|$)|(^|\/)llm(\.js)?$/.test(
            m,
          ),
        )
        .map((m) => `${s.path}: ${m}`),
    );
    expect(bad).toEqual([]);
  });

  it("does not declare the planning layer or the worker as a dependency", () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies ?? {}).filter((d) => /planner|ai-worker|studio/.test(d))).toEqual([]);
  });

  it("contains no director, prompt or model code", () => {
    const bad = sources
      .filter((s) => /\b(DirectorLlm|directorSystem|messages\.push|anthropic)\b/.test(s.text))
      .map((s) => s.path);
    expect(bad).toEqual([]);
  });

  it("reads the script only in the files frozen for E1", () => {
    // a file reads the script when it imports the Script contract (E1.4: the package renderer imports the render
    // contract and the evaluator from @erkasa/contracts, which is not reading the script)
    const readsScript = (text: string): boolean =>
      [...text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s+"@erkasa\/contracts"/g)].some((m) =>
        /\bScript\b/.test(m[1] ?? ""),
      );
    const readers = sources
      .filter((s) => readsScript(s.text))
      .map((s) => s.path)
      .sort();
    // every file that imports the contracts and is not a script reader must not name the Script contract at all
    for (const s of sources)
      if (!SCRIPT_READERS.includes(s.path)) expect(/\bScript\b/.test(s.text), s.path).toBe(false);
    expect(readers.filter((r) => !SCRIPT_READERS.includes(r))).toEqual([]);
  });

  it("publishes its capabilities as data", () => {
    const c = capabilities();
    expect(c.version).toBe(CAPABILITIES_VERSION);
    expect(c.sets.map((s) => s.id).sort()).toEqual(["cage", "interview", "office", "room"]);
    expect(c.verbs.length).toBeGreaterThan(10);
    // a plan written only from the published capabilities is a valid plan
    const set = c.sets[0];
    if (!set) throw new Error("no set");
    const mark = set.marks.find((m) => m.kind === "stand") ?? set.marks[0];
    const plan = FilmPlan.safeParse({
      schema: "erkasa.film/1",
      title: "From capabilities",
      voiceId: "none",
      cast: [{ id: "a", name: "A", build: "man" }],
      shots: [
        {
          id: "sh01",
          scene: "s01",
          moment: "Someone stands there.",
          kind: "set",
          set: set.id,
          actors: [{ id: "a", at: mark?.id }],
        },
      ],
    });
    expect(plan.success).toBe(true);
  });
});

describe("no visual regression against the recorded baseline", () => {
  const want = readGolden();
  // E1.4: kinetic-type clip ids are per shot, so the SVG text of type frames is no longer golden.json's; a frame
  // passes if its text is the historical one or it differs only in those ids. The pixels of the changed frames
  // are proven by `pnpm --filter @erkasa/film golden` (one process per film: resvg keeps native memory).
  it("B1–B5 render the same frames (text, or the same SVG up to kinetic-type ids)", () => {
    const e = readEvidence();
    for (const film of BENCH) {
      const v = verifyV2(e, film, v2Svgs(film), { pixels: false });
      expect(v.failures, film).toEqual([]);
      expect(v.frames, film).toBe(Object.keys(want[`v2/${film}`] ?? {}).length);
    }
  });
  it("W0 renders the same pixels (sample)", async () => {
    const got = await w0Golden(1, [0, 9, 18, 27, 36, 44]);
    const sample = {
      "w0/b1-why-we-stay": Object.fromEntries(
        Object.keys(got["w0/b1-why-we-stay"] ?? {}).map((t) => [t, want["w0/b1-why-we-stay"]?.[t] ?? ""]),
      ),
    };
    expect(diffGolden(sample, got)).toEqual([]);
  }, 120_000);
});
