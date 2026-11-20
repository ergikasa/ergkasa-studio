/* global console */
/**
 * Character v4 rig prototype: evidence sheets for the audit (prototype tooling, not production code).
 *
 *   node prototypes/character-v4/rig/sheets.mjs [rotation|emotions|visemes|eyes ...]
 *
 * Every tile is one call of the 2.5D head rig (headrig.mjs) at full detail, rasterised with the engine's resvg
 * settings (raster.mjs). Writes PNG sheets to out/evidence/ and the per-tile draw/raster times to sheets.json.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { createHeadRig } from "./headrig.mjs";
import { EMOTIONS, VISEMES } from "./face.mjs";
import { png, fitFilters } from "./raster.mjs";
import { VIEW0 } from "./proxy.mjs";

const OUT = "prototypes/character-v4/out/evidence";
mkdirSync(OUT, { recursive: true });
const rig = createHeadRig({ lod: 1 });
const TW = 430,
  TH = 505,
  LABEL = 34;
const timings = existsSync(`${OUT}/sheets.json`)
  ? JSON.parse(readFileSync(`${OUT}/sheets.json`, "utf8"))
  : {};

function tile(pose) {
  const a = Date.now();
  const r = rig.draw(pose);
  const svg = fitFilters(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2000" viewBox="0 0 1600 2000"><defs>${r.defs}</defs><rect width="1600" height="2000" fill="#2C383D"/>${r.svg}</svg>`,
  );
  const b = Date.now();
  const img = png(svg, 800).toString("base64");
  return { img, drawMs: b - a, rasterMs: Date.now() - b };
}

function sheet(name, title, rows) {
  const cols = Math.max(...rows.map((r) => r.length));
  const W = cols * TW,
    H = 60 + rows.length * (TH + LABEL);
  const parts = [];
  const times = [];
  rows.forEach((row, j) =>
    row.forEach(([label, pose], i) => {
      const t = tile(pose);
      times.push({ label, drawMs: t.drawMs, rasterMs: t.rasterMs });
      const x = i * TW,
        y = 60 + j * (TH + LABEL);
      parts.push(
        `<svg x="${x}" y="${y}" width="${TW}" height="${TH}" viewBox="250 130 430 505" preserveAspectRatio="xMidYMid slice"><image href="data:image/png;base64,${t.img}" width="800" height="1000"/></svg>`,
        `<text x="${x + TW / 2}" y="${y + TH + 24}" font-size="19" font-weight="500" fill="#E8E2D8" text-anchor="middle">${label}</text>`,
      );
      console.info(name, label, t.drawMs, t.rasterMs);
    }),
  );
  writeFileSync(
    `${OUT}/${name}.png`,
    png(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#14181A"/><text x="24" y="40" font-size="24" font-weight="800" fill="#F2EDE4">${title}</text>${parts.join("")}</svg>`,
    ),
  );
  timings[name] = times;
}

const v = (yaw, pitch = VIEW0.pitch, roll = VIEW0.roll) => ({ yaw, pitch, roll });
const SHEETS = {
  rotation: () =>
    sheet(
      "rotation",
      "2.5D head rig: one character, one light, rotated (rows 1-2 inside the supported range, row 3 outside it)",
      [
        [
          ["yaw 14", v(14)],
          ["yaw 22 (authored view)", v(22)],
          ["yaw 30", v(30)],
          ["yaw 38", v(38)],
          ["yaw 42", v(42)],
        ],
        [
          ["pitch -8 (chin up)", v(22, -8)],
          ["pitch +15 (chin down)", v(22, 15)],
          ["roll -8", v(22, 3, -8)],
          ["roll +6", v(22, 3, 6)],
          ["yaw 34, pitch 10, roll 4", v(34, 10, 4)],
        ],
        [
          ["OUT OF RANGE: yaw 4", v(4)],
          ["OUT OF RANGE: yaw 0, pitch 15", v(0, 15)],
          ["OUT OF RANGE: yaw 55", v(55)],
          ["OUT OF RANGE: pitch -16", v(22, -16)],
        ],
      ],
    ),
  emotions: () =>
    sheet(
      "emotions",
      "Emotion presets: AUs plus head posture, eyes on camera (the demo blends between them over 0.3-0.9 s)",
      [Object.keys(EMOTIONS).slice(0, 4), Object.keys(EMOTIONS).slice(4)].map((ks) =>
        ks.map((k) => {
          const e = EMOTIONS[k];
          return [k, { ...v(22 + e.head[0], 3 + e.head[1], -1.5 + e.head[2]), aus: e.aus }];
        }),
      ),
    ),
  visemes: () =>
    sheet(
      "visemes",
      "Visemes (mouth shapes for speech): jaw rotation about the TMJ, separate inner lip edges, teeth and tongue",
      [
        Object.keys(VISEMES).slice(0, 5),
        Object.keys(VISEMES).slice(5, 10),
        Object.keys(VISEMES).slice(10),
      ].map((ks) => ks.map((k) => [k, { ...v(22), aus: VISEMES[k] }])),
    ),
  eyes: () =>
    sheet(
      "eyes",
      "Eyes: gaze independent of the head, convergence, lids following gaze, blink stages, lid raise",
      [
        [
          ["look to camera", { ...v(22), look: [0, 0, 60] }],
          ["look screen-left", { ...v(22), look: [-40, 0, 40] }],
          ["look screen-right", { ...v(22), look: [40, 4, 40] }],
          ["look up", { ...v(22), look: [0, 30, 40] }],
          ["look down (lids follow)", { ...v(22), look: [0, -32, 40] }],
        ],
        [
          ["near target (convergence)", { ...v(22), look: [-2, -2, 9] }],
          ["blink 35%", { ...v(22), lids: { n: 0.25, f: 0.25 } }],
          ["blink 70%", { ...v(22), lids: { n: 0.5, f: 0.5 } }],
          ["closed", { ...v(22), lids: { n: 1, f: 1 } }],
          ["lid raise (AU5)", { ...v(22), aus: { lidUp: 0.9 } }],
        ],
      ],
    ),
};

const which = process.argv.slice(2);
for (const k of which.length ? which : Object.keys(SHEETS)) SHEETS[k]();
writeFileSync(`${OUT}/sheets.json`, JSON.stringify({ bindMs: rig.bindMs, ...timings }, null, 1));
