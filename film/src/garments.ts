/**
 * Clothes, hair and faces on the placeholder rig (Standard v2.1 CA-W3, CA-W4, CA-I1).
 *
 * The rig (rig.ts) gives the skeleton; this file dresses it, inside out: legs and shoes, what hangs below the
 * waist (skirts, coat tails, aprons), the torso and its layers, what is worn at the neck, the head with its hair
 * style, facial hair, glasses and hat, and the near arm with its sleeve and cuff. Everything is drawn from the
 * pose, so clothes follow the body: sleeves are the arm's colour from shoulder to wrist (or to the elbow for short
 * sleeves), a coat's tail is pushed by the knees, a tie and a scarf hang by gravity whatever the lean, and cloth
 * trails the motion (`sway`, from the body's speed a moment ago: follow-through without simulation).
 *
 * Coordinates are the rig's local space: facing right, hip at (0, 0), y down.
 */
import type { Features, Garment, GarmentKind } from "@erkasa/contracts";
import { fmt } from "./motion.js";

type P = [number, number];

export interface DressedLook {
  build: "man" | "woman";
  skin: string;
  skinShade: string;
  hair: string;
  wardrobe?: readonly Garment[] | undefined;
  features?: Features | undefined;
}

/** Pose channels the clothes read (a subset of rig.ts Pose). */
export interface ClothPose {
  torso: number;
  head: number;
  breath: number;
  hand: number;
  thigh: number;
  thighF: number;
}

/** The skeleton points of rig.ts skeleton(). */
export interface Bones {
  shL: P;
  neck: P;
  head: P;
  shN: P;
  shF: P;
  elbow: P;
  hand: P;
  elbowF: P;
  handF: P;
  knee: P;
  ankle: P;
  kneeF: P;
  ankleF: P;
}

export function darken(hex: string, k: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number): number =>
    Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  const r = ch((n >> 16) & 255),
    g = ch((n >> 8) & 255),
    b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Relative luminance 0..1 of a #RRGGBB colour. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1, 7), 16);
  const c = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c((n >> 16) & 255) + 0.7152 * c((n >> 8) & 255) + 0.0722 * c(n & 255);
}

/**
 * Light cloth (whites, creams) would melt into the show's cream walls: it gets a thin darker edge, 3 units in rig
 * space (under 2 px at the scales people are drawn at, inside the Style Bible's contour rule).
 */
const edge = (col: string): string =>
  luminance(col) > 0.55 ? ` stroke="${darken(col, -0.32)}" stroke-width="3" stroke-linejoin="round"` : "";

const SLEEVED_LAYERS: GarmentKind[] = [
  "puffer",
  "overcoat",
  "raincoat",
  "lab_coat",
  "suit_jacket",
  "blazer",
  "work_jacket",
  "cardigan",
];
const SHORT_SLEEVES: GarmentKind[] = ["tshirt", "polo", "scrubs_top"];
const LONG_COATS: GarmentKind[] = ["overcoat", "raincoat", "lab_coat"];
const JACKETS: GarmentKind[] = ["suit_jacket", "blazer", "work_jacket", "cardigan"];

const lim = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const pt = (p: P): string => `${fmt(p[0])} ${fmt(p[1])}`;
const lerp = (a: P, b: P, k: number): P => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

/** The rig's torso outline, wider by `grow` and ending at `hem` (y). */
function torsoPath(woman: boolean, b: number, grow = 0, hem = 10): string {
  const L = (woman ? 54 : 62) + grow,
    Lc = (woman ? 60 : 70) + grow,
    Lt = (woman ? 50 : 58) + grow;
  const R = (woman ? 52 : 58) + grow,
    Rc = (woman ? 66 : 74) + grow,
    Rt = (woman ? 46 : 52) + grow;
  return `M${-L} ${hem} Q${-Lc} -130 ${-Lt} ${fmt(-232 - b - grow * 0.4)} Q-10 ${fmt(-262 - b - grow)} ${Rt} ${fmt(-236 - b - grow * 0.4)} Q${Rc} -120 ${R} ${hem} Z`;
}

