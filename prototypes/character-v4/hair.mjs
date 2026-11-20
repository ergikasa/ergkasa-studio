/**
 * Character v4 prototype: hair and beard. Not production code.
 *
 * Hair is designed as LOCKS: each lock is a centre line and a width profile, drawn back to front, with a lit
 * edge toward the key, a dark parting on the far edge, a contact shadow on what it lies on, and fine strands
 * inside that follow it. That is how a 2D key artist builds hair (big shapes first, strands last), and it
 * animates: a lock is a chain that can sway, a strand is a child of its lock.
 *
 * The beard is built from TUFTS (short tapered clumps that follow the growth direction), then single hairs,
 * then the hairs that break the silhouette. Everything is seeded, so every render is the same picture.
 */
import { smooth, sample, taper, inside, rng, lerp, clamp, f } from "./lib.mjs";

const LIGHT = [-0.62, -0.78]; // toward the key (up and to the left)

function distTo(p, line) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i],
      b = line[i + 1];
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy || 1;
    const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1);
    best = Math.min(best, Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t)));
  }
  return best;
}

/** Normals along a polyline (unit, consistent side). */
function normals(pts) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  });
}

/** Width of a lock at t: full at the root third, tapering to a point. */
function lockWidth(t, w, root = 0.75, tip = 0.04) {
  if (t < 0.28) return w * lerp(root, 1, t / 0.28);
  return w * lerp(1, tip, Math.pow((t - 0.28) / 0.72, 1.35));
}

// ------------------------------------------------------------------------------------------------ hairstyle

/**
 * The v4 hairstyle, at the portrait view: short-to-medium, textured, a side part over the near eye, the top swept
 * across to the far side with lift at the front, tapered sides greying at the temples. Each lock is
 * [width, ...centre line], listed back to front.
 */
export const HAIRSTYLE = {
  outline: [
    [637, 724],
    [625, 664],
    [624, 592],
    [636, 520],
    [660, 456],
    [696, 402],
    [746, 362],
    [808, 336],
    [878, 324],
    [950, 322],
    [1022, 332],
    [1092, 360],
    [1154, 406],
    [1202, 474],
    [1232, 562],
    [1246, 660],
    [1244, 760],
    [1234, 860],
    [1218, 940],
    [1196, 992],
    [1172, 976],
    [1150, 930],
    [1132, 850],
    [1124, 806],
    [1122, 904],
    [1100, 904],
    [1096, 820],
    [1084, 752],
    [1062, 702],
    [1030, 656],
    [1000, 626],
    [960, 602],
    [900, 594],
    [830, 592],
    [760, 598],
    [702, 614],
    [662, 642],
    [646, 684],
  ],
  // the hair may reach past the outline on the top and the far side (locks, fly-aways), never onto the face
  reach: [
    [628, 730],
    [606, 664],
    [604, 588],
    [616, 508],
    [642, 440],
    [682, 380],
    [740, 336],
    [808, 306],
    [880, 294],
    [952, 292],
    [1026, 302],
    [1100, 330],
    [1170, 380],
    [1222, 452],
    [1256, 548],
    [1272, 660],
    [1268, 770],
    [1256, 870],
    [1236, 950],
    [1206, 1004],
    [1166, 986],
    [1126, 806],
    [1124, 910],
    [1098, 910],
    [1094, 820],
    [1082, 752],
    [1060, 702],
    [1028, 656],
    [998, 626],
    [960, 602],
    [900, 594],
    [830, 592],
    [760, 598],
    [702, 614],
    [662, 642],
    [646, 690],
  ],
  // the skin edge under the hair (front hairline, temple, sideburn): the hair thins out here
  hairline: [
    [646, 690],
    [662, 642],
    [702, 614],
    [760, 598],
    [830, 592],
    [900, 594],
    [960, 602],
    [1000, 626],
    [1030, 656],
    [1062, 702],
    [1084, 752],
    [1096, 820],
    [1100, 904],
  ],
  // the part: from the front hairline over the near eye back toward the crown
  part: [
    [962, 602],
    [968, 548],
    [986, 486],
    [1012, 428],
    [1046, 382],
  ],
  back: [
    // near side, combed down and back from the part toward the ear and the nape
    [44, [1046, 386], [1110, 412], [1170, 462], [1216, 540], [1240, 640], [1242, 730]],
    [40, [1024, 440], [1094, 466], [1158, 520], [1200, 600], [1222, 700], [1226, 790]],
    [38, [1004, 500], [1066, 520], [1130, 570], [1176, 650], [1200, 740], [1206, 830]],
    [34, [1186, 640], [1220, 740], [1226, 850], [1214, 930], [1196, 984]],
    [30, [1150, 740], [1188, 820], [1200, 900], [1192, 960]],
    [26, [990, 560], [1040, 594], [1088, 640], [1126, 700], [1150, 760]],
  ],
  top: [
    // the main section, swept from the part across the top to the far side, the front lifting off the forehead
    [52, [1046, 382], [966, 346], [870, 336], [780, 352], [706, 398], [656, 462], [630, 540]],
    [50, [1030, 420], [950, 386], [852, 378], [760, 398], [692, 446], [648, 516], [630, 600]],
    [48, [1014, 466], [934, 436], [838, 432], [752, 456], [690, 504], [652, 572], [636, 650]],
    [46, [998, 514], [920, 484], [826, 476], [744, 500], [684, 548], [650, 616], [638, 700]],
    [44, [984, 560], [910, 528], [816, 520], [736, 544], [680, 592], [652, 652], [646, 712]],
    // the front: rooted at the hairline, rising, then rolling over to the far side
    [40, [966, 600], [936, 540], [870, 500], [790, 494], [722, 522], [672, 576], [648, 660]],
    [34, [900, 596], [870, 548], [810, 526], [746, 536], [696, 572], [664, 630], [652, 690]],
  ],
  // one loose lock that has fallen forward onto the far side of the forehead
  loose: [9, [810, 560], [770, 566], [738, 590], [718, 626], [712, 662], [718, 690]],
  // where the hair faces the key: the sheen band crosses the locks here
  sheen: [
    [652, 600],
    [664, 520],
    [702, 458],
    [764, 414],
    [840, 392],
    [920, 388],
  ],
};

