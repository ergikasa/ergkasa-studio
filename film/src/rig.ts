/**
 * The placeholder character rig (profile, cutout, drawn in code). It stands in for the artists' rig: the rest of
 * the engine only talks to it through a Pose (named channels) and gets back where the hands and the head are,
 * so a professional rig can replace this file without changing how films are directed.
 *
 * Angles are degrees. Limbs: 0 = straight down, positive = forward (toward the facing side). The hip is the root.
 */
import { fmt, rad } from "./motion.js";

export interface Pose {
  torso: number; // lean, + forward
  head: number; // tilt, + down/forward, - up
  gx: number; // eyes -1 (back) .. 1 (forward)
  gy: number; // eyes -1 (up) .. 1 (down)
  lid: number; // 0 open .. 1 closed
  brow: number; // -1 raised/worried .. 1 lowered/determined
  mouth: number; // -1 frown .. 1 smile
  shrug: number; // shoulders up
  arm: number; // near arm, upper
  fore: number; // near arm, elbow (relative)
  armF: number;
  foreF: number;
  thigh: number;
  shin: number; // relative to thigh
  thighF: number;
  shinF: number;
  breath: number; // 0..1
  hand: number; // near hand: 0 open, 1 fist/grip
  open: number; // mouth opening 0..1 (lip-sync)
}

export const STANDING: Pose = {
  torso: 2,
  head: 2,
  gx: 1,
  gy: 0,
  lid: 0,
  brow: 0,
  mouth: 0,
  shrug: 0,
  arm: 6,
  fore: 10,
  armF: 2,
  foreF: 8,
  thigh: 0,
  shin: 0,
  thighF: -2,
  shinF: 2,
  breath: 0.5,
  hand: 0,
  open: 0,
};
export const SEATED: Pose = {
  ...STANDING,
  torso: 6,
  thigh: 92,
  shin: -92,
  thighF: 86,
  shinF: -84,
  arm: 20,
  fore: 40,
  armF: 16,
  foreF: 36,
};

export const CHANNELS = Object.keys(STANDING) as Array<keyof Pose>;

/** Lengths of the placeholder rig (world px at scale 1). */
export const RIG = {
  torso: 250,
  neck: 40,
  head: 58,
  upperArm: 125,
  foreArm: 118,
  thigh: 165,
  shin: 170,
  foot: 22,
};
/** Hip height above the floor when standing straight. */
export const STAND_HIP = RIG.thigh + RIG.shin + RIG.foot;

export interface Look {
  build: "man" | "woman";
  coat: string;
  coatDark: string;
  pants: string;
  skin: string;
  skinShade: string;
  hair: string;
}

export function lookFor(m: { build: "man" | "woman"; coat?: string; hair?: string; skin?: string }): Look {
  const coat = m.coat ?? (m.build === "man" ? "#3D5A80" : "#2A9D8F");
  return {
    build: m.build,
    coat,
    coatDark: shade(coat, -0.22),
    pants: m.build === "man" ? "#2B2D42" : "#3B3355",
    skin: m.skin ?? "#E3A983",
    skinShade: shade(m.skin ?? "#E3A983", -0.14),
    hair: m.hair ?? (m.build === "man" ? "#2B2118" : "#5A3A2A"),
  };
}

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number): number =>
    Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  const r = ch((n >> 16) & 255),
    g = ch((n >> 8) & 255),
    b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Point at `len` from (x, y) along `deg` (0 = down, + = forward). */
export const along = (x: number, y: number, len: number, deg: number): [number, number] => [
  x + Math.sin(rad(deg)) * len,
  y + Math.cos(rad(deg)) * len,
];

export interface Placed {
  x: number; // hip, world
  y: number;
  facing: 1 | -1;
  /** Turn squash, 1 = normal, 0 = edge-on (used to turn around). */
  turn: number;
  scale: number;
}

export interface Drawn {
  svg: string;
  /** World positions of the near hand, the far hand and the head centre. */
  hand: [number, number];
  handF: [number, number];
  head: [number, number];
  /** Top of the head and feet, world (for framing). */
  top: number;
  feet: number;
}

