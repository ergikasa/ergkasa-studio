/**
 * K5: a refused package produces no frame. For each of the gate's 50 broken packages (the 48 of E1.3, one
 * EASE_UNDEFINED, one SVG_UNSAFE), renderPackage reports exactly validate()'s findings, hands no frame to its
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
  it("there are 50, including EASE_UNDEFINED and SVG_UNSAFE", () => {
    expect(CASES.length).toBe(50);
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
