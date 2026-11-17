/**
 * The six reference films and the two contract examples, through the gate with the engine's real capabilities.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validate } from "../src/index.js";
import { ROOT, caps, film, honestRanges, run, type Film } from "./helpers.js";

const FILMS: Film[] = [
  "b1-why-we-stay",
  "b2-same-answers",
  "b3-every-yes",
  "b4-one-percent",
  "b5-planning-fallacy",
  "w0-office",
];

describe.each(FILMS)("%s", (name) => {
  it("as the stager writes it today: every check passes except the value ranges its manifest declares (open E1.2 finding)", () => {
    const { pkg, manifest } = film(name);
    const r = run(pkg, manifest);
    const codes = new Set(r.errors.map((e) => e.code));
    expect([...codes]).toEqual(["VALUE_RANGE"]);
    for (const e of r.errors) expect(e.message).toMatch(/'(channel\.(gx|gy|brow|lid)|param\.door)'/);
    expect(r.warnings).toEqual([]);
  });

  it("with the ranges the engine declares (the stager fix, values untouched): passes with no finding", () => {
    const { pkg, manifest } = film(name);
    const r = run(pkg, honestRanges(manifest));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.verified?.package.id).toBe(pkg.id);
  });
});

describe("the two contract examples", () => {
  const ex = (name: string) =>
    validate({
      package: readFileSync(join(ROOT, `contracts/fixtures/valid/render-package.${name}.json`)),
      root: ROOT,
      capabilities: caps(),
    });

  it("prisoner-cell: refused only for what this engine cannot draw yet (lights, shapes, text and icon overlays, glow, dip to black, two builtins it does not carry)", () => {
    const r = ex("prisoner-cell");
    expect(r.errors.map((e) => `${e.code} ${e.file}${e.path}`)).toEqual([
      "CAPABILITY_MISSING package/edit/0/enter/kind",
      "CAPABILITY_MISSING package/overlays/0/kind",
      "CAPABILITY_MISSING package/overlays/2/kind",
      "FX_UNSUPPORTED package/scenes/0/events/0/fx",
      "CAPABILITY_MISSING package/scenes/0/layers/1/nodes/3/kind",
      "CAPABILITY_MISSING package/scenes/0/layers/2/nodes/0/kind",
      "CAPABILITY_MISSING package/scenes/0/lights/0/kind",
      "CAPABILITY_MISSING package/scenes/0/lights/1/kind",
      "CAPABILITY_MISSING package/scenes/0/lights/2/kind",
      "BUILTIN_UNKNOWN manifest/assets/4/source/name",
      "BUILTIN_UNKNOWN manifest/assets/5/source/name",
    ]);
  });

  it("office-procedural: refused for the clock template's inputs and two builtins this engine does not carry", () => {
    const r = ex("office-procedural");
    expect(r.errors.map((e) => `${e.code} ${e.file}${e.path}`)).toEqual([
      "PARAM_NOT_DECLARED manifest/assets/1/parameters",
      "PARAM_NOT_DECLARED manifest/assets/1/parameters",
      "PARAM_UNSUPPORTED manifest/assets/1/parameters/0",
      "PARAM_UNSUPPORTED manifest/assets/1/parameters/2",
      "BUILTIN_UNKNOWN manifest/assets/3/source/name",
      "BUILTIN_UNKNOWN manifest/assets/4/source/name",
    ]);
  });

  it("their files are inside the root, unchanged, and their builtin set and type assets match the engine", () => {
    for (const name of ["prisoner-cell", "office-procedural"]) {
      const codes = ex(name).errors.map((e) => e.code);
      for (const c of [
        "FILE_HASH",
        "FILE_MISSING",
        "PATH_ESCAPE",
        "MANIFEST_HASH",
        "BUILTIN_MISMATCH",
        "SCHEMA",
      ])
        expect(codes).not.toContain(c);
    }
  });
});
