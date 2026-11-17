/**
 * The engine's published render capabilities: complete, deterministic, pinned to the code, and accepted by the
 * gate; and the gate's own check of a capabilities document.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { capabilities, renderCapabilities, SETS, TEMPLATES } from "@erkasa/film";
import { capabilityProblems } from "../src/index.js";
import { ROOT, caps, clone, film, sha } from "./helpers.js";

const FILE: Array<[RegExp, string]> = [
  [/^rig\./, "film/src/rig.ts"],
  [/^set\./, "film/src/sets.ts"],
  [/^prop\./, "film/src/props.ts"],
  [/^template\./, "film/src/templates.ts"],
  [/^type\.kinetic$/, "film/src/style.ts"],
  [/^overlay\./, "film/src/v2frame.ts"],
  [/^w0\./, "film/src/w0/world.ts"],
  [/^type\.w0$/, "film/src/w0/compositor.ts"],
];

describe("engine render capabilities", () => {
  it("are part of capabilities() and deterministic", () => {
    expect(capabilities().render).toEqual(renderCapabilities());
    expect(JSON.stringify(renderCapabilities())).toBe(JSON.stringify(renderCapabilities()));
  });

  it("are a document the gate accepts", () => {
    expect(capabilityProblems(caps())).toEqual([]);
  });

  it("pin every builtin to the file that implements it (sha256, the stager's fingerprint semantics)", () => {
    for (const b of renderCapabilities().builtins) {
      if (b.kind === "font") {
        const weight = b.font?.weight;
        const dir = join(
          ROOT,
          "node_modules/.pnpm/@expo-google-fonts+montserrat@0.4.2/node_modules/@expo-google-fonts/montserrat",
        );
        const names: Record<number, string> = {
          300: "300Light/Montserrat_300Light.ttf",
          500: "500Medium/Montserrat_500Medium.ttf",
          800: "800ExtraBold/Montserrat_800ExtraBold.ttf",
          900: "900Black/Montserrat_900Black.ttf",
        };
        expect(b.fingerprint, b.name).toBe(sha(readFileSync(join(dir, names[weight as number] as string))));
        continue;
      }
      const file = FILE.find(([re]) => re.test(b.name))?.[1];
      expect(file, b.name).toBeDefined();
      expect(b.fingerprint, b.name).toBe(sha(readFileSync(join(ROOT, file as string))));
      expect([b.version, b.status]).toEqual([1, "supported"]);
    }
  });

  it("cover every set, template, prop kind, W0 layer and font the engine draws", () => {
    const names = new Set(renderCapabilities().builtins.map((b) => b.name));
    for (const id of Object.keys(SETS))
      for (const part of ["back", "front"]) expect(names.has(`set.${id}.${part}`), id).toBe(true);
    for (const t of Object.keys(TEMPLATES)) expect(names.has(`template.${t}`), t).toBe(true);
    for (const k of ["cup", "paper", "notebook", "phone"])
      for (const st of ["resting", "held"]) expect(names.has(`prop.${k}.${st}`)).toBe(true);
    for (const n of [
      "w0.sky",
      "w0.city",
      "w0.wall",
      "w0.mid",
      "w0.near",
      "type.w0",
      "type.kinetic",
      "overlay.ots",
      "overlay.scrim",
      "rig.cutout.man",
      "rig.cutout.woman",
    ])
      expect(names.has(n), n).toBe(true);
    for (const w of [300, 500, 800, 900]) expect(names.has(`font.montserrat-${w}`)).toBe(true);
  });

  it("every builtin the six staged films use is published with the same version, fingerprint and kind", () => {
    const byName = new Map(renderCapabilities().builtins.map((b) => [b.name, b]));
    for (const f of [
      "b1-why-we-stay",
      "b2-same-answers",
      "b3-every-yes",
      "b4-one-percent",
      "b5-planning-fallacy",
      "w0-office",
    ] as const)
      for (const a of film(f).manifest.assets) {
        const sources = [
          a.source,
          ...(a.kind === "vector" ? a.states.flatMap((s) => ("source" in s ? [s.source] : [])) : []),
        ];
        for (const s of sources) {
          if (s.kind !== "builtin") continue;
          const b = byName.get(s.name);
          expect(b, `${f} ${s.name}`).toBeDefined();
          expect([b?.version, b?.fingerprint, b?.kind]).toEqual([s.version, s.fingerprint, a.kind]);
        }
      }
  });
});

describe("the gate refuses capabilities it cannot trust", () => {
  const broken = (f: (c: ReturnType<typeof caps>) => void): string[] => {
    const c = caps();
    f(c);
    return capabilityProblems(c);
  };
  it.each([
    [
      "a builtin listed twice",
      (c: ReturnType<typeof caps>) => c.builtins.push(clone(c.builtins[0]) as (typeof c.builtins)[number]),
      /listed twice/,
    ],
    [
      "a fingerprint that is not a sha256",
      (c: ReturnType<typeof caps>) => ((c.builtins[0] as { fingerprint: string }).fingerprint = "abc"),
      /not a sha256/,
    ],
    [
      "a version that is not a positive integer",
      (c: ReturnType<typeof caps>) => ((c.builtins[0] as { version: number }).version = 0),
      /positive integer/,
    ],
    [
      "an unknown status",
      (c: ReturnType<typeof caps>) => ((c.builtins[0] as { status: string }).status = "beta"),
      /unknown status/,
    ],
    [
      "a rig without its description",
      (c: ReturnType<typeof caps>) =>
        delete (c.builtins.find((b) => b.kind === "rig") as { rig?: unknown }).rig,
      /without its rig/,
    ],
    [
      "a list that is not a list",
      (c: ReturnType<typeof caps>) => ((c as { fx: unknown }).fx = "none"),
      /fx is not a list/,
    ],
  ])("%s", (_, f, re) => {
    expect(broken(f).join("\n")).toMatch(re);
  });
});
