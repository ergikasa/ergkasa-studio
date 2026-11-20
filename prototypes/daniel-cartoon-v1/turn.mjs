/** Daniel, human cartoon v1 (concept prototype): the head turned through 0..90°, from the same 3D construction. */
import { camera, renderPng, svgDoc } from "./lib.mjs";
import { drawHead } from "./face.mjs";
export function turnStrip({ angles = [0, 15, 30, 45, 60, 75, 90], S = 16, cell = 330 } = {}) {
  let svg = "";
  angles.forEach((yaw, k) => {
    const cam = camera({
      yaw,
      S,
      cx: cell * k + cell / 2 + (yaw > 50 ? -cell * 0.08 : 0),
      cy: 230,
      floor: 168.6,
    });
    svg += drawHead(cam, { pose: { at: [0, 168.6, 0.8], nod: 1 }, expr: { browDown: 0.12, press: 0.1 } }).svg;
    svg += `<text x="${cell * k + cell / 2}" y="470" text-anchor="middle" font-family="Inter" font-size="22" fill="#3A302A">${yaw}°</text>`;
  });
  return { svg, w: cell * angles.length, h: 500 };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const { svg, w, h } = turnStrip();
  renderPng(svgDoc(w, h, svg, "#EFEBE4"), new URL("./out/wip-turn.png", import.meta.url).pathname, 1600);
}
