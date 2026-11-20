/**
 * Daniel, human cartoon v1 (concept prototype): the jacket's construction drawn on the torso's surface (lapels,
 * open shirt collar, button, pockets, the opening below the button), so it turns with the body.
 */
import { id, ink, smooth, taperBoth } from "./all.mjs";
import { onFront } from "./tube.mjs";
import { PAL } from "./palette.mjs";

/** World (x, y) on the jacket front → screen. `dz` lifts a detail off the surface (lapels lie on the chest). */
export function surf(cam, T) {
  return (x, y, dz = 0) => {
    const p = onFront(T, x, y);
    return cam.P([p[0], p[1], p[2] + dz]).slice(0, 2);
  };
}

const mirror = (pts) => pts.map(([x, y, z]) => [-x, y, z]);

export function jacketFront(cam, torso, { lw, clipTrousers, clipJacket }) {
  const S = surf(cam, torso);
  const map = (pts) => pts.map(([x, y, z = 0]) => S(x, y, z));
  let svg = "";

  // ---------------------------------------------------------------- the opening below the button: trousers, belt
  const gapR = [
    [-0.15, 106.4],
    [-1.2, 101.5],
    [-3.6, 93.0],
    [-7.4, 85.0],
    [-11.4, 79.4],
  ];
  const gap = [...gapR, ...mirror(gapR).reverse()];
  const gapD = smooth(map(gap));
  const gapClip = id("gap");
  svg += `<clipPath id="${gapClip}"><path d="${gapD}"/></clipPath>`;
  svg += `<g clip-path="url(#${clipTrousers})"><g clip-path="url(#${gapClip})">`;
  svg += `<path d="${gapD}" fill="${PAL.trousers}"/>`;
  svg += `<path d="${smooth(
    map([
      [0.5, 107],
      [4.4, 92],
      [11.4, 79.4],
      [3, 79.4],
      [1.2, 90],
    ]),
  )}" fill="${PAL.trousersShade}"/>`;
  const belt = [
    [-14, 101.4],
    [14, 101.4],
    [14, 97.9],
    [-14, 97.9],
  ];
  svg += `<path d="${smooth(map(belt), true, 0)}" fill="${PAL.belt}"/>`;
  svg += `<path d="${smooth(
    map([
      [-1.7, 101.0],
      [1.7, 101.0],
      [1.7, 98.3],
      [-1.7, 98.3],
    ]),
    true,
    0,
  )}" fill="none" stroke="${PAL.buckle}" stroke-width="${lw * 1.1}"/>`;
  svg += `<path d="${ink(
    map([
      [0.5, 97.6],
      [0.7, 90],
      [0.4, 83.5],
    ]),
    lw * 0.8,
    taperBoth,
  )}" fill="${PAL.line}" opacity="0.8"/>`;
  for (const y of [97.9, 101.4])
    svg += `<path d="${ink(
      map([
        [-14, y],
        [0, y - 0.05],
        [14, y],
      ]),
      lw * 0.8,
      taperBoth,
    )}" fill="${PAL.line}"/>`;
  svg += `</g></g>`;
  // the jacket's front edges
  for (const side of [gapR, mirror(gapR)])
    svg += `<path d="${ink(map(side), lw * 1.3, (t) => 0.6 + 0.4 * Math.sin(Math.PI * t))}" fill="${PAL.jacketLine}"/>`;

  svg += `<g clip-path="url(#${clipJacket})">`;
  // ---------------------------------------------------------------- shirt in the V, open collar, a little skin
  const vR = [
    [0, 107.4],
    [-2.2, 122],
    [-4.6, 138],
    [-6.0, 147.4],
    [-6.6, 152.4],
  ];
  const shirtV = [...vR, [0, 155], ...mirror(vR).reverse()];
  svg += `<path d="${smooth(map(shirtV))}" fill="${PAL.shirt}"/>`;
  svg += `<path d="${smooth(
    map([
      [0.3, 107.4],
      [1.6, 118],
      [3.9, 134],
      [5.6, 147],
      [6.5, 151],
      [2.5, 151.5],
      [1.6, 135],
      [0.8, 120],
    ]),
  )}" fill="${PAL.shirtShade}"/>`;
  // the shirt placket and its buttons
  svg += `<path d="${ink(
    map([
      [-0.55, 108],
      [-0.5, 125],
      [-0.6, 141.5],
    ]),
    lw * 0.6,
    taperBoth,
  )}" fill="${PAL.shirtLine}"/>`;
  for (const y of [112, 121, 130, 139]) {
    const [cx, cy] = S(0.05, y);
    svg += `<circle cx="${cx}" cy="${cy}" r="${lw * 0.9}" fill="${PAL.shirtShade}" stroke="${PAL.shirtLine}" stroke-width="${lw * 0.4}"/>`;
  }
  // skin at the open collar
  svg += `<path d="${smooth(
    map([
      [-2.7, 152.8],
      [-1.8, 149.0],
      [0, 144.0],
      [1.8, 149.0],
      [2.7, 152.8],
      [0, 155],
    ]),
  )}" fill="${PAL.skin}"/>`;
  svg += `<path d="${smooth(
    map([
      [0.3, 144.2],
      [1.8, 149.0],
      [2.7, 152.8],
      [1.2, 153.2],
      [0.9, 149],
    ]),
  )}" fill="${PAL.skinShade}"/>`;
  // shirt collar: an open spread collar, band around the neck, points lying on the lapels
  for (const sx of [-1, 1]) {
    const wing = [
      [sx * 2.9, 154.6],
      [sx * 5.6, 154.2],
      [sx * 6.5, 150.6],
      [sx * 6.4, 146.0],
      [sx * 4.6, 147.4],
      [sx * 2.2, 150.4],
    ];
    const d = smooth(map(wing.map(([x, y]) => [x, y, 0.4])), true, 0.06);
    svg += `<path d="${d}" fill="${sx > 0 ? PAL.shirtShade : PAL.shirt}" stroke="${PAL.line}" stroke-width="${lw}" stroke-linejoin="round"/>`;
    // the fold where the collar turns over its band
    svg += `<path d="${ink(
      map([
        [sx * 2.9, 153.4],
        [sx * 4.4, 152.9],
        [sx * 5.6, 152.6],
      ]),
      lw * 0.7,
      taperBoth,
    )}" fill="${PAL.shirtLine}"/>`;
  }
  // ---------------------------------------------------------------- lapels (notch lapel) and collar
  for (const sx of [-1, 1]) {
    const lap = [
      [sx * 0.2, 107.6],
      [sx * 5.4, 121],
      [sx * 9.4, 133.2],
      [sx * 11.0, 138.4],
      [sx * 8.3, 139.0],
      [sx * 9.0, 141.6],
      [sx * 8.4, 147.6],
      [sx * 6.8, 151.6],
      [sx * 6.3, 147.4],
      [sx * 4.8, 138],
      [sx * 2.4, 122],
    ].map(([x, y]) => [x, y, 0.45]);
    // cast shadow of the lapel on the chest (on the side away from the light)
    const shadowOff = sx > 0 ? 0.8 : 0.35;
    const sh = [
      [sx * 0.6, 106.6],
      [sx * (5.4 + shadowOff), 120.6],
      [sx * (9.4 + shadowOff), 132.6],
      [sx * (11.0 + shadowOff), 137.8],
      [sx * 11.0, 138.4],
      [sx * 9.4, 133.2],
      [sx * 5.4, 121],
    ];
    svg += `<path d="${smooth(map(sh))}" fill="${PAL.jacketShade}"/>`;
    const d = smooth(map(lap), true, 0.13);
    svg += `<path d="${d}" fill="${sx > 0 ? PAL.jacketShade : PAL.lapel}" stroke="${PAL.jacketLine}" stroke-width="${lw * 1.1}" stroke-linejoin="round"/>`;
    // the roll of the lapel: a soft highlight along its fold
    svg += `<path d="${ink(
      map([
        [sx * 6.2, 146],
        [sx * 4.6, 136],
        [sx * 2.6, 123],
        [sx * 0.8, 111],
      ]),
      lw * 1.4,
      taperBoth,
    )}" fill="${sx > 0 ? PAL.jacket : PAL.lapelHi}"/>`;
    // the notch line (gorge)
    svg += `<path d="${ink(
      map([
        [sx * 8.3, 139.0],
        [sx * 7.0, 140.4],
        [sx * 6.2, 143],
      ]),
      lw * 0.9,
      taperBoth,
    )}" fill="${PAL.jacketLine}"/>`;
  }
  // ---------------------------------------------------------------- button, pockets, dart
  {
    const [bx, by] = S(0.15, 107.2, 0.3);
    const r = (cam.S * 0.95).toFixed(2);
    svg += `<circle cx="${bx}" cy="${by}" r="${r}" fill="${PAL.button}" stroke="${PAL.jacketLine}" stroke-width="${lw * 0.8}"/>`;
    svg += `<circle cx="${bx - cam.S * 0.25}" cy="${by - cam.S * 0.25}" r="${(cam.S * 0.22).toFixed(2)}" fill="${PAL.buttonHi}"/>`;
  }
  for (const sx of [-1, 1]) {
    const flap = [
      [sx * 7.0, 95.6],
      [sx * 16.4, 94.9],
      [sx * 16.6, 91.6],
      [sx * 7.2, 92.3],
    ].map(([x, y]) => [x, y, 0.25]);
    svg += `<path d="${smooth(
      map([
        [sx * 7.2, 92.3],
        [sx * 16.6, 91.6],
        [sx * 16.5, 90.9],
        [sx * 7.3, 91.6],
      ]),
      true,
      0,
    )}" fill="${PAL.jacketShade}"/>`;
    svg += `<path d="${smooth(map(flap), true, 0.04)}" fill="${sx > 0 ? PAL.jacketShade : PAL.jacket}" stroke="${PAL.jacketLine}" stroke-width="${lw * 0.9}" stroke-linejoin="round"/>`;
    // front dart from the pocket up toward the chest
    svg += `<path d="${ink(
      map([
        [sx * 9.6, 96.2],
        [sx * 9.8, 104],
        [sx * 9.9, 112],
      ]),
      lw * 0.6,
      taperBoth,
    )}" fill="${PAL.jacketLine}" opacity="0.7"/>`;
  }
  // chest welt pocket on his left, with a folded square
  svg += `<path d="${smooth(
    map(
      [
        [7.8, 128.0],
        [14.4, 128.8],
        [14.4, 127.3],
        [7.8, 126.6],
      ].map(([x, y]) => [x, y, 0.2]),
    ),
    true,
    0,
  )}" fill="${PAL.jacketShade}" stroke="${PAL.jacketLine}" stroke-width="${lw * 0.8}"/>`;
  svg += `</g>`;
  return svg;
}
