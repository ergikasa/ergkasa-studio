import type { AssetMeta } from "@erkasa/contracts";
import { hashString } from "../core/random.js";
import { OPACITY_GUARD, SvgTemplate, fmt, type PartPose } from "../core/svg-template.js";
import { sampleNumber, type Tracks } from "../core/tracks.js";

/**
 * Objects, icons and metaphors. Placement tracks: x, y (center, world or screen px), size (px width),
 * scale, rotation, opacity. Part tracks drive named groups: `part.<id>.rotation|x|y|scaleX|scaleY|opacity`.
 * props.idle adds a continuous motion: float | bob | spin | pulse | sway.
 */
export interface PreparedSvgAsset {
  meta: AssetMeta;
  template: SvgTemplate;
}

export function prepareSvgAsset(meta: AssetMeta, svgText: string): PreparedSvgAsset {
  return { meta, template: SvgTemplate.compile(svgText, meta.assetId) };
}

const PART_TRACK = /^part\.([^.]+)\.(rotation|x|y|scaleX|scaleY|opacity)$/;
const DEFAULTS: Record<string, number> = { rotation: 0, x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 };

export function renderSvgAsset(
  a: PreparedSvgAsset,
  nodeId: string,
  tracks: Tracks,
  props: Record<string, unknown>,
  frame: number,
  fps: number,
  seed: number,
): string {
  const [vx, vy, vw, vh] = a.template.viewBox;
  const size = sampleNumber(tracks["size"], frame, typeof props["size"] === "number" ? props["size"] : vw);
  let scale = sampleNumber(tracks["scale"], frame, 1) * (size / vw);
  const x = sampleNumber(tracks["x"], frame, 0);
  let y = sampleNumber(tracks["y"], frame, 0);
  let rotation = sampleNumber(tracks["rotation"], frame, 0);
  const opacity = sampleNumber(tracks["opacity"], frame, 1);
  if (opacity <= 0.001 || scale <= 0.0001) return "";

  const t = frame / fps;
  const ph = (hashString(nodeId, seed) % 628) / 100;
  switch (props["idle"]) {
    case "float":
      y += Math.sin(t * 1.6 + ph) * size * 0.04;
      rotation += Math.sin(t * 1.1 + ph) * 2.5;
      break;
    case "bob":
      y += Math.abs(Math.sin(t * 3 + ph)) * -size * 0.05;
      break;
    case "spin":
      rotation += t * 90;
      break;
    case "pulse":
      scale *= 1 + Math.sin(t * 4 + ph) * 0.04;
      break;
    case "sway":
      rotation += Math.sin(t * 1.8 + ph) * 6;
      break;
    default:
      break;
  }

  const parts: Record<string, PartPose> = {};
  for (const [name, kfs] of Object.entries(tracks)) {
    const m = PART_TRACK.exec(name);
    if (!m) continue;
    const [, part, prop] = m as unknown as [string, string, keyof PartPose];
    if (!a.template.parts.has(part))
      throw new Error(`${a.meta.assetId}: no part '${part}' for track ${name}`);
    parts[part] = { ...(parts[part] ?? {}), [prop]: sampleNumber(kfs, frame, DEFAULTS[prop] ?? 0) };
  }

  // Metaphors carry a plain `backdrop`; hide it when the asset sits on top of a scene.
  if (props["backdrop"] === false && a.template.parts.has("backdrop")) parts["backdrop"] = { opacity: 0 };
  const body = a.template.render({ parts });
  const color = typeof props["color"] === "string" ? props["color"] : a.template.rootColor;
  const colorAttr = color ? ` color="${color}"` : "";
  const op = opacity < 1 ? ` opacity="${fmt(opacity)}"` : "";
  const cx = vx + vw / 2;
  const cy = vy + vh / 2;
  return (
    `<g data-node="${nodeId}"${colorAttr}${op} transform="translate(${fmt(x)} ${fmt(y)})` +
    (rotation ? ` rotate(${fmt(rotation)})` : "") +
    ` scale(${fmt(scale)}) translate(${fmt(-cx)} ${fmt(-cy)})">${op ? OPACITY_GUARD : ""}${body}</g>`
  );
}
