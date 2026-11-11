import { describe, expect, it } from "vitest";
import { gate, nearest, PALETTE } from "../src/poc/ai-svg.js";

const ok = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90" width="90" height="90"><g id="x"><path d="M14,20 L66,20 L62,84 L23,88 Z" fill="#F5F2EC"/><rect x="14" y="20" width="52" height="10" fill="#d9d1c4"/></g></svg>`;

describe("AI-SVG gate", () => {
  it("accepts a clean flat drawing and snaps near colours to the palette", () => {
    const r = gate(ok, "ai_mug");
    expect(r.check.ok).toBe(true);
    expect(r.check.shapes).toBe(2);
    expect(r.normalized).toContain('fill="#F6F3EE"');
    expect(r.normalized).toContain('<g id="ai_mug"');
    expect(nearest("#2a1e19").colour).toBe("#2A1E18");
    expect(PALETTE.length).toBeGreaterThan(30);
  });

  it("refuses unsafe or off-style drawings with reasons", () => {
    const bad = ok.replace(
      '<g id="x">',
      '<g id="x" onclick="alert(1)"><script>x()</script><image href="https://e.com/a.png"/>',
    );
    const r = gate(bad, "ai_bad");
    expect(r.normalized).toBeUndefined();
    expect(r.check.problems.join(" ")).toMatch(/event handler.*|script/);
    const outlined = ok.replace('fill="#F5F2EC"', 'fill="#F5F2EC" stroke="#000000" stroke-width="12"');
    expect(gate(outlined, "ai_o").check.problems.join(" ")).toMatch(/thick outline/);
    expect(gate(ok.replace(/viewBox="[^"]*"/, ""), "ai_v").check.problems).toContain(
      "no viewBox starting at 0 0",
    );
  });
});