/** Local (facing right, hip at 0,0) skeleton points for a pose. */
export function skeleton(p: Pose) {
  const sh = along(0, 0, -(RIG.torso + p.breath * 4), -p.torso);
  const shL: [number, number] = [sh[0], sh[1] - p.shrug * 14];
  const neck = along(shL[0], shL[1], -RIG.neck, -p.torso * 0.6);
  const head = along(neck[0], neck[1], -RIG.head, -(p.torso * 0.4 + p.head));
  const shN: [number, number] = [shL[0] + 4, shL[1] + 16];
  const shF: [number, number] = [shL[0] - 8, shL[1] + 14];
  const elbow = along(shN[0], shN[1], RIG.upperArm, p.arm);
  const hand = along(elbow[0], elbow[1], RIG.foreArm, p.arm + p.fore);
  const elbowF = along(shF[0], shF[1], RIG.upperArm - 5, p.armF);
  const handF = along(elbowF[0], elbowF[1], RIG.foreArm - 3, p.armF + p.foreF);
  const knee = along(6, 0, RIG.thigh, p.thigh);
  const ankle = along(knee[0], knee[1], RIG.shin, p.thigh + p.shin);
  const kneeF = along(0, 0, RIG.thigh, p.thighF);
  const ankleF = along(kneeF[0], kneeF[1], RIG.shin, p.thighF + p.shinF);
  return { shL, neck, head, shN, shF, elbow, hand, elbowF, handF, knee, ankle, kneeF, ankleF };
}

/**
 * Two-bone IK for the near arm: the angles that put the hand on a local target (or as close as the arm reaches),
 * with the elbow bending down and back like a real arm.
 */
export function reachArm(p: Pose, target: [number, number]): { arm: number; fore: number } {
  const { shN } = skeleton(p);
  const dx = target[0] - shN[0];
  const dy = target[1] - shN[1];
  const L1 = RIG.upperArm,
    L2 = RIG.foreArm;
  const d = Math.min(L1 + L2 - 2, Math.max(20, Math.hypot(dx, dy)));
  const theta = (Math.atan2(dx, dy) * 180) / Math.PI; // 0 = down
  const a = (Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)) * 180) / Math.PI;
  const elbowAngle = (Math.acos((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2)) * 180) / Math.PI;
  return { arm: theta - a, fore: 180 - elbowAngle };
}

/** World point -> the rig's local space (facing right, hip at 0,0). */
export function toLocal(pl: Placed, w: [number, number]): [number, number] {
  return [((w[0] - pl.x) * pl.facing) / pl.scale, (w[1] - pl.y) / pl.scale];
}
export function toWorld(pl: Placed, l: [number, number]): [number, number] {
  return [pl.x + l[0] * pl.scale * pl.facing * Math.max(0.05, pl.turn), pl.y + l[1] * pl.scale];
}

