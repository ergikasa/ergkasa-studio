/**
 * Daniel, human cartoon v1 (concept prototype): the full figure in one view.
 *
 * Draw order follows depth for the view: the far arm and leg first, then the body, then the near arm and hand.
 */
import { add, camera, id, ink, norm, renderPng, sub, svgDoc, taperBoth, taperEnd } from "./all.mjs";
import { POSE, jacketTorso, neck, shoe, sleeve, trouserLeg, trouserSeat } from "./body.mjs";
import { group, shapePath } from "./render.mjs";
import { chains, silhouette, tube } from "./tube.mjs";
import { hand } from "./hand.mjs";
import { drawHead } from "./face.mjs";
import { jacketFront } from "./outfit.mjs";
import { PAL } from "./palette.mjs";

export { PAL };

export const HEAD_POSE = { at: [0, 168.0, 1.0], nod: 2, tilt: -1.5, turn: 0, scale: 1.05 };

function handTubes(side) {
  const J = POSE.joints;
  const el = J[`elbow${side}`],
    wr = J[`wrist${side}`];
  const down = norm(add(norm(sub(wr, el)), [0, 0, 0.12]));
  const palm = side === "R" ? [1, 0, -0.45] : [-1, 0, -0.45];
  return hand({ side, wrist: add(wr, [0, -0.6, 0]), down, palm });
}

/** A short tube for the shirt cuff showing below the sleeve. */
function cuff(side) {
  const J = POSE.joints;
  const el = J[`elbow${side}`],
    wr = J[`wrist${side}`];
  const d = norm(sub(wr, el));
  return tube({
    path: [add(wr, [d[0] * -2, d[1] * -2, d[2] * -2]), add(wr, [d[0] * 1.1, d[1] * 1.1, d[2] * 1.1])],
    rings: 8,
    section: () => 3.9,
  });
}

