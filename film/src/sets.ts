/**
 * Sets as data: a place drawn for the vertical frame, with named marks (where people stand or sit, which way
 * they face, where they look), props with their starting places, surfaces to put things on, and light that can
 * change. Placeholder art in the show style; the artists' sets replace the drawing, not the data.
 */
import type { SetId } from "./contract.js";
import { fmt } from "./motion.js";
import type { PropKind } from "./props.js";
import { STAND_HIP } from "./rig.js";
import { PALETTE as C } from "./style.js";

export interface Mark {
  x: number;
  kind: "stand" | "seat";
  facing: 1 | -1;
  /** Seat marks: the hip height of a seated person. */
  seatY?: number;
  /** What someone at this mark naturally looks at (a window view, a screen). */
  look?: [number, number];
  /** Surface marks: things put down here rest at this height. */
  surfaceY?: number;
  /** Where the hands rest when working at this mark (keyboard, paper). */
  work?: [number, number];
}

export interface PropInit {
  kind: PropKind;
  x: number;
  y: number;
}

export interface SetState {
  t: number;
  /** 0 day, 1 golden, 2 dusk, 3 night (fractional while it changes). */
  light: number;
  door: number; // 0 closed .. 1 open
}

export interface SetDef {
  id: SetId;
  w: number;
  h: number;
  floor: number;
  /** The whole place as the camera sees it in a wide shot: centre and visible height (world px). */
  wide: { cx: number; cy: number; height: number };
  marks: Record<string, Mark>;
  props: Record<string, PropInit>;
  /** Points of interest someone can look at (not places to stand). */
  targets: Record<string, [number, number]>;
  back(s: SetState): string;
  front(s: SetState): string;
}

const lightMix = (light: number, day: number, golden: number, dusk: number, night: number): number => {
  const v = [day, golden, dusk, night];
  const i = Math.max(0, Math.min(2, Math.floor(light)));
  const k = Math.max(0, Math.min(1, light - i));
  return (v[i] as number) + ((v[i + 1] as number) - (v[i] as number)) * k;
};

function windowView(x: number, y: number, w: number, h: number, s: SetState, sun = true): string {
  const night = lightMix(s.light, 0, 0, 0.5, 1);
  const golden = lightMix(s.light, 0, 1, 0.6, 0);
  return `<g transform="translate(${x} ${y})">
    <rect width="${w}" height="${h}" fill="url(#sky_day)"/>
    <rect width="${w}" height="${h}" fill="url(#sky_golden)" opacity="${fmt(golden)}"/>
    <rect width="${w}" height="${h}" fill="url(#sky_night)" opacity="${fmt(night)}"/>
    ${sun ? `<circle cx="${fmt(w * 0.68)}" cy="${fmt(h * (0.62 + s.light * 0.08))}" r="${fmt(w * 0.16)}" fill="#FFF1C9" opacity="${fmt(1 - night)}"/>` : ""}
    ${night > 0.3 ? [0.2, 0.45, 0.7, 0.85].map((k, i) => `<circle cx="${fmt(w * k)}" cy="${fmt(h * (0.15 + (i % 2) * 0.12))}" r="3" fill="#FFF" opacity="${fmt(night)}"/>`).join("") : ""}
    <path d="M0 ${fmt(h * 0.82)} L${fmt(w * 0.2)} ${fmt(h * 0.72)} L${fmt(w * 0.36)} ${fmt(h * 0.78)} L${fmt(w * 0.56)} ${fmt(h * 0.66)} L${fmt(w * 0.78)} ${fmt(h * 0.75)} L${w} ${fmt(h * 0.7)} L${w} ${h} L0 ${h}Z" fill="${night > 0.5 ? "#1E2A4A" : "#E59A6B"}" opacity=".85"/>
    <rect width="${w}" height="${h}" fill="none" stroke="${C.woodDark}" stroke-width="22"/>
    <line x1="${w / 2}" y1="0" x2="${w / 2}" y2="${h}" stroke="${C.woodDark}" stroke-width="14"/><line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="${C.woodDark}" stroke-width="14"/></g>`;
}

const room = (w: number, h: number, floor: number, s: SetState): string => {
  const night = lightMix(s.light, 0, 0.08, 0.35, 0.62);
  return `<rect x="0" y="0" width="${w}" height="${h}" fill="${C.wall}"/>
    <rect x="0" y="${floor - 330}" width="${w}" height="330" fill="${C.wallShade}"/>
    <rect x="0" y="${floor}" width="${w}" height="${h - floor}" fill="${C.woodDark}"/>
    <rect x="0" y="${floor}" width="${w}" height="10" fill="#000" opacity=".15"/>
    <rect x="0" y="0" width="${w}" height="${h}" fill="#0C1529" opacity="${fmt(night)}"/>`;
};

