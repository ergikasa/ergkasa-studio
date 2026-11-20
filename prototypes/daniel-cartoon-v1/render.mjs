/**
 * Daniel, human cartoon v1 (concept prototype): drawing tubes as cel-shaded ink shapes.
 *
 * A group (a garment, the skin of a hand) is drawn as one shape: every member's outline is inked first and the
 * fills go on top, so lines appear only on the outside of the group, never where its tubes join.
 */
import { id, norm, smooth } from "./lib.mjs";
import { shadows, silhouette } from "./tube.mjs";

export const LIGHT = norm([-0.52, 0.55, 0.65]);

/** Thins a polygon so Catmull-Rom smoothing does not wobble. */
export function thin(pts, minDist = 1.2) {
  const out = [pts[0]];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= minDist) out.push(p);
  }
  return out;
}

export const shapePath = (pts) => smooth(thin(pts, 1.6));

/**
 * One inked, shaded group.
 * members: [{ T, cap?: {capStart, capEnd}, shade?: false, fill?, shadeColor? }]
 */
export function group(cam, { members, fill, shade, line, lw = 3, threshold = 0.12, extra = "" }) {
  const outlines = members.map((m) => shapePath(silhouette(m.T, cam, m.cap ?? {})));
  let svg = `<g>`;
  // ink first: outlines become the group's silhouette
  for (const d of outlines)
    svg += `<path d="${d}" fill="${line}" stroke="${line}" stroke-width="${lw * 2}" stroke-linejoin="round"/>`;
  members.forEach((m, k) => {
    const d = outlines[k];
    svg += `<path d="${d}" fill="${m.fill ?? fill}"/>`;
    if (m.shade !== false) {
      const cid = id("c");
      svg += `<clipPath id="${cid}"><path d="${d}"/></clipPath><g clip-path="url(#${cid})">`;
      for (const p of shadows(m.T, cam, LIGHT, m.threshold ?? threshold)) {
        svg += `<path d="${smooth(thin(p, 2))}" fill="${m.shadeColor ?? shade}"/>`;
      }
      svg += `</g>`;
    }
  });
  return svg + extra + `</g>`;
}

/** The clip path of a group (for details drawn inside it). */
export function clipOf(cam, members) {
  const cid = id("k");
  const d = members.map((m) => shapePath(silhouette(m.T, cam, m.cap ?? {}))).join(" ");
  return { cid, def: `<clipPath id="${cid}"><path d="${d}"/></clipPath>` };
}