export function figure({
  yaw = 0,
  S = 10,
  cx = 350,
  floorY = 1880,
  expr = {},
  gaze = [0, 0],
  head = HEAD_POSE,
  bake = null,
}) {
  const cam = camera({ yaw, S, cx, cy: floorY });
  // bake mode: groups tagged as parts of the character package; the head is baked on its own (face.mjs)
  const B = (part, bind) => (bake ? `<g data-part="${part}${bake.suffix}" data-bind="${bind}">` : "");
  const E = bake ? "</g>" : "";
  const lr = (s) => s.toLowerCase();
  const lw = 2.3 * (S / 10);
  const T = {
    torso: jacketTorso(),
    sleeveR: sleeve("R"),
    sleeveL: sleeve("L"),
    seat: trouserSeat(),
    legR: trouserLeg("R"),
    legL: trouserLeg("L"),
    shoeR: shoe("R"),
    shoeL: shoe("L"),
    neck: neck(),
    cuffR: cuff("R"),
    cuffL: cuff("L"),
  };
  const hands = { R: handTubes("R"), L: handTubes("L") };
  const turned = Math.abs(yaw) > 10;
  const far = yaw > 0 ? "L" : "R",
    near = yaw > 0 ? "R" : "L";

  const g = (members, fill, shade, line = PAL.line, extra = {}) =>
    group(cam, { members, fill, shade, line, lw, ...extra });
  const trousers = (ms) => g(ms, PAL.trousers, PAL.trousersShade);
  const shoeG = (s) =>
    B(`shoe_${lr(s)}`, "root") + g([{ T: T[`shoe${s}`] }], PAL.shoe, PAL.shoeShade) + shoeDetails(s) + E;
  const handG = (s) => {
    // fingers from far to near, each with its own outline, so they read as separate fingers
    const [palm, ...digits] = hands[s];
    const parts = [
      palm,
      ...digits
        .map((h) => ({ ...h, depth: h.T.rings.reduce((m, r) => m + cam.P(r.c)[2], 0) / h.T.rings.length }))
        .sort((a, b) => a.depth - b.depth),
    ];
    return (
      B(`hand_${lr(s)}`, `hand_${lr(s)}`) +
      parts.map((h) => g([{ T: h.T }], PAL.skin, PAL.skinShade, PAL.line, { threshold: 0.2 })).join("") +
      E +
      (s === "L" ? B("watch_l", "forearm_l") + watch(s) + E : "")
    );
  };
  const cuffG = (s) =>
    B(`cuff_${lr(s)}`, `forearm_${lr(s)}`) + g([{ T: T[`cuff${s}`] }], PAL.shirt, PAL.shirtShade) + E;
  const sleeveG = (s) => g([{ T: T[`sleeve${s}`] }], PAL.jacket, PAL.jacketShade, PAL.jacketLine);

  // clip paths used by details
  const clip = (members) => {
    const cid = id("k");
    return {
      cid,
      def: `<clipPath id="${cid}"><path d="${members.map((m) => shapePath(silhouette(m, cam))).join(" ")}"/></clipPath>`,
    };
  };
  const trouserClip = clip([T.seat, T.legR, T.legL]);
  const jacketClip = clip([T.torso]);

  let svg = trouserClip.def + jacketClip.def;
  // bake mode: the trousers end under the jacket (where the hanging sleeves hid them in the concept, a moving
  // arm would uncover the seat's top at the hips)
  const trimY = cam.P([0, 81, 0])[1];
  const trim = bake ? `trim${bake.suffix}` : "";
  if (bake)
    svg += `<clipPath id="${trim}"><path d="M${-S * 100} ${trimY} L${S * 100} ${trimY} L${S * 100} ${S * 20} L${-S * 100} ${S * 20} Z"/></clipPath>`;
  const T0 = bake ? `<g clip-path="url(#${trim})">` : "";
  const T1 = bake ? "</g>" : "";
  // floor shadow (bake mode: the scene draws contact shadows, not the character)
  const fc = cam.P([0, 0, 1]);
  if (!bake)
    svg += `<ellipse cx="${fc[0]}" cy="${fc[1] + S * 0.6}" rx="${S * 24}" ry="${S * 4.2}" fill="#2A1D18" opacity="0.12"/>`;

  if (turned) {
    svg += shoeG(far);
    svg +=
      B(`leg_${lr(far)}`, "root") + T0 + trousers([{ T: T[`leg${far}`] }]) + trouserDetails(far) + T1 + E;
    svg += handG(far) + cuffG(far) + B(`sleeve_${lr(far)}`, `arm_${lr(far)}`) + sleeveG(far) + E;
    svg +=
      B("trousers", "root") +
      T0 +
      trousers([{ T: T.seat }, { T: T[`leg${near}`] }]) +
      trouserDetails(near) +
      T1 +
      E;
    svg += shoeG(near);
  } else {
    svg += shoeG("R") + shoeG("L");
    svg +=
      B("trousers", "root") +
      T0 +
      trousers([{ T: T.seat }, { T: T.legR }, { T: T.legL }]) +
      trouserDetails("R") +
      trouserDetails("L") +
      T1 +
      E;
  }
  svg += B("neck", "neck") + g([{ T: T.neck }], PAL.skin, PAL.skinShade) + neckDetails() + E;
  // jacket: torso and the near sleeve(s) are one garment; lines inside only where an arm lies against the body
  // (bake mode: the sleeves are their own parts, so the arms can move)
  const jacketMembers = bake
    ? [{ T: T.torso }]
    : turned
      ? [{ T: T.torso }, { T: T[`sleeve${near}`] }]
      : [{ T: T.torso }, { T: T.sleeveR }, { T: T.sleeveL }];
  svg += B("jacket", "torso") + g(jacketMembers, PAL.jacket, PAL.jacketShade, PAL.jacketLine);
  svg += jacketFront(cam, T.torso, { lw, clipTrousers: trouserClip.cid, clipJacket: jacketClip.cid }) + E;
  for (const s of turned ? [near] : ["R", "L"])
    svg += bake ? B(`sleeve_${lr(s)}`, `arm_${lr(s)}`) + sleeveG(s) + sleeveLines(s) + E : sleeveLines(s);
  // head
  if (!bake) svg += drawHead(cam, { pose: head, expr, gaze }).svg;
  // hands in front of the body, then the sleeve hems over the cuffs
  for (const s of turned ? [near] : ["R", "L"])
    svg += handG(s) + cuffG(s) + B(`hem_${lr(s)}`, `forearm_${lr(s)}`) + sleeveHem(s) + E;
  return svg;

  // ---------------------------------------------------------------- details
  function neckDetails() {
    // the jaw's shadow on the neck, the sternocleidomastoid lines, the larynx
    const P = (x, y, z) => cam.P([x, y, z]).slice(0, 2);
    let out = `<clipPath id="nk${cam.yaw}"><path d="${shapePath(silhouette(T.neck, cam))}"/></clipPath><g clip-path="url(#nk${cam.yaw})">`;
    out += `<path d="${ink([P(-7, 157.4, 4), P(-3, 155.4, 6.2), P(0, 154.8, 6.6), P(3, 155.4, 6.2), P(7, 157.4, 4)], S * 3.2, taperBoth)}" fill="${PAL.skinShade}"/>`;
    for (const sx of [-1, 1])
      out += `<path d="${ink([P(sx * 4.6, 160, 3.2), P(sx * 3.2, 155, 5.2), P(sx * 1.4, 151.2, 6.0)], lw * 0.8, taperBoth)}" fill="${PAL.skinShade}"/>`;
    out += `<path d="${ink([P(-0.5, 154.3, 6.6), P(0, 153.6, 6.7), P(0.5, 154.3, 6.6)], lw * 0.8, taperBoth)}" fill="${PAL.skinShade}"/>`;
    return out + `</g>`;
  }
  function sleeveLines(s) {
    const { left, right } = chains(T[`sleeve${s}`], cam);
    const torsoX = cam.P([0, 120, 0])[0];
    const mean = (c) => c.reduce((m, p) => m + p[0], 0) / c.length;
    const inner = Math.abs(mean(left) - torsoX) < Math.abs(mean(right) - torsoX) ? left : right;
    const from = Math.floor(inner.length * 0.2);
    let out = `<path d="${ink(
      inner.slice(from).map((p) => p.slice(0, 2)),
      lw * 1.6,
      (t) => Math.min(1, t * 4) * (0.7 + 0.3 * t),
    )}" fill="${PAL.jacketLine}"/>`;
    const ringPts = (sv) => {
      const R = T[`sleeve${s}`].rings;
      const r = R[Math.round(sv * (R.length - 1))];
      return r.pts.filter((p, j) => cam.dir(r.n[j])[2] > 0.1).map((p) => cam.P(p).slice(0, 2));
    };
    // a short crease at the inside of the elbow, on the inner edge only
    const k = Math.floor(inner.length * 0.52);
    const e0 = inner[k],
      e1 = inner[k + 3];
    if (e0 && e1) {
      const dx = torsoX - e0[0] > 0 ? -1 : 1;
      out += `<path d="${ink([e0.slice(0, 2), [e1[0] + dx * lw * 3, e1[1] + lw * 1.5]], lw * 0.9, taperEnd)}" fill="${PAL.jacketLine}" opacity="0.8"/>`;
    }
    return out;
  }
  function sleeveHem(s) {
    const R = T[`sleeve${s}`].rings;
    const r = R[R.length - 1];
    const vis = r.pts
      .map((p, j) => [p, cam.dir(r.n[j])[2]])
      .filter(([, v]) => v > -0.2)
      .map(([p]) => cam.P(p).slice(0, 2));
    if (vis.length < 3) return "";
    vis.sort((a, b) => a[0] - b[0]);
    return `<path d="${ink(vis, lw * 1.4, taperBoth)}" fill="${PAL.jacketLine}"/>`;
  }
  function watch(s) {
    if (s !== "L") return "";
    const wr = POSE.joints.wristL;
    const t = tube({
      path: [add(wr, [0, 1.6, -0.3]), add(wr, [0, -0.6, 0.1])],
      rings: 6,
      section: () => 3.1,
    });
    return g([{ T: t }], PAL.watchStrap, "#24170F");
  }
  function trouserDetails(s) {
    const R = T[`leg${s}`].rings;
    const crease = R.slice(Math.floor(R.length * 0.22), R.length - 3).map((r) => {
      let best = r.pts[0],
        bd = -1e9;
      r.pts.forEach((p) => {
        const d = cam.dir(sub(p, r.c));
        if (d[2] > bd) {
          bd = d[2];
          best = p;
        }
      });
      return cam.P(best).slice(0, 2);
    });
    let out = `<g clip-path="url(#${trouserClip.cid})"><path d="${ink(crease, lw * 0.8, taperBoth)}" fill="${PAL.trousersShade}"/>`;
    const r = R[R.length - 4];
    const f = r.pts.filter((p, j) => cam.dir(r.n[j])[2] > 0.25).map((p) => cam.P(p).slice(0, 2));
    if (f.length > 3)
      out += `<path d="${ink(
        f.sort((a, b) => a[0] - b[0]),
        lw * 0.9,
        taperBoth,
      )}" fill="${PAL.trousersShade}"/>`;
    // folds: behind the knee's inner side and at the top of the thigh, short and few
    const around = R[0].pts.length;
    const inner = s === "R" ? 1 : -1; // toward the other leg
    const onLeg = (sv, a) => {
      const rr = R[Math.round(sv * (R.length - 1))];
      // angle a (degrees) from the front toward the inner side
      const j = Math.round((((inner * a) / 360) * around + around) % around);
      return cam.P(rr.pts[j % around]).slice(0, 2);
    };
    for (const [s0, a0, s1, a1] of [
      [0.52, 40, 0.57, 72],
      [0.55, 30, 0.6, 62],
      [0.12, 30, 0.2, 70],
    ]) {
      const p0 = onLeg(s0, a0),
        p1 = onLeg(s1, a1);
      out += `<path d="${ink([p0, p1], lw * 0.8, taperBoth)}" fill="${PAL.trousersShade}"/>`;
    }
    return out + `</g>`;
  }
  function shoeDetails(s) {
    const R = T[`shoe${s}`].rings;
    const sole = R.map((r) => {
      let best = r.pts[0];
      r.pts.forEach((p) => {
        if (p[1] < best[1] + 0.001 && cam.dir(sub(p, r.c))[2] > -0.3) best = p;
      });
      return cam.P(add(best, [0, 0.9, 0])).slice(0, 2);
    });
    // a highlight on the toe cap where it faces the light
    const toeRing = R[Math.round(R.length * 0.82)];
    let best = null,
      bd = -1;
    toeRing.pts.forEach((p, j) => {
      const n = cam.dir(toeRing.n[j]);
      const l = n[0] * -0.52 + n[1] * 0.55 + n[2] * 0.65;
      if (n[2] > 0 && l > bd) {
        bd = l;
        best = p;
      }
    });
    let hi = "";
    if (best) {
      const [hx, hy] = cam.P(best);
      hi = `<ellipse cx="${hx}" cy="${hy}" rx="${cam.S * 1.2}" ry="${cam.S * 0.5}" fill="${PAL.shoeHi}" opacity="0.8"/>`;
    }
    return `<path d="${ink(sole, lw * 0.9, taperBoth)}" fill="${PAL.shoeShade}"/>` + hi;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = figure({ yaw: 0 });
  const b = figure({ yaw: 35, cx: 1050 });
  renderPng(
    svgDoc(1400, 1950, a + b, "#EFEBE4"),
    new URL("./out/wip-body.png", import.meta.url).pathname,
    1000,
  );
  console.log("ok");
}
