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

describe("capabilities v2 (E1.4): the declaration matches the engine's code", () => {
  const c = renderCapabilities();
  const src = (f: string): string => readFileSync(join(ROOT, f), "utf8");

  it("is erkasa.capabilities/2; a v1 document and broken rules are refused", () => {
    expect(c.version).toBe("erkasa.capabilities/2");
    const v1 = clone(caps()) as unknown as Record<string, unknown>;
    delete v1["version"];
    v1["projections"] = ["flat", "parallax"];
    v1["transitions"] = ["cut", "dissolve", "whip"];
    expect(capabilityProblems(v1)).toEqual(
      expect.arrayContaining([
        "version is not erkasa.capabilities/2",
        "projections is not a map of rules",
        "transitions is not a list of { kind, from, to }",
      ]),
    );
    const roles = caps();
    (roles.projections["parallax"]?.roles["city"] as { blur: string }).blur = "fog";
    expect(capabilityProblems(roles)).toEqual([
      "projections.parallax.roles.city.blur names a role that does not exist ('fog')",
    ]);
    const tr = caps();
    tr.transitions.push({ kind: "cut", from: "flat", to: "orbit" });
    expect(capabilityProblems(tr)).toEqual(["transition cut flat->orbit: unknown projection 'orbit'"]);
    const pl = caps();
    (pl.builtins.find((b) => b.kind === "vector") as { placement: string[] }).placement = ["skew"];
    expect(capabilityProblems(pl)).toEqual([
      `${pl.builtins.find((b) => b.kind === "vector")?.name}: placement is not a list of placement fields`,
    ]);
    const fl = caps();
    fl.fields["package:/id"] = "ignored" as never;
    expect(capabilityProblems(fl)).toEqual(["fields: 'package:/id' has an unknown class 'ignored'"]);
  });

  it("output: the size the renderer draws (style.ts W × H), 30 fps, silent", () => {
    expect(src("film/src/style.ts")).toMatch(/export const W = 1080;/);
    expect(src("film/src/style.ts")).toMatch(/export const H = 1920;/);
    expect(c.output).toEqual({ sizes: [[1080, 1920]], fps: [30], audio: false });
  });

  it("parallax camera: W0's reference height and dolly share (w0/camera.ts REF.height, GAMMA)", () => {
    const cam = src("film/src/w0/camera.ts");
    expect(cam).toContain("export const REF: Cam = { cx: 1450, cy: 1120, height: 2140 };");
    expect(cam).toContain("const GAMMA = 0.55;");
    expect(c.projections["parallax"]?.camera).toMatchObject({
      referenceDistance: [2140],
      dolly: [0.55],
      aperture: [0],
    });
  });

  it("editorial camera: centred at W/2 (v2frame.ts editorialView)", () => {
    expect(src("film/src/v2frame.ts")).toContain(
      '`<g transform="translate(540 ${fmt(960 + dy)}) scale(${fmt(z)}) translate(-540 -960)">${svg}</g>`',
    );
    expect(c.projections["flat"]?.camera.editorial).toEqual({ builtins: "template.", x: 540 });
  });

  it("captions: the published semantics are the renderer's constants", () => {
    expect(src("film/src/package/draw.ts")).toContain("clamp((t - ph.in) / 0.12)");
    expect(src("film/src/w0/compositor.ts")).toContain(
      'fill-opacity="${stroke ? 0.9 : w.reached ? 1 : 0.6}"',
    );
    expect(c.captions).toEqual({
      anchor: ["screen"],
      align: ["center"],
      maxWidth: false,
      semantics: { fadeIn: 0.12, unspokenOpacity: 0.6, strokeOpacity: 0.9, overVignette: true },
    });
  });

  it("rigs: the rest pose is the standing pose actorSvg falls back to; the height is the stager's", () => {
    expect(src("film/src/package/draw.ts")).toContain("const pose = { ...STANDING } as Pose;");
    const { manifest } = film("b3-every-yes");
    for (const b of c.builtins.filter((x) => x.kind === "rig")) {
      const m = manifest.assets.find(
        (a) => a.kind === "rig" && a.source.kind === "builtin" && a.source.name === b.name,
      );
      if (m?.kind === "rig") expect(b.rig?.height, b.name).toBe(m.height);
      expect(b.rig?.rest).toMatchObject({
        glow: 0,
        "root.x": 0,
        "root.y": 0,
        "root.scale": 1,
        facing: 1,
        turn: 1,
      });
      for (const bone of b.rig?.bones ?? [])
        expect(typeof b.rig?.rest[bone], `${b.name} ${bone}`).toBe("number");
    }
  });

  it("placement: props are drawn where the node is (x, y); every other builtin applies none", () => {
    for (const b of c.builtins.filter((x) => x.kind === "vector"))
      expect(b.placement, b.name).toEqual(b.name.startsWith("prop.") ? ["x", "y"] : []);
  });
});