function lockSvg(spec, R, lightAt, opts = {}) {
  const [w, ...guide] = spec;
  const c = sample(guide, 36);
  const nr = normals(c);
  const n = c.length;
  const L = [],
    Rr = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const ww = lockWidth(t, w, opts.root ?? 0.75) / 2;
    L.push([c[i][0] + nr[i][0] * ww, c[i][1] + nr[i][1] * ww]);
    Rr.push([c[i][0] - nr[i][0] * ww, c[i][1] - nr[i][1] * ww]);
  }
  const shape = smooth([...L, ...Rr.slice().reverse()], true, 0.14);
  const mid = c[Math.floor(n * 0.45)];
  const lit = lightAt(mid);
  const side = nr[Math.floor(n / 2)][0] * LIGHT[0] + nr[Math.floor(n / 2)][1] * LIGHT[1] > 0 ? 1 : -1;
  const base = opts.grey ? lerpHex("#2A211C", "#5E5751", opts.grey) : lerpHex("#130E0B", "#3A2D24", lit);
  const hiC = opts.grey ? lerpHex("#7A706A", "#BDB4AC", lit) : lerpHex("#3A2E26", "#A08672", lit);
  const out = [];
  // contact shadow on what the lock lies on (down and away from the key)
  out.push(`<path d="${shape}" fill="#050302" opacity=".45" transform="translate(4 6)" filter="url(#b4)"/>`);
  out.push(`<path d="${shape}" fill="${base}"/>`);
  // lit ribbon toward the key, a dark parting on the other edge
  const ribbon = c.map((p, i) => {
    const t = i / (n - 1);
    const ww = lockWidth(t, w) / 2;
    return [p[0] + nr[i][0] * side * ww * 0.35, p[1] + nr[i][1] * side * ww * 0.35];
  });
  out.push(
    `<path d="${taperMid(ribbon.slice(2, -3), w * 0.42)}" fill="${hiC}" opacity="${f(0.35 + lit * 0.4)}" filter="url(#b2)"/>`,
  );
  const parting = c.map((p, i) => {
    const t = i / (n - 1);
    const ww = lockWidth(t, w) / 2;
    return [p[0] - nr[i][0] * side * ww * 0.82, p[1] - nr[i][1] * side * ww * 0.82];
  });
  out.push(
    `<path d="${taper(parting.slice(1, -4), 3.2, 0.4)}" fill="#050302" opacity=".7" filter="url(#b1)"/>`,
  );
  // strands inside the lock
  let dark = "",
    light = "",
    grey = "";
  const count = Math.round(w * 0.55);
  for (let k = 0; k < count; k++) {
    const u = R.range(-0.46, 0.46);
    const t0 = R.range(0, 0.25),
      t1 = R.range(0.55, 1);
    const pts = [];
    for (let i = Math.floor(t0 * (n - 1)); i <= Math.floor(t1 * (n - 1)); i++) {
      const t = i / (n - 1);
      const ww = lockWidth(t, w);
      const uu = u * (1 - 0.25 * t);
      pts.push([c[i][0] + nr[i][0] * uu * ww, c[i][1] + nr[i][1] * uu * ww]);
    }
    if (pts.length < 3) continue;
    const s = taper(pts, R.range(0.9, 1.6), 0.15);
    const towardLight = u * side;
    if (opts.grey && R() < opts.grey) grey += s;
    else if (towardLight > 0.05 && R() < 0.75) light += s;
    else dark += s;
  }
  out.push(`<path d="${dark}" fill="#070504" opacity=".45"/>`);
  out.push(`<path d="${light}" fill="${hiC}" opacity="${f(0.25 + lit * 0.35)}"/>`);
  if (grey) out.push(`<path d="${grey}" fill="#B6ADA5" opacity=".55"/>`);
  return { svg: out.join(""), centre: c };
}

/** A lock seen as a ribbon: thin at both ends, widest in the middle. */
function taperMid(pts, w) {
  const n = pts.length;
  if (n < 3) return "";
  const nr = normals(pts);
  const L = [],
    Rr = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const ww = (w * Math.sin(Math.PI * t)) / 2 + 0.4;
    L.push([pts[i][0] + nr[i][0] * ww, pts[i][1] + nr[i][1] * ww]);
    Rr.push([pts[i][0] - nr[i][0] * ww, pts[i][1] - nr[i][1] * ww]);
  }
  return smooth([...L, ...Rr.reverse()], true, 0.15);
}

