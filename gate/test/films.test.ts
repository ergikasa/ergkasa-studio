/**
 * What must pass the gate, and what must not.
 *
 *   films            the six reference films, as the stager writes them: executable, pass with no finding.
 *   acceptance (B)   gate/fixtures/acceptance: built only from the engine's published capabilities and real files;
 *                    executable, pass with no finding, and are exactly what the generator produces.
 *   contract (A)     contracts/fixtures/valid: examples of the schema. They may use features this engine does not
 *                    draw yet and are not claimed executable; they pass the schema (contracts tests, Zod + Ajv)
 *                    and the gate refuses them for exactly those features.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AssetManifest, RenderPackage } from "@erkasa/contracts";
import { validate } from "../src/index.js";
import { generate } from "./acceptance/generate.js";
import { ROOT, caps, film, run, type Film } from "./helpers.js";

const FILMS: Film[] = [
  "b1-why-we-stay",
  "b2-same-answers",
  "b3-every-yes",
  "b4-one-percent",
  "b5-planning-fallacy",
  "w0-office",
];
const gateFile = (path: string) =>
  validate({ package: readFileSync(join(ROOT, path)), root: ROOT, capabilities: caps() });

describe.each(FILMS)("film %s, as the stager writes it", (name) => {
  it("passes the gate with no error and no warning", () => {
    const { pkg, manifest } = film(name);
    const r = run(pkg, manifest);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.verified?.package.id).toBe(pkg.id);
  });
});

describe("gate acceptance fixtures (B)", () => {
  const fixtures = generate();

  it.each(fixtures.map((f) => [f.name, f] as const))("%s passes every check with no finding", (_, f) => {
    const r = gateFile(f.packagePath);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it.each(fixtures.map((f) => [f.name, f] as const))(
    "%s on disk is exactly what the generator produces from the engine's capabilities",
    (_, f) => {
      expect(readFileSync(join(ROOT, f.packagePath), "utf8")).toBe(f.pkg);
      expect(readFileSync(join(ROOT, f.manifestPath), "utf8")).toBe(f.manifest);
    },
  );

  it("use real files and builtins: prisoner-cell has two verified SVGs from the asset library", () => {
    const r = gateFile("gate/fixtures/acceptance/prisoner-cell.render.json");
    expect([...(r.verified?.files.keys() ?? [])].sort()).toEqual([
      "prop_chair@1",
      "prop_chair@1#default",
      "set_prison_cell@1",
      "set_prison_cell@1#default",
    ]);
  });
});

describe("contract fixtures (A): schema examples, not claimed executable", () => {
  const A = ["prisoner-cell", "office-procedural"];

  it.each(A)("%s is valid against the contract's schemas", (name) => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, `contracts/fixtures/valid/render-package.${name}.json`), "utf8"),
    );
    const man = JSON.parse(
      readFileSync(join(ROOT, `contracts/fixtures/valid/asset-manifest.${name}.json`), "utf8"),
    );
    expect(RenderPackage.safeParse(pkg).success).toBe(true);
    expect(AssetManifest.safeParse(man).success).toBe(true);
  });

  it("prisoner-cell is refused only for features this engine does not draw (lights, shapes, text and icon overlays, glow, dip to black) and two builtins it does not carry", () => {
    expect(
      gateFile("contracts/fixtures/valid/render-package.prisoner-cell.json").errors.map(
        (e) => `${e.code} ${e.file}${e.path}`,
      ),
    ).toEqual([
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

  it("office-procedural is refused for the clock template's inputs and two builtins this engine does not carry", () => {
    expect(
      gateFile("contracts/fixtures/valid/render-package.office-procedural.json").errors.map(
        (e) => `${e.code} ${e.file}${e.path}`,
      ),
    ).toEqual([
      "PARAM_NOT_DECLARED manifest/assets/1/parameters",
      "PARAM_NOT_DECLARED manifest/assets/1/parameters",
      "PARAM_UNSUPPORTED manifest/assets/1/parameters/0",
      "PARAM_UNSUPPORTED manifest/assets/1/parameters/2",
      "BUILTIN_UNKNOWN manifest/assets/3/source/name",
      "BUILTIN_UNKNOWN manifest/assets/4/source/name",
    ]);
  });

  it("their files, hashes and pins are sound: what refuses them is only what the engine cannot draw", () => {
    for (const name of A) {
      const codes = gateFile(`contracts/fixtures/valid/render-package.${name}.json`).errors.map(
        (e) => e.code,
      );
      for (const c of [
        "FILE_HASH",
        "FILE_MISSING",
        "PATH_ESCAPE",
        "MANIFEST_HASH",
        "BUILTIN_MISMATCH",
        "SCHEMA",
        "NOT_APPROVED",
      ])
        expect(codes).not.toContain(c);
    }
  });
});
