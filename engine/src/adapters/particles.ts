import { hashString, mulberry32 } from "../core/random.js";
import { OPACITY_GUARD, fmt } from "../core/svg-template.js";
import { sampleNumber, type Tracks } from "../core/tracks.js";

/**
 * Deterministic particles. Each particle's position is a closed-form function of time
 * (no step-by-step simulation), so any frame can be rendered on its own, in any order.
 * props: preset (dust | snow | rain | sparkle | bokeh), count, area [x, y, w, h].
 */
interface Preset {
  color: string;
  size: [number, number];
  speed: [number, number]; // px/s, positive = down
  drift: number; // horizontal sway px
  opacity: [number, number];
  shape: "circle" | "streak" | "star";
}

const PRESETS: Record<string, Preset> = {
  dust: {
    color: "#FFF4D6",
    size: [2, 6],
    speed: [-14, 10],
    drift: 26,
    opacity: [0.25, 0.7],
    shape: "circle",
  },
  snow: { color: "#FFFFFF", size: [4, 11], speed: [60, 130], drift: 40, opacity: [0.6, 1], shape: "circle" },
  rain: {
    color: "#BFD9EA",
    size: [2, 3],
    speed: [900, 1300],
    drift: 0,
    opacity: [0.35, 0.7],
    shape: "streak",
  },
  sparkle: { color: "#FFE7A8", size: [6, 14], speed: [-30, -8], drift: 18, opacity: [0.4, 1], shape: "star" },
  bokeh: {
    color: "#FFFFFF",
    size: [18, 46],
    speed: [-10, 10],
    drift: 30,
    opacity: [0.06, 0.18],
    shape: "circle",
  },
};

export function renderParticles(
  nodeId: string,
  tracks: Tracks,
  props: Record<string, unknown>,
  frame: number,
  fps: number,
  seed: number,
): string {
  const presetName = typeof props["preset"] === "string" ? props["preset"] : "dust";
  const p = PRESETS[presetName];
  if (!p) throw new Error(`particles ${nodeId}: unknown preset '${presetName}'`);
  const opacity = sampleNumber(tracks["opacity"], frame, 1);
  if (opacity <= 0.001) return "";
  const count = typeof props["count"] === "number" ? props["count"] : 40;
  const area = Array.isArray(props["area"]) ? (props["area"] as number[]) : [0, 0, 1080, 1920];
  const [ax, ay, aw, ah] = [area[0] ?? 0, area[1] ?? 0, area[2] ?? 1080, area[3] ?? 1920];
  const rnd = mulberry32(hashString(nodeId, seed));
  const t = frame / fps;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const x0 = rnd() * aw;
    const y0 = rnd() * ah;
    const v = p.speed[0] + rnd() * (p.speed[1] - p.speed[0]);
    const s = p.size[0] + rnd() * (p.size[1] - p.size[0]);
    const o = p.opacity[0] + rnd() * (p.opacity[1] - p.opacity[0]);
    const ph = rnd() * Math.PI * 2;
    const tw = presetName === "sparkle" ? 0.5 + 0.5 * Math.sin(t * 5 + ph) : 1;
    const y = ay + ((((y0 + v * t) % ah) + ah) % ah);
    const x = ax + ((((x0 + Math.sin(t * 0.8 + ph) * p.drift) % aw) + aw) % aw);
    const alpha = fmt(o * tw);
    if (p.shape === "streak") {
      out.push(
        `<line x1="${fmt(x)}" y1="${fmt(y)}" x2="${fmt(x - 4)}" y2="${fmt(y + s * 14)}" stroke="${p.color}" stroke-width="${fmt(s)}" stroke-linecap="round" stroke-opacity="${alpha}"/>`,
      );
    } else if (p.shape === "star") {
      const r = s;
      out.push(
        `<path d="M${fmt(x)},${fmt(y - r)} Q${fmt(x)},${fmt(y)} ${fmt(x + r)},${fmt(y)} Q${fmt(x)},${fmt(y)} ${fmt(x)},${fmt(y + r)} Q${fmt(x)},${fmt(y)} ${fmt(x - r)},${fmt(y)} Q${fmt(x)},${fmt(y)} ${fmt(x)},${fmt(y - r)} Z" fill="${p.color}" fill-opacity="${alpha}"/>`,
      );
    } else {
      out.push(
        `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(s)}" fill="${p.color}" fill-opacity="${alpha}"/>`,
      );
    }
  }
  const op = opacity < 1 ? ` opacity="${fmt(opacity)}"` : "";
  return `<g data-node="${nodeId}"${op}>${op ? OPACITY_GUARD : ""}${out.join("")}</g>`;
}