const clock = (x: number, y: number, r: number, t: number): string =>
  `<g transform="translate(${x} ${y})"><circle r="${r}" fill="${C.cream}" stroke="${C.slate}" stroke-width="${fmt(r * 0.16)}"/>
  <line x1="0" y1="0" x2="0" y2="${fmt(-r * 0.55)}" stroke="#1B1B2F" stroke-width="${fmt(r * 0.12)}" stroke-linecap="round" transform="rotate(${fmt(170 + t * 0.01)})"/>
  <line x1="0" y1="0" x2="0" y2="${fmt(-r * 0.78)}" stroke="#1B1B2F" stroke-width="${fmt(r * 0.08)}" stroke-linecap="round" transform="rotate(${fmt(348 + t * 0.1)})"/>
  <line x1="0" y1="0" x2="0" y2="${fmt(-r * 0.85)}" stroke="${C.coral}" stroke-width="${fmt(r * 0.04)}" stroke-linecap="round" transform="rotate(${fmt(Math.floor(t) * 6)})"/></g>`;

const officeChair = (x: number, seatY: number, facing: 1 | -1): string =>
  `<g transform="translate(${x} ${seatY + 15}) scale(${facing} 1)"><rect x="-90" y="-10" width="170" height="26" rx="12" fill="#1B1B2F"/><rect x="-100" y="-300" width="30" height="300" rx="14" fill="#1B1B2F"/><rect x="-6" y="16" width="16" height="170" fill="#1B1B2F"/><rect x="-80" y="180" width="170" height="14" rx="7" fill="#1B1B2F"/></g>`;

const desk = (x0: number, x1: number, top: number, floor: number): string =>
  `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="40" rx="8" fill="${C.wood}"/>
   <rect x="${x0 + 30}" y="${top + 40}" width="34" height="${floor - top - 40}" fill="${C.woodDark}"/><rect x="${x1 - 64}" y="${top + 40}" width="34" height="${floor - top - 40}" fill="${C.woodDark}"/>`;

const monitor = (x: number, y: number, on: number): string =>
  `<g transform="translate(${x} ${y})"><rect x="0" y="0" width="300" height="190" rx="12" fill="${C.slate}"/><rect x="14" y="14" width="272" height="150" rx="6" fill="#3B6E8F"/>
   <rect x="14" y="14" width="272" height="150" rx="6" fill="#8FC1E3" opacity="${fmt(on * 0.35)}"/>
   <rect x="120" y="190" width="60" height="16" fill="${C.slate}"/><rect x="80" y="204" width="140" height="10" rx="5" fill="${C.slate}"/></g>`;

// ---------------------------------------------------------------- office: one person, a desk, a window
const OFFICE_FLOOR = 1700;
const office: SetDef = {
  id: "office",
  w: 1700,
  h: 2100,
  floor: OFFICE_FLOOR,
  wide: { cx: 960, cy: 1080, height: 2060 },
  marks: {
    chair: { x: 560, kind: "seat", facing: 1, seatY: 1395, look: [1010, 1180], work: [800, 1266] },
    desk: { x: 520, kind: "stand", facing: 1, look: [1010, 1180], surfaceY: 1290 },
    window: { x: 1250, kind: "stand", facing: 1, look: [1420, 560] },
    desk_top: { x: 820, kind: "stand", facing: 1, surfaceY: 1290 },
  },
  props: { cup: { kind: "cup", x: 760, y: 1262 }, paper: { kind: "paper", x: 1180, y: 1270 } },
  targets: { clock: [300, 330], screen: [1010, 1180], window_view: [1440, 520], door: [120, 1300] },
  back: (s) =>
    room(1700, 2100, OFFICE_FLOOR, s) +
    windowView(1200, 240, 440, 600, s) +
    `<polygon points="1200,840 1640,840 1700,${OFFICE_FLOOR} 820,${OFFICE_FLOOR}" fill="url(#beam)" opacity="${fmt(lightMix(s.light, 0.18, 0.45, 0.2, 0))}"/>` +
    clock(300, 330, 72, s.t) +
    `<rect x="40" y="980" width="200" height="720" fill="${C.woodDark}" opacity=".85"/><circle cx="210" cy="1360" r="9" fill="${C.ochre}"/>` +
    officeChair(560, 1395, 1) +
    desk(640, 1320, 1290, OFFICE_FLOOR) +
    monitor(860, 1080, 1),
  front: () => `<rect x="-100" y="${OFFICE_FLOOR + 40}" width="1900" height="400" fill="#4E3320"/>`,
};

