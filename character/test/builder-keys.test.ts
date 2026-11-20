import { describe, expect, it } from "vitest";
import { exactDeltas, fieldDeltas, sameTopology } from "../src/builder/keys.js";
import { parseD, parseTaggedSvg } from "../src/builder/sources/tagged-svg.js";
import { must } from "./helpers.js";

const svg = (body: string): string => `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

describe("tagged SVG importer", () => {
  it("makes one part per data-part group, in document order, with its binding and morph mode", () => {
    const parts = parseTaggedSvg(
      svg(
        `<path d="M0 0 L9 9" stroke="#000000"/>` +
          `<g data-part="b" data-bind="head" data-morph="field"><path d="M0 0 L10 0 L10 10 Z" fill="#112233"/></g>` +
          `<g data-part="a" data-bind="root"><path d="M0 0 C1 1 2 2 3 3" stroke="#445566" stroke-width="2"/></g>` +
          `<g data-part="b" data-bind="head"><path d="M5 5 L6 6" stroke="#000000"/></g>`,
      ),
    );
    expect(parts.map((p) => [p.id, p.bind, p.morph, p.order])).toEqual([
      ["b", "head", "field", 0],
      ["a", "root", "exact", 1],
    ]);
    // the untagged path is not part of the character; a part's later groups add to it
    expect(must(parts[0]).paths).toHaveLength(2);
    // curves stay curves: a cubic indexes its three points
    expect(must(parts[1]).paths[0]?.cmds).toEqual([
      ["M", 0],
      ["C", 1, 2, 3],
    ]);
    expect(must(parts[1]).paths[0]?.stroke).toEqual({ color: "#445566", width: 2 });
  });

  it("folds opacity into the colour's alpha and draws circles as four cubic arcs", () => {
    const [p] = parseTaggedSvg(
      svg(`<g data-part="e" data-bind="head"><circle cx="0" cy="0" r="2" fill="#FFFFFF" opacity="0.5"/></g>`),
    );
    const path = must(must(p).paths[0]);
    expect(path.fill).toBe("#FFFFFF80");
    expect(path.cmds.filter((c) => c[0] === "C")).toHaveLength(4);
  });

  it("clips at build time: the shape inside the clip, a seam stroke follows it, another stroke stays whole", () => {
    const [p] = parseTaggedSvg(
      svg(
        `<g data-part="r" data-bind="head"><clipPath id="k"><path d="M0 0 L10 0 L10 10 L0 10 Z"/></clipPath>` +
          `<g clip-path="url(#k)">` +
          `<path d="M5 -5 L20 -5 L20 5 L5 5 Z" fill="#AA0000" stroke="#AA0000" stroke-width="1.2"/>` +
          `<path d="M2 2 L3 3" fill="#00AA00" stroke="#000000"/></g></g>`,
      ),
    );
    const part = must(p);
    expect(part.clipped).toBe(true);
    const inside = must(part.paths[0]);
    const xs = inside.cmds.flatMap((c) => c.slice(1).map((i) => must(part.vertices[i as number])[0]));
    const ys = inside.cmds.flatMap((c) => c.slice(1).map((i) => must(part.vertices[i as number])[1]));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(5);
    expect(Math.max(...xs)).toBeLessThanOrEqual(10);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(5);
    expect(inside.stroke).toEqual({ color: "#AA0000", width: 1.2 });
    // the detail's dark outline is not a seam: kept whole, after its clipped fill
    expect(part.paths.some((q) => q.stroke?.color === "#000000" && !q.fill)).toBe(true);
  });

  it("refuses what it cannot represent", () => {
    expect(() =>
      parseTaggedSvg(
        svg(`<g data-part="x"><rect width="1" height="1"/><text>t</text><polygon points="0 0"/></g>`),
      ),
    ).toThrow(/polygon/);
    expect(() => parseD("M0 0 l1 1")).toThrow(/relative/);
    expect(() => parseTaggedSvg(svg(`<g data-part="x"><path d="M0 0 L1 1" fill="red"/></g>`))).toThrow(
      /colour/,
    );
  });
});

describe("morph targets from key drawings", () => {
  const part = (pts: Array<[number, number]>) =>
    must(
      parseTaggedSvg(
        svg(`<g data-part="p"><path d="M${pts.map((p) => p.join(" ")).join(" L")} Z" fill="#000000"/></g>`),
      )[0],
    );

  it("an exact key is the difference of corresponding points, sparse", () => {
    const a = part([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    const b = part([
      [0, 0],
      [10, 2],
      [10, 10],
    ]);
    expect(sameTopology(a, b)).toBe(true);
    expect(exactDeltas(a.vertices, b.vertices)).toEqual([[1, 0, 2]]);
    const c = part([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
    expect(sameTopology(a, c)).toBe(false);
  });

  it("a field key moves points like the form's seen samples around them", () => {
    const from: Array<[number, number]> = [];
    for (let x = 0; x <= 100; x += 10) for (let y = 0; y <= 100; y += 10) from.push([x, y]);
    // the form moves 3 right and 1 down; unseen samples (moving elsewhere) are ignored
    const to = from.map(([x, y]) => [x + 3, y + 1] as [number, number]);
    const seen = from.map(() => true);
    from.push([50, 50]);
    to.push([90, 90]);
    seen.push(false);
    const d = fieldDeltas(
      [
        [12, 37],
        [55, 55],
      ],
      { from, to, seen },
    );
    expect(d).toEqual([
      [0, 3, 1],
      [1, 3, 1],
    ]);
  });
});
