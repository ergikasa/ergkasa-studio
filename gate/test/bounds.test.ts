/**
 * V2 (E1.4), positive side: bounds exactly around every view the camera takes pass, for a flat set scene, an
 * editorial scene and a W0 scene (the negative side, one step inside: V2a–V2c in executable-cases.ts).
 */
import { describe, expect, it } from "vitest";
import { validate } from "../src/index.js";
import { boundsScene, tight, w0 } from "./executable-cases.js";
import { base, caps, write } from "./helpers.js";

describe("bounds touching the camera's views exactly", () => {
  it.each(["set", "editorial", "parallax"] as const)("%s scene: accepted", (kind) => {
    const b = kind === "parallax" ? w0() : base();
    const s = kind === "parallax" ? boundsScene.parallax(b.pkg) : boundsScene[kind](b.pkg, b.manifest);
    tight(b.pkg, b.manifest, s);
    const w = write(b.pkg, b.manifest, { root: b.root });
    const r = validate({ package: w.text, root: w.root, capabilities: caps() });
    expect(r.errors).toEqual([]);
  });
});