// ---------------------------------------------------------------- interview: two people across a desk
const INT_FLOOR = 1700;
const interview: SetDef = {
  id: "interview",
  w: 1800,
  h: 2100,
  floor: INT_FLOOR,
  wide: { cx: 900, cy: 1180, height: 1800 },
  marks: {
    door: { x: 200, kind: "stand", facing: 1 },
    chair_l: { x: 560, kind: "seat", facing: 1, seatY: 1395, work: [790, 1266] },
    chair_r: { x: 1240, kind: "seat", facing: -1, seatY: 1395, work: [1010, 1266] },
    stand_l: { x: 640, kind: "stand", facing: 1 },
    stand_r: { x: 1160, kind: "stand", facing: -1 },
    desk_top: { x: 900, kind: "stand", facing: 1, surfaceY: 1290 },
  },
  props: { notebook: { kind: "notebook", x: 1020, y: 1266 }, cv: { kind: "paper", x: 820, y: 1266 } },
  targets: { door: [200, 1250], window_view: [900, 520], maria_spot: [1210, 1050] },
  back: (s) =>
    room(1800, 2100, INT_FLOOR, s) +
    windowView(690, 260, 420, 520, s, false) +
    `<g transform="translate(110 940)"><rect width="200" height="760" fill="${C.woodDark}"/><rect x="${fmt(200 - 200 * (1 - s.door * 0.85))}" width="${fmt(200 * (1 - s.door * 0.85))}" height="760" fill="${C.wood}"/><circle cx="170" cy="400" r="9" fill="${C.ochre}"/></g>` +
    `<g transform="translate(380 420)"><rect width="150" height="110" fill="${C.cream}" stroke="${C.woodDark}" stroke-width="8"/><circle cx="75" cy="55" r="26" fill="${C.coral}" opacity=".7"/></g>` +
    `<g transform="translate(1290 420)"><rect width="150" height="110" fill="${C.cream}" stroke="${C.woodDark}" stroke-width="8"/><rect x="30" y="30" width="90" height="50" fill="${C.teal}" opacity=".6"/></g>` +
    officeChair(560, 1395, 1) +
    officeChair(1240, 1395, -1) +
    `<g transform="translate(1530 1500)"><path d="M0 200 L-20 0 L60 0 L40 200Z" fill="${C.slate}"/><circle cx="20" cy="-60" r="80" fill="${C.teal}"/><circle cx="-30" cy="-20" r="50" fill="${C.teal}"/><circle cx="70" cy="-10" r="55" fill="#24877B"/></g>`,
  front: () =>
    desk(680, 1120, 1290, INT_FLOOR) +
    `<g transform="translate(940 1170)"><rect width="140" height="100" rx="8" fill="${C.slate}"/><rect x="-10" y="100" width="160" height="14" rx="6" fill="${C.slate}"/></g>`,
};

// ---------------------------------------------------------------- room: a student room where weeks go by
const ROOM_FLOOR = 1700;
const roomSet: SetDef = {
  id: "room",
  w: 1700,
  h: 2100,
  floor: ROOM_FLOOR,
  wide: { cx: 850, cy: 1150, height: 1850 },
  marks: {
    chair: { x: 600, kind: "seat", facing: 1, seatY: 1395, look: [1000, 1150], work: [840, 1266] },
    wall: { x: 900, kind: "stand", facing: 1, look: [1180, 700] },
    desk_top: { x: 860, kind: "stand", facing: 1, surfaceY: 1290 },
  },
  props: { cup: { kind: "cup", x: 860, y: 1262 }, paper: { kind: "paper", x: 760, y: 1270 } },
  targets: { plan: [1180, 700], window_view: [330, 560], laptop: [1000, 1170] },
  back: (s) =>
    room(1700, 2100, ROOM_FLOOR, s) +
    windowView(150, 300, 360, 520, s) +
    `<g transform="translate(1000 500)"><rect width="360" height="400" fill="#FBF7F0" stroke="${C.woodDark}" stroke-width="6"/><rect x="24" y="24" width="312" height="40" fill="${C.slate}"/>
      ${Array.from({ length: 5 }, (_, i) => `<rect x="${24 + i * 64}" y="90" width="52" height="${80 + ((i * 37) % 100)}" fill="${[C.ochre, C.coral, C.teal, C.ochre, C.coral][i]}" opacity=".85"/>`).join("")}
      ${Array.from({ length: 6 }, (_, i) => `<rect x="24" y="${290 + i * 16}" width="${180 + ((i * 53) % 120)}" height="6" fill="#B8B0A2"/>`).join("")}</g>` +
    officeChair(600, 1395, 1) +
    desk(680, 1360, 1290, ROOM_FLOOR) +
    `<g transform="translate(900 1140)"><path d="M0 130 L260 130 L240 0 L20 0Z" fill="${C.slate}"/><rect x="-20" y="130" width="300" height="20" rx="6" fill="${C.slate}"/><path d="M40 20 L220 20 L230 110 L30 110Z" fill="#8FC1E3" opacity=".55"/></g>` +
    `<g transform="translate(1290 1110)"><rect x="-6" y="0" width="12" height="180" fill="${C.ink}"/><path d="M-60 0 L60 0 L30 -70 L-30 -70Z" fill="${C.ochre}"/><ellipse cx="0" cy="10" rx="${fmt(120 + lightMix(s.light, 0, 0, 40, 80))}" ry="60" fill="url(#glow)" opacity="${fmt(lightMix(s.light, 0, 0.2, 0.6, 1))}"/></g>`,
  front: () => `<rect x="-100" y="${ROOM_FLOOR + 40}" width="1900" height="400" fill="#4E3320"/>`,
};