/** A limb as a bent stroke a -> b -> c. */
const limb = (a: P, b: P, c: P, w: number, col: string): string =>
  `<path d="M${pt(a)} L${pt(b)} L${pt(c)}" stroke="${col}" stroke-width="${fmt(w)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
const seg = (a: P, b: P, w: number, col: string, cap = "round"): string =>
  `<path d="M${pt(a)} L${pt(b)}" stroke="${col}" stroke-width="${fmt(w)}" stroke-linecap="${cap}" fill="none"/>`;

/** The body drawn dressed: everything between the floor shadow and the end of the person's group. */
export function dressedSvg(
  p: ClothPose & { open: number; lid: number; gx: number; gy: number; brow: number; mouth: number },
  k: Bones,
  look: DressedLook,
  swayIn = 0,
): string {
  const sway = lim(swayIn, -1, 1);
  const G = look.wardrobe ?? [];
  const has = (kind: GarmentKind): Garment | undefined => G.find((g) => g.kind === kind);
  const any = (kinds: GarmentKind[]): Garment | undefined => {
    for (let i = G.length - 1; i >= 0; i--) if (kinds.includes((G[i] as Garment).kind)) return G[i];
    return undefined;
  };
  const woman = look.build === "woman";
  const b = p.breath * 4;
  const top = any(["shirt", "blouse", "tshirt", "polo", "sweater", "hoodie", "scrubs_top"]);
  const dress = has("dress");
  const overalls = has("overalls");
  const bottom = any(["trousers", "jeans", "shorts", "skirt", "dress", "overalls", "scrubs_trousers"]);
  const feet = any(["shoes", "boots", "sneakers"]);
  const coat = any(LONG_COATS);
  const jacket = any(JACKETS);
  const puffer = has("puffer");
  const outer = any(SLEEVED_LAYERS);
  const baseTop = (dress?.color ?? top?.color ?? "#3D5A80") as string;

  // sleeves: the outermost layer with sleeves, else the top
  const sleeve = outer?.color ?? baseTop;
  const shortSleeve = !outer && (!top || SHORT_SLEEVES.includes(top.kind) || (dress && !top));
  const sleeveW = puffer && outer === puffer ? 46 : 38;
  const cuff = outer && top && (top.kind === "shirt" || top.kind === "blouse") ? top.color : undefined;
  const pants = bottom && !["skirt", "dress"].includes(bottom.kind) ? bottom.color : look.skinShade;

  const arm = (
    sh: P,
    el: P,
    hd: P,
    w: number,
    col: string,
    skin: string,
    grip: number,
    near: boolean,
  ): string => {
    const hand = `<ellipse cx="${fmt(hd[0])}" cy="${fmt(hd[1])}" rx="${fmt(19 - grip * 3)}" ry="${fmt(19 + grip * 2)}" fill="${skin}"/>`;
    if (shortSleeve) return limb(sh, el, hd, w - 6, skin) + seg(sh, lerp(sh, el, 0.62), w + 2, col) + hand;
    let s =
      (luminance(col) > 0.55 ? limb(sh, el, hd, w + 6, darken(col, -0.32)) : "") + limb(sh, el, hd, w, col);
    if (cuff)
      s += seg(lerp(el, hd, 0.8), lerp(el, hd, 0.9), w - 8, near ? cuff : darken(cuff, -0.18), "butt");
    return s + hand;
  };

  const legW = 50;
  const leg = (hip: P, kn: P, an: P, w: number, col: string, far: boolean): string => {
    const c = far ? darken(col, -0.25) : col;
    if (bottom?.kind === "shorts")
      return (
        limb(hip, kn, an, w - 8, far ? look.skinShade : look.skin) + seg(hip, lerp(hip, kn, 0.7), w + 2, c)
      );
    return limb(hip, kn, an, w, c);
  };
  const shoe = (c: P, far: boolean): string => {
    const col = feet?.color ?? "#1A1A22";
    const fc = far ? darken(col, -0.3) : col;
    let s = `<ellipse cx="${fmt(c[0] + 24)}" cy="${fmt(c[1] + 8)}" rx="44" ry="17" fill="${fc}"/>`;
    if (feet?.kind === "boots")
      s =
        `<rect x="${fmt(c[0] - 22)}" y="${fmt(c[1] - 34)}" width="44" height="44" rx="10" fill="${fc}"/>` + s;
    if (feet?.kind === "sneakers")
      s += `<path d="M${fmt(c[0] - 18)} ${fmt(c[1] + 18)} L${fmt(c[0] + 66)} ${fmt(c[1] + 18)}" stroke="#F4EBDD" stroke-width="6" stroke-linecap="round"/>`;
    return s;
  };

  // ---- what hangs below the waist: skirts, dresses, coat tails, the apron; pushed by the knees, trailing motion
  const kneeFront: P = k.knee[0] > k.kneeF[0] ? k.knee : k.kneeF;
  const hangPanel = (len: number, col: string, wide: number, open = false): string => {
    const { hem, frontX, backX, over } = hemGeometry(p, k, sway, len, wide);
    const d = `M${-62 - wide} -10 L${58 + wide} -10 L${pt(over)} L${fmt(frontX)} ${fmt(hem)} Q${fmt((frontX + backX) / 2)} ${fmt(hem + 10)} ${fmt(backX)} ${fmt(hem - 6)} Z`;
    let s = `<path d="${d}" fill="${col}"${edge(col)}/>`;
    // a fold line from the knee: cloth bends where the leg pushes it
    s += `<path d="M${fmt(kneeFront[0] * 0.5)} 20 Q${fmt(kneeFront[0] * 0.7)} ${fmt(hem * 0.6)} ${fmt(frontX - 18)} ${fmt(hem - 4)}" stroke="${darken(col, -0.18)}" stroke-width="5" fill="none" opacity=".7"/>`;
    if (open)
      s += `<path d="M${fmt(over[0] - 4)} ${fmt(over[1])} L${fmt(frontX - 6)} ${fmt(hem)}" stroke="${darken(col, -0.25)}" stroke-width="4"/>`;
    return s;
  };
  let below = "";
  if (dress) below += hangPanel(150, dress.color, 6);
  else if (bottom?.kind === "skirt") below += hangPanel(130, bottom.color, 4);
  const apron = has("apron");
  if (apron) below += hangPanel(120, apron.color, -14);
  if (coat) below += hangPanel(coat.kind === "lab_coat" ? 150 : 175, coat.color, 8, coat.kind === "lab_coat");

  // ---- the torso and its layers (rotated with the torso)
  let torso = `<path d="${torsoPath(woman, b)}" fill="${baseTop}"${edge(baseTop)}/>`;
  const vInner = (col: string, wide: number): string =>
    `<path d="M${22 - wide} ${fmt(-240 - b)} L${54 + wide * 0.3} ${fmt(-232 - b)} L${44 + wide * 0.2} -118 Z" fill="${col}"/>`;
  // necklines of the top
  if (top && (top.kind === "shirt" || top.kind === "blouse"))
    torso += `<path d="M24 ${fmt(-240 - b)} L36 -212 L46 ${fmt(-236 - b)} Z" fill="${darken(top.color, 0.12)}"/>`;
  if (top && (top.kind === "tshirt" || top.kind === "sweater"))
    torso += `<path d="M-8 ${fmt(-252 - b)} Q14 ${fmt(-238 - b)} 40 ${fmt(-244 - b)}" stroke="${darken(top.color, -0.2)}" stroke-width="7" fill="none"/>`;
  if (top?.kind === "polo")
    torso += `<path d="M22 ${fmt(-242 - b)} L36 -214 L48 ${fmt(-238 - b)} L40 ${fmt(-226 - b)} Z" fill="${darken(top.color, -0.15)}"/>`;
  if (top?.kind === "scrubs_top")
    torso += `<path d="M18 ${fmt(-240 - b)} L36 -200 L50 ${fmt(-236 - b)} Z" fill="${look.skinShade}"/>`;
  if (top?.kind === "sweater")
    torso += `<path d="M-60 0 L56 0" stroke="${darken(top.color, -0.18)}" stroke-width="12"/>`;
  if (top?.kind === "hoodie")
    torso += `<path d="M10 -150 L14 -110 M24 -150 L30 -112" stroke="#F4EBDD" stroke-width="4" stroke-linecap="round"/><rect x="-10" y="-80" width="66" height="48" rx="12" fill="${darken(top.color, -0.12)}"/>`;
  if (overalls)
    torso += `<path d="M2 -150 L56 -152 L60 10 L-4 10 Z" fill="${overalls.color}"/><path d="M8 -150 L-30 ${fmt(-240 - b)}" stroke="${overalls.color}" stroke-width="12"/><circle cx="10" cy="-140" r="6" fill="${darken(overalls.color, 0.4)}"/>`;
  if (dress) torso += `<path d="M-60 -6 L58 -6" stroke="${darken(dress.color, -0.2)}" stroke-width="8"/>`;
  const waistcoat = has("waistcoat");
  if (waistcoat && !jacket && !coat)
    torso +=
      `<path d="M18 ${fmt(-226 - b)} L56 ${fmt(-222 - b)} Q66 -120 58 4 L4 4 Q2 -110 30 -128 Z" fill="${waistcoat.color}"/>` +
      [-96, -64, -32]
        .map((y) => `<circle cx="34" cy="${y}" r="4.5" fill="${darken(waistcoat.color, 0.35)}"/>`)
        .join("");
  if (jacket) {
    const jc = jacket.color;
    const inner = waistcoat?.color ?? top?.color ?? baseTop;
    torso += `<path d="${torsoPath(woman, b, 4, jacket.kind === "cardigan" ? 6 : 30)}" fill="${jc}"${edge(jc)}/>`;
    torso += vInner(inner, jacket.kind === "cardigan" ? 6 : 0);
    if (waistcoat)
      torso += `<path d="M28 -150 L44 -120 L40 -112 Z" fill="${darken(waistcoat.color, -0.2)}"/>`;
    if (top && (top.kind === "shirt" || top.kind === "blouse"))
      torso += `<path d="M24 ${fmt(-242 - b)} L34 -208 L44 ${fmt(-238 - b)} Z" fill="${top.color}"/>`;
    if (jacket.kind !== "cardigan") {
      torso += `<path d="M20 ${fmt(-240 - b)} L28 -200 L44 -120 L34 -196 Z" fill="${darken(jc, -0.28)}"/>`; // lapel
      torso += `<path d="M-50 -130 Q-20 -126 4 -134" stroke="${darken(jc, -0.18)}" stroke-width="4" fill="none"/>`; // pocket line
    }
    torso += [-96, -62].map((y) => `<circle cx="47" cy="${y}" r="5" fill="${darken(jc, -0.35)}"/>`).join("");
  }
  const hiVis = has("hi_vis_vest");
  if (hiVis) {
    const st = hiVis.color2 ?? "#F4EBDD";
    torso += `<path d="${torsoPath(woman, b, 3, 14)}" fill="${hiVis.color}"/>`;
    torso += vInner(top?.color ?? baseTop, 2);
    torso += `<path d="M-68 -140 Q2 -130 72 -142" stroke="${st}" stroke-width="15" fill="none"/><path d="M-66 -64 Q2 -56 68 -66" stroke="${st}" stroke-width="15" fill="none"/>`;
  }
  if (apron)
    torso += `<path d="M10 -200 L60 -200 L62 10 L6 10 Z" fill="${apron.color}"${edge(apron.color)}/><path d="M14 -200 L-14 ${fmt(-244 - b)}" stroke="${apron.color}" stroke-width="7"/><path d="M-62 -92 L60 -92" stroke="${darken(apron.color, -0.2)}" stroke-width="6"/>`;
  if (coat) {
    const cc = coat.color;
    torso += `<path d="${torsoPath(woman, b, 7, 10)}" fill="${cc}"${edge(cc)}/>`;
    if (coat.kind === "lab_coat")
      torso +=
        vInner(jacket?.color ?? top?.color ?? baseTop, 4) +
        `<path d="M18 ${fmt(-242 - b)} L30 -190 L44 -116 L34 -192 Z" fill="${darken(cc, -0.12)}"/><rect x="-46" y="-150" width="40" height="34" rx="4" fill="none" stroke="${darken(cc, -0.15)}" stroke-width="4"/>`;
    else {
      torso += `<path d="M14 ${fmt(-246 - b)} L34 ${fmt(-214 - b)} L56 ${fmt(-238 - b)} Q50 ${fmt(-258 - b)} 14 ${fmt(-246 - b)} Z" fill="${darken(cc, -0.22)}"/>`; // collar
      torso += [-150, -110, -70, -30]
        .map((y) => `<circle cx="50" cy="${y}" r="5" fill="${darken(cc, -0.4)}"/>`)
        .join("");
      if (coat.kind === "raincoat")
        torso += `<path d="M-68 -78 L66 -82" stroke="${darken(cc, -0.25)}" stroke-width="13"/>`;
    }
  }
  if (puffer) {
    torso += `<path d="${torsoPath(woman, b, 12, 18)}" fill="${puffer.color}"/>`;
    torso += [-196, -150, -104, -58, -12]
      .map(
        (y) =>
          `<path d="M-72 ${y} Q4 ${y + 9} 78 ${y - 2}" stroke="${darken(puffer.color, -0.2)}" stroke-width="5" fill="none"/>`,
      )
      .join("");
    torso += `<path d="M2 ${fmt(-258 - b)} Q30 ${fmt(-268 - b)} 54 ${fmt(-246 - b)} L50 ${fmt(-226 - b)} Q26 ${fmt(-240 - b)} 0 ${fmt(-236 - b)} Z" fill="${darken(puffer.color, -0.15)}"/>`;
  }
  // neck pieces hang by gravity: counter the lean, trail the motion
  const hang = (x: number, y: number): string => `rotate(${fmt(-p.torso * 0.75 - sway * 14)} ${x} ${y})`;
  // a tie or bow tie is under a closed coat (overcoat, raincoat, puffer): not drawn; a lab coat is worn open
  const closed = !!puffer || (!!coat && coat.kind !== "lab_coat");
  const tie = closed ? undefined : has("tie");
  if (tie)
    torso += `<g transform="${hang(40, -230 - b)}"><path d="M34 ${fmt(-236 - b)} L46 ${fmt(-236 - b)} L44 ${fmt(-222 - b)} L36 ${fmt(-222 - b)} Z" fill="${darken(tie.color, -0.2)}"/><path d="M36 ${fmt(-222 - b)} L44 ${fmt(-222 - b)} L49 ${fmt(-150 - b)} L40 ${fmt(-136 - b)} L32 ${fmt(-150 - b)} Z" fill="${tie.color}"/>${tie.color2 ? `<path d="M35 ${fmt(-200 - b)} L46 ${fmt(-190 - b)} M34 ${fmt(-176 - b)} L48 ${fmt(-166 - b)}" stroke="${tie.color2}" stroke-width="4"/>` : ""}</g>`;
  const bow = closed ? undefined : has("bow_tie");
  if (bow)
    torso += `<path d="M28 ${fmt(-238 - b)} L40 ${fmt(-230 - b)} L28 ${fmt(-222 - b)} Z M52 ${fmt(-238 - b)} L40 ${fmt(-230 - b)} L52 ${fmt(-222 - b)} Z" fill="${bow.color}"/>`;
  const scarf = has("scarf");
  if (scarf)
    torso += `<ellipse cx="4" cy="${fmt(-248 - b)}" rx="50" ry="20" fill="${scarf.color}"/><g transform="${hang(30, -240 - b)}"><path d="M20 ${fmt(-244 - b)} L42 ${fmt(-244 - b)} L46 ${fmt(-150 - b)} L24 ${fmt(-154 - b)} Z" fill="${darken(scarf.color, -0.12)}"/><path d="M24 ${fmt(-160 - b)} L46 ${fmt(-156 - b)}" stroke="${darken(scarf.color, -0.3)}" stroke-width="4"/></g>`;
  const torsoSvg = `<g transform="rotate(${fmt(p.torso)} 0 0)">${torso}</g>`;

  // hood behind the head
  const hood =
    top?.kind === "hoodie" && !outer
      ? `<path d="M${fmt(k.shL[0] - 60)} ${fmt(k.shL[1] + 10)} Q${fmt(k.shL[0] - 70)} ${fmt(k.shL[1] - 60)} ${fmt(k.shL[0] - 10)} ${fmt(k.shL[1] - 40)} L${fmt(k.shL[0] + 10)} ${fmt(k.shL[1] + 6)} Z" fill="${darken(top.color, -0.15)}"/>`
      : "";

  const neckEl = `<path d="M${fmt(k.shL[0])} ${fmt(k.shL[1] + 6)} L${fmt(k.neck[0])} ${fmt(k.neck[1])}" stroke="${look.skinShade}" stroke-width="34" stroke-linecap="round"/>`;

  return [
    arm(k.shF, k.elbowF, k.handF, sleeveW - 4, darken(sleeve, -0.22), look.skinShade, 0, false),
    leg([0, 0], k.kneeF, k.ankleF, legW, pants === look.skinShade ? look.skin : pants, true),
    shoe(k.ankleF, true),
    leg([6, 0], k.knee, k.ankle, legW + 2, pants === look.skinShade ? look.skin : pants, false),
    shoe(k.ankle, false),
    below,
    hood,
    neckEl,
    torsoSvg,
    headSvg(p, k, look, sway),
    arm(k.shN, k.elbow, k.hand, sleeveW, sleeve, look.skin, p.hand, true),
  ].join("");
}

/**
 * Where cloth that hangs from the waist ends (local space): the hem's height, its front and back corners, and the
 * point where it goes over the front knee. The front never goes behind the front knee and the back never in front
 * of the back knee (the cloth stays outside the legs); seated, the hem rests over the lap; moving, it trails.
 */
export function hemGeometry(
  p: { thigh: number; thighF: number },
  k: Pick<Bones, "knee" | "kneeF">,
  sway: number,
  len: number,
  wide: number,
): { hem: number; frontX: number; backX: number; over: P; lap: number } {
  const lap = lim((Math.max(p.thigh, p.thighF) - 25) / 55, 0, 1); // 0 standing .. 1 seated
  const kneeFront: P = k.knee[0] > k.kneeF[0] ? k.knee : k.kneeF;
  const kneeBack: P = k.knee[0] > k.kneeF[0] ? k.kneeF : k.knee;
  const hemSeat = kneeFront[1] + Math.min(70, len * 0.35);
  const hem = len * (1 - lap) + hemSeat * lap;
  const sw = lim(sway, -1, 1);
  const frontX = Math.max(58, kneeFront[0] + 34) - sw * 18 + wide;
  const backX = Math.min(-64, kneeBack[0] - 48) - sw * 34 - wide;
  const over: P = [Math.max(56, kneeFront[0] + 28), Math.min(hem - 10, kneeFront[1] - 30 * lap)];
  return { hem, frontX, backX, over, lap };
}

// ------------------------------------------------------------------------------------------------ the head

const HAIR: Record<string, string> = {
  short: "M-58 4 Q-66 -66 0 -66 Q50 -68 58 -26 Q20 -40 -8 -34 Q-26 -10 -40 22 Z",
  side_part: "M-58 4 Q-66 -68 2 -68 Q52 -70 60 -30 Q22 -46 -8 -36 Q-26 -10 -40 22 Z",
  slicked: "M-56 0 Q-62 -64 0 -64 Q46 -66 54 -34 Q14 -46 -12 -40 Q-30 -14 -40 14 Z",
  curly: "M-60 6 Q-70 -70 0 -70 Q54 -72 60 -26 Q22 -40 -8 -34 Q-26 -10 -42 24 Z",
  receding: "M-58 4 Q-66 -58 -22 -64 Q-8 -48 -18 -30 Q-30 -10 -40 22 Z",
  bald: "M-56 8 Q-62 -22 -44 -36 Q-34 -12 -40 22 Z",
  long: "M-60 0 Q-70 -70 0 -68 Q52 -70 58 -24 Q24 -40 -6 -34 Q-30 -6 -36 40 Q-50 90 -78 110 Q-84 50 -60 0Z",
  bob: "M-60 0 Q-70 -70 0 -68 Q52 -70 58 -24 Q24 -40 -6 -34 Q-24 0 -28 46 Q-50 58 -68 46 Q-66 20 -60 0Z",
  bun: "M-56 2 Q-64 -64 0 -64 Q50 -66 56 -28 Q20 -42 -8 -36 Q-26 -12 -38 18 Z",
  ponytail: "M-56 2 Q-64 -64 0 -64 Q50 -66 56 -28 Q20 -42 -8 -36 Q-26 -12 -38 18 Z",
};

function headSvg(
  p: {
    head: number;
    torso: number;
    lid: number;
    gx: number;
    gy: number;
    brow: number;
    mouth: number;
    open: number;
  },
  k: Bones,
  look: DressedLook,
  sway: number,
): string {
  const woman = look.build === "woman";
  const f = look.features ?? { hair: woman ? "long" : "short", facialHair: "none" };
  const hc = look.hair;
  const ex = lim(p.gx, -1, 1) * 7,
    ey = lim(p.gy, -1, 1) * 6;
  const lid = lim(p.lid, 0, 1),
    open = lim(p.open, 0, 1),
    brow = lim(p.brow, -1.2, 1.2),
    mouth = lim(p.mouth, -1.2, 1.2);
  const ht = p.head + p.torso * 0.4;
  let hair = `<path d="${HAIR[f.hair] ?? HAIR.short}" fill="${hc}"/>`;
  if (f.hair === "side_part")
    hair += `<path d="M-6 -66 Q12 -52 34 -50" stroke="${darken(hc, -0.3)}" stroke-width="4" fill="none"/>`;
  if (f.hair === "slicked")
    hair += `<path d="M-40 -48 Q-6 -60 30 -52" stroke="${darken(hc, 0.3)}" stroke-width="4" fill="none" opacity=".7"/>`;
  if (f.hair === "curly")
    hair += [
      [-48, -42],
      [-30, -62],
      [-6, -70],
      [20, -66],
      [40, -52],
      [-54, -14],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="14" fill="${hc}"/>`)
      .join("");
  if (f.hair === "bun") hair += `<circle cx="-48" cy="-54" r="24" fill="${hc}"/>`;
  if (f.hair === "ponytail")
    hair += `<path d="M-48 -34 Q${fmt(-86 - sway * 16)} 0 ${fmt(-74 - sway * 26)} 70 Q${fmt(-64 - sway * 18)} 10 -40 -16 Z" fill="${hc}"/>`;
  let beard = "";
  if (f.facialHair === "stubble")
    beard = `<path d="M6 22 Q24 64 58 32 Q48 50 22 44 Z" fill="${hc}" opacity=".35"/>`;
  if (f.facialHair === "beard")
    beard = `<path d="M-14 10 Q-8 64 30 68 Q60 62 60 30 Q48 44 32 42 Q16 44 4 22 Z" fill="${hc}"/>`;
  if (f.facialHair === "moustache" || f.facialHair === "beard")
    beard += `<path d="M26 27 Q40 18 54 27 Q42 32 26 29 Z" fill="${hc}"/>`;
  const G = look.wardrobe ?? [];
  const hat = G.find((g) =>
    ["fedora", "flat_cap", "cloche", "hard_hat", "beanie", "cap", "chef_hat"].includes(g.kind),
  );
  const glasses = G.some((g) => g.kind === "glasses");
  let hatSvg = "";
  if (hat) {
    const c = hat.color,
      d = darken(c, -0.25),
      c2 = hat.color2 ?? d;
    if (hat.kind === "fedora")
      hatSvg = `<path d="M-48 -50 Q-52 -106 -2 -108 Q46 -106 46 -50 Z" fill="${c}"/><path d="M-50 -64 L48 -64 L47 -52 L-49 -52 Z" fill="${c2}"/><ellipse cx="2" cy="-50" rx="86" ry="11" fill="${d}"/><path d="M-12 -104 Q0 -92 12 -104" stroke="${d}" stroke-width="4" fill="none"/>`;
    if (hat.kind === "flat_cap")
      hatSvg = `<path d="M-58 -36 Q-60 -86 2 -86 Q52 -84 58 -50 Q88 -46 96 -36 Q60 -32 -58 -36 Z" fill="${c}"/><path d="M58 -50 Q88 -46 96 -36" stroke="${d}" stroke-width="4" fill="none"/>`;
    if (hat.kind === "cloche")
      hatSvg = `<path d="M-60 -4 Q-68 -92 0 -92 Q62 -90 62 -22 Q64 -8 58 -6 Q30 -28 -6 -28 Q-40 -22 -60 -4Z" fill="${c}"/><path d="M-62 -36 Q0 -50 62 -40" stroke="${c2}" stroke-width="9" fill="none"/>`;
    if (hat.kind === "hard_hat")
      hatSvg = `<path d="M-56 -44 Q-54 -114 2 -114 Q58 -112 58 -44 Z" fill="${c}"/><path d="M-64 -46 L84 -46 Q88 -36 72 -36 L-64 -38 Z" fill="${d}"/><path d="M2 -112 L2 -48" stroke="${d}" stroke-width="7"/>`;
    if (hat.kind === "beanie")
      hatSvg = `<path d="M-58 -22 Q-62 -100 0 -100 Q58 -98 58 -26 Z" fill="${c}"/><path d="M-60 -34 L60 -38 L60 -18 L-60 -14 Z" fill="${d}"/>`;
    if (hat.kind === "cap")
      hatSvg = `<path d="M-54 -38 Q-52 -98 2 -98 Q54 -96 56 -42 Z" fill="${c}"/><path d="M50 -48 Q98 -48 106 -38 Q70 -36 50 -40 Z" fill="${d}"/>`;
    if (hat.kind === "chef_hat")
      hatSvg = `<ellipse cx="-24" cy="-104" rx="34" ry="34" fill="${c}"${edge(c)}/><ellipse cx="22" cy="-108" rx="36" ry="38" fill="${c}"${edge(c)}/><rect x="-50" y="-74" width="100" height="28" rx="6" fill="${c}"${edge(c)}/><path d="M-50 -60 L50 -60" stroke="${d}" stroke-width="3"/>`;
  }
  const mouthSvg =
    open > 0.06
      ? `<ellipse cx="38" cy="${fmt(34 + mouth * 3)}" rx="${fmt(8 - open * 2)}" ry="${fmt(2 + open * 8)}" fill="#5A2A24"/>`
      : `<path d="M30 34 Q38 ${fmt(34 + mouth * 7)} 46 31" stroke="#8C4A3C" stroke-width="4.5" stroke-linecap="round" fill="none"/>`;
  return `<g transform="translate(${fmt(k.head[0])} ${fmt(k.head[1])}) rotate(${fmt(ht)})">
    <rect x="-14" y="30" width="30" height="40" rx="10" fill="${look.skinShade}"/>
    <ellipse cx="0" cy="0" rx="${woman ? 52 : 56}" ry="${woman ? 60 : 62}" fill="${look.skin}"/>
    <path d="M${woman ? 48 : 52} -6 Q${woman ? 64 : 72} 8 ${woman ? 50 : 54} 18 Z" fill="${look.skin}"/>
    ${hair}
    <ellipse cx="-14" cy="6" rx="11" ry="15" fill="${look.skinShade}"/>
    ${beard}
    <ellipse cx="${fmt(30 + ex)}" cy="${fmt(-4 + ey)}" rx="7.5" ry="${fmt(9 * (1 - lid) + 0.8)}" fill="#1B1B2F"/>
    <path d="M18 ${fmt(-24 + brow * 6)} Q32 ${fmt(-30 + brow * 3 - Math.max(0, -brow) * 5)} 46 ${fmt(-24 - brow * 4)}" stroke="${hc}" stroke-width="6" stroke-linecap="round" fill="none"/>
    ${mouthSvg}
    ${glasses ? `<circle cx="31" cy="-4" r="15" fill="#FFFFFF" fill-opacity=".14" stroke="#1B1B2F" stroke-width="4"/><path d="M16 -6 L-12 -2" stroke="#1B1B2F" stroke-width="4"/>` : ""}
    ${hatSvg}
  </g>`;
}
