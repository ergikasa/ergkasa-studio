/* global console */
/**
 * Character v3 prototype: an 8-second performance, rendered to MP4 and a contact sheet.
 *   node prototypes/character-v3/demo.mjs   (from the repository root)
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { character } from "./body.mjs";
import { FPS, armAt, blinkAt, expressionAt, gazeSolver, track } from "./perform.mjs";
import { png, rgba } from "./raster.mjs";

const W = 1080,
  Hh = 1920,
  DUR = 8.4;
const OUT = "prototypes/character-v3/out";
mkdirSync(OUT, { recursive: true });

// the scene, in the character's space
const paper = (t) => {
  const u = Math.max(0, Math.min(1, (t - 1.3) / 1.5));
  return [560 - u * 200 + Math.sin(u * 7) * 60, -760 + u * 1600];
};
const points = {
  partner: () => [900, -250],
  paper,
  floor: () => [-160, 760],
};
const eye = [22, -206];
const gaze = gazeSolver(
  [
    [0, "partner"],
    [1.22, "paper"],
    [3.05, "floor"],
    [4.25, "partner"],
  ],
  eye,
);
const blinks = [0.85, 1.22, 3.05, 4.25, 6.9];
const expressions = [
  [0, "neutral"],
  [1.32, "surprise"],
  [2.7, "worry"],
  [4.35, "reassure"],
  [6.2, "convince"],
];
const rest = { arm: 6, fore: 10, wrist: 0, handN: "relaxed" };
const armKeys = [
  [0, rest],
  [4.45, rest],
  [4.62, { arm: 2, fore: 4, wrist: 4, handN: "relaxed" }], // anticipation: a small dip before the lift
  [5.05, { arm: 20, fore: 104, wrist: -22, handN: "explain" }],
  [5.9, { arm: 22, fore: 100, wrist: -18, handN: "explain" }],
  [6.35, { arm: 26, fore: 90, wrist: -8, handN: "point" }], // the accent on "convince"
  [7.2, { arm: 24, fore: 94, wrist: -10, handN: "point" }],
  [7.9, rest],
];

function frame(t) {
  const g = gaze(t, points);
  const face = expressionAt(expressions, t);
  face.gx = g.gx;
  face.gy = g.gy + (face.gy ?? 0) * 0.2;
  face.nod = (face.nod ?? 0) + g.nod;
  face.lidUp = Math.max(face.lidUp ?? 0, blinkAt(blinks, t));
  const arm = armAt(armKeys, t);
  const pose = {
    ...arm,
    breath: 0.5 + 0.5 * Math.sin(t * 1.6),
    lean: track(
      [
        [0, 0],
        [6.1, 0],
        [6.5, 4],
        [7.6, 4],
        [8.2, 1],
      ],
      t,
    ),
    shrug: track(
      [
        [0, 0],
        [1.3, 0],
        [1.45, 0.35],
        [2.0, 0.15],
        [2.8, 0.25],
        [4.3, 0.25],
        [4.8, 0],
      ],
      t,
    ),
    armF: 4 + Math.sin(t * 1.6) * 0.6,
    foreF: 14,
  };
  const c = character(pose, face, {}, {});
  const [px, py] = paper(t);
  const paperSvg =
    t > 1.25
      ? `<g transform="translate(${px} ${py}) rotate(${Math.sin(t * 5) * 28})"><rect x="-60" y="-40" width="120" height="80" rx="3" fill="#F7F4EC" stroke="#C9C2B4" stroke-width="2"/><path d="M-44 -20 H40 M-44 -4 H36 M-44 12 H28" stroke="#9AA3B0" stroke-width="4"/></g>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}"><defs>${c.defs}<radialGradient id="bg" cx="40%" cy="35%" r="80%"><stop offset="0" stop-color="#EADCC4"/><stop offset="1" stop-color="#C9B597"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/><rect x="700" y="160" width="300" height="520" rx="6" fill="#F3E7D2" opacity=".55"/><rect x="700" y="160" width="300" height="520" rx="6" fill="none" stroke="#B49A78" stroke-width="10" opacity=".6"/><g transform="translate(430 880) scale(1.6)">${paperSvg}${c.svg}</g></svg>`;
}

const frames = Math.round(DUR * FPS);
const ff = spawn(
  "ffmpeg",
  [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgba",
    "-s",
    `${W}x${Hh}`,
    "-r",
    String(FPS),
    "-i",
    "-",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    `${OUT}/v3-performance.mp4`,
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);
const sheet = [];
for (let k = 0; k < frames; k++) {
  const t = k / FPS;
  const svg = frame(t);
  const px = rgba(svg);
  if (!ff.stdin.write(px)) await new Promise((r) => ff.stdin.once("drain", r));
  if (k % 15 === 0) sheet.push([t, svg]);
  if ([60, 105, 165].includes(k)) writeFileSync(`${OUT}/v3-frame-${k}.png`, png(svg));
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
// contact sheet: every 0.5 s
const cols = 6,
  cw = 270,
  ch = 480;
const rows = Math.ceil(sheet.length / cols);
let cells = "";
sheet.forEach(([t, svg], i) => {
  const data = png(svg, cw).toString("base64");
  cells += `<image href="data:image/png;base64,${data}" x="${(i % cols) * cw}" y="${Math.floor(i / cols) * (ch + 34)}" width="${cw}" height="${ch}"/><text x="${(i % cols) * cw + cw / 2}" y="${Math.floor(i / cols) * (ch + 34) + ch + 26}" font-size="20" text-anchor="middle" fill="#14213D">${t.toFixed(1)} s</text>`;
});
writeFileSync(
  `${OUT}/v3-performance-contact.png`,
  png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cw}" height="${rows * (ch + 34)}" viewBox="0 0 ${cols * cw} ${rows * (ch + 34)}"><rect width="100%" height="100%" fill="#F4EBDD"/>${cells}</svg>`,
  ),
);
console.info(`wrote ${OUT}/v3-performance.mp4 (${frames} frames) and the contact sheet`);