// ---------------------------------------------------------------- cage: the metaphor as a place
const CAGE_FLOOR = 1700;
const cage: SetDef = {
  id: "cage",
  w: 1500,
  h: 2200,
  floor: CAGE_FLOOR,
  wide: { cx: 640, cy: 1180, height: 1760 },
  marks: {
    chair: { x: 500, kind: "seat", facing: 1, seatY: 1475, look: [1100, 1250] },
    inside: { x: 620, kind: "stand", facing: 1, look: [1100, 1250] },
    door: { x: 1000, kind: "stand", facing: 1, look: [1300, 1300] },
    outside: { x: 1260, kind: "stand", facing: 1, look: [1500, 1300] },
  },
  props: {},
  targets: { door: [880, 1300], light: [1150, 1300] },
  back: (s) => {
    const open = s.door;
    return `<rect x="0" y="0" width="1500" height="2200" fill="${C.night}"/>
      <rect x="0" y="${CAGE_FLOOR}" width="1500" height="500" fill="${C.deep}"/>
      <ellipse cx="1080" cy="1340" rx="${fmt(440 * open)}" ry="${fmt(540 * open)}" fill="url(#glow)" opacity="${fmt(0.6 * open)}"/>
      <ellipse cx="${fmt(880 + 280 * open)}" cy="${CAGE_FLOOR + 12}" rx="${fmt(300 * open)}" ry="32" fill="${C.sun}" opacity="${fmt(0.35 * open)}"/>
      ${officeChair(470, 1475, 1)}`;
  },
  front: (s) => {
    const bars = Array.from({ length: 9 }, (_, i) => 250 + i * 72);
    const raw = 1 - 1.35 * s.door;
    const scaleX = Math.abs(raw) < 0.04 ? (raw < 0 ? -0.04 : 0.04) : raw; // never a zero scale
    return `<g>
      <path d="M220 ${CAGE_FLOOR - 20} L220 640 Q540 380 860 640 L860 ${CAGE_FLOOR - 20}" fill="none" stroke="${C.ochre}" stroke-width="14"/>
      ${bars.map((x) => `<line x1="${x}" y1="${fmt(640 - Math.sin(((x - 220) / 640) * Math.PI) * 190)}" x2="${x}" y2="${CAGE_FLOOR - 20}" stroke="${C.ochre}" stroke-width="9"/>`).join("")}
      <rect x="200" y="${CAGE_FLOOR - 20}" width="680" height="30" rx="10" fill="${C.ochre}"/>
      <g transform="translate(860 1000) scale(${fmt(scaleX)} 1)"><rect x="-200" y="0" width="200" height="${CAGE_FLOOR - 1020}" fill="${C.night}" fill-opacity=".001" stroke="${C.ochre}" stroke-width="12"/>
      ${[0, 1, 2].map((i) => `<line x1="${-150 + i * 50}" y1="0" x2="${-150 + i * 50}" y2="${CAGE_FLOOR - 1020}" stroke="${C.ochre}" stroke-width="8"/>`).join("")}</g></g>`;
  },
};

export const SETS: Record<SetId, SetDef> = { office, interview, room: roomSet, cage };

/** Hip height of a person standing on the set's floor. */
export const standingHipY = (set: SetDef): number => set.floor - STAND_HIP;

/** A one-paragraph description of each set for the director (marks, props, targets). */
export function describeSets(): string {
  return Object.values(SETS)
    .map(
      (s) =>
        `- ${s.id}: marks ${Object.entries(s.marks)
          .map(([k, m]) => `${k} (${m.kind}${m.surfaceY ? ", surface" : ""})`)
          .join(", ")}; props ${
          Object.entries(s.props)
            .map(([k, p]) => `${k} (${p.kind})`)
            .join(", ") || "none"
        }; look targets ${Object.keys(s.targets).join(", ")}`,
    )
    .join("\n");
}
