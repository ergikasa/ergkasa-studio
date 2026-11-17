import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AssetManifest, RenderPackage, type AssetSource } from "../src/index.js";
import { CONTRACTS_DIR } from "./helpers.js";

/**
 * The two valid examples are real, not illustrative: the manifest points at files in this repository with their
 * actual hashes, and the package pins that manifest by hash. These checks keep them that way. They are not the
 * Validation Gate (E1.3); they only prove the examples describe things that exist.
 */
const ROOT = join(CONTRACTS_DIR, "..");
const sha = (path: string): string =>
  createHash("sha256")
    .update(readFileSync(join(ROOT, path)))
    .digest("hex");
const MANIFEST = "contracts/fixtures/valid/asset-manifest.prisoner-cell.json";
const manifest = AssetManifest.parse(JSON.parse(readFileSync(join(ROOT, MANIFEST), "utf8")));
const pkg = RenderPackage.parse(
  JSON.parse(readFileSync(join(CONTRACTS_DIR, "fixtures/valid/render-package.prisoner-cell.json"), "utf8")),
);

const fileSources = (): AssetSource[] =>
  manifest.assets.flatMap((a) => [
    a.source,
    ...(a.kind === "vector" ? (a.states ?? []).flatMap((s) => (s.source ? [s.source] : [])) : []),
  ]);

describe("real examples", () => {
  it("every file in the manifest exists with the declared sha256", () => {
    const files = fileSources().filter((s) => s.kind === "file");
    expect(files.length).toBeGreaterThan(5);
    for (const s of files) if (s.kind === "file") expect(sha(s.uri), s.uri).toBe(s.sha256);
  });

  it("the package pins the manifest it was written against", () => {
    expect(pkg.assetManifest.uri).toBe(MANIFEST);
    expect(sha(pkg.assetManifest.uri)).toBe(pkg.assetManifest.sha256);
  });

  it("every asset the package names is in the manifest", () => {
    const known = new Set(manifest.assets.map((a) => `${a.id}@${a.version}`));
    const text = JSON.stringify(pkg);
    const refs = [...text.matchAll(/"([a-z]+_[a-z0-9_]+@\d+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(5);
    for (const r of refs) expect(known.has(r ?? ""), r).toBe(true);
  });

  it("fills defaults so the engine never guesses", () => {
    const [scene] = pkg.scenes;
    const node = scene?.layers[0]?.nodes[0];
    expect([node?.scale, node?.rotation, node?.opacity, node?.flip]).toEqual([1, 0, 1, false]);
    expect(scene?.events[1]?.fx).toBe("none");
  });
});