function lerpHex(a, b, t) {
  const A = parseInt(a.slice(1), 16),
    B = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(lerp((A >> s) & 255, (B >> s) & 255, clamp(t, 0, 1)));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

/** The flow at a point: tangents of the nearest guide curves, weighted by distance. */
function flowAt(p, guides) {
  let wx = 0,
    wy = 0;
  for (const g of guides) {
    let best = Infinity,
      bt = [0, 1];
    for (let i = 0; i < g.length - 1; i++) {
      const a = g[i],
        b = g[i + 1];
      const dx = b[0] - a[0],
        dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy || 1;
      const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1);
      const d = Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
      if (d < best) {
        best = d;
        const l = Math.sqrt(l2);
        bt = [dx / l, dy / l];
      }
    }
    const w = 1 / Math.pow(best + 10, 2.4);
    wx += bt[0] * w;
    wy += bt[1] * w;
  }
  const l = Math.hypot(wx, wy) || 1;
  return [wx / l, wy / l];
}

function streamline(start, len, step, guides, R, wobble = 0.03) {
  const pts = [start];
  let p = start,
    bend = R.range(-wobble, wobble);
  for (let s = 0; s < len; s += step) {
    const d = flowAt(p, guides);
    bend = clamp(bend + R.range(-wobble, wobble), -0.18, 0.18);
    const c = Math.cos(bend),
      sn = Math.sin(bend);
    const q = [p[0] + (d[0] * c - d[1] * sn) * step, p[1] + (d[0] * sn + d[1] * c) * step];
    pts.push(q);
    p = q;
  }
  return pts;
}

/** A lock along a streamline: full at the root, tapering to a point, its value set by where it faces. */
function lockFrom(c, w, lightAt, R, opts = {}) {
  const nr = normals(c);
  const n = c.length;
  const L = [],
    Rr = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const ww = lockWidth(t, w, opts.root ?? 0.22, 0.03) / 2;
    L.push([c[i][0] + nr[i][0] * ww, c[i][1] + nr[i][1] * ww]);
    Rr.push([c[i][0] - nr[i][0] * ww, c[i][1] - nr[i][1] * ww]);
  }
  const shape = smooth([...L, ...Rr.slice().reverse()], true, 0.14);
  const mid = c[Math.floor(n * 0.4)];
  const lit = clamp(lightAt(mid) + R.range(-0.1, 0.1), 0, 1);
  const side = nr[Math.floor(n / 2)][0] * LIGHT[0] + nr[Math.floor(n / 2)][1] * LIGHT[1] > 0 ? 1 : -1;
  const base = lerpHex("#100B09", "#3A2C23", lit);
  const hiC = lerpHex("#2A201A", "#7E6654", lit);
  const off = (k, frac) =>
    c.map((p, i) => {
      const ww = lockWidth(i / (n - 1), w, 0.22) / 2;
      return [p[0] + nr[i][0] * k * ww * frac, p[1] + nr[i][1] * k * ww * frac];
    });
  const out = [];
  out.push(`<path d="${shape}" fill="#050302" opacity=".35" transform="translate(3 5)" filter="url(#b4)"/>`);
  out.push(`<path d="${shape}" fill="${base}"/>`);
  // value across the lock: lighter toward the key, darker on the far edge (blurred, so locks melt together)
  out.push(
    `<path d="${taperMid(off(side, 0.3).slice(1, -3), w * 0.45)}" fill="${hiC}" opacity="${f(0.3 + lit * 0.35)}" filter="url(#b3)"/>`,
  );
  out.push(
    `<path d="${taper(off(-side, 0.7).slice(1, Math.floor(n * 0.75)), w * 0.22, 0.5)}" fill="#050302" opacity=".55" filter="url(#b2)"/>`,
  );
  // strands inside the lock
  let dark = "",
    light = "",
    grey = "";
  const count = Math.round(w * 0.7);
  for (let k = 0; k < count; k++) {
    const u = R.range(-0.46, 0.46);
    const t0 = R.range(0.04, 0.3),
      t1 = R.range(0.5, 1);
    const pts = [];
    for (let i = Math.floor(t0 * (n - 1)); i <= Math.floor(t1 * (n - 1)); i++) {
      const t = i / (n - 1);
      const ww = lockWidth(t, w, 0.22);
      pts.push([c[i][0] + nr[i][0] * u * ww, c[i][1] + nr[i][1] * u * ww]);
    }
    if (pts.length < 3) continue;
    const s = taper(pts, R.range(0.8, 1.5), 0.12);
    if (opts.grey && R() < opts.grey) grey += s;
    else if (u * side > 0 && R() < 0.7) light += s;
    else dark += s;
  }
  out.push(`<path d="${dark}" fill="#060403" opacity=".4"/>`);
  out.push(`<path d="${light}" fill="${hiC}" opacity="${f(0.22 + lit * 0.3)}"/>`);
  if (grey) out.push(`<path d="${grey}" fill="#8E8680" opacity=".3"/>`);
  return out.join("");
}

/** Lift a lock off the scalp in its middle (volume), outward from the centre of the head. */
function lifted(c, amount) {
  const n = c.length;
  return c.map((p, i) => {
    const t = i / (n - 1);
    const dx = p[0] - 900,
      dy = p[1] - 760;
    const l = Math.hypot(dx, dy) || 1;
    const k = amount * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.25)), 1.4);
    return [p[0] + (dx / l) * k, p[1] + (dy / l) * k];
  });
}

