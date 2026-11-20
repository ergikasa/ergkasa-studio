/**
 * Capabilities v2, the field matrix (E1.4, conditions C and D): every leaf field of erkasa.render/1 and
 * erkasa.assets/1 has exactly one class in the engine's capabilities, read from the generated JSON schemas at test
 * time (a new field without a class fails here); and every field the gate restricts or refuses has a negative case.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CASES } from "./broken.js";
import { ROOT, caps } from "./helpers.js";

type Json = Record<string, unknown>;

/** Leaf fields of a JSON schema, as JSON Pointers with `*` for array items (following $ref, anyOf, oneOf, allOf). */
export function leaves(file: string): string[] {
  const root = JSON.parse(readFileSync(join(ROOT, "contracts/json-schema", file), "utf8")) as Json;
  const out = new Set<string>();
  const resolve = (ref: string): Json =>
    ref
      .replace(/^#\//, "")
      .split("/")
      .reduce<unknown>((n, k) => (n as Json)[k], root) as Json;
  const walk = (n: unknown, path: string, seen: string[]): void => {
    if (!n || typeof n !== "object") return;
    const o = n as Json;
    if (typeof o["$ref"] === "string") {
      if (seen.includes(o["$ref"])) return;
      return walk(resolve(o["$ref"]), path, [...seen, o["$ref"]]);
    }
    for (const k of ["anyOf", "oneOf", "allOf"])
      for (const x of (o[k] as unknown[]) ?? []) walk(x, path, seen);
    for (const [p, v] of Object.entries((o["properties"] as Json) ?? {})) {
      out.add(`${path}/${p}`);
      walk(v, `${path}/${p}`, seen);
    }
    if (o["items"] && typeof o["items"] === "object") walk(o["items"], `${path}/*`, seen);
  };
  walk(root, "", []);
  const all = [...out];
  return all.filter((p) => !all.some((q) => q.startsWith(`${p}/`))).sort();
}

const SCHEMA_FIELDS = [
  ...leaves("render-package.schema.json").map((p) => `package:${p}`),
  ...leaves("asset-manifest.schema.json").map((p) => `manifest:${p}`),
].sort();

describe("the field matrix", () => {
  const fields = caps().fields;

  it("classifies every leaf field of both schemas, and nothing else (257 since W1: actor wardrobe × 3, features × 2; rig garments, hairStyles, facialHair)", () => {
    expect(SCHEMA_FIELDS.length).toBe(257);
    expect(SCHEMA_FIELDS.filter((f) => !(f in fields))).toEqual([]); // a new schema field without a class
    expect(Object.keys(fields).filter((f) => !SCHEMA_FIELDS.includes(f))).toEqual([]); // a class for no field
  });

  it("uses only the five classes with defined semantics (no field is ignored)", () => {
    expect([...new Set(Object.values(fields))].sort()).toEqual([
      "applied",
      "metadata",
      "refused",
      "restricted",
      "validated",
    ]);
  });

  /**
   * Every restricted or refused field and the finding (code + path pattern, `#` for an index) of the negative case
   * that proves the gate enforces it. A restricted or refused field missing here, or whose finding no case
   * expects, fails the test.
   */
  const ENFORCED: Array<[RegExp, string]> = [
    [/^package:\/output\/(width|height)$/, "VALUE_UNSUPPORTED package/output/width"],
    [/^package:\/output\/fps$/, "VALUE_UNSUPPORTED package/output/fps"],
    // E1.5/E1.6: audio is mixed; pan holds its only value, trim/fades/duration stay inside the file and the film (audio-cases.ts)
    [/^package:\/audio\/\*\/role$/, "VALUE_UNSUPPORTED package/audio/#/role"],
    [/^package:\/audio\/\*\/start$/, "VALUE_UNSUPPORTED package/audio/#/start"],
    [/^package:\/audio\/\*\/trim$/, "VALUE_RANGE package/audio/#/trim"],
    [/^package:\/audio\/\*\/fadeIn$/, "VALUE_RANGE package/audio/#/fadeIn"],
    [/^package:\/audio\/\*\/fadeOut$/, "VALUE_RANGE package/audio/#/fadeOut"],
    [/^package:\/audio\/\*\/pan$/, "VALUE_UNSUPPORTED package/audio/#/pan"],
    [/^package:\/audio\/\*\/duration$/, "VALUE_RANGE package/audio/#/duration"],
    [/^package:\/mix\/duckMusicDb$/, "VALUE_UNSUPPORTED package/mix/duckMusicDb"],
    [/^package:\/mix\/loudness\/rangeLu$/, "VALUE_UNSUPPORTED package/mix/loudness/rangeLu"],
    [/^package:\/mix\/loudness\/truePeakDb$/, "VALUE_UNSUPPORTED package/mix/loudness/truePeakDb"],
    [/^package:\/edit\/\*\/enter\/kind$/, "CAPABILITY_MISSING package/edit/#/enter/kind"],
    [/^package:\/overlays\/\*\/kind$/, "CAPABILITY_MISSING package/overlays/#/kind"],
    [
      /^package:\/overlays\/\*\/(appear|asset|lines\/.*|panel\/.*|in|out|size|state|at\/(actor|node|offset))$/,
      "CAPABILITY_MISSING package/overlays/#/kind",
    ],
    [/^package:\/overlays\/\*\/style\/font$/, "ASSET_KIND package/overlays/#/style/font"],
    [/^package:\/overlays\/\*\/style\/align$/, "VALUE_UNSUPPORTED package/overlays/#/style/align"],
    [/^package:\/overlays\/\*\/style\/maxWidth$/, "VALUE_UNSUPPORTED package/overlays/#/style/maxWidth"],
    [/^package:\/scenes\/\*\/camera\/projection$/, "CAPABILITY_MISSING package/scenes/#/camera/projection"],
    [/^package:\/scenes\/\*\/camera\/aperture$/, "VALUE_UNSUPPORTED package/scenes/#/camera/aperture"],
    [
      /^package:\/scenes\/\*\/camera\/referenceDistance$/,
      "VALUE_UNSUPPORTED package/scenes/#/camera/referenceDistance",
    ],
    [/^package:\/scenes\/\*\/camera\/dolly$/, "VALUE_UNSUPPORTED package/scenes/#/camera/dolly"],
    [/^package:\/scenes\/\*\/layers\/\*\/blur$/, "VALUE_UNSUPPORTED package/scenes/#/layers/#/blur"],
    [/^package:\/scenes\/\*\/layers\/\*\/lit$/, "VALUE_UNSUPPORTED package/scenes/#/layers/#/lit"],
    [
      /^package:\/scenes\/\*\/(layers|screen)\/\*\/nodes\/\*\/(x|y|scale|rotation|opacity|flip|pivot)$/,
      "VALUE_UNSUPPORTED package/scenes/#/layers/#/nodes/#/scale",
    ],
    [
      /^package:\/scenes\/\*\/(layers|screen)\/\*\/nodes\/\*\/(align|color|fill\/.*|font|lineHeight|maxWidth|shape\/.*|size|stroke\/.*|text)$/,
      "CAPABILITY_MISSING package/scenes/#/screen/#/nodes/#/kind",
    ],
    [/^package:\/scenes\/\*\/actors\/\*\/layer$/, "VALUE_UNSUPPORTED package/scenes/#/actors/#/layer"],
    [/^package:\/scenes\/\*\/actors\/\*\/(rim|shadow)$/, "VALUE_UNSUPPORTED package/scenes/#/actors/#/rim"],
    [
      /^package:\/scenes\/\*\/actors\/\*\/wardrobe\/\*\/kind$/,
      "WARDROBE_UNSUPPORTED package/scenes/#/actors/#/wardrobe/#/kind",
    ],
    [/^package:\/scenes\/\*\/contacts\//, "CAPABILITY_MISSING package/scenes/#/contacts/#"],
    [/^package:\/scenes\/\*\/lights\//, "CAPABILITY_MISSING package/scenes/#/lights/#/kind"],
    [/^package:\/scenes\/\*\/events\/\*\/fx$/, "FX_UNSUPPORTED package/scenes/#/events/#/fx"],
    [/^package:\/scenes\/\*\/events\/\*\/duration$/, "VALUE_UNSUPPORTED package/scenes/#/events/#/duration"],
    [/^package:\/scenes\/\*\/events\/\*\/state$/, "CAPABILITY_MISSING package/scenes/#/events/#/state"],
    [
      /^package:\/scenes\/\*\/tracks\/\*\/keys\/\*\/ease$/,
      "EASE_UNDEFINED package/scenes/#/tracks/#/keys/#/ease",
    ],
    [/^manifest:\/assets\/\*\/states\/\*\/element$/, "CAPABILITY_MISSING manifest/assets/#/states/#/element"],
    [/^manifest:\/assets\/\*\/source\/kind$/, "RIG_UNSUPPORTED manifest/assets/#/source/kind"],
    [/^manifest:\/assets\/\*\/format$/, "CAPABILITY_MISSING manifest/assets/#/format"],
    [/^manifest:\/assets\/\*\/height$/, "VALUE_UNSUPPORTED manifest/assets/#/height"],
    [/^manifest:\/assets\/\*\/(family|weight)$/, "BUILTIN_MISMATCH manifest/assets/#/family"],
  ];
  const expected = new Set(CASES.flatMap((c) => c.expect.map((e) => e.replace(/\/\d+/g, "/#"))));

  it("every restricted or refused field is enforced by a negative case with its code and path", () => {
    const strict = Object.entries(fields).filter(([, k]) => k === "restricted" || k === "refused");
    const unmatched = strict.filter(([f]) => !ENFORCED.some(([re]) => re.test(f))).map(([f]) => f);
    expect(unmatched).toEqual([]);
    const unproved = ENFORCED.filter(
      ([re, finding]) => strict.some(([f]) => re.test(f)) && !expected.has(finding),
    ).map(([, finding]) => finding);
    expect(unproved).toEqual([]);
  });
});