export function drawPerson(
  pose: Pose,
  pl: Placed,
  look: Look,
  opts: { glow?: number; id?: string } = {},
): Drawn {
  const cl = (v: number, a: number, b: number): number =>
    Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : a;
  const p: Pose = {
    ...pose,
    lid: cl(pose.lid, 0, 1),
    open: cl(pose.open, 0, 1),
    gx: cl(pose.gx, -1, 1),
    gy: cl(pose.gy, -1, 1),
    brow: cl(pose.brow, -1.2, 1.2),
    mouth: cl(pose.mouth, -1.2, 1.2),
    shrug: cl(pose.shrug, -0.8, 1.2),
    hand: cl(pose.hand, 0, 1),
  };
  const k = skeleton(p);
  const limb = (
    a: [number, number],
    b: [number, number],
    c: [number, number],
    w: number,
    col: string,
  ): string =>
    `<path d="M${fmt(a[0])} ${fmt(a[1])} L${fmt(b[0])} ${fmt(b[1])} L${fmt(c[0])} ${fmt(c[1])}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  const shoe = (c: [number, number], col: string): string =>
    `<ellipse cx="${fmt(c[0] + 24)}" cy="${fmt(c[1] + 8)}" rx="44" ry="17" fill="${col}"/>`;
  const handShape = (c: [number, number], col: string, grip: number): string =>
    `<ellipse cx="${fmt(c[0])}" cy="${fmt(c[1])}" rx="${fmt(19 - grip * 3)}" ry="${fmt(19 + grip * 2)}" fill="${col}"/>`;
  const b = p.breath * 4;
  const woman = look.build === "woman";
  const torso = `<g transform="rotate(${fmt(p.torso)} 0 0)">
    <path d="M${woman ? -54 : -62} 10 Q${woman ? -60 : -70} -130 ${woman ? -50 : -58} ${fmt(-232 - b)} Q-10 ${fmt(-262 - b)} ${woman ? 46 : 52} ${fmt(-236 - b)} Q${woman ? 66 : 74} -120 ${woman ? 52 : 58} 10 Z" fill="${look.coat}"/>
    <path d="M28 ${fmt(-238 - b)} L48 -150 L38 ${fmt(-236 - b)} Z" fill="#F4EBDD" opacity=".9"/>
    <path d="M-62 -10 Q0 4 58 -10 L58 10 L-62 10Z" fill="${look.coatDark}" opacity=".5"/></g>`;
  const ex = p.gx * 7,
    ey = p.gy * 6;
  const ht = p.head + p.torso * 0.4;
  const hairBack = woman
    ? `<path d="M-60 0 Q-70 -70 0 -68 Q52 -70 58 -24 Q24 -40 -6 -34 Q-30 -6 -36 40 Q-50 90 -78 110 Q-84 50 -60 0Z" fill="${look.hair}"/>`
    : `<path d="M-58 4 Q-66 -66 0 -66 Q50 -68 58 -26 Q20 -40 -8 -34 Q-26 -10 -40 22 Z" fill="${look.hair}"/>`;
  const face = `<g transform="translate(${fmt(k.head[0])} ${fmt(k.head[1])}) rotate(${fmt(ht)})">
    <rect x="-14" y="30" width="30" height="40" rx="10" fill="${look.skinShade}"/>
    <ellipse cx="0" cy="0" rx="${woman ? 52 : 56}" ry="${woman ? 60 : 62}" fill="${look.skin}"/>
    <path d="M${woman ? 48 : 52} -6 Q${woman ? 64 : 72} 8 ${woman ? 50 : 54} 18 Z" fill="${look.skin}"/>
    ${hairBack}
    <ellipse cx="-14" cy="6" rx="11" ry="15" fill="${look.skinShade}"/>
    <ellipse cx="${fmt(30 + ex)}" cy="${fmt(-4 + ey)}" rx="7.5" ry="${fmt(9 * (1 - p.lid) + 0.8)}" fill="#1B1B2F"/>
    <path d="M18 ${fmt(-24 + p.brow * 6)} Q32 ${fmt(-30 + p.brow * 3 - Math.max(0, -p.brow) * 5)} 46 ${fmt(-24 - p.brow * 4)}" stroke="${look.hair}" stroke-width="6" stroke-linecap="round" fill="none"/>
    ${p.open > 0.06 ? `<ellipse cx="38" cy="${fmt(34 + p.mouth * 3)}" rx="${fmt(8 - p.open * 2)}" ry="${fmt(2 + p.open * 8)}" fill="#5A2A24"/>` : `<path d="M30 34 Q38 ${fmt(34 + p.mouth * 7)} 46 31" stroke="#8C4A3C" stroke-width="4.5" stroke-linecap="round" fill="none"/>`}
  </g>`;
  const neckEl = `<path d="M${fmt(k.shL[0])} ${fmt(k.shL[1] + 6)} L${fmt(k.neck[0])} ${fmt(k.neck[1])}" stroke="${look.skinShade}" stroke-width="34" stroke-linecap="round"/>`;
  const glow = opts.glow
    ? `<g opacity="${fmt(opts.glow)}"><ellipse cx="${fmt(k.head[0])}" cy="${fmt(k.head[1] - 40)}" rx="230" ry="230" fill="url(#glow)"/><ellipse cx="${fmt(k.head[0])}" cy="${fmt(k.head[1] - 92)}" rx="62" ry="15" fill="none" stroke="#FFD27D" stroke-width="9"/></g>`
    : "";
  const sx = pl.scale * pl.facing * Math.max(0.05, pl.turn);
  const svg = `<g${opts.id ? ` data-id="${opts.id}"` : ""} transform="translate(${fmt(pl.x)} ${fmt(pl.y)}) scale(${fmt(sx)} ${fmt(pl.scale)})">
    ${glow}
    <ellipse cx="20" cy="${fmt(Math.max(k.ankle[1], k.ankleF[1]) + 24)}" rx="120" ry="14" fill="#000" opacity=".16"/>
    ${limb(k.shF, k.elbowF, k.handF, 34, look.coatDark)}${handShape(k.handF, look.skinShade, 0)}
    ${limb([0, 0], k.kneeF, k.ankleF, 50, shade(look.pants, -0.25))}${shoe(k.ankleF, "#111")}
    ${limb([6, 0], k.knee, k.ankle, 52, look.pants)}${shoe(k.ankle, "#1A1A22")}
    ${neckEl}${torso}${face}
    ${limb(k.shN, k.elbow, k.hand, 38, look.coat)}${handShape(k.hand, look.skin, p.hand)}
  </g>`;
  const top = toWorld(pl, [k.head[0], k.head[1] - 70])[1];
  const feet = toWorld(pl, k.ankle)[1] + 26 * pl.scale;
  return {
    svg,
    hand: toWorld(pl, k.hand),
    handF: toWorld(pl, k.handF),
    head: toWorld(pl, k.head),
    top,
    feet,
  };
}
