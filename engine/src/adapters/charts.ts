import { easeFn } from "../core/easing.js";
import { OPACITY_GUARD, fmt } from "../core/svg-template.js";
import { sampleNumber, type Tracks } from "../core/tracks.js";
import { escapeXml } from "./text.js";

/**
 * Animated charts for the motion-graphics adapter. Everything grows with the `progress` track (0..1):
 * bars rise, numbers count, lines draw. props: chart, data [{label, value}], unit, card (default true).
 * Tracks: x, y (center), size (width px), scale, opacity, progress.
 */
export const CHART_KINDS = ["bar", "counter", "line", "compare", "linear_vs_exponential", "pie"] as const;

interface Datum {
  label: string;
  value: number;
}

const PALETTE = ["#E8833A", "#2F8F8A", "#C2554D", "#3E5F86", "#E3B66B", "#8E6BB0"];
const INK = "#2A1E18";
const MUTED = "#8A7F74";
const FONT = 'font-family="Montserrat"';
const easeOut = easeFn("easeOutCubic");
const easeInOut = easeFn("easeInOutCubic");
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export function formatValue(v: number, unit: string | undefined, decimals?: number): string {
  const d = decimals ?? (Math.abs(v) < 10 && !Number.isInteger(v) ? 1 : 0);
  const s = v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  if (!unit) return s;
  return ["$", "€", "£"].includes(unit) ? `${unit}${s}` : `${s}${unit}`;
}

const text = (
  x: number,
  y: number,
  size: number,
  weight: number,
  fill: string,
  content: string,
  anchor = "middle",
): string =>
  `<text x="${fmt(x)}" y="${fmt(y)}" ${FONT} font-size="${fmt(size)}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(content)}</text>`;

function bar(data: Datum[], w: number, h: number, p: number, unit?: string): string {
  const n = data.length;
  const max = Math.max(...data.map((d) => d.value), 1e-9);
  const plotW = w * 0.84;
  const slot = plotW / n;
  const bw = Math.min(slot * 0.62, w * 0.22);
  const base = h * 0.3;
  const plotH = h * 0.55;
  const fs = w * 0.05;
  let out = `<line x1="${fmt(-plotW / 2)}" y1="${fmt(base)}" x2="${fmt(plotW / 2)}" y2="${fmt(base)}" stroke="${MUTED}" stroke-width="3" stroke-linecap="round"/>`;
  data.forEach((d, i) => {
    const pi = clamp01(p * (1 + 0.3 * (n - 1)) - 0.3 * i);
    const k = easeOut(pi);
    const bh = (d.value / max) * plotH * k;
    const cx = -plotW / 2 + slot * (i + 0.5);
    const color = PALETTE[i % PALETTE.length] as string;
    out += `<rect x="${fmt(cx - bw / 2)}" y="${fmt(base - bh)}" width="${fmt(bw)}" height="${fmt(bh)}" rx="${fmt(Math.min(12, bw / 4))}" fill="${color}"/>`;
    if (pi > 0) out += text(cx, base - bh - fs * 0.45, fs * 1.15, 900, INK, formatValue(d.value * k, unit));
    out += text(cx, base + fs * 1.35, fs, 700, MUTED, d.label);
  });
  return out;
}

function counter(data: Datum[], w: number, h: number, p: number, unit?: string): string {
  const d = data[0] ?? { label: "", value: 0 };
  const k = easeOut(clamp01(p));
  const fs = w * 0.2;
  const pop = 1 + 0.06 * Math.sin(clamp01(p) * Math.PI);
  return (
    `<g transform="scale(${fmt(pop)})">${text(0, fs * 0.25, fs, 900, PALETTE[0] as string, formatValue(d.value * k, unit, Number.isInteger(d.value) ? 0 : 1))}</g>` +
    text(0, fs * 0.25 + w * 0.11, w * 0.06, 700, INK, d.label) +
    (h > 0 ? "" : "")
  );
}

