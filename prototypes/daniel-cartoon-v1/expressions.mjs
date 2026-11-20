/**
 * Daniel, human cartoon v1 (concept prototype): expression sheet. Every expression is a set of the same face
 * parameters a rig would animate (brows, lids, mouth corners, jaw, gaze), not a separate drawing.
 */
import { camera, renderPng, svgDoc } from "./lib.mjs";
import { drawHead } from "./face.mjs";

export const EXPRESSIONS = [
  { name: "Neutral, attentive", expr: { browDown: 0.12, press: 0.1 }, gaze: [0, 0], pose: { nod: 1 } },
  {
    name: "Warm smile",
    expr: { smile: 0.75, squint: 0.2, browUp: 0.15 },
    gaze: [0, 0],
    pose: { nod: -1, tilt: 3 },
  },
  {
    name: "Laughing",
    expr: { smile: 1.0, jaw: 0.5, squint: 0.7, browUp: 0.35 },
    gaze: [0, 0.1],
    pose: { nod: -6, tilt: 4 },
  },
  {
    name: "Skeptical",
    expr: { press: 0.5, L: { browUp: 0.9, smile: 0.35 }, R: { browDown: 0.6, squint: 0.3 } },
    gaze: [-0.4, 0.05],
    pose: { nod: 3, tilt: -5 },
  },
  {
    name: "Thinking",
    expr: { press: 0.35, browDown: 0.3, L: { browUp: 0.35 }, squint: 0.2 },
    gaze: [-0.7, 0.6],
    pose: { nod: -4, turn: -6, tilt: 3 },
  },
  {
    name: "Worried",
    expr: { browInner: 1.0, frown: 0.45, press: 0.25, lidUp: 0.2 },
    gaze: [0.15, -0.05],
    pose: { nod: 3 },
  },
  {
    name: "Angry",
    expr: { browDown: 1.0, squint: 0.5, frown: 0.4, press: 0.6, sneer: 0.35 },
    gaze: [0, 0],
    pose: { nod: 6 },
  },
  { name: "Surprised", expr: { browUp: 1.0, lidUp: 1.0, jaw: 0.7 }, gaze: [0, 0], pose: { nod: -5 } },
  {
    name: "Sad",
    expr: { browInner: 1.0, lidDown: 0.5, frown: 0.8 },
    gaze: [0.15, -0.7],
    pose: { nod: 9, tilt: -3 },
  },
];

export function sheet({ yaw = 25, S = 22, cols = 3, cell = [560, 660] } = {}) {
  let svg = "";
  EXPRESSIONS.forEach((e, k) => {
    const cx = (k % cols) * cell[0] + cell[0] / 2,
      cy = Math.floor(k / cols) * cell[1] + cell[1] * 0.43;
    const cam = camera({ yaw, S, cx, cy, floor: 168.6 });
    svg += drawHead(cam, { pose: { at: [0, 168.6, 0.8], ...e.pose }, expr: e.expr, gaze: e.gaze }).svg;
    svg += `<text x="${cx}" y="${cy + cell[1] * 0.53}" text-anchor="middle" font-family="Inter" font-size="26" fill="#3A302A">${e.name}</text>`;
  });
  return { svg, w: cols * cell[0], h: Math.ceil(EXPRESSIONS.length / cols) * cell[1] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { svg, w, h } = sheet();
  renderPng(svgDoc(w, h, svg, "#EFEBE4"), new URL("./out/wip-expr.png", import.meta.url).pathname, 1500);
  console.log("ok");
}
