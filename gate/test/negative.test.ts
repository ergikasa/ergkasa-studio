/**
 * Packages broken on purpose, one fault each, on a clean base (B3 + one real file asset). Every case must be
 * refused with exactly the expected code(s) at exactly the expected path(s), and nothing else.
 */
import { describe, expect, it } from "vitest";
import { B, CASES, broken, gate, setAsset, type Ctx } from "./broken.js";
import { caps, clone } from "./helpers.js";

describe("broken packages are refused with the exact code and path", () => {
  it("the base itself passes", () => {
    const r = gate({ pkg: clone(B.pkg), manifest: clone(B.manifest), root: B.root, capabilities: caps() });
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it.each(CASES.map((c) => [c.name, c] as const))("%s", (_, k) => {
    const r = gate(broken(k));
    expect(r.ok).toBe(false);
    const got = r.errors.map((e) => `${e.code} ${e.file}${e.path}`).sort();
    expect(got, JSON.stringify(r.errors, null, 1)).toEqual([...k.expect].sort());
  });

  it("covers at least 20 distinct error codes", () => {
    const codes = new Set(CASES.flatMap((c) => c.expect.map((e) => e.split(" ")[0])));
    expect(codes.size).toBeGreaterThanOrEqual(20);
  });

  it("a deprecated builtin is a warning, not an error", () => {
    const c: Ctx = { pkg: clone(B.pkg), manifest: clone(B.manifest), root: B.root, capabilities: caps() };
    const name = (c.manifest.assets[setAsset]?.source as { name: string }).name;
    (c.capabilities.builtins.find((b) => b.name === name) as { status: string }).status = "deprecated";
    const r = gate(c);
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => `${w.code} ${w.file}${w.path}`)).toEqual([
      `BUILTIN_DEPRECATED manifest/assets/${setAsset}/source/name`,
      `BUILTIN_DEPRECATED manifest/assets/${setAsset}/states/0/source/name`,
    ]);
  });
});
