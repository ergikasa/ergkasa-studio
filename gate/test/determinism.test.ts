/** The same input gives the same report, and findings come in one total order. */
import { describe, expect, it } from "vitest";
import { compareFindings, type Finding } from "../src/index.js";
import { base, film, run } from "./helpers.js";

describe("determinism and order", () => {
  it("validating the same package twice gives the same report, byte for byte", () => {
    const { pkg, manifest } = film("b2-same-answers");
    const a = run(pkg, manifest);
    const b = run(pkg, manifest);
    expect(JSON.stringify({ ...a, verified: undefined })).toBe(JSON.stringify({ ...b, verified: undefined }));
    expect(a.errors.length).toBeGreaterThan(0);
  });

  it("a package with many faults: findings are sorted by document, pointer (numbers as numbers), code, message", () => {
    const B = base();
    // faults spread over the whole document: every scene over a tiny node budget, every cut with a transition
    // the engine does not draw, introduced from the last to the first
    for (let i = B.pkg.edit.length - 1; i > 0; i--)
      (B.pkg.edit[i] as { enter: { kind: string } }).enter.kind = "dip_to_black";
    const r2 = run(B.pkg, B.manifest, { root: B.root, budgets: { nodesPerScene: 1 } });
    const errors = r2.errors;
    expect(errors.length).toBeGreaterThan(10);
    const sorted = [...errors].sort(compareFindings);
    expect(errors).toEqual(sorted);
    const shuffled = [...errors].reverse().sort(compareFindings);
    expect(shuffled).toEqual(errors);
    // /scenes/2 before /scenes/10
    const scenes = errors
      .filter((e) => e.code === "BUDGET_SCENE_NODES")
      .map((e) => Number(e.path.split("/")[2]));
    expect(scenes).toEqual([...scenes].sort((a, b) => a - b));
  });

  it("compareFindings is total: document, then pointer by segments, then code, then message", () => {
    const f = (file: Finding["file"], path: string, code = "A", message = "m"): Finding => ({
      file,
      path,
      code,
      message,
    });
    const list = [
      f("manifest", "/assets/1"),
      f("package", "/scenes/10"),
      f("package", "/scenes/2/id"),
      f("package", "/scenes/2"),
      f("package", "", "B"),
      f("package", "", "A"),
      f("capabilities", ""),
    ];
    expect([...list].sort(compareFindings).map((x) => `${x.file}${x.path}:${x.code}`)).toEqual([
      "package:A",
      "package:B",
      "package/scenes/2:A",
      "package/scenes/2/id:A",
      "package/scenes/10:A",
      "manifest/assets/1:A",
      "capabilities:A",
    ]);
  });
});