export function svgHair(opts = {}) {
  const R = rng(opts.seed ?? 21);
  const st = HAIRSTYLE;
  const defs = [];
  const out = [];
  const massD = smooth(st.outline, true, 0.16);
  const reachD = smooth(st.reach, true, 0.16);
  defs.push(`<clipPath id="hairClip"><path d="${reachD}"/></clipPath>`);
  defs.push(
    `<mask id="hairMask" maskUnits="userSpaceOnUse" x="500" y="200" width="900" height="950"><path d="${reachD}" fill="#fff"/><path d="${smooth(st.hairline, false)}" fill="none" stroke="#000" stroke-width="18" opacity=".7" filter="url(#b4)"/></mask>`,
  );
  defs.push(
    `<radialGradient id="hairBase" cx="760" cy="430" r="620" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#33271F"/><stop offset=".5" stop-color="#1A130F"/><stop offset="1" stop-color="#080605"/></radialGradient>`,
  );
  // how much a point faces the key: the top front is brightest, the near side and back fall off
  const lightAt = (p) => clamp(1.2 - (p[0] - 640) / 520 - Math.max(0, p[1] - 430) / 480, 0, 1);
  const topGuides = st.top.map((g) => g.slice(1));
  const backGuides = st.back.map((g) => g.slice(1));

  // the shadow the hair casts on the forehead and the near temple
  out.push(
    `<path d="${smooth(
      [
        [640, 640],
        [700, 618],
        [790, 608],
        [900, 610],
        [980, 622],
        [1040, 668],
        [1084, 740],
        [1092, 700],
        [1010, 610],
        [880, 586],
        [760, 588],
        [660, 610],
      ],
      true,
    )}" fill="#5A2E22" opacity=".45" filter="url(#b6)"/>`,
  );
  // the mass, with the big value gradient (the head is a ball in light)
  const g = [`<g mask="url(#hairMask)"><g clip-path="url(#hairClip)">`];
  g.push(`<path d="${massD}" fill="url(#hairBase)"/>`);
  // the tapered near side shows skin through it
  g.push(
    `<path d="${smooth(
      [
        [1080, 700],
        [1140, 690],
        [1200, 760],
        [1196, 960],
        [1160, 1010],
        [1124, 900],
        [1110, 780],
      ],
      true,
    )}" fill="#6A5146" opacity=".4" filter="url(#b10)"/>`,
    `<path d="${smooth(
      [
        [628, 640],
        [660, 640],
        [664, 720],
        [634, 726],
      ],
      true,
    )}" fill="#6A5146" opacity=".35" filter="url(#b6)"/>`,
  );
  // near-side locks: seeded along the part, combed down and back
  const part = sample(st.part, 60);
  const back = [];
  for (let i = 0; i < 26; i++) {
    const p = part[Math.floor(R.range(0.05, 1) * 60)];
    const start = [p[0] + R.range(4, 40), p[1] + R.range(0, 30)];
    back.push({
      c: streamline(start, R.range(160, 320), 8, backGuides, R),
      w: R.range(16, 34),
      key: start[1],
    });
  }
  for (let i = 0; i < 16; i++) {
    const start = [R.range(1100, 1220), R.range(560, 900)];
    back.push({
      c: streamline(start, R.range(90, 180), 8, backGuides, R),
      w: R.range(12, 24),
      key: start[1] + 400,
    });
  }
  back.sort((a, b) => a.key - b.key);
  for (const l of back) {
    const m = l.c[Math.floor(l.c.length / 2)];
    const grey = m[0] > 1090 && m[1] > 680 ? 0.22 : m[0] > 1060 && m[1] > 640 ? 0.1 : 0;
    g.push(lockFrom(l.c, l.w, lightAt, R, { grey }));
  }
  // the top section: seeded along the part (crown first) and along the front hairline (front last)
  const top = [];
  for (let i = 0; i < 34; i++) {
    const t = R.range(0, 1);
    const p = part[Math.floor(t * 59)];
    const start = [p[0] - R.range(0, 26), p[1] + R.range(-6, 10)];
    const c0 = streamline(start, R.range(240, 420), 8, topGuides, R);
    top.push({ c: R() < 0.6 ? lifted(c0, R.range(3, 12)) : c0, w: R.range(22, 46), key: -start[1] });
  }
  const front = sample(
    [
      [968, 600],
      [920, 594],
      [860, 592],
      [800, 594],
      [740, 602],
    ],
    20,
  );
  for (let i = 0; i < 14; i++) {
    const p = front[Math.floor(R.range(0, 1) * 20)];
    // rooted at the hairline, lifting first: start a little inside the mass, flow up and over
    const start = [p[0] + R.range(-10, 10), p[1] - R.range(4, 18)];
    top.push({
      c: lifted(streamline(start, R.range(160, 300), 8, topGuides, R), R.range(4, 14)),
      w: R.range(18, 34),
      key: 1000 + start[0],
    });
  }
  top.sort((a, b) => a.key - b.key);
  for (const l of top) g.push(lockFrom(l.c, l.w, lightAt, R));

  // fine strands over everything, close to the local value
  let fine = "",
    fineHi = "",
    fineG = "";
  for (let i = 0; i < 1400; i++) {
    const start = [R.range(620, 1250), R.range(330, 1040)];
    if (!inside(start, st.outline)) continue;
    const rightOfPart = start[0] > lerp(962, 1046, clamp((602 - start[1]) / 220, 0, 1)) + 10;
    const c = streamline(start, R.range(30, 90), 6, rightOfPart ? backGuides : topGuides, R, 0.04);
    const s = taper(c, R.range(0.7, 1.3), 0.1);
    const lit = lightAt(c[Math.floor(c.length / 2)]);
    const greyZone = (start[0] > 1080 && start[1] > 640) || (start[0] < 670 && start[1] > 620);
    if (greyZone && R() < 0.3) fineG += s;
    else if (R() < lit * 0.6) fineHi += s;
    else fine += s;
  }
  g.push(
    `<path d="${fine}" fill="#070504" opacity=".35"/><path d="${fineHi}" fill="#6E5848" opacity=".3"/><path d="${fineG}" fill="#8E8680" opacity=".25"/>`,
  );

  // the sheen: a band where the hair faces the key, broken by the locks
  const sheen = sample(st.sheen, 80);
  let sh = "",
    sh2 = "";
  for (let i = 0; i < 170; i++) {
    const p = sheen[Math.floor(R() * sheen.length)];
    const q = [p[0] + R.range(-18, 18), p[1] + R.range(-16, 16)];
    // break the band into clumps: skip some stretches entirely
    if (Math.sin(q[0] * 0.045 + q[1] * 0.02) > 0.55) continue;
    const c = streamline(q, R.range(24, 60), 5, topGuides, R, 0.02);
    const s = taper(c, R.range(1.2, 2.6), 0.1);
    if (R() < 0.3) sh2 += s;
    else sh += s;
  }
  g.push(
    `<g filter="url(#b05)"><path d="${sh}" fill="#A68B74" opacity=".42"/><path d="${sh2}" fill="#D9C1A9" opacity=".32"/></g>`,
  );
  g.push(
    `<path d="${smooth(st.sheen, false)}" fill="none" stroke="#8A705C" stroke-width="40" opacity=".18" filter="url(#b16)"/>`,
  );
  // the part: a thin line of scalp
  g.push(
    `<path d="${smooth(st.part, false)}" fill="none" stroke="#6A4A3C" stroke-width="2" opacity=".35" filter="url(#b1)"/>`,
  );
  g.push(`</g></g>`);
  // roots at the hairline: dense, short and soft, rising before the hair turns over
  let roots = "",
    rootsG = "";
  const hl = sample(st.hairline, 400);
  for (let i = 0; i < hl.length; i++) {
    const p = hl[i];
    for (let k = 0; k < 2; k++) {
      const sideZone = p[1] > 640 && p[0] > 1020;
      const farZone = p[0] < 680;
      const ang = sideZone
        ? Math.PI / 2 + 0.6 + R.range(-0.2, 0.2)
        : farZone
          ? -Math.PI / 2 - 0.9 + R.range(-0.3, 0.3)
          : -Math.PI / 2 - 0.45 + R.range(-0.25, 0.25);
      const s0 = [p[0] + R.range(-3, 3), p[1] + R.range(-4, 5)];
      const L = R.range(6, 15);
      const e = [s0[0] + Math.cos(ang) * L, s0[1] + Math.sin(ang) * L];
      const m = [lerp(s0[0], e[0], 0.5) + R.range(-1.5, 1.5), lerp(s0[1], e[1], 0.5)];
      const s = taper([s0, m, e], R.range(0.8, 1.2), 0.3);
      if ((sideZone || farZone) && R() < 0.35) rootsG += s;
      else roots += s;
    }
  }
  g.push(
    `<path d="${smooth(st.hairline, false)}" fill="none" stroke="#2A1E18" stroke-width="16" opacity=".35" transform="translate(0 -8)" filter="url(#b4)"/>`,
  );
  g.push(
    `<path d="${roots}" fill="#1E1611" opacity=".45"/><path d="${rootsG}" fill="#A0978F" opacity=".4"/>`,
  );
  out.push(g.join(""));
  // the loose lock on the forehead
  // (no loose lock: the forehead stays clear for the brows to act)
  // cool rim on the back of the head
  out.push(
    `<path d="${smooth(
      [
        [1150, 420],
        [1200, 486],
        [1232, 570],
        [1244, 660],
        [1244, 760],
        [1234, 860],
      ],
      false,
    )}" fill="none" stroke="#A9C2DA" stroke-width="5" opacity=".2" filter="url(#b4)"/>`,
  );

  // fine hairs breaking the silhouette
  let fly = "";
  const edge = sample(st.outline.slice(1, 18), 140);
  for (const p of edge) {
    // fewer on the crown (they read as a cowlick), more at the far temple and the back
    if (R() < (p[1] < 380 ? 0.8 : 0.35)) continue;
    const rightOfPart = p[0] > 1040;
    const d = flowAt(p, rightOfPart ? backGuides : topGuides);
    const L = R.range(8, 26);
    const o = R.range(-6, 0);
    const nx = -d[1],
      ny = d[0];
    const bow = R.range(1, 5);
    fly += taper(
      [
        [p[0] + nx * o, p[1] + ny * o],
        [p[0] + d[0] * L * 0.5 - nx * bow, p[1] + d[1] * L * 0.5 - ny * bow],
        [p[0] + d[0] * L - nx * bow * 2.4, p[1] + d[1] * L - ny * bow * 2.4],
      ],
      1.0,
      0.1,
    );
  }
  out.push(`<path d="${fly}" fill="#2C221C" opacity=".6"/>`);
  // the short hairs at the near temple and the sideburn, salt and pepper
  let temple = "",
    templeG = "";
  for (let i = 0; i < 420; i++) {
    const p = [R.range(1080, 1140), R.range(690, 910)];
    if (!inside(p, st.outline)) continue;
    const ang = Math.PI / 2 + 0.25 + R.range(-0.25, 0.25);
    const L = R.range(8, 15);
    const s = taper([p, [p[0] + Math.cos(ang) * L, p[1] + Math.sin(ang) * L]], R.range(1, 1.6), 0.15);
    if (R() < 0.45) templeG += s;
    else temple += s;
  }
  out.push(
    `<path d="${temple}" fill="#120D0A" opacity=".55"/><path d="${templeG}" fill="#A69D95" opacity=".5"/>`,
  );
  void lockSvg;
  return { defs: defs.join(""), svg: `<g id="hair">${out.join("")}</g>` };
}

