import { describe, expect, it } from "vitest";
import { Shot } from "../src/contract.js";
import { perform, propAt, WALK_SPEED } from "../src/perform.js";
import { RIG, reachArm, SEATED, skeleton } from "../src/rig.js";
import { SETS } from "../src/sets.js";

function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error("missing");
  return v;
}

const ctx = (shot: unknown, dur = 6) => {
  const cast = [
    { id: "dritan", name: "Dritan", build: "man" as const },
    { id: "maria", name: "Maria", build: "woman" as const },
  ];
  const s = Shot.parse(shot);
  return perform({
    set: SETS[s.set ?? "office"],
    shot: s,
    path: "shots[0]",
    dur,
    cast,
    at: (a) => (a === "start" ? 0 : a.startsWith("sec:") ? Number(a.slice(4)) : undefined),
    words: [],
  });
};

describe("rig", () => {
  it("two-bone IK puts the hand on a reachable target", () => {
    for (const target of [
      [150, -180],
      [200, -60],
      [60, -300],
      [-40, -120],
    ] as Array<[number, number]>) {
      const r = reachArm(SEATED, target);
      const k = skeleton({ ...SEATED, arm: r.arm, fore: r.fore });
      expect(Math.hypot(k.hand[0] - target[0], k.hand[1] - target[1])).toBeLessThan(3);
    }
  });
});

