import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AssetManifest, RenderPackage, type AssetSource } from "../src/index.js";
import { CONTRACTS_DIR } from "./helpers.js";

/**
 * The valid examples are real, not illustrative: every manifest points at files in this repository (or at code
 * the engine runs) with their actual hashes, and every package pins its manifest by hash. These checks keep them
 * that way and prove the completeness rule (no defaults). They are not the Validation Gate (E1.3).
 */
const ROOT = join(CONTRACTS_DIR, "..");
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");
/** The hash of a file, or of several ("a+b") concatenated in order. */
const sha = (path: string): string =>
  createHash("sha256")
    .update(Buffer.concat(path.split("+").map((p) => readFileSync(join(ROOT, p)))))
    .digest("hex");

/** Builtins and the source file whose hash pins them in the examples (until the engine publishes its own). */
const IMPLEMENTATION: Record<string, string> = {
  "rig.cutout": "film/src/rig.ts+film/src/garments.ts",
  "set.office.back": "film/src/sets.ts",
  "set.office.front": "film/src/sets.ts",
  "template.clock": "film/src/templates.ts",
  "type.kinetic": "film/src/style.ts",
};

for (const example of ["prisoner-cell", "office-procedural"]) {
  const MANIFEST = `contracts/fixtures/valid/asset-manifest.${example}.json`;
  const PACKAGE = `contracts/fixtures/valid/render-package.${example}.json`;
  const manifestJson: unknown = JSON.parse(read(MANIFEST));
  const packageJson: unknown = JSON.parse(read(PACKAGE));
  const manifest = AssetManifest.parse(manifestJson);
  const pkg = RenderPackage.parse(packageJson);
  const sources = (): AssetSource[] =>
    manifest.assets.flatMap((a) => [
      a.source,
      ...(a.kind === "vector" ? a.states.flatMap((s) => ("source" in s ? [s.source] : [])) : []),
    ]);

  describe(`real example: ${example}`, () => {
    it("every file in the manifest exists with the declared sha256", () => {
      for (const s of sources()) if (s.kind === "file") expect(sha(s.uri), s.uri).toBe(s.sha256);
    });

    it("every builtin is pinned to the code that implements it", () => {
      for (const s of sources())
        if (s.kind === "builtin" && IMPLEMENTATION[s.name])
          expect(s.fingerprint, s.name).toBe(sha(IMPLEMENTATION[s.name] ?? ""));
    });

    it("the package pins the manifest it was written against", () => {
      expect(pkg.assetManifest.uri).toBe(MANIFEST);
      expect(sha(pkg.assetManifest.uri)).toBe(pkg.assetManifest.sha256);
    });

    it("every asset the package names is in the manifest", () => {
      const known = new Set(manifest.assets.map((a) => `${a.id}@${a.version}`));
      const refs = [...JSON.stringify(pkg).matchAll(/"([a-z]+_[a-z0-9_]+@\d+)"/g)].map((m) => m[1] ?? "");
      expect(refs.length).toBeGreaterThan(2);
      for (const r of refs) expect(known.has(r), r).toBe(true);
    });

    it("sampled tracks are stored at the film's frame rate, starting on a frame", () => {
      const sampled = pkg.scenes.flatMap((s) => s.tracks).filter((t) => t.kind === "samples");
      expect(sampled.length).toBeGreaterThan(0);
      for (const t of sampled) {
        expect(t.rate).toBe(pkg.output.fps);
        expect(Number.isInteger(t.start * pkg.output.fps)).toBe(true);
      }
    });

    it("procedural nodes set every static parameter and drive only declared channels", () => {
      const declared = new Map(manifest.assets.map((a) => [`${a.id}@${a.version}`, a]));
      for (const scene of pkg.scenes) {
        const nodes = [...scene.layers, ...(scene.screen ?? [])].flatMap((l) => l.nodes);
        for (const n of nodes) {
          if (n.kind !== "asset") continue;
          const a = declared.get(n.asset);
          const params = a?.kind === "vector" ? (a.parameters ?? []) : [];
          const statics = params.filter((p) => p.kind === "static").map((p) => p.id);
          expect(Object.keys(n.params ?? {}).sort(), n.id).toEqual([...statics].sort());
          const channels = new Set(params.filter((p) => p.kind === "channel").map((p) => `param.${p.id}`));
          for (const t of scene.tracks)
            if (t.target.kind === "node" && t.target.id === n.id && t.channel.startsWith("param."))
              expect(channels.has(t.channel), `${n.id} ${t.channel}`).toBe(true);
        }
      }
    });

    it("parsing returns the document unchanged (Zod adds no values a Java reader would not see)", () => {
      expect(manifest).toEqual(manifestJson);
      expect(pkg).toEqual(packageJson);
    });
  });
}

describe("completeness: the contract fills nothing in", () => {
  it("the JSON Schemas declare no default values", () => {
    for (const name of ["render-package", "asset-manifest"]) {
      const schema = read(`contracts/json-schema/${name}.schema.json`);
      expect(schema.includes('"default"'), name).toBe(false);
    }
  });
});
