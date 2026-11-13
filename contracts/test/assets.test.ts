import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { AssetMeta, Rig } from "../src/index.js";
import { REPO_ROOT, findFiles } from "./helpers.js";

/** The real asset library must satisfy the asset contract, not just the fixtures. */
const assetsDir = join(REPO_ROOT, "assets");

describe("asset library", () => {
  const metas = findFiles(assetsDir, "asset.json");

  it("contains the expected v1 library", () => {
    expect(metas.length).toBeGreaterThanOrEqual(400);
  });

  it("every asset.json satisfies AssetMeta", () => {
    const failures: string[] = [];
    for (const file of metas) {
      const res = AssetMeta.safeParse(JSON.parse(readFileSync(file, "utf8")));
      if (!res.success)
        failures.push(
          `${relative(assetsDir, file)}: ${res.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
        );
    }
    expect(failures).toEqual([]);
  });

  it("every rig.json satisfies Rig", () => {
    const rigs = findFiles(assetsDir, "rig.json");
    // one rig per rigged character in the library (14 after the production list: cast, NPCs, host, roles)
    const manifest = JSON.parse(readFileSync(join(assetsDir, "manifest.json"), "utf8")) as {
      assets: Array<{ kind: string }>;
    };
    expect(rigs.length).toBe(manifest.assets.filter((a) => a.kind === "rigged_character").length);
    expect(rigs.length).toBeGreaterThanOrEqual(14);
    for (const file of rigs) {
      const res = Rig.safeParse(JSON.parse(readFileSync(file, "utf8")));
      expect(res.success, `${file}: ${res.success ? "" : JSON.stringify(res.error.issues)}`).toBe(true);
    }
  });

  it("asset ids are unique", () => {
    const ids = metas.map((f) => (JSON.parse(readFileSync(f, "utf8")) as { assetId: string }).assetId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
