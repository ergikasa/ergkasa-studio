/**
 * E1.4 final audit F1–F3: the values the capabilities publish are the values the gate enforces.
 *   - every static parameter of every builtin: the values the eight packages write fit its schema; at least one
 *     case writes a wrong value and is refused at that parameter (the cases: value-cases.ts, run by negative.test
 *     and, for 0 frames, by film's K5);
 *   - the three values of the audit are refused before rendering: lines "hello", y "top", place "middle";
 *   - facing: −1 and 1 only, changed by hold; the positive packages pass;
 *   - a capabilities document whose schema the gate cannot enforce is refused.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FILMS } from "@erkasa/stager";
import { describe, expect, it } from "vitest";
import { schemaProblems, schemaViolations, validate } from "../src/index.js";
import { broken, gate, inputs } from "./broken.js";
import { caps, film, ROOT } from "./helpers.js";
import { VALUE_CASES, VALUE_POSITIVE } from "./value-cases.js";

const C = caps();
const statics = C.builtins.flatMap((b) =>
  (b.parameters ?? []).flatMap((p) => (p.kind === "static" ? [{ b: b.name, p }] : [])),
);

/** Every static value the eight packages write, by builtin and parameter. */
function written(): Map<string, unknown[]> {
  const out = new Map<string, unknown[]>();
  for (const f of FILMS) {
    const { pkg, manifest } = film(f);
    const named = new Map(manifest.assets.map((a) => [`${a.id}@${a.version}`, a]));
    for (const s of pkg.scenes)
      for (const l of [...s.layers, ...(s.screen ?? [])])
        for (const n of l.nodes) {
          if (n.kind !== "asset") continue;
          const a = named.get(n.asset);
          const st = a?.kind === "vector" ? a.states.find((x) => x.name === n.state) : undefined;
          if (!st || !("source" in st) || st.source.kind !== "builtin") continue;
          for (const [id, v] of Object.entries(n.params ?? {})) {
            const k = `${st.source.name}.${id}`;
            out.set(k, [...(out.get(k) ?? []), v]);
          }
        }
  }
  return out;
}

describe("F1 static parameters: published, enforced", () => {
  const w = written();
  it("every builtin publishes a schema the gate understands for each static parameter", () => {
    expect(statics.length).toBe(52); // 12 templates × 3, type.kinetic 5, type.w0 4, w0.city 2, ots 2, scrim, wall, mid
    for (const { b, p } of statics)
      expect(schemaProblems(p.kind === "static" ? p.schema : {}, `${b}.${p.id}`)).toEqual([]);
  });
  it.each(statics.map(({ b, p }) => [`${b} ${p.id}`, b, p] as const))(
    "%s: the eight packages write it, every value fits",
    (_, b, p) => {
      const vs = w.get(`${b}.${p.id}`) ?? [];
      expect(vs.length, `${b}.${p.id} is not written by any package`).toBeGreaterThan(0);
      if (p.kind === "static") for (const v of vs) expect(schemaViolations(v, p.schema)).toEqual([]);
    },
  );
  it.each(statics.map(({ b, p }) => [`${b} ${p.id}`, b, p.id] as const))(
    "%s: a wrong value is refused at the parameter",
    (_, b, id) => {
      const mine = VALUE_CASES.filter(
        (k) => k.name.startsWith(`F1 ${b} `) && k.expect.some((e) => e.includes(`/params/${id}`)),
      );
      const templ = b.startsWith("template.") && ["params", "anchors", "dur"].includes(id);
      // the template inputs anchors and dur are written for every template the same way (clock's cases)
      const cases =
        mine.length || !templ
          ? mine
          : VALUE_CASES.filter(
              (k) =>
                k.name.startsWith("F1 template.clock ") && k.expect.some((e) => e.includes(`/params/${id}`)),
            );
      expect(cases.length, `no case refuses a wrong ${b} ${id}`).toBeGreaterThan(0);
    },
  );
  it.each([
    ["F1 type.kinetic lines a string", "/params/lines"],
    ["F1 type.kinetic y a word", "/params/y"],
    ["F1 type.w0 place middle", "/params/place"],
    ["F1 overlay.scrim place middle", "/params/place"],
  ])("audit value: %s is refused before rendering (VALUE_UNSUPPORTED at %s)", (name, at) => {
    const k = VALUE_CASES.find((c) => c.name === name);
    expect(k).toBeDefined();
    const r = gate(broken(k as NonNullable<typeof k>));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "VALUE_UNSUPPORTED" && e.path.endsWith(at))).toBe(true);
  });
  it("a capabilities document with a schema keyword the gate does not understand is refused", () => {
    const bad = caps();
    const b = bad.builtins.find((x) => x.name === "type.kinetic");
    const p = b?.parameters?.find((x) => x.id === "y");
    if (p?.kind === "static") p.schema = { ...p.schema, format: "date" } as typeof p.schema;
    const r = validate({
      ...inputs(broken({ name: "x", mutate: () => undefined, expect: [] })),
      capabilities: bad,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toEqual(["CAPABILITIES_INVALID"]);
  });
});

describe("F2/F3 values the engine accepts are accepted", () => {
  it.each(VALUE_POSITIVE.map((p) => [p.name, p] as const))("%s: the gate passes it", (_, p) => {
    const r = gate(broken({ name: p.name, start: p.start, mutate: p.mutate, expect: [] }));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });
  it("facing is declared discrete: held props' param.facing and actors' facing take −1 and 1", () => {
    const held = C.builtins.filter((b) => /^prop\.[a-z]+\.held$/.test(b.name));
    expect(held.length).toBeGreaterThan(0);
    for (const b of held)
      expect(b.parameters?.find((p) => p.id === "facing")).toMatchObject({
        kind: "channel",
        values: [-1, 1],
      });
    for (const b of C.builtins.filter((x) => x.kind === "rig"))
      expect(b.rig?.channelValues).toEqual({ facing: [-1, 1] });
  });
});

describe("F3 roles: the gate reads them from the capabilities only", () => {
  it("checkRoles names no role and no builtin: every role rule comes from the declaration", () => {
    const src = readFileSync(join(ROOT, "gate/src/executable.ts"), "utf8");
    const body = src.slice(src.indexOf("function checkRoles("));
    const literals = [...body.matchAll(/"([^"\\]*)"/g)].map((m) => m[1]);
    const names = [
      ...Object.values(C.projections).flatMap((p) =>
        Object.entries(p.roles).flatMap(([r, x]) => [r, x.builtin, ...x.members]),
      ),
    ].filter(Boolean);
    expect(literals.filter((l) => names.includes(l as string))).toEqual([]);
    expect(body).not.toMatch(/prop\.|resting|\.held/);
  });
});

describe("F4: the parallax projection the bounds are measured with is part of the contract", () => {
  it("a capabilities document whose parallax projection is not { reference, gamma, plane } is refused", () => {
    const bad = caps();
    const cam = bad.projections["parallax"]?.camera;
    if (cam) cam.parallax = { reference: { cx: 1450, cy: 1120 }, gamma: 0.55, plane: "w0.mid" } as never;
    const r = validate({
      ...inputs(broken({ name: "x", mutate: () => undefined, expect: [] })),
      capabilities: bad,
    });
    expect(r.errors.map((e) => e.code)).toEqual(["CAPABILITIES_INVALID"]);
  });
});
