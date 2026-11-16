/**
 * Temporal regression tests: the state of every person at the end of each shot against the start of the
 * next one, in the five benchmark films and the W0 film, plus the actions that must go on across a cut.
 */
import { describe, expect, it } from "vitest";
import { checkFilm, stateOf } from "../src/continuity.js";
import { loadFilms } from "../src/continuity-report.js";
import type { ActorPerf } from "../src/perform.js";

const films = loadFilms();

describe.each(films.map((f) => [f.name, f] as const))("%s", (_name, film) => {
  const r = checkFilm(film.shots);
  it("has no undeclared continuity error at any cut", () => {
    expect(r.issues.filter((i) => i.level === "error")).toEqual([]);
  });
  for (const t of r.transitions.filter((x) => !x.intentional)) {
    it(`${t.from} -> ${t.to} keeps ${t.actor} where, how and as they were`, () => {
      expect(Math.hypot(t.next.x - t.prev.x, t.next.y - t.prev.y)).toBeLessThanOrEqual(r.tol.position);
      expect(t.next.facing).toBe(t.prev.facing);
      expect(t.next.scale).toBe(t.prev.scale);
      expect(t.next.mood).toBe(t.prev.mood);
      expect(t.next.holding).toBe(t.prev.holding);
      if (t.prev.movement !== "sitting_down" && t.prev.movement !== "standing_up")
        expect(t.next.seated).toBe(t.prev.seated);
    });
  }
});

const shot = (film: string, id: string) => {
  const f = films.find((x) => x.name === film);
  const s = f?.shots.find((x) => x.shot.id === id);
  if (!s?.perf) throw new Error(`${film} ${id}`);
  return s as typeof s & { perf: NonNullable<typeof s.perf> };
};
const actor = (s: ReturnType<typeof shot>, id: string) => s.perf.actors.get(id) as ActorPerf;

describe("actions across a cut", () => {
  it("a walk cut halfway goes on at the same speed and reaches its mark (W0 sh05 -> sh06)", () => {
    const a = shot("w0/b1-why-we-stay", "sh05");
    const b = shot("w0/b1-why-we-stay", "sh06");
    const end = stateOf(a.perf, actor(a, "dritan"), a.dur, "office");
    const start = stateOf(b.perf, actor(b, "dritan"), 0, "office");
    expect(end.movement).toBe("walking");
    expect(start.movement).toBe("walking");
    expect(Math.abs((start.walk?.speed ?? 0) - (end.walk?.speed ?? 0))).toBeLessThan(
      0.15 * Math.abs(end.walk?.speed ?? 1),
    );
    const done = stateOf(b.perf, actor(b, "dritan"), b.dur, "office");
    expect(done.movement).not.toBe("walking");
  });
  it("the walk's stride does not restart at the cut (legs continuous)", () => {
    const a = shot("w0/b1-why-we-stay", "sh05");
    const b = shot("w0/b1-why-we-stay", "sh06");
    const pe = actor(a, "dritan").pose(a.dur);
    const ps = actor(b, "dritan").pose(0);
    expect(Math.abs(pe.thigh - ps.thigh)).toBeLessThan(12);
    expect(Math.abs(pe.thighF - ps.thighF)).toBeLessThan(12);
  });
  it("a sit started before the cut finishes after it (b2 sh03 -> sh04)", () => {
    const b = shot("v2/b2-same-answers", "sh04");
    const s0 = stateOf(b.perf, actor(b, "alex"), 0, "interview");
    const s1 = stateOf(b.perf, actor(b, "alex"), 1.5, "interview");
    expect(s0.seated).toBe(false);
    expect(s1.seated).toBe(true);
  });
  it("a prop handed over stays in the new hand (b2 sh06 -> sh07)", () => {
    const b = shot("v2/b2-same-answers", "sh07");
    expect(stateOf(b.perf, actor(b, "maria"), 0, "interview").holding).toBe("cv");
  });
  it("a declared time jump starts from the plan, and is reported, not failed (b5 sh03 -> sh04)", () => {
    const f = films.find((x) => x.name === "v2/b5-planning-fallacy");
    const t = f && checkFilm(f.shots).transitions.find((x) => x.to === "sh04");
    if (!t) throw new Error("b5 sh03 -> sh04 not found");
    expect(t.intentional).toBe("reset");
    expect(t.issues.every((i) => i.level === "warning")).toBe(true);
    expect(t.next.seated).toBe(true);
  });
});