// ------------------------------------------------------------------------------------------------ beard

/** A short boxed beard: a clean cheek line, a moustache trimmed to the lip, greying at the chin. */
export const BEARD = {
  zone: [
    // cheek line, near side: from the sideburn down and forward to the mouth corner
    [1100, 900],
    [1074, 932],
    [1038, 962],
    [998, 988],
    [958, 1008],
    [922, 1026],
    [896, 1046],
    [882, 1066],
    // moustache: from the near corner up under the nose and over to the far corner
    [870, 1046],
    [848, 1030],
    [818, 1022],
    [790, 1023],
    [766, 1020],
    [742, 1023],
    [720, 1030],
    [702, 1044],
    [690, 1060],
    // far cheek line out to the silhouette
    [672, 1048],
    [652, 1034],
    [636, 1028],
    // outer edge: just past the skin silhouette on the far side, under the jaw, the neckline on the near side
    [631, 1074],
    [634, 1124],
    [646, 1174],
    [666, 1214],
    [694, 1246],
    [732, 1270],
    [778, 1282],
    [826, 1286],
    [876, 1280],
    [932, 1262],
    [996, 1232],
    [1050, 1192],
    [1092, 1137],
    [1118, 1072],
    [1130, 1004],
    [1124, 948],
  ],
  cheekLine: [
    [1100, 900],
    [1074, 932],
    [1038, 962],
    [998, 988],
    [958, 1008],
    [922, 1026],
    [896, 1046],
    [882, 1066],
  ],
  mouTop: [
    [882, 1066],
    [870, 1046],
    [848, 1030],
    [818, 1022],
    [790, 1023],
    [766, 1020],
    [742, 1023],
    [720, 1030],
    [702, 1044],
    [690, 1060],
    [672, 1048],
    [652, 1034],
    [636, 1028],
  ],
  neckline: [
    [694, 1246],
    [732, 1270],
    [778, 1282],
    [826, 1286],
    [876, 1280],
    [932, 1262],
    [996, 1232],
    [1050, 1192],
    [1092, 1137],
    [1118, 1072],
    [1130, 1004],
  ],
  outer: [
    [636, 1028],
    [631, 1074],
    [634, 1124],
    [646, 1174],
    [666, 1214],
    [694, 1246],
    [732, 1270],
    [778, 1282],
    [826, 1286],
    [876, 1280],
    [932, 1262],
    [996, 1232],
    [1050, 1192],
    [1092, 1137],
    [1118, 1072],
  ],
};