function line(data: Datum[], w: number, h: number, p: number, unit?: string): string {
  const n = data.length;
  const max = Math.max(...data.map((d) => d.value), 1e-9);
  const min = Math.min(0, ...data.map((d) => d.value));
  const plotW = w * 0.8;
  const plotH = h * 0.52;
  const base = h * 0.28;
  const pts = data.map(
    (d, i) =>
      [-plotW / 2 + (plotW * i) / Math.max(1, n - 1), base - ((d.value - min) / (max - min)) * plotH] as [
        number,
        number,
      ],
  );
  const lens = pts
    .slice(1)
    .map((q, i) =>
      Math.hypot(q[0] - (pts[i] as [number, number])[0], q[1] - (pts[i] as [number, number])[1]),
    );
  const total = lens.reduce((a, b) => a + b, 0);
  let left = total * easeInOut(clamp01(p));
  const drawn: Array<[number, number]> = [pts[0] as [number, number]];
  for (let i = 0; i < lens.length && left > 0; i++) {
    const a = pts[i] as [number, number];
    const b = pts[i + 1] as [number, number];
    const seg = lens[i] as number;
    const t = Math.min(1, left / seg);
    drawn.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    left -= seg;
  }
  const head = drawn[drawn.length - 1] as [number, number];
  const fs = w * 0.05;
  const lastVal = data[data.length - 1]?.value ?? 0;
  return (
    `<line x1="${fmt(-plotW / 2)}" y1="${fmt(base)}" x2="${fmt(plotW / 2)}" y2="${fmt(base)}" stroke="${MUTED}" stroke-width="3"/>` +
    `<polyline points="${drawn.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(" ")}" fill="none" stroke="${PALETTE[1]}" stroke-width="${fmt(w * 0.018)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${fmt(head[0])}" cy="${fmt(head[1])}" r="${fmt(w * 0.022)}" fill="${PALETTE[0]}"/>` +
    text(-plotW / 2, base + fs * 1.4, fs, 700, MUTED, data[0]?.label ?? "", "start") +
    text(plotW / 2, base + fs * 1.4, fs, 700, MUTED, data[n - 1]?.label ?? "", "end") +
    (p >= 0.98
      ? text(head[0], head[1] - fs * 0.9, fs * 1.2, 900, INK, formatValue(lastVal, unit), "end")
      : "")
  );
}

function compare(data: Datum[], w: number, h: number, p: number, unit?: string): string {
  const rows = data.slice(0, 4);
  const max = Math.max(...rows.map((d) => d.value), 1e-9);
  const barW = w * 0.8;
  const rowH = (h * 0.8) / rows.length;
  const fs = w * 0.055;
  let out = "";
  rows.forEach((d, i) => {
    const k = easeOut(clamp01(p * 1.3 - 0.3 * i));
    const y = -h * 0.4 + rowH * i + fs * 1.2;
    out += text(-barW / 2, y, fs, 800, INK, d.label, "start");
    out += `<rect x="${fmt(-barW / 2)}" y="${fmt(y + fs * 0.4)}" width="${fmt(barW)}" height="${fmt(fs * 1.3)}" rx="${fmt(fs * 0.65)}" fill="#ECE6DC"/>`;
    out += `<rect x="${fmt(-barW / 2)}" y="${fmt(y + fs * 0.4)}" width="${fmt(Math.max(0, barW * (d.value / max) * k))}" height="${fmt(fs * 1.3)}" rx="${fmt(fs * 0.65)}" fill="${PALETTE[i % PALETTE.length]}"/>`;
    out += text(barW / 2, y, fs, 900, INK, formatValue(d.value * k, unit), "end");
  });
  return out;
}

function linearVsExponential(data: Datum[], w: number, h: number, p: number): string {
  const plotW = w * 0.78;
  const plotH = h * 0.6;
  const x0 = -plotW / 2;
  const base = h * 0.3;
  const steps = 40;
  const k = easeInOut(clamp01(p));
  const curve = (f: (t: number) => number): string => {
    const pts: string[] = [];
    for (let i = 0; i <= Math.round(steps * k); i++) {
      const t = i / steps;
      pts.push(`${fmt(x0 + plotW * t)},${fmt(base - plotH * f(t))}`);
    }
    return pts.join(" ");
  };
  const lin = (t: number): number => t * 0.42;
  const exp = (t: number): number => (Math.exp(3.2 * t) - 1) / (Math.exp(3.2) - 1);
  const fs = w * 0.05;
  const labelA = data[0]?.label ?? "Linear";
  const labelB = data[1]?.label ?? "Compound";
  const tEnd = Math.round(steps * k) / steps;
  return (
    `<line x1="${fmt(x0)}" y1="${fmt(base)}" x2="${fmt(-x0)}" y2="${fmt(base)}" stroke="${MUTED}" stroke-width="3"/>` +
    `<line x1="${fmt(x0)}" y1="${fmt(base)}" x2="${fmt(x0)}" y2="${fmt(base - plotH)}" stroke="${MUTED}" stroke-width="3"/>` +
    (k > 0.02
      ? `<polyline points="${curve(lin)}" fill="none" stroke="${PALETTE[3]}" stroke-width="${fmt(w * 0.016)}" stroke-linecap="round"/>`
      : "") +
    (k > 0.02
      ? `<polyline points="${curve(exp)}" fill="none" stroke="${PALETTE[0]}" stroke-width="${fmt(w * 0.02)}" stroke-linecap="round"/>`
      : "") +
    (k > 0.9
      ? text(
          x0 + plotW * tEnd - fs * 0.3,
          base - plotH * lin(tEnd) - fs * 0.6,
          fs,
          800,
          PALETTE[3] as string,
          labelA,
          "end",
        ) +
        text(
          x0 + plotW * tEnd - fs * 0.3,
          base - plotH * exp(tEnd) + fs * 0.4,
          fs,
          900,
          PALETTE[0] as string,
          labelB,
          "end",
        )
      : "")
  );
}

