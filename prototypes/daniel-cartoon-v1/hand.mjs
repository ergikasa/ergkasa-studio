/**
 * Daniel, human cartoon v1 (concept prototype): a hand with five fingers, three bones each (two for the thumb).
 *
 * The hand is built from the wrist along its own axes, so the same hand can be posed: `curl` per finger in degrees
 * at the three joints, thumb opposition. Proportions of an adult male hand (about 19 cm long).
 */
import { add, cross, mul, norm, rotate } from "./lib.mjs";
import { sectionRadius, table } from "./body.mjs";
import { tube } from "./tube.mjs";

const FINGERS = [
  // name, offset across the knuckle line (toward the thumb), lengths of the three segments, radius at the base
  { id: "index", t: 2.75, len: [4.3, 2.6, 2.0], r: 0.98, knuckle: 9.9 },
  { id: "middle", t: 0.9, len: [4.7, 2.9, 2.1], r: 1.0, knuckle: 10.3 },
  { id: "ring", t: -0.95, len: [4.4, 2.8, 2.0], r: 0.95, knuckle: 10.0 },
  { id: "little", t: -2.7, len: [3.5, 2.1, 1.8], r: 0.85, knuckle: 9.3 },
];

/**
 * A hand. `wrist`: world position; `down`: direction from wrist to fingers; `palm`: palm normal (world);
 * `curl`: degrees per joint for the four fingers; `thumb`: { spread, curl }.
 */
export function hand({
  side = "R",
  wrist,
  down,
  palm,
  curl = [
    [10, 22, 10],
    [13, 26, 12],
    [16, 29, 14],
    [19, 32, 15],
  ],
  thumb = { curl: [12, 16] },
}) {
  const d = norm(down);
  const p = norm(palm);
  const t = side === "R" ? norm(cross(d, p)) : norm(cross(p, d)); // toward the thumb
  const flex = norm(cross(d, p)); // rotating about this moves a finger toward the palm
  const at = (along, across, out) => add(wrist, add(mul(d, along), add(mul(t, across), mul(p, out))));
  const tubes = [];
  // palm: wrist to knuckles, wide across, thin through
  tubes.push({
    id: "palm",
    T: tube({
      path: [at(-0.6, 0.1, 0), at(4.5, 0.15, 0.25), at(9.3, 0.0, 0.1)],
      rings: 24,
      hint: t,
      section: (s, th) => {
        const [w, th1, th2] = table(
          [
            [0, 2.7, 1.35, 1.35],
            [0.3, 3.6, 1.6, 1.35],
            [0.8, 4.2, 1.3, 1.25],
            [1, 4.0, 1.15, 1.15],
          ],
          s,
        );
        // θ = 0 points to the thumb side; "front" depth is the palm side
        return sectionRadius(th - Math.PI / 2, w, th1, th2, 2.6);
      },
    }),
  });
  // fingers
  for (const [k, f] of FINGERS.entries()) {
    let dir = rotate(d, p, (side === "R" ? 1 : -1) * (k - 1.2) * 1.2); // fan a little
    let pos = at(f.knuckle - 0.9, f.t, 0.05);
    const pts = [pos];
    const c = curl[k];
    for (let j = 0; j < 3; j++) {
      dir = rotate(dir, flex, c[j]); // flex toward the palm
      pos = add(pos, mul(dir, f.len[j]));
      pts.push(pos);
    }
    const base = f.r;
    tubes.push({
      id: f.id,
      T: tube({
        path: pts,
        rings: 26,
        hint: p,
        section: (s, th) => {
          const r = table(
            [
              [0, base * 1.05],
              [0.42, base * 0.9],
              [0.47, base * 0.95],
              [0.72, base * 0.83],
              [0.78, base * 0.86],
              [0.9, base * 0.8],
              [0.96, base * 0.62],
              [1, base * 0.2],
            ],
            s,
          )[0];
          return r * (1 - 0.12 * Math.abs(Math.cos(th))); // a little flatter top to bottom
        },
      }),
    });
  }
  // thumb: from the thenar mass at the base of the palm, lying along the index finger
  {
    let dir = norm(add(mul(d, 0.92), add(mul(t, 0.34), mul(p, 0.16))));
    let pos = at(2.6, 2.3, 0.55);
    const pts = [pos];
    const lens = [4.0, 3.1, 2.5];
    const cs = [0, ...thumb.curl];
    for (let j = 0; j < 3; j++) {
      dir = rotate(dir, norm(cross(dir, p)), cs[j]);
      pos = add(pos, mul(dir, lens[j]));
      pts.push(pos);
    }
    tubes.push({
      id: "thumb",
      T: tube({
        path: pts,
        rings: 30,
        hint: p,
        section: (s) =>
          table(
            [
              [0, 1.7],
              [0.3, 1.25],
              [0.42, 1.08],
              [0.7, 1.0],
              [0.9, 0.88],
              [0.96, 0.66],
              [1, 0.22],
            ],
            s,
          )[0],
      }),
    });
  }
  return tubes;
}
