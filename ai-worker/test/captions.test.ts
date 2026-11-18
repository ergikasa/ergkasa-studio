/**
 * E1.6 subphase 4b end to end: a voiced run rendered with captions (the default) through the package. The words and
 * their times come from the voice alignment (synthetic voice); the captions are drawn into the band and nowhere
 * else: against the same run rendered without captions, the engine's frames (before encoding) differ only inside the
 * caption band, and only while a phrase is on screen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RenderPackage } from "@erkasa/contracts";
import { openPackage, renderCapabilities } from "@erkasa/film";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FILM_FILES, voiceTimings } from "../src/film-steps.js";
import { PACKAGE_FILES } from "../src/package-steps.js";
import { handleCommand } from "../src/worker.js";
import { RUN, cmd, copyRun, deps, frameHashes, makeRun } from "./e2e-fixture.js";
import { useTestLibrary } from "./test-library.js";

const noop = (): void => undefined;
type Captions = Extract<RenderPackage["overlays"][number], { kind: "captions" }>;
const ZONE = renderCapabilities().captions.zone as { top: number; bottom: number };

let restore: () => void = noop;
let withCaps = "";
let without = "";
let base = "";
beforeAll(async () => {
  restore = useTestLibrary();
  base = await makeRun();
  for (const captions of [true, false]) {
    const storage = copyRun(base);
    const r = await handleCommand(
      cmd("render.finalize", "render", { music: true, captions }),
      deps(storage),
      noop,
    );
    expect(r.status, JSON.stringify(r.error)).toBe("SUCCEEDED");
    if (captions) withCaps = join(storage, RUN);
    else without = join(storage, RUN);
  }
}, 900_000);
afterAll(() => restore());

const pkgOf = (dir: string): RenderPackage =>
  RenderPackage.parse(JSON.parse(readFileSync(join(dir, PACKAGE_FILES.render), "utf8")));

/** The engine's frame `k` of a run's package, before encoding (RGBA). */
async function pixels(dir: string, k: number): Promise<Buffer> {
  const o = openPackage({
    package: readFileSync(join(dir, PACKAGE_FILES.render), "utf8"),
    root: join(dir, PACKAGE_FILES.root),
  });
  if (!o.ok) throw new Error(JSON.stringify(o.errors.slice(0, 3)));
  return o.renderer.pixels(k);
}

/** Rows (0..1919) where the two runs' frames differ at time `t` (the engine's pixels, before encoding). */
async function differingRows(a: string, b: string, t: number): Promise<number[]> {
  const k = Math.round(t * 30);
  const x = await pixels(a, k);
  const y = await pixels(b, k);
  expect(x.length).toBe(1080 * 1920 * 4);
  const rows: number[] = [];
  for (let r = 0; r < 1920; r++)
    if (!x.subarray(r * 4320, (r + 1) * 4320).equals(y.subarray(r * 4320, (r + 1) * 4320))) rows.push(r);
  return rows;
}

describe("captions from the voice alignment", () => {
  it("every aligned word is a caption word, at its aligned time (whole ms), in order", () => {
    const c = pkgOf(withCaps).overlays.find((o) => o.kind === "captions") as Captions;
    expect(c).toBeDefined();
    const { alignments } = voiceTimings(join(base, RUN));
    const aligned = Object.values(alignments ?? {}).flatMap((ws) => ws.map((w) => w.word.trim()));
    const words = c.phrases.flatMap((p) => p.words.map((w) => w.text));
    expect(words).toEqual(aligned.filter(Boolean));
    for (const p of c.phrases) for (const w of p.words) expect(Math.round(w.t * 1000)).toBe(w.t * 1000);
  });

  it("without captions the package has no overlay (the E1.5 film)", () => {
    expect(pkgOf(without).overlays).toEqual([]);
  });

  it("the gate passed both; the two MP4s have the same number of frames", () => {
    for (const d of [withCaps, without])
      expect((JSON.parse(readFileSync(join(d, PACKAGE_FILES.gate), "utf8")) as { ok: boolean }).ok).toBe(
        true,
      );
    expect(frameHashes(join(withCaps, FILM_FILES.video)).length).toBe(
      frameHashes(join(without, FILM_FILES.video)).length,
    );
  });

  it("while a phrase shows, the frame differs only inside the caption band; between phrases, not at all", async () => {
    const c = pkgOf(withCaps).overlays.find((o) => o.kind === "captions") as Captions;
    for (const p of c.phrases.slice(0, 4)) {
      const rows = await differingRows(withCaps, without, (p.in + p.out) / 2);
      expect(rows.length, `phrase at ${p.in}`).toBeGreaterThan(0);
      expect(Math.min(...rows)).toBeGreaterThanOrEqual(ZONE.top);
      expect(Math.max(...rows)).toBeLessThanOrEqual(ZONE.bottom);
    }
    // a moment with no phrase (before the first word, or in a gap): no difference at all
    const gaps = c.phrases.flatMap((p, i) => {
      const next = c.phrases[i + 1];
      return next && next.in - p.out > 0.2 ? [(p.out + next.in) / 2] : [];
    });
    const quiet = (c.phrases[0]?.in ?? 0) > 0.2 ? [(c.phrases[0]?.in ?? 0) / 2] : gaps.slice(0, 1);
    for (const t of quiet) expect(await differingRows(withCaps, without, t), `at ${t}`).toEqual([]);
  }, 300_000);
});