function pie(data: Datum[], w: number, h: number, p: number, unit?: string): string {
  const total = data.reduce((a, d) => a + Math.max(0, d.value), 0) || 1;
  const r = Math.min(w, h) * 0.32;
  const cy = -h * 0.06;
  const sweep = easeInOut(clamp01(p)) * Math.PI * 2;
  let a0 = -Math.PI / 2;
  let out = "";
  const fs = w * 0.045;
  data.forEach((d, i) => {
    const full = (Math.max(0, d.value) / total) * Math.PI * 2;
    const start = a0 - -Math.PI / 2;
    const visible = Math.max(0, Math.min(full, sweep - start));
    if (visible > 0.001) {
      const a1 = a0 + visible;
      const large = visible > Math.PI ? 1 : 0;
      const [sx, sy] = [Math.cos(a0) * r, cy + Math.sin(a0) * r];
      const [ex, ey] = [Math.cos(a1) * r, cy + Math.sin(a1) * r];
      out +=
        visible >= Math.PI * 2 - 0.001
          ? `<circle cx="0" cy="${fmt(cy)}" r="${fmt(r)}" fill="${PALETTE[i % PALETTE.length]}"/>`
          : `<path d="M0,${fmt(cy)} L${fmt(sx)},${fmt(sy)} A${fmt(r)},${fmt(r)} 0 ${large} 1 ${fmt(ex)},${fmt(ey)} Z" fill="${PALETTE[i % PALETTE.length]}"/>`;
    }
    a0 += full;
  });
  // legend
  data.slice(0, 4).forEach((d, i) => {
    const y = cy + r + fs * 1.8 + i * fs * 1.4;
    out += `<rect x="${fmt(-w * 0.32)}" y="${fmt(y - fs * 0.8)}" width="${fmt(fs)}" height="${fmt(fs)}" rx="4" fill="${PALETTE[i % PALETTE.length]}"/>`;
    out += text(-w * 0.32 + fs * 1.5, y, fs, 700, INK, `${d.label}  ${formatValue(d.value, unit)}`, "start");
  });
  return out;
}

export function renderChart(
  nodeId: string,
  tracks: Tracks,
  props: Record<string, unknown>,
  frame: number,
): string {
  const kind = String(props["chart"] ?? "bar");
  const data = (Array.isArray(props["data"]) ? props["data"] : []) as Datum[];
  if (!data.length) throw new Error(`chart ${nodeId}: no data`);
  const unit = typeof props["unit"] === "string" ? props["unit"] : undefined;
  const opacity = sampleNumber(tracks["opacity"], frame, 1);
  const scale = sampleNumber(tracks["scale"], frame, 1);
  if (opacity <= 0.001 || scale <= 0.0001) return "";
  const w = sampleNumber(tracks["size"], frame, 900);
  const h = w * (kind === "counter" ? 0.5 : kind === "pie" ? 1.05 : 0.78);
  const p = sampleNumber(tracks["progress"], frame, 1);
  const x = sampleNumber(tracks["x"], frame, 540);
  const y = sampleNumber(tracks["y"], frame, 860);

  let body: string;
  switch (kind) {
    case "bar":
      body = bar(data, w, h, p, unit);
      break;
    case "counter":
      body = counter(data, w, h, p, unit);
      break;
    case "line":
      body = line(data, w, h, p, unit);
      break;
    case "compare":
      body = compare(data, w, h, p, unit);
      break;
    case "linear_vs_exponential":
      body = linearVsExponential(data, w, h, p);
      break;
    case "pie":
      body = pie(data, w, h, p, unit);
      break;
    default:
      throw new Error(`chart ${nodeId}: unknown chart '${kind}' (available: ${CHART_KINDS.join(", ")})`);
  }
  const card =
    props["card"] === false
      ? ""
      : `<rect x="${fmt(-w / 2 - 6)}" y="${fmt(-h / 2 + 10)}" width="${fmt(w + 12)}" height="${fmt(h)}" rx="34" fill="#000" fill-opacity="0.12"/>` +
        `<rect x="${fmt(-w / 2)}" y="${fmt(-h / 2)}" width="${fmt(w)}" height="${fmt(h)}" rx="32" fill="#FFFDF8"/>`;
  const op = opacity < 1 ? ` opacity="${fmt(opacity)}"` : "";
  return `<g data-node="${nodeId}"${op} transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale)})">${op ? OPACITY_GUARD : ""}${card}${body}</g>`;
}
