import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AssetManifest, RenderPackage, type AssetSource } from "../src/index.js";
import { CONTRACTS_DIR } from "./helpers.js";

/**
 * The two valid examples are real, not illustrative: the manifest points at files in this repository with their
 * actual hashes, and the package pins that manifest by hash. These checks keep them that way and prove the
 * completeness rule (no defaults). They are not the Validation Gate (E1.3).
 */
const ROOT = join(CONTRACTS_DIR, "..");
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");
const sha = (path: string): string =>
  createHash("sha256")
    .update(readFileSync(join(ROOT, path)))
    .digest("hex");
const MANIFEST = "contracts/fixtures/valid/asset-manifest.prisoner-cell.json";
const PACKAGE = "contracts/fixtures/valid/render-package.prisoner-cell.json";
const manifestJson: unknown = JSON.parse(read(MANIFEST));
const packageJson: unknown = JSON.parse(read(PACKAGE));
const manifest = AssetManifest.parse(manifestJson);
const pkg = RenderPackage.parse(packageJson);

const sources = (): AssetSource[] =>
  manifest.assets.flatMap((a) => [
    a.source,
    ...(a.kind === "vector" ? a.states.flatMap((s) => ("source" in s ? [s.source] : [])) : []),
  ]);

describe("real examples", () => {
  it("every file in the manifest exists with the declared sha256", () => {
    const files = sources().filter((s) => s.kind === "file");
    expect(files.length).toBeGreaterThan(5);
    for (const s of files) if (s.kind === "file") expect(sha(s.uri), s.uri).toBe(s.sha256);
  });

  it("the procedural rig is pinned to the code that implements it", () => {
    const rig = manifest.assets.find((a) => a.kind === "rig");
    expect(rig?.source).toEqual({
      kind: "builtin",
      name: "rig.cutout",
      version: 1,
      fingerprint: sha("film/src/rig.ts"),
    });
  });

  it("the package pins the manifest it was written against", () => {
    expect(pkg.assetManifest.uri).toBe(MANIFEST);
    expect(sha(pkg.assetManifest.uri)).toBe(pkg.assetManifest.sha256);
  });

  it("every asset the package names is in the manifest", () => {
    const known = new Set(manifest.assets.map((a) => `${a.id}@${a.version}`));
    const refs = [...JSON.stringify(pkg).matchAll(/"([a-z]+_[a-z0-9_]+@\d+)"/g)].map((m) => m[1] ?? "");
    expect(refs.length).toBeGreaterThan(5);
    for (const r of refs) expect(known.has(r), r).toBe(true);
  });

  it("sampled bone tracks are stored at the film's frame rate, starting on a frame", () => {
    const sampled = pkg.scenes.flatMap((s) => s.tracks).filter((t) => t.kind === "samples");
    expect(sampled.length).toBeGreaterThan(0);
    for (const t of sampled) {
      expect(t.rate).toBe(pkg.output.fps);
      expect(Number.isInteger(t.start * pkg.output.fps)).toBe(true);
    }
  });
});

describe("completeness: the contract fills nothing in", () => {
  it("parsing returns the document unchanged (Zod adds no values a Java reader would not see)", () => {
    expect(manifest).toEqual(manifestJson);
    expect(pkg).toEqual(packageJson);
  });

  it("the JSON Schemas declare no default values", () => {
    for (const name of ["render-package", "asset-manifest"]) {
      const schema = read(`contracts/json-schema/${name}.schema.json`);
      expect(schema.includes('"default"'), name).toBe(false);
    }
  });
});
