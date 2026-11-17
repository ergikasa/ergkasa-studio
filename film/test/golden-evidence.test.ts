import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyV2, type Evidence } from "../src/golden-evidence.js";
import { normaliseKtIds } from "../src/golden-ids.js";
import { rasterize } from "../src/render.js";

const sha = (d: string | Uint8Array): string => createHash("sha256").update(d).digest("hex").slice(0, 16);
const svg = (id: string, fill = "#fff"): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><clipPath id="${id}"><rect width="500" height="80"/></clipPath></defs><g clip-path="url(#${id})"><rect width="500" height="80" fill="${fill}"/></g></svg>`;
const old = svg("kt1094");
const evidence: Evidence = {
  capturedAt: "test",
  v2: { "v2/f": { "1": { text: sha(old), norm: sha(normaliseKtIds(old)), px: sha(rasterize(old)) } } },
  w0: {},
};

describe("verifying today's engine against the evidence (no tolerance)", () => {
  it("passes the historical SVG and an SVG that differs only in kinetic-type ids", () => {
    expect(verifyV2(evidence, "f", () => old)).toEqual({ frames: 1, changed: [], failures: [] });
    expect(verifyV2(evidence, "f", () => svg("kt-s1-0"))).toEqual({
      frames: 1,
      changed: ["1"],
      failures: [],
    });
  });

  it("fails any other change, with or without new ids", () => {
    expect(verifyV2(evidence, "f", () => svg("kt1094", "#ffe")).failures).toEqual([
      "f @ 1: the normalised SVG differs",
    ]);
    expect(verifyV2(evidence, "f", () => svg("kt-s1-0", "#ffe")).failures).toEqual([
      "f @ 1: the normalised SVG differs",
    ]);
    expect(
      verifyV2(evidence, "f", () =>
        old.replace('width="500" height="80" fill', 'width="501" height="80" fill'),
      ).failures,
    ).toEqual(["f @ 1: the normalised SVG differs"]);
    const noIds = '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"/>';
    expect(verifyV2(evidence, "f", () => noIds).failures).toEqual([
      "f @ 1: the SVG changed and it has no kinetic-type ids",
    ]);
  });

  it("fails a pixel change that the normalised text cannot see", () => {
    const e = structuredClone(evidence);
    const g = e.v2["v2/f"]?.["1"];
    if (!g) throw new Error("no frame");
    g.px = "0000000000000000";
    expect(verifyV2(e, "f", () => svg("kt-s1-0")).failures).toEqual(["f @ 1: the pixels differ"]);
  });
});