export function svgBeard(H, opts = {}) {
  const R = rng(opts.seed ?? 33);
  const z = BEARD;
  const out = [];
  const lips = opts.lips ?? [];
  const upperLip = lips[0] ?? [],
    lowerLip = lips[1] ?? [];
  const zoneD = smooth(z.zone, true, 0.14);
  // the lips stay clear of the beard: the lower lip entirely, the upper lip below the moustache's edge
  const lipCut =
    (lowerLip.length
      ? `<path d="${smooth(lowerLip, true, 0.17)}" fill="#000" filter="url(#b1)"/><path d="${smooth(lowerLip.slice(5), false)}" fill="none" stroke="#000" stroke-width="12" opacity=".7" filter="url(#b4)"/>`
      : "") +
    (upperLip.length ? `<path d="${smooth(upperLip, true, 0.17)}" fill="#000" filter="url(#b1)"/>` : "");
  const defs = [
    `<clipPath id="beardVol"><path d="${zoneD}"/></clipPath>`,
    `<mask id="beardMask" maskUnits="userSpaceOnUse" x="540" y="840" width="700" height="520"><path d="${zoneD}" fill="#fff" filter="url(#b2)"/><path d="${smooth(z.cheekLine, false)}" fill="none" stroke="#000" stroke-width="30" opacity=".75" filter="url(#b6)"/><path d="${smooth(z.mouTop.slice(0, 11), false)}" fill="none" stroke="#000" stroke-width="18" opacity=".8" filter="url(#b4)"/>${lipCut}</mask>`,
  ];
  // density: dense on the chin, jaw and moustache, thinning toward the cheek line
  const density = (p) => {
    const dc = distTo(p, z.cheekLine);
    const dm = distTo(p, z.mouTop);
    const edge = Math.min(clamp(dc / 30, 0, 1), clamp(dm / 8, 0, 1));
    const gap = Math.min(Math.hypot(p[0] - 712, p[1] - 1140), Math.hypot(p[0] - 836, p[1] - 1150));
    return edge * clamp(gap / 24, 0.5, 1);
  };
  const dirAt = (p) => {
    const mo = p[1] < 1086 && p[0] > 688 && p[0] < 884 && p[1] > 1016;
    if (mo) return p[0] > 764 ? [0.6, 1] : [-0.6, 1];
    if (p[0] > 900 && p[1] < 1150) return [-0.4, 1];
    if (p[0] > 960) return [-0.75, 1];
    if (p[0] < 690) return [0.3, 1];
    if (p[1] > 1240) return [0.12, 1];
    return [p[0] > 800 ? -0.15 : 0.1, 1];
  };

  // 0. stubble above the cheek line: the shaved skin is a little darker and cooler, with fine dots of growth
  let dots = "";
  for (let i = 0; i < 1600; i++) {
    const p = [R.range(880, 1110), R.range(880, 1060)];
    const d = distTo(p, z.cheekLine);
    if (inside(p, z.zone) || d > 46 || R() > 1 - d / 46) continue;
    const a = Math.atan2(1, -0.4) + R.range(-0.4, 0.4);
    dots += taper([p, [p[0] + Math.cos(a) * 3.5, p[1] + Math.sin(a) * 3.5]], 1.1, 0.4);
  }
  out.push(
    `<path d="${smooth(
      z.cheekLine
        .map(([x, y]) => [x, y])
        .concat([
          [1110, 1000],
          [960, 1060],
          [880, 1080],
        ]),
      true,
    )}" fill="#5A4A50" opacity=".22" filter="url(#b10)"/>`,
  );
  out.push(`<path d="${dots}" fill="#2A1D18" opacity=".45"/>`);

  // 1. the beard as a volume: value first. Lit front of the chin and the far jaw, the near side plane
  //    turning away, the underside in deep shadow
  const vol = [
    `<g mask="url(#beardMask)">`,
    `<path d="${zoneD}" fill="#2C2018"/>`,
    `<g clip-path="url(#beardVol)">`,
  ];
  vol.push(
    `<path d="${smooth(
      [
        [640, 1040],
        [700, 1080],
        [760, 1130],
        [810, 1190],
        [800, 1250],
        [740, 1262],
        [676, 1220],
        [642, 1150],
      ],
      true,
    )}" fill="#5E4A3C" opacity=".9" filter="url(#b16)"/>`,
    `<path d="${smooth(
      [
        [700, 1030],
        [760, 1024],
        [850, 1030],
        [880, 1060],
        [830, 1066],
        [760, 1060],
        [700, 1066],
      ],
      true,
    )}" fill="#4E3D31" opacity=".7" filter="url(#b6)"/>`,
    `<path d="${smooth(
      [
        [900, 1020],
        [1160, 900],
        [1160, 1320],
        [930, 1320],
        [900, 1150],
      ],
      true,
    )}" fill="#0E0907" opacity=".75" filter="url(#b16)"/>`,
    `<path d="${smooth(
      [
        [700, 1236],
        [780, 1266],
        [880, 1266],
        [990, 1222],
        [1080, 1160],
        [1120, 1090],
        [1150, 1180],
        [1040, 1280],
        [860, 1310],
        [720, 1290],
      ],
      true,
    )}" fill="#050302" opacity=".7" filter="url(#b10)"/>`,
    // the warm edge of the terminator crossing the beard
    `<path d="${smooth(
      [
        [905, 1060],
        [900, 1130],
        [910, 1200],
        [925, 1260],
      ],
      false,
    )}" fill="none" stroke="#3E2A20" stroke-width="22" opacity=".6" filter="url(#b10)"/>`,
  );
  // 2. clumps: low contrast, following the growth, bottom first so each lies over the roots of the next
  const tufts = [];
  for (let i = 0; i < 6000; i++) {
    const p = [R.range(626, 1150), R.range(1016, 1292)];
    if (!inside(p, z.zone) || inside(p, lowerLip)) continue;
    if (R() > density(p) * 0.9 + 0.05) continue;
    tufts.push(p);
  }
  tufts.sort((a, b) => b[1] - a[1]);
  const shadeAt = (p) => {
    const tx = p[1] < 1060 ? 960 - (p[1] - 960) * 0.6 : lerp(900, 930, clamp((p[1] - 1060) / 220, 0, 1));
    return Math.max(
      clamp((p[0] - tx + 30) / 110, 0, 1),
      clamp((p[1] - 1220 + Math.max(0, 860 - p[0]) * 0.2) / 60, 0, 1),
    );
  };
  const T = { lit: "", litHi: "", sh: "", shHi: "", dark: "" };
  for (const p of tufts) {
    const d = dirAt(p);
    const a = Math.atan2(d[1], d[0]) + R.range(-0.25, 0.25);
    const L = R.range(9, 16);
    const W = R.range(2.6, 4.6);
    const e = [p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L];
    const bend = R.range(-2, 2);
    const m = [lerp(p[0], e[0], 0.5) - Math.sin(a) * bend, lerp(p[1], e[1], 0.5) + Math.cos(a) * bend];
    const tuft = taper([p, m, e], W, 0.5);
    const off = [LIGHT[0] * W * 0.35, LIGHT[1] * W * 0.35];
    const hi = taper([[p[0] + off[0], p[1] + off[1]], [m[0] + off[0], m[1] + off[1]], e], W * 0.4, 0.2);
    // a dark gap under every few clumps gives the beard its depth
    const gapS = taper(
      [[p[0] - off[0], p[1] - off[1]], [m[0] - off[0] * 1.5, m[1] - off[1] * 1.5], e],
      W * 0.45,
      0.2,
    );
    const sh = R() < shadeAt(p);
    if (R() < 0.3) T.dark += gapS;
    if (sh) {
      T.sh += tuft;
      if (R() < 0.35) T.shHi += hi;
    } else {
      T.lit += tuft;
      if (R() < 0.7) T.litHi += hi;
    }
  }
  vol.push(
    `<path d="${T.dark}" fill="#050302" opacity=".45"/>`,
    `<path d="${T.sh}" fill="#150F0C" opacity=".75"/>`,
    `<path d="${T.shHi}" fill="#36291F" opacity=".45"/>`,
    `<path d="${T.lit}" fill="#35271D" opacity=".75"/>`,
    `<path d="${T.litHi}" fill="#6E5644" opacity=".5"/>`,
  );
  // 3. single hairs: dark ones for texture, grey ones streaking down from the corners of the mouth
  let hairs = "",
    greyH = "",
    litH = "";
  for (let i = 0; i < 3800; i++) {
    const p = [R.range(626, 1150), R.range(1016, 1292)];
    if (!inside(p, z.zone) || inside(p, lowerLip)) continue;
    if (R() > density(p)) continue;
    const d = dirAt(p);
    const a = Math.atan2(d[1], d[0]) + R.range(-0.35, 0.35);
    const L = R.range(7, 14);
    const e = [p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L];
    const s = taper(
      [p, [lerp(p[0], e[0], 0.5) + R.range(-1, 1), lerp(p[1], e[1], 0.5)], e],
      R.range(0.8, 1.2),
      0.1,
    );
    const chin =
      p[1] > 1120 &&
      (Math.abs(p[0] - (712 + (p[1] - 1120) * 0.1)) < 22 ||
        Math.abs(p[0] - (846 - (p[1] - 1120) * 0.05)) < 24);
    if (R() < (chin ? 0.42 : 0.04)) greyH += s;
    else if (R() > shadeAt(p) && R() < 0.25) litH += s;
    else hairs += s;
  }
  vol.push(
    `<path d="${hairs}" fill="#0A0605" opacity=".55"/><path d="${litH}" fill="#7A6352" opacity=".45"/><path d="${greyH}" fill="#A9A098" opacity=".6"/>`,
  );
  vol.push(`</g></g>`);
  out.push(vol.join(""));

  // 4. the moustache over the lip: hairs combed down and out from the philtrum, the lip edge showing through
  let mo = "",
    moHi = "";
  for (let i = 0; i < 1300; i++) {
    const p = [R.range(690, 884), R.range(1012, 1074)];
    // roots up to a few pixels above the trimmed edge, so the edge is made of hair, not a line
    const dTop = distTo(p, z.mouTop);
    if (!inside(p, z.zone) && dTop > 5) continue;
    if (R() > clamp(dTop / 12, 0.35, 1)) continue;
    const d = p[0] > 764 ? [0.55 + (p[0] - 764) / 300, 1] : [-0.55 - (764 - p[0]) / 300, 1];
    const a = Math.atan2(d[1], d[0]) + R.range(-0.2, 0.2);
    const L = R.range(10, 18);
    const e = [p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L];
    const s = taper(
      [p, [lerp(p[0], e[0], 0.5), lerp(p[1], e[1], 0.5) + R.range(-1, 1)], e],
      R.range(1.0, 1.7),
      0.15,
    );
    if (p[0] < 840 && p[1] < 1046 && R() < 0.5) moHi += s;
    else mo += s;
  }
  out.push(`<path d="${mo}" fill="#150E0B" opacity=".55"/><path d="${moHi}" fill="#6E5747" opacity=".5"/>`);

  // 5. the hairs that break the silhouette and the cheek line
  let edge = "",
    edgeLit = "";
  const outer = sample(z.outer, 220);
  for (const p of outer) {
    for (let k = 0; k < 5; k++) {
      const d = dirAt(p);
      const a = Math.atan2(d[1], d[0]) + R.range(-0.55, 0.55);
      const L = R.range(6, 22);
      const s0 = [p[0] + R.range(-10, 1), p[1] + R.range(-12, 0)];
      const e = [s0[0] + Math.cos(a) * L, s0[1] + Math.sin(a) * L];
      const s = taper(
        [s0, [lerp(s0[0], e[0], 0.5) + R.range(-1.5, 1.5), lerp(s0[1], e[1], 0.5)], e],
        R.range(0.8, 1.3),
        0.1,
      );
      if (p[0] < 780 && R() < 0.55) edgeLit += s;
      else edge += s;
    }
  }
  out.push(
    `<path d="${edge}" fill="#120C0A" opacity=".7"/><path d="${edgeLit}" fill="#5E4A3B" opacity=".7"/>`,
  );
  let cheek = "";
  const cl = sample(z.cheekLine, 110);
  for (const p of cl) {
    for (let k = 0; k < 3; k++) {
      const q = [p[0] + R.range(-6, 6), p[1] + R.range(-2, 14)];
      const d = dirAt(q);
      const a = Math.atan2(d[1], d[0]) + R.range(-0.4, 0.4);
      const L = R.range(5, 10);
      cheek += taper([q, [q[0] + Math.cos(a) * L, q[1] + Math.sin(a) * L]], 1.0, 0.15);
    }
  }
  out.push(`<path d="${cheek}" fill="#1E1511" opacity=".5"/>`);
  void H;
  void upperLip;
  return { defs: defs.join(""), svg: `<g id="beard">${out.join("")}</g>` };
}
