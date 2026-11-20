/**
 * W1: Character Identity + Wardrobe Intelligence (Standard v2.1 CA-I, CA-W; acceptance tests D1, D2, D3, D5, D6 of
 * the advanced character requirements). Every test runs on the real pipeline: the plan is composed by the engine,
 * staged into a Render Package by the stager, validated by the gate and drawn by the package renderer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GarmentKind,
  identityFingerprint,
  outfitProblems,
  type Garment,
  type RenderPackage,
} from "@erkasa/contracts";
import { serialise, stageV2, withCameraBounds } from "@erkasa/stager";
import { Script } from "@erkasa/contracts";
import { FilmPlan, Era, Occasion, Profession, Weather, type CastMember } from "../src/contract.js";
import { prepare } from "../src/film.js";
import { hemGeometry, dressedSvg } from "../src/garments.js";
import { openPackage } from "../src/package/render.js";
import { CLOTH_LAG, SEATED, STANDING, drawPerson, lookFor, skeleton, swayOf } from "../src/rig.js";
import { ANACHRONISTIC, dressFor, resolveWardrobe } from "../src/wardrobe.js";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
import { ROOT } from "./package/helpers.js";

const json = (p: string): unknown => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const B2W1 = (): FilmPlan => FilmPlan.parse(json("film/plans/b2-same-answers.w1.film.json"));
const B2 = (): FilmPlan => FilmPlan.parse(json("film/plans/b2-same-answers.film.json"));
const script = (): Script => Script.parse(json("benchmark/scripts/b2-same-answers.script.json"));
const kinds = (gs: readonly Garment[]): string[] => gs.map((g) => g.kind);

function packageOf(plan: FilmPlan): { pkg: RenderPackage; root: string; text: string } {
  const s = withCameraBounds(stageV2("w1-test", plan, script()));
  const w = serialise(s);
  const root = mkdtempSync(join(tmpdir(), "pkg-w1-"));
  const muri = (JSON.parse(w.pkg) as { assetManifest: { uri: string } }).assetManifest.uri;
  mkdirSync(dirname(join(root, muri)), { recursive: true });
  writeFileSync(join(root, muri), w.manifest);
  return { pkg: JSON.parse(w.pkg) as RenderPackage, root, text: w.pkg };
}

// ------------------------------------------------------------------------------------------------ CA-W1 selection

describe("CA-W1 costume selection: from era, profession, occasion and weather, never arbitrary", () => {
  const base = { build: "man" as const, seed: "p1", weather: "mild" as const, occasion: "work" as const };

  it("is deterministic: the same person in the same situation is dressed the same way", () => {
    const a = dressFor({ ...base, era: "1920s", profession: "business" });
    const b = dressFor({ ...base, era: "1920s", profession: "business" });
    expect(a).toEqual(b);
  });

  it("a 1920s businessman wears a three-piece suit, tie and a hat; nothing modern", () => {
    const d = dressFor({ ...base, era: "1920s", profession: "business" });
    expect(kinds(d.garments)).toEqual(
      expect.arrayContaining(["shirt", "trousers", "waistcoat", "suit_jacket", "tie", "fedora", "shoes"]),
    );
    for (const g of d.garments) expect(ANACHRONISTIC["1920s"].has(g.kind), g.kind).toBe(false);
    expect(d.reasons.length).toBeGreaterThanOrEqual(d.garments.length);
  });

  it("a construction worker at work wears a hard hat, a hi-vis vest and boots", () => {
    const d = dressFor({ ...base, era: "contemporary", profession: "construction" });
    expect(kinds(d.garments)).toEqual(expect.arrayContaining(["hard_hat", "hi_vis_vest", "boots"]));
  });

  it("winter adds a warm coat and a scarf; rain a raincoat; formal meetings a suit", () => {
    const cold = dressFor({
      ...base,
      era: "contemporary",
      profession: "none",
      occasion: "outdoor",
      weather: "snow",
    });
    expect(kinds(cold.garments)).toEqual(expect.arrayContaining(["scarf"]));
    expect(kinds(cold.garments).some((k) => ["puffer", "overcoat"].includes(k))).toBe(true);
    const rain = dressFor({ ...base, era: "contemporary", profession: "office", weather: "rain" });
    expect(kinds(rain.garments)).toContain("raincoat");
    const formal = dressFor({
      ...base,
      build: "woman",
      era: "contemporary",
      profession: "executive",
      occasion: "formal",
    });
    expect(kinds(formal.garments)).toContain("blazer");
  });

  it("every combination gives an outfit the rig can draw, without anachronisms (6 eras x 15 professions x 6 occasions x 5 weathers x 2 builds)", () => {
    let n = 0;
    for (const era of Era.options)
      for (const profession of Profession.options)
        for (const occasion of Occasion.options)
          for (const weather of Weather.options)
            for (const build of ["man", "woman"] as const) {
              const d = dressFor({ build, era, profession, occasion, weather, seed: `${era}${profession}` });
              const where = `${build} ${era} ${profession} ${occasion} ${weather}: ${kinds(d.garments).join(",")}`;
              expect(outfitProblems(d.garments), where).toEqual([]);
              for (const g of d.garments)
                expect(ANACHRONISTIC[era].has(g.kind), `${where} has ${g.kind}`).toBe(false);
              n++;
            }
    expect(n).toBe(5400);
  });

  it("the rig draws every garment kind, standing and seated, without NaN", () => {
    for (const kind of GarmentKind.options) {
      const wardrobe: Garment[] = [
        { kind: "shirt", color: "#F4EBDD" },
        { kind: "trousers", color: "#2B2D42" },
        ...(["shirt", "trousers"].includes(kind) ? [] : [{ kind, color: "#E76F51", color2: "#F4EBDD" }]),
      ];
      for (const pose of [STANDING, SEATED]) {
        const svg = drawPerson(
          pose,
          { x: 0, y: 0, facing: 1, turn: 1, scale: 1 },
          lookFor({ build: "man", wardrobe }),
          {
            sway: 0.5,
          },
        ).svg;
        expect(svg, kind).not.toMatch(/NaN|undefined/);
      }
    }
  });
});

// ------------------------------------------------------------------------------------------------ CA-W2 continuity

describe("CA-W2 wardrobe continuity (D2, D3)", () => {
  it("D2: inside one event (the first interview) the outfit is identical in every shot", () => {
    const w = resolveWardrobe(B2W1());
    const first = ["sh01", "sh03", "sh04", "sh05"].map((s) => w.byShot.get(s)?.get("alex"));
    for (const x of first) expect(x?.outfit).toBe("casual");
    for (const x of first) expect(x?.garments).toEqual(first[0]?.garments);
    const second = ["sh06", "sh07", "sh08", "sh09", "sh11"].map((s) => w.byShot.get(s)?.get("alex"));
    for (const x of second) expect(x?.garments).toEqual(second[0]?.garments);
    expect(w.issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("D3: a justified change between two situations: different clothes, the same person", () => {
    const w = resolveWardrobe(B2W1());
    const a = w.byShot.get("sh05")?.get("alex");
    const b = w.byShot.get("sh06")?.get("alex");
    expect(a?.garments).not.toEqual(b?.garments);
    expect(kinds(b?.garments ?? [])).toEqual(expect.arrayContaining(["suit_jacket", "tie", "shirt"]));
    expect(w.report.map((r) => [r.actor, r.outfit, r.fromShot])).toEqual(
      expect.arrayContaining([
        ["alex", "casual", "sh01"],
        ["alex", "interview_suit", "sh06"],
      ]),
    );
  });

  it("a change of clothes inside one event is refused (WARDROBE_CHANGE_IN_EVENT)", () => {
    const p = B2W1();
    const sh06 = p.shots.find((s) => s.id === "sh06");
    if (sh06) delete sh06.continuity;
    expect(resolveWardrobe(p).issues.map((i) => i.code)).toContain("WARDROBE_CHANGE_IN_EVENT");
  });

  it("a change into an outfit with no narrative reason is refused (WARDROBE_CHANGE_NO_REASON)", () => {
    const p = B2W1();
    const alex = p.cast.find((c) => c.id === "alex") as CastMember;
    for (const o of alex.outfits ?? []) delete o.reason;
    expect(resolveWardrobe(p).issues.map((i) => i.code)).toContain("WARDROBE_CHANGE_NO_REASON");
  });

  it("an outfit the plan gives against the situation is reported (WARDROBE_CONTEXT)", () => {
    const p = B2W1();
    const alex = p.cast.find((c) => c.id === "alex") as CastMember;
    alex.era = "1920s";
    alex.outfits = [
      {
        id: "casual",
        weather: "snow",
        garments: [
          { kind: "hoodie", color: "#2A9D8F" },
          { kind: "jeans", color: "#3D5A80" },
        ],
      },
      { id: "interview_suit", occasion: "interview", reason: "second interview" },
    ];
    const msgs = resolveWardrobe(p)
      .issues.filter((i) => i.code === "WARDROBE_CONTEXT")
      .map((i) => i.message);
    expect(msgs.join(" | ")).toMatch(/hoodie is anachronistic/);
    expect(msgs.join(" | ")).toMatch(/jeans is anachronistic/);
  });
});

// ------------------------------------------------------------------------------------------------ CA-I identity

describe("CA-I identity (D1, D6): one person, one cast member, the same in every scene", () => {
  it("the old B2 split one person into two cast members to change clothes: reported (IDENTITY_SPLIT)", () => {
    const codes = resolveWardrobe(B2()).issues.map((i) => i.code);
    expect(codes).toContain("IDENTITY_SPLIT");
    expect(resolveWardrobe(B2W1()).issues.map((i) => i.code)).not.toContain("IDENTITY_SPLIT");
  });

  it("D1 + D6: through the whole package (stager -> gate -> renderer), alex and maria keep one identity in every scene while alex changes clothes", () => {
    const { pkg, root, text } = packageOf(B2W1());
    const opened = openPackage({ package: text, root });
    expect(opened.ok ? [] : opened.errors).toEqual([]);
    const seen = new Map<string, Set<string>>();
    const outfits = new Map<string, Set<string>>();
    let scenesWithAlex = 0;
    for (const s of pkg.scenes)
      for (const a of s.actors) {
        expect(a.rig).toMatch(/@2$/); // the dressed rig
        const fp = identityFingerprint({
          rig: a.rig,
          skin: a.appearance.skin ?? "",
          hair: a.appearance.hair ?? "",
          features: a.features,
        });
        (seen.get(a.id) ?? seen.set(a.id, new Set()).get(a.id))?.add(fp);
        (outfits.get(a.id) ?? outfits.set(a.id, new Set()).get(a.id))?.add(JSON.stringify(a.wardrobe));
        if (a.id === "alex") scenesWithAlex++;
      }
    expect(scenesWithAlex).toBeGreaterThanOrEqual(5); // D1: the same person in at least five scenes
    expect([...seen.values()].map((v) => v.size)).toEqual([1, 1]); // one identity each
    expect(outfits.get("alex")?.size).toBe(2); // casual, then the suit
    expect(outfits.get("maria")?.size).toBe(1);
  });

  it("the gate refuses a package where a person's face changes between scenes (IDENTITY_DRIFT)", () => {
    const { pkg, root } = packageOf(B2W1());
    const later = pkg.scenes.filter((s) => s.actors.some((a) => a.id === "alex"))[2];
    const alex = later?.actors.find((a) => a.id === "alex");
    if (!alex) throw new Error("no alex");
    alex.features = { hair: "bald", facialHair: "beard" };
    const text = JSON.stringify(pkg);
    const opened = openPackage({ package: text, root });
    expect(opened.ok).toBe(false);
    if (!opened.ok) expect(opened.errors.map((e) => e.code)).toContain("IDENTITY_DRIFT");
  });

  it("the package carries exactly what the engine dressed people in (package and plan paths draw the same clothes)", () => {
    const plan = B2W1();
    const { pkg } = packageOf(plan);
    const { composed } = prepare({ script: script(), plan });
    for (const cs of composed.shots) {
      if (!cs.perf) continue;
      for (const [id, a] of cs.perf.actors) {
        const scene = pkg.scenes.find(
          (s) => s.id.endsWith(`_${cs.shot.id}`) && s.actors.some((x) => x.id === id),
        );
        const pa = scene?.actors.find((x) => x.id === id);
        expect(pa?.wardrobe, `${cs.shot.id}/${id}`).toEqual(a.look.wardrobe);
        expect(pa?.features, `${cs.shot.id}/${id}`).toEqual(a.look.features);
      }
    }
  });
});

// ------------------------------------------------------------------------------------------------ CA-W4 animation

describe("CA-W4 clothing animation (D5): cloth follows the body without breaking it", () => {
  const plan = (): FilmPlan => {
    const p = B2W1();
    const alex = p.cast.find((c) => c.id === "alex") as CastMember;
    alex.outfits = [{ id: "casual", occasion: "outdoor", weather: "cold" }, ...(alex.outfits ?? []).slice(1)];
    return p;
  };

  it("walking in a winter coat: the coat trails the walk, settles after the stop, and stays outside the legs in every frame", () => {
    const { composed } = prepare({ script: script(), plan: plan() });
    const sh03 = composed.shots.find((s) => s.shot.id === "sh03");
    const alex = sh03?.perf?.actors.get("alex");
    if (!sh03 || !alex) throw new Error("no walk");
    const worn = alex.look.wardrobe?.map((g) => g.kind) ?? [];
    expect(worn).toContain("scarf");
    expect(worn.some((k) => ["overcoat", "puffer"].includes(k))).toBe(true);
    const walk = alex.walks[0];
    if (!walk) throw new Error("alex does not walk");
    const sways: number[] = [];
    for (let t = 0; t <= sh03.dur; t += 1 / 30) {
      const pl = alex.placed(t);
      const sway = swayOf(alex.placed(t - CLOTH_LAG).x, pl.x, pl.facing);
      sways.push(sway);
      const pose = alex.pose(t);
      const k = skeleton(pose);
      const h = hemGeometry(pose, k, sway, 175, 8); // a long coat's hem (the strictest case)
      const frontKnee = Math.max(k.knee[0], k.kneeF[0]);
      const backKnee = Math.min(k.knee[0], k.kneeF[0]);
      expect(h.frontX, `t=${t.toFixed(2)}`).toBeGreaterThanOrEqual(frontKnee); // cloth never cuts into the leg
      expect(h.backX, `t=${t.toFixed(2)}`).toBeLessThanOrEqual(backKnee);
      expect(Number.isFinite(h.hem)).toBe(true);
      const svg = alex.draw(t).svg;
      expect(svg).not.toMatch(/NaN/);
    }
    const during = sways.filter((_, i) => i / 30 > walk.t0 + 0.4 && i / 30 < walk.t1 - 0.1);
    const after = sways.filter((_, i) => i / 30 > walk.t1 + 0.4);
    expect(Math.max(...during)).toBeGreaterThan(0.25); // the coat trails the motion while walking
    for (const s of after) expect(Math.abs(s)).toBeLessThan(0.02); // and settles once the body has stopped
  });

  it("sway changes smoothly from frame to frame (no popping): at most 0.12 per frame", () => {
    const { composed } = prepare({ script: script(), plan: plan() });
    const sh03 = composed.shots.find((s) => s.shot.id === "sh03");
    const alex = sh03?.perf?.actors.get("alex");
    if (!sh03 || !alex) throw new Error("no walk");
    let prev: number | undefined;
    for (let t = 0; t <= sh03.dur; t += 1 / 30) {
      const pl = alex.placed(t);
      const s = swayOf(alex.placed(t - CLOTH_LAG).x, pl.x, pl.facing);
      if (prev !== undefined) expect(Math.abs(s - prev)).toBeLessThanOrEqual(0.12);
      prev = s;
    }
  });

  it("a tie hangs by gravity: leaning forward, the tie counter-rotates", () => {
    const look = lookFor({
      build: "man",
      wardrobe: [
        { kind: "shirt", color: "#F4EBDD" },
        { kind: "trousers", color: "#2B2D42" },
        { kind: "suit_jacket", color: "#14213D" },
        { kind: "tie", color: "#E76F51" },
      ],
    });
    const lean = { ...STANDING, torso: 20 };
    const svg = dressedSvg({ ...lean }, skeleton(lean), { ...look }, 0);
    expect(svg).toMatch(/rotate\(-15 40 /); // -0.75 x 20 degrees about the knot
  });
});
