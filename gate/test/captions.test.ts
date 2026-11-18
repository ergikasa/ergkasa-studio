/**
 * E1.6 subphase 4b (D3, E-D2): captions in the band the engine reserves. A film staged with captions passes; the
 * Gate refuses, with an identifiable code and path, captions outside the band, a phrase wider than the band, and
 * kinetic type that reaches into the band while a phrase shows (CAPTION_CONFLICT).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FilmPlan } from "@erkasa/film";
import {
  Script,
  captionPhraseWidth,
  kineticTypeExtent,
  type KineticLine,
  type RenderPackage,
} from "@erkasa/contracts";
import { ROOT, serialise, stageV2, withCameraBounds, CAPTION_STYLE } from "@erkasa/stager";
import { describe, expect, it } from "vitest";
import { caps, clone, run } from "./helpers.js";

const json = (p: string): unknown => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const ZONE = caps().captions.zone as { top: number; bottom: number; maxWidth: number };

function staged(name: string): { pkg: RenderPackage; manifest: string; notes: string[] } {
  const s = withCameraBounds(
    stageV2(
      name,
      FilmPlan.parse(json(`film/plans/${name}.film.json`)),
      Script.parse(json(`benchmark/scripts/${name}.script.json`)),
      {
        captions: { zone: ZONE },
      },
    ),
  );
  const w = serialise(s);
  return { pkg: JSON.parse(w.pkg) as RenderPackage, manifest: w.manifest, notes: s.notes ?? [] };
}

const errs = (pkg: RenderPackage, manifest: string): string[] =>
  run(pkg, manifest).errors.map((e) => `${e.code} ${e.file}${e.path}`);

type Captions = Extract<RenderPackage["overlays"][number], { kind: "captions" }>;
const captionsOf = (p: RenderPackage): Captions => p.overlays.find((o) => o.kind === "captions") as Captions;

/** The kinetic type nodes of a package with their scene. */
function kinetic(
  p: RenderPackage,
): Array<{ scene: string; node: { id: string; params: Record<string, unknown> } }> {
  return p.scenes.flatMap((s) =>
    [...s.layers, ...(s.screen ?? [])].flatMap((l) =>
      l.nodes
        .filter((n) => n.kind === "asset" && n.asset.startsWith("type_kinetic@") && n.params)
        .map((n) => ({ scene: s.id, node: n as unknown as { id: string; params: Record<string, unknown> } })),
    ),
  );
}

describe.each(["b1-why-we-stay", "b2-same-answers", "b5-planning-fallacy"])(
  "%s staged with captions",
  (name) => {
    const s = staged(name);

    it("passes the gate", () => {
      expect(errs(s.pkg, s.manifest)).toEqual([]);
    });

    it("every phrase fits the band; every word once, in order, inside its phrase; phrases do not overlap", () => {
      const c = captionsOf(s.pkg);
      expect(c.style.font).toBe("font_montserrat_extrabold@1");
      let prevOut = 0;
      for (const ph of c.phrases) {
        expect(
          captionPhraseWidth(
            ph.words.map((w) => w.text),
            CAPTION_STYLE.size,
            800,
            10,
          ),
        ).toBeLessThanOrEqual(ZONE.maxWidth);
        expect(ph.in).toBeGreaterThanOrEqual(prevOut);
        ph.words.forEach((w, k) => {
          expect(w.t).toBeGreaterThanOrEqual(ph.in);
          expect(w.end).toBeLessThanOrEqual(ph.out);
          expect(w.t).toBeLessThan(w.end);
          if (k) expect(w.t).toBeGreaterThanOrEqual((ph.words[k - 1] as { t: number }).t);
        });
        prevOut = ph.out;
      }
      const narration = Script.parse(json(`benchmark/scripts/${name}.script.json`))
        .scenes.flatMap((sc) => sc.narration.split(/\s+/))
        .filter(Boolean);
      expect(c.phrases.flatMap((ph) => ph.words.map((w) => w.text))).toEqual(narration);
    });

    it("no kinetic type reaches into the band while captions show", () => {
      for (const k of kinetic(s.pkg)) {
        const e = kineticTypeExtent(k.node.params["lines"] as KineticLine[], k.node.params["y"] as number);
        expect(
          e.bottom <= ZONE.top || e.top >= ZONE.bottom,
          `${k.scene}/${k.node.id} ${e.top}..${e.bottom}`,
        ).toBe(true);
      }
    });
  },
);

describe("refused captions", () => {
  const b1 = staged("b1-why-we-stay");

  it("b1 had kinetic type in the band: the stager lifted it (and says so)", () => {
    expect(
      b1.notes.filter((n) => n.startsWith("captions: kinetic type lifted")).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("kinetic type put back into the band: CAPTION_CONFLICT on each phrase it meets", () => {
    const p = clone(b1.pkg);
    const lifted = kinetic(p).find(
      (k) => (k.node.params["y"] as number) < 1430 && (k.node.params["y"] as number) > 1000,
    );
    expect(lifted).toBeDefined();
    if (lifted) lifted.node.params["y"] = 1430;
    const e = errs(p, b1.manifest);
    expect(e.length).toBeGreaterThanOrEqual(1);
    for (const x of e) expect(x).toMatch(/^CAPTION_CONFLICT package\/overlays\/0\/phrases\/\d+$/);
  });

  it("captions below the band: VALUE_RANGE at their anchor", () => {
    const p = clone(b1.pkg);
    captionsOf(p).at.y = 0.95;
    expect(errs(p, b1.manifest)).toEqual(["VALUE_RANGE package/overlays/0/at/y"]);
  });

  it("a phrase wider than the band: VALUE_RANGE at that phrase", () => {
    const p = clone(b1.pkg);
    const ph = captionsOf(p).phrases[0] as Captions["phrases"][number];
    const w0 = ph.words[0] as Captions["phrases"][number]["words"][number];
    ph.words = Array.from({ length: 6 }, (_, k) => ({ ...w0, text: "UNDERSTANDABLY", t: w0.t + k * 0.01 }));
    expect(errs(p, b1.manifest)).toEqual(["VALUE_RANGE package/overlays/0/phrases/0"]);
  });

  it("a word that starts before the one before it: OVERLAY_TIME (unchanged since E1.2)", () => {
    const p = clone(b1.pkg);
    const ph = captionsOf(p).phrases.find((x) => x.words.length >= 2) as Captions["phrases"][number];
    const i = captionsOf(p).phrases.indexOf(ph);
    (ph.words[1] as { t: number }).t = (ph.words[0] as { t: number }).t - 0.01;
    expect(errs(p, b1.manifest)).toContain(`OVERLAY_TIME package/overlays/0/phrases/${i}/words/1/t`);
  });
});
