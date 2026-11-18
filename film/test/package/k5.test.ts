/**
 * K5: a refused package produces no frame. For each of the gate's 103 broken packages (the 48 of E1.3, one
 * EASE_UNDEFINED, one SVG_UNSAFE, the 16 of the gate audit and 37 one-fault packages of G16), renderPackage reports exactly validate()'s findings, hands no frame to its
 * sink and never starts it (so no encoder starts).
 */
import { describe, expect, it } from "vitest";
import { validate } from "@erkasa/gate";
import { renderPackage, type FrameSink } from "../../src/package/render.js";
// the gate's own broken packages (test material shared with gate/test/negative.test.ts)
import { CASES, broken, inputs } from "../../../gate/test/broken.js";

const spy = () => {
  const calls = { begin: 0, frame: 0, end: 0 };
  const sink: FrameSink = {
    begin: () => void calls.begin++,
    frame: () => void calls.frame++,
    end: () => void calls.end++,
  };
  return { calls, sink };
};

describe("K5: refused packages", () => {
  it("there are 183: E1.3's 48, EASE_UNDEFINED, SVG_UNSAFE, the audit's 16, G16's 38 (E1.4, V2d with decision B), the final audit's 60 (F1 46, F2 9, F3 5) and E1.5's 19 audio cases", () => {
    expect(CASES.length).toBe(183);
    expect(CASES.filter((c) => /^E1\.5 audio: /.test(c.name)).length).toBe(19);
    expect(CASES.filter((c) => /^F1 /.test(c.name)).length).toBe(46);
    expect(CASES.filter((c) => /^F2 /.test(c.name)).length).toBe(9);
    expect(CASES.filter((c) => /^F3 /.test(c.name)).length).toBe(5);
    expect(CASES.filter((c) => / audit: /.test(c.name)).length).toBe(16);
    const codes = CASES.flatMap((c) => c.expect.map((e) => e.split(" ")[0]));
    expect(codes).toContain("EASE_UNDEFINED");
    expect(codes).toContain("SVG_UNSAFE");
  });

  it.each(CASES.map((c) => [c.name, c] as const))(
    "%s: the gate's findings, no frame, no encoder",
    async (_, k) => {
      const input = inputs(broken(k));
      const want = validate(input);
      expect(want.ok).toBe(false);
      const { calls, sink } = spy();
      const got = await renderPackage(
        { package: input.package, root: input.root, ...(input.budgets ? { budgets: input.budgets } : {}) },
        sink,
        undefined,
        { capabilities: input.capabilities },
      );
      expect(got.ok).toBe(false);
      expect(got.errors).toEqual(want.errors);
      expect(got.warnings).toEqual(want.warnings);
      expect(got.frames).toBe(0);
      expect(calls).toEqual({ begin: 0, frame: 0, end: 0 });
    },
  );
});