describe("performance", () => {
  it("a walk moves at the speed of its steps (no sliding) and arrives at the mark", () => {
    const p = ctx({
      id: "a",
      scene: "s01",
      moment: "walk",
      kind: "set",
      set: "office",
      actors: [{ id: "dritan", at: "desk", pose: "standing" }],
      actions: [{ who: "dritan", do: "walk_to", target: "window", at: "sec:0.5" }],
    });
    const a = must(p.actors.get("dritan"));
    const mid = (must(a.walks[0]).t0 + must(a.walks[0]).t1) / 2;
    const v = (a.x.at(mid + 0.1) - a.x.at(mid - 0.1)) / 0.2;
    expect(Math.abs(v - WALK_SPEED)).toBeLessThan(WALK_SPEED * 0.08);
    expect(a.x.at(6)).toBeCloseTo(must(SETS.office.marks["window"]).x, 0);
    expect(p.issues).toEqual([]);
  });

  it("the eyes move before the head when looking at something", () => {
    const p = ctx({
      id: "a",
      scene: "s01",
      moment: "look",
      kind: "set",
      set: "office",
      actors: [{ id: "dritan", at: "chair", pose: "seated" }],
      actions: [{ who: "dritan", do: "look", target: "window_view", at: "sec:1" }],
    });
    const a = must(p.actors.get("dritan"));
    const eye0 = a.ch.gy.at(1),
      eye1 = a.ch.gy.at(1.115);
    const head0 = a.ch.head.at(1),
      head1 = a.ch.head.at(1.115);
    expect(Math.abs(eye1 - eye0)).toBeGreaterThan(0.2);
    expect(Math.abs(head1 - head0)).toBeLessThan(0.5);
    expect(a.ch.head.at(2)).toBeLessThan(head0 - 5); // and then the head goes up toward the window
  });

  it("standing up goes the other way first (anticipation) and ends standing", () => {
    const p = ctx({
      id: "a",
      scene: "s01",
      moment: "stand",
      kind: "set",
      set: "office",
      actors: [{ id: "dritan", at: "chair", pose: "seated" }],
      actions: [{ who: "dritan", do: "stand_up", at: "sec:1" }],
    });
    const a = must(p.actors.get("dritan"));
    const t0 = a.ch.torso.at(1);
    expect(a.ch.torso.at(1.3)).toBeLessThan(t0); // leans back before going forward
    expect(a.seatedAt(4)).toBe(false);
    expect(a.y.at(4)).toBeLessThan(a.y.at(0)); // the hip rose
  });

  it("a picked-up cup follows the hand, and goes back on the desk when put down", () => {
    const p = ctx({
      id: "a",
      scene: "s01",
      moment: "cup",
      kind: "set",
      set: "office",
      actors: [{ id: "dritan", at: "chair", pose: "seated" }],
      actions: [
        { who: "dritan", do: "pick_up", target: "cup", at: "sec:0.5" },
        { who: "dritan", do: "drink", at: "sec:2" },
        { who: "dritan", do: "put_down", target: "desk_top", at: "sec:4.2" },
      ],
    });
    expect(p.issues).toEqual([]);
    const a = must(p.actors.get("dritan"));
    const cup = must(p.props.get("cup"));
    const atDrink = propAt(cup, 2.6, p.actors);
    expect(Math.hypot(atDrink[0] - a.draw(2.6).hand[0], atDrink[1] - a.draw(2.6).hand[1])).toBeLessThan(1);
    const after = propAt(cup, 5.8, p.actors);
    expect(after[1]).toBeCloseTo(must(must(SETS.office.marks["desk_top"]).surfaceY) - 28, 0);
  });

  it("unknown marks, props and people are reported for the director to fix", () => {
    const p = ctx({
      id: "a",
      scene: "s01",
      moment: "bad",
      kind: "set",
      set: "office",
      actors: [{ id: "dritan", at: "sofa", pose: "standing" }],
      actions: [
        { who: "maria", do: "nod" },
        { who: "dritan", do: "pick_up", target: "guitar" },
      ],
    });
    expect(p.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["MARK_UNKNOWN", "PROP_UNKNOWN", "WHO_UNKNOWN"]),
    );
  });

  it("arms are long enough for the work point of every seat", () => {
    for (const set of Object.values(SETS))
      for (const m of Object.values(set.marks))
        if (m.work) {
          const p = ctx({
            id: "a",
            scene: "s01",
            moment: "type",
            kind: "set",
            set: set.id,
            actors: [
              {
                id: "dritan",
                at: must(Object.entries(set.marks).find(([, x]) => x === m))[0],
                pose: "seated",
              },
            ],
            actions: [{ who: "dritan", do: "type", at: "start", sec: 1 }],
          });
          const a = must(p.actors.get("dritan"));
          const hand = a.draw(0.8).hand;
          expect(Math.hypot(hand[0] - m.work[0], hand[1] - m.work[1]), `${set.id}`).toBeLessThan(
            RIG.foreArm * 0.25,
          );
        }
  });

  it("a handover: the paper leaves one hand and ends in the other person's hand", () => {
    const p = ctx({
      id: "a",
      scene: "s01",
      moment: "give",
      kind: "set",
      set: "interview",
      actors: [
        { id: "dritan", at: "stand_l", pose: "standing", holding: "cv" },
        { id: "maria", at: "chair_r", pose: "seated" },
      ],
      actions: [{ who: "dritan", do: "give", target: "maria", at: "sec:0.5" }],
    });
    expect(p.issues).toEqual([]);
    const cv = must(p.props.get("cv"));
    const d0 = propAt(cv, 0.2, p.actors);
    expect(
      Math.hypot(
        d0[0] - must(p.actors.get("dritan")).draw(0.2).hand[0],
        d0[1] - must(p.actors.get("dritan")).draw(0.2).hand[1],
      ),
    ).toBeLessThan(1);
    const m = must(p.actors.get("maria")).draw(3).hand;
    const d1 = propAt(cv, 3, p.actors);
    expect(Math.hypot(d1[0] - m[0], d1[1] - m[1])).toBeLessThan(1);
    // and at the moment of the handover both hands are close to each other
    const tA = must(p.actors.get("dritan")).draw(1.2).hand;
    const tB = must(p.actors.get("maria")).draw(1.2).hand;
    expect(Math.hypot(tA[0] - tB[0], tA[1] - tB[1])).toBeLessThan(90);
  });
});
