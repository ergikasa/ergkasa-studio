/**
 * K6: the package renderer depends on no plan, script, timing, performance, continuity, stager or AI code, and
 * reads nothing of the package beyond what the gate verified.
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normaliseKtIds } from "../../src/golden-ids.js";
import { openPackage } from "../../src/package/render.js";
import { fixtureB, ROOT } from "./helpers.js";

/** Every module the renderer loads at run time (type-only imports excluded), from the source. */
function graph(entry: string): { files: string[]; external: string[] } {
  const seen = new Set<string>();
  const external = new Set<string>();
  const IMPORT = /(?:import|export)\s[^;]*?from\s+"([^"]+)"|import\s*\(\s*"([^"]+)"\s*\)|import\s+"([^"]+)"/g;
  const resolveSpec = (from: string, spec: string): string | undefined => {
    if (spec.startsWith(".")) {
      const p = resolve(dirname(from), spec).replace(/\.js$/, ".ts");
      if (!existsSync(p)) throw new Error(`${from}: cannot resolve ${spec}`);
      return p;
    }
    const m = /^@erkasa\/([^/]+)$/.exec(spec);
    if (m) return join(ROOT, m[1] as string, "src", "index.ts");
    external.add(spec);
    return undefined;
  };
  const walk = (f: string): void => {
    if (seen.has(f)) return;
    seen.add(f);
    for (const m of readFileSync(f, "utf8").matchAll(IMPORT)) {
      if (/^(?:import|export)\s+type\b/.test(m[0])) continue;
      const next = resolveSpec(f, (m[1] ?? m[2] ?? m[3]) as string);
      if (next) walk(next);
    }
  };
  walk(entry);
  return { files: [...seen].map((f) => relative(ROOT, f)).sort(), external: [...external].sort() };
}

describe("K6: what the renderer is made of", () => {
  const g = graph(join(ROOT, "film/src/package/render.ts"));

  it("no planner, stager, AI, timing, performance, continuity, director, plan or script reader", () => {
    const forbidden = [
      /^planner\//,
      /^stager\//,
      /^ai-worker\//,
      /^engine-worker\//,
      /^compiler\//,
      /^studio\//,
      /film\/src\/(timing|perform|continuity|compose|film|cli|qa|sound|golden[^/]*|continuity-report)\.ts$/,
      /film\/src\/w0\/(composer|cli|mechanics|sound|frame)\.ts$/,
      /director/i,
    ];
    expect(g.files.filter((f) => forbidden.some((re) => re.test(f)))).toEqual([]);
    // the workspace packages it reaches: the contracts, the gate, and the engine package (for the resvg guard)
    expect([...new Set(g.files.map((f) => f.split("/")[0]))].sort()).toEqual([
      "contracts",
      "engine",
      "film",
      "gate",
    ]);
    // contracts/src/script.ts is reached only as a schema of the contracts' index: no renderer module names Script
    for (const f of g.files.filter((x) => x.startsWith("film/") || x.startsWith("gate/")))
      expect(/\bScript\b/.test(readFileSync(join(ROOT, f), "utf8")), f).toBe(false);
    expect(g.external).toEqual([
      "@napi-rs/canvas",
      "@resvg/resvg-js",
      "node:child_process",
      "node:crypto",
      "node:fs",
      "node:module",
      "node:path",
      "node:url",
      "saxes",
      "zod",
    ]);
  });

  it("no film.json, plan or script file is read by renderer code", () => {
    for (const f of g.files.filter((x) => x.startsWith("film/src/package/")))
      expect(
        /film\.json|\.script\.json|plans\/|benchmark\//.test(readFileSync(join(ROOT, f), "utf8")),
        f,
      ).toBe(false);
    // the renderer's own modules open no file at all (node:fs is reached only through the gate and the engine's
    // fonts and fingerprints)
    for (const f of g.files.filter((x) => x.startsWith("film/src/package/")))
      expect(/node:fs/.test(readFileSync(join(ROOT, f), "utf8")), f).toBe(false);
  });

  it("reads no field the capabilities classify as refused, validated or metadata (T9)", () => {
    // the field names of those classes that a drawing could read; the gate reads them, the renderer must not
    const NOT_DRAWN =
      /\.(bounds|contacts|audio|mix|lights|aperture|referenceDistance|dolly|lit|rim|shadow|maxWidth|align|provenance|license|approval|affordances|defaultState|durationSec|sampleRate|producer)\b/;
    for (const f of g.files.filter((x) => x.startsWith("film/src/package/")))
      expect(readFileSync(join(ROOT, f), "utf8").match(NOT_DRAWN)?.[0], f).toBeUndefined();
  });

  it("no path is reopened: changing the files after the gate verified them changes nothing drawn", () => {
    const root = mkdtempSync(join(tmpdir(), "pkg-verified-"));
    const { text } = fixtureB("prisoner-cell");
    const pkg = JSON.parse(text) as { assetManifest: { uri: string } };
    cpSync(join(ROOT, pkg.assetManifest.uri), join(root, pkg.assetManifest.uri), { recursive: true });
    const manifest = JSON.parse(readFileSync(join(ROOT, pkg.assetManifest.uri), "utf8")) as {
      assets: Array<{
        source: { kind: string; uri?: string };
        states?: Array<{ source?: { kind: string; uri?: string } }>;
      }>;
    };
    const uris = manifest.assets.flatMap((a) =>
      [a.source, ...(a.states ?? []).map((s) => s.source)].flatMap((s) =>
        s?.kind === "file" && s.uri ? [s.uri] : [],
      ),
    );
    expect(uris.length).toBeGreaterThan(1);
    for (const u of uris) cpSync(join(ROOT, u), join(root, u), { recursive: true });
    const o = openPackage({ package: text, root });
    if (!o.ok) throw new Error(JSON.stringify(o.errors));
    const before = [0, 120, 239].map((k) => o.renderer.svg(k) as string);
    // after verification, every file on disk is replaced by a different (valid) drawing
    for (const u of uris)
      writeFileSync(
        join(root, u),
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="red"/></svg>',
      );
    const after = [0, 120, 239].map((k) => o.renderer.svg(k) as string);
    expect(after.map(normaliseKtIds)).toEqual(before.map(normaliseKtIds));
    expect(before.every((s) => s.includes("data:image/svg+xml;base64,"))).toBe(true);
    expect(before.some((s) => /href="(?!data:|#)/.test(s))).toBe(false);
  });
});
