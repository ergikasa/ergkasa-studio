/**
 * Editorial templates: designed scenes for ideas that need no person. The director chooses one and fills its
 * parameters; the design (layout, type, motion, colour) is fixed here, so every film keeps the show's look.
 */
import { z } from "zod";
import type { Template } from "./contract.js";
import { EASES, K, clamp, fmt, ramp, rad, type Key } from "./motion.js";
import { H, PALETTE as C, W, textWidth } from "./style.js";

export interface TemplateCtx {
  t: number;
  dur: number;
  params: Record<string, unknown>;
  /** Local time of an anchor (start, word:x, sec:n); undefined when it does not resolve. */
  at(anchor: string): number | undefined;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const label = (
  x: number,
  y: number,
  s: string,
  size: number,
  fill: string,
  weight = 500,
  anchor = "middle",
  ls = 3,
): string =>
  `<text x="${fmt(x)}" y="${fmt(y)}" text-anchor="${anchor}" font-family="Montserrat" font-weight="${weight}" font-size="${size}" letter-spacing="${ls}" fill="${fill}">${esc(s)}</text>`;
const fit = (s: string, size: number, maxW: number, weight: "light" | "bold" = "bold"): number => {
  const w = textWidth(s, size, weight);
  return w > maxW ? Math.floor((size * maxW) / w) : size;
};

// ---------------------------------------------------------------- parameters
const Anchor = z.string();
const Lines = z.array(z.string().max(40)).max(6);
export const PARAMS: Record<Template, z.ZodType> = {
  statement: z.object({}).passthrough(),
  clock: z.object({ time: z.string().regex(/^\d{1,2}:\d{2}$/) }).passthrough(),
  scale: z
    .object({
      left: z.string().max(24),
      right: z.string().max(24),
      items: z
        .array(
          z.object({ label: z.string().max(14), side: z.enum(["left", "right"]), at: Anchor.optional() }),
        )
        .min(1)
        .max(8),
      clearAt: Anchor.optional(),
    })
    .passthrough(),
  curves: z
    .object({
      a: z.object({ label: z.string().max(18), end: z.number().positive() }),
      b: z.object({ label: z.string().max(18), end: z.number().positive() }),
      start: z.string().max(12).optional(),
      finish: z.string().max(12).optional(),
    })
    .passthrough(),
  bars: z
    .object({
      unit: z.string().max(10).optional(),
      bars: z
        .array(z.object({ label: z.string().max(16), value: z.number().nonnegative() }))
        .min(1)
        .max(4),
    })
    .passthrough(),
  counter: z
    .object({
      from: z.number(),
      to: z.number(),
      decimals: z.number().int().min(0).max(2).optional(),
      suffix: z.string().max(6).optional(),
      label: z.string().max(28).optional(),
    })
    .passthrough(),
  word_shadow: z.object({ word: z.string().min(1).max(10), shadow: z.string().min(1).max(10) }).passthrough(),
  time_strip: z
    .object({
      label: z.string().max(24),
      segments: z.array(z.string().max(14)).min(2).max(5),
      keep: z.number().int().min(0),
      pushAt: Anchor.optional(),
    })
    .passthrough(),
  receipts: z
    .object({
      front: z.object({ title: z.string().max(18), lines: Lines }),
      back: z.object({ title: z.string().max(18), lines: Lines }),
      revealAt: Anchor.optional(),
    })
    .passthrough(),
  calendar: z
    .object({
      from: z.number().int().min(1).max(60),
      to: z.number().int().min(1).max(60),
      label: z.string().max(10).optional(),
    })
    .passthrough(),
  window_dream: z.object({}).passthrough(),
  cards: z
    .object({
      left: z.object({ title: z.string().max(18), lines: Lines }),
      right: z.object({ title: z.string().max(18), lines: Lines }),
    })
    .passthrough(),
};

/** Visible events of a template (local seconds), for the dead-time check. */
export function templateEvents(tpl: Template, ctx: TemplateCtx): number[] {
  const p = ctx.params as Record<string, unknown>;
  const ev: number[] = [0];
  const push = (a: unknown): void => {
    if (typeof a === "string") {
      const t = ctx.at(a);
      if (t !== undefined) ev.push(t);
    }
  };
  if (tpl === "scale") {
    (p["items"] as Array<{ at?: string }> | undefined)?.forEach((it, i) =>
      it.at ? push(it.at) : ev.push(0.6 + i * 0.42),
    );
    push(p["clearAt"]);
  }
  if (tpl === "receipts") push(p["revealAt"]);
  if (tpl === "time_strip") push(p["pushAt"]);
  // templates with continuous motion
  if (
    [
      "statement",
      "clock",
      "curves",
      "bars",
      "counter",
      "calendar",
      "window_dream",
      "cards",
      "word_shadow",
    ].includes(tpl)
  )
    for (let s = 0; s < ctx.dur; s += 1) ev.push(s);
  return ev;
}

type Draw = (ctx: TemplateCtx) => { bg: string; svg: string };

const statement: Draw = ({ t, dur }) => ({
  bg: C.night,
  svg: `<circle cx="${fmt(
    760 +
      K(t, [
        [0, 0],
        [dur, -160],
      ]),
  )}" cy="${fmt(
    1250 -
      K(t, [
        [0, 0],
        [dur, 120],
      ]),
  )}" r="${fmt(
    K(t, [
      [0, 300],
      [0.8, 420, "back"],
      [dur, 470],
    ]),
  )}" fill="${C.ochre}" opacity=".16"/>
        <circle cx="${fmt(
          300 +
            K(t, [
              [0, 0],
              [dur, 120],
            ]),
        )}" cy="1500" r="${fmt(
          K(t, [
            [0, 140],
            [dur, 220],
          ]),
        )}" fill="${C.coral}" opacity=".12"/>
        <rect x="90" y="${fmt(
          1500 +
            K(t, [
              [0, 40],
              [0.6, 0, "back"],
            ]),
        )}" width="${fmt(
          K(t, [
            [0.3, 0],
            [1.2, 220, "out"],
          ]),
        )}" height="10" rx="5" fill="${C.ochre}"/>`,
});

const clock: Draw = ({ t, dur, params }) => {
  const [hh, mm] = String(params["time"] ?? "5:58")
    .split(":")
    .map(Number) as [number, number];
  const z = K(t, [
    [0, 1],
    [dur, 1.1],
  ]);
  const sec = (Math.floor(t) * 6 + EASES.back(clamp((t % 1) * 5)) * 6 + 300) % 360;
  return {
    bg: C.wall,
    svg: `<g transform="translate(540 900) scale(${fmt(z)})"><circle r="420" fill="${C.wallShade}" opacity=".5"/><circle r="300" fill="${C.cream}" stroke="${C.slate}" stroke-width="34"/>
      ${Array.from({ length: 12 }, (_, i) => `<rect x="-6" y="-270" width="12" height="${i % 3 ? 26 : 50}" fill="${C.slate}" transform="rotate(${i * 30})"/>`).join("")}
      <line x1="0" y1="0" x2="0" y2="-170" stroke="${C.ink}" stroke-width="22" stroke-linecap="round" transform="rotate(${fmt((hh % 12) * 30 + mm * 0.5)})"/>
      <line x1="0" y1="0" x2="0" y2="-240" stroke="${C.ink}" stroke-width="14" stroke-linecap="round" transform="rotate(${fmt(mm * 6 + t * 0.1)})"/>
      <line x1="0" y1="40" x2="0" y2="-255" stroke="${C.coral}" stroke-width="6" stroke-linecap="round" transform="rotate(${fmt(sec)})"/><circle r="18" fill="${C.coral}"/></g>`,
  };
};

const scale: Draw = (ctx) => {
  const { t, dur, params } = ctx;
  const items = (params["items"] as Array<{ label: string; side: "left" | "right"; at?: string }>) ?? [];
  const times = items.map((it, i) => (it.at ? (ctx.at(it.at) ?? 0.6 + i * 0.42) : 0.6 + i * 0.42));
  const clearT = typeof params["clearAt"] === "string" ? ctx.at(params["clearAt"]) : undefined;
  const fall = clearT === undefined ? 0 : ramp(t, clearT, clearT + 1.2, "in");
  const weight = (until: number): number =>
    items.reduce(
      (n, it, i) => n + ((times[i] as number) + 0.25 <= until ? (it.side === "left" ? 1 : -1) : 0),
      0,
    );
  const changes = [0, ...times.map((x) => x + 0.25), ...(clearT !== undefined ? [clearT] : [])]
    .filter((x) => x <= t)
    .sort((a, b) => a - b);
  const last = changes[changes.length - 1] ?? 0;
  const target = clearT !== undefined && t >= clearT ? 0 : weight(t) * 3.4;
  const prev = clearT !== undefined && t >= clearT ? weight(clearT) * 3.4 : weight(last - 0.01) * 3.4;
  const tilt = prev + (target - prev) * EASES.spring(clamp((t - last) / 1.6));
  const cx = 540,
    cy = 1040,
    arm = 340;
  const Lp: [number, number] = [cx - Math.cos(rad(tilt)) * arm, cy + Math.sin(rad(tilt)) * arm];
  const Rp: [number, number] = [cx + Math.cos(rad(tilt)) * arm, cy - Math.sin(rad(tilt)) * arm];
  const pan = (p: [number, number], name: string): string =>
    `<line x1="${fmt(p[0] - 110)}" y1="${fmt(p[1] + 230)}" x2="${fmt(p[0])}" y2="${fmt(p[1])}" stroke="${C.cream}" stroke-width="4"/><line x1="${fmt(p[0] + 110)}" y1="${fmt(p[1] + 230)}" x2="${fmt(p[0])}" y2="${fmt(p[1])}" stroke="${C.cream}" stroke-width="4"/>
     <path d="M${fmt(p[0] - 140)} ${fmt(p[1] + 230)} Q${fmt(p[0])} ${fmt(p[1] + 300)} ${fmt(p[0] + 140)} ${fmt(p[1] + 230)}Z" fill="${C.cream}"/>${label(p[0], p[1] + 350, name.toUpperCase(), 28, C.cream, 500)}`;
  const counts = { left: 0, right: 0 };
  const blocks = items
    .map((it, i) => {
      const tt = times[i] as number;
      const n = counts[it.side]++;
      if (t < tt - 0.35) return "";
      const p = it.side === "left" ? Lp : Rp;
      const drop = K(t, [
        [tt - 0.35, -380],
        [tt, 0, "in"],
      ]);
      const squash = t > tt && t < tt + 0.25 ? 1 - Math.sin(((t - tt) / 0.25) * Math.PI) * 0.22 : 1;
      const by = p[1] + 220 - n * 58 + drop + fall * (700 + i * 60);
      const bx = p[0] + (n % 2 ? 8 : -8) + fall * (i % 2 ? 60 : -60) * (i / 3);
      const rot = fall * (i % 2 ? 40 : -35) * (1 + i / 4);
      return `<g transform="translate(${fmt(bx)} ${fmt(by)}) rotate(${fmt(rot)}) scale(${fmt(2 - squash)} ${fmt(squash)})" opacity="${fmt(1 - fall * 0.9)}"><rect x="-90" y="-52" width="180" height="54" rx="8" fill="${i % 2 ? C.coral : C.ochre}"/>${label(0, -14, it.label, fit(it.label, 30, 160), C.ink, 800, "middle", 0)}</g>`;
    })
    .join("");
  const z = K(t, [
    [0, 0.95],
    [dur, 1.03],
  ]);
  return {
    bg: C.night,
    svg: `<g transform="translate(540 960) scale(${fmt(z)}) translate(-540 -960)"><rect x="0" y="1600" width="${W}" height="400" fill="${C.deep}"/>
      <rect x="${cx - 16}" y="${cy}" width="32" height="620" fill="${C.cream}"/><path d="M${cx - 150} 1660 L${cx + 150} 1660 L${cx + 80} 1620 L${cx - 80} 1620Z" fill="${C.cream}"/>
      <line x1="${fmt(Lp[0])}" y1="${fmt(Lp[1])}" x2="${fmt(Rp[0])}" y2="${fmt(Rp[1])}" stroke="${C.cream}" stroke-width="22" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="26" fill="${C.ochre}"/>${pan(Lp, String(params["left"] ?? ""))}${pan(Rp, String(params["right"] ?? ""))}${blocks}</g>`,
  };
};

const curves: Draw = ({ t, dur, params }) => {
  const a = params["a"] as { label: string; end: number };
  const b = params["b"] as { label: string; end: number };
  const x0 = 150,
    x1 = 930,
    base = 1500,
    top = 760;
  const max = Math.max(a.end, b.end, 1.5);
  const p = ramp(t, 0.3, Math.max(1.2, dur * 0.8), "io");
  const yOf = (v: number): number => base - ((v - 0) / max) * (base - top) * 0.92 - 40;
  const path = (end: number): string => {
    const pts: string[] = [];
    for (let i = 0; i <= 60 * p; i++) {
      const x = i / 60;
      const v = Math.pow(end, Math.pow(x, 1.6)); // starts at 1, bends late
      pts.push(`${fmt(x0 + x * (x1 - x0))},${fmt(yOf(v))}`);
    }
    return pts.join(" ");
  };
  const endV = (end: number): number => Math.pow(end, Math.pow(p, 1.6));
  const tip = (end: number, col: string, name: string): string => {
    if (p < 0.05) return "";
    const x = x0 + p * (x1 - x0),
      y = yOf(endV(end));
    const v = endV(end);
    const shown = v >= 10 ? v.toFixed(0) : v.toFixed(2);
    return `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="14" fill="${col}"/>${label(Math.min(x, 860), y - 34, `${name.toUpperCase()}  ${shown}×`, 30, col, 800, "middle", 1)}`;
  };
  return {
    bg: C.night,
    svg: `<line x1="${x0}" y1="${base}" x2="${x1}" y2="${base}" stroke="${C.cream}" stroke-width="4" opacity=".5"/>
      <line x1="${x0}" y1="${base}" x2="${x0}" y2="${top - 40}" stroke="${C.cream}" stroke-width="4" opacity=".5"/>
      <line x1="${x0}" y1="${fmt(yOf(1))}" x2="${x1}" y2="${fmt(yOf(1))}" stroke="${C.cream}" stroke-width="2" stroke-dasharray="8 10" opacity=".35"/>
      <polyline points="${path(b.end)}" fill="none" stroke="${C.coral}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="${path(a.end)}" fill="none" stroke="${C.ochre}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      ${tip(b.end, C.coral, b.label)}${tip(a.end, C.ochre, a.label)}
      ${label(x0, base + 60, String(params["start"] ?? "DAY 1"), 28, C.cream, 500, "start")}${label(x1, base + 60, String(params["finish"] ?? "DAY 365"), 28, C.cream, 500, "end")}`,
  };
};

const bars: Draw = ({ t, params }) => {
  const list = (params["bars"] as Array<{ label: string; value: number }>) ?? [];
  const unit = String(params["unit"] ?? "");
  const max = Math.max(...list.map((b) => b.value), 1);
  const n = list.length;
  const bw = Math.min(220, 760 / n - 40);
  const gap = (860 - n * bw) / (n + 1);
  const base = 1500;
  return {
    bg: C.night,
    svg: `<line x1="110" y1="${base}" x2="970" y2="${base}" stroke="${C.cream}" stroke-width="4" opacity=".5"/>${list
      .map((b, i) => {
        const p = K(t, [
          [0.3 + i * 0.35, 0],
          [1.3 + i * 0.35, 1, "back"],
        ]);
        const h = (b.value / max) * 620 * p;
        const x = 110 + gap + i * (bw + gap);
        const v = b.value * clamp(p);
        return `<rect x="${fmt(x)}" y="${fmt(base - h)}" width="${fmt(bw)}" height="${fmt(Math.max(0, h))}" rx="10" fill="${i === n - 1 ? C.ochre : C.coral}"/>
          ${label(x + bw / 2, base - h - 30, `${Math.round(v)}${unit ? ` ${unit}` : ""}`, 52, C.cream, 900, "middle", 0)}
          ${label(x + bw / 2, base + 60, b.label.toUpperCase(), fit(b.label.toUpperCase(), 28, bw + gap - 10, "light"), C.cream, 500)}`;
      })
      .join("")}`,
  };
};

const counter: Draw = ({ t, dur, params }) => {
  const from = Number(params["from"] ?? 0),
    to = Number(params["to"] ?? 100);
  const dec = Number(params["decimals"] ?? 0);
  const countEnd = Math.max(1, dur * 0.5);
  const v = from + (to - from) * ramp(t, 0.3, countEnd, "out");
  const str = `${v.toFixed(dec)}${String(params["suffix"] ?? "")}`;
  const size = fit(str, 300, 900);
  // after the count: the number lands (a small overshoot), the ring keeps opening, the label is underlined
  const land = K(t, [
    [countEnd, 1],
    [countEnd + 0.18, 1.08, "out"],
    [countEnd + 0.5, 1, "back"],
  ]);
  const ring = K(t, [
    [0, 300],
    [0.6, 380, "back"],
    [dur, 470, "lin"],
  ]);
  const lbl = params["label"] ? String(params["label"]).toUpperCase() : "";
  const under = ramp(t, countEnd + 0.2, Math.max(countEnd + 0.4, dur - 0.2), "io");
  return {
    bg: C.night,
    svg: `<circle cx="540" cy="900" r="${fmt(ring)}" fill="${C.ochre}" opacity=".12"/>
      <circle cx="540" cy="900" r="${fmt(ring * 1.25)}" fill="none" stroke="${C.ochre}" stroke-width="3" opacity="${fmt(0.25 * (1 - under))}"/>
      <g transform="translate(540 900) scale(${fmt(land)}) translate(-540 -900)">${label(540, 900 + size * 0.35, str, size, C.ochre, 900, "middle", -4)}</g>
      ${lbl ? label(540, 1180, lbl, 40, C.cream, 500, "middle", 6) + `<rect x="${fmt(540 - 300 * under)}" y="1210" width="${fmt(600 * under)}" height="6" rx="3" fill="${C.ochre}"/>` : ""}`,
  };
};

const wordShadow: Draw = ({ t, dur, params }) => {
  const word = String(params["word"] ?? "YES").toUpperCase();
  const shadow = String(params["shadow"] ?? "NO").toUpperCase();
  const size = fit(word, 300, 860);
  const sh = ramp(t, 0.5, Math.min(dur, 2.2), "out");
  const lx = K(t, [
    [0, 120],
    [dur, 300],
  ]);
  return {
    bg: C.wall,
    svg: `<rect x="0" y="1300" width="${W}" height="620" fill="${C.wallShade}"/>
      <circle cx="${fmt(lx)}" cy="300" r="90" fill="${C.sun}"/><circle cx="${fmt(lx)}" cy="300" r="260" fill="url(#glow)" opacity=".7"/>
      <g opacity="${fmt(sh * 0.85)}" transform="translate(${fmt(540 + 60 * sh)} 1310) skewX(${fmt(-38 * sh)}) scale(1 ${fmt(-0.55 * sh - 0.05)})">${label(0, 0, shadow, size, C.ink, 900, "middle", -6)}</g>
      ${label(540, 1290, word, size, C.ink, 900, "middle", -6)}`,
  };
};

const timeStrip: Draw = (ctx) => {
  const { t, params } = ctx;
  const segs = (params["segments"] as string[]) ?? [];
  const keep = Math.min(segs.length - 1, Number(params["keep"] ?? 0));
  const pushT = typeof params["pushAt"] === "string" ? (ctx.at(params["pushAt"]) ?? 1.5) : 1.5;
  const p = ramp(t, pushT, pushT + 0.9, "back");
  const x0 = 120,
    x1 = 960,
    y = 980,
    h = 220;
  const w = (x1 - x0) / segs.length;
  const cols = [C.teal, C.coral, C.ochre, C.slate, "#8E6BB0"];
  return {
    bg: C.night,
    svg: `${label(x0, y - 70, String(params["label"] ?? "").toUpperCase(), 34, C.cream, 500, "start", 6)}
      <rect x="${x0 - 8}" y="${y - 8}" width="${x1 - x0 + 16}" height="${h + 16}" rx="18" fill="none" stroke="${C.cream}" stroke-width="4" opacity=".6"/>
      ${segs
        .map((s, i) => {
          const isKeep = i === keep;
          const sx = x0 + i * w;
          const nx = isKeep ? sx + (x0 - sx) * p : sx + (i < keep ? -1 : 1) * 700 * p;
          const nw = isKeep ? w + (x1 - x0 - w) * p : w;
          const appear = K(t, [
            [0.15 * i, 0],
            [0.15 * i + 0.4, 1, "back"],
          ]);
          return `<g opacity="${fmt(isKeep ? 1 : 1 - clamp(p))}"><rect x="${fmt(nx + 4)}" y="${fmt(y + (1 - appear) * 60)}" width="${fmt(nw - 8)}" height="${h}" rx="12" fill="${cols[i % cols.length]}"/>
            ${label(nx + nw / 2, y + h / 2 + 12, s.toUpperCase(), fit(s.toUpperCase(), isKeep ? 40 + 14 * p : 30, nw - 24, "light"), C.cream, 800, "middle", 1)}</g>`;
        })
        .join("")}`,
  };
};

const receipts: Draw = (ctx) => {
  const { t, params } = ctx;
  const front = params["front"] as { title: string; lines: string[] };
  const back = params["back"] as { title: string; lines: string[] };
  const rt = typeof params["revealAt"] === "string" ? (ctx.at(params["revealAt"]) ?? 1.6) : 1.6;
  const inF = K(t, [
    [0, 1],
    [0.6, 0, "back"],
  ]);
  const rev = ramp(t, rt, rt + 0.8, "back");
  const card = (
    x: number,
    y: number,
    rot: number,
    d: { title: string; lines: string[] },
    accent: string,
    dim: boolean,
  ): string =>
    `<g transform="translate(${fmt(x)} ${fmt(y)}) rotate(${fmt(rot)})"><path d="M-210 -320 L210 -320 L210 300 ${Array.from({ length: 14 }, (_, i) => `L${fmt(210 - (i + 1) * 30)} ${i % 2 ? 300 : 280}`).join(" ")} Z" fill="${dim ? "#D9CFBF" : "#FBF7F0"}"/>
      ${label(0, -240, d.title.toUpperCase(), fit(d.title.toUpperCase(), 40, 380), accent, 900, "middle", 1)}
      <line x1="-170" y1="-200" x2="170" y2="-200" stroke="${C.ink}" stroke-width="3" stroke-dasharray="6 8"/>
      ${d.lines.map((l, i) => label(-170, -140 + i * 62, l, fit(l, 32, 340, "light"), C.ink, 500, "start", 0)).join("")}</g>`;
  return {
    bg: C.night,
    svg: `${card(540 + 230 * rev, 1000 - 60 * rev, 6 * rev, back, C.coral, true)}${card(540 - 160 * rev, 1000 + 700 * inF, -4 * rev, front, C.slate, false)}`,
  };
};

const calendar: Draw = ({ t, dur, params }) => {
  const from = Number(params["from"] ?? 1),
    to = Number(params["to"] ?? 7);
  const name = String(params["label"] ?? "Week").toUpperCase();
  const span = Math.max(1, to - from);
  const per = Math.max(0.35, (dur - 0.8) / span);
  const idx = Math.min(span, Math.floor(Math.max(0, t - 0.4) / per));
  const flip = clamp((t - 0.4 - idx * per) / Math.min(0.45, per));
  const page = (n: number, extra = ""): string =>
    `<g ${extra}><rect x="-300" y="-360" width="600" height="720" rx="24" fill="#FBF7F0"/><rect x="-300" y="-360" width="600" height="170" rx="24" fill="${C.coral}"/><rect x="-300" y="-220" width="600" height="30" fill="${C.coral}"/>
      ${label(0, -250, name, 56, C.cream, 900, "middle", 8)}${label(0, 150, String(n), 340, C.ink, 900, "middle", -10)}</g>`;
  const cur = from + idx;
  const next = Math.min(to, cur + 1);
  const falling = idx < span && flip > 0 && flip < 1;
  return {
    bg: C.night,
    svg: `<g transform="translate(540 980)">${page(falling ? next : cur)}${falling ? page(cur, `transform="translate(${fmt(flip * 260)} ${fmt(flip * flip * 900)}) rotate(${fmt(flip * 40)})" opacity="${fmt(1 - flip)}"`) : ""}
      <rect x="-240" y="-390" width="30" height="70" rx="12" fill="${C.ink}"/><rect x="210" y="-390" width="30" height="70" rx="12" fill="${C.ink}"/></g>`,
  };
};

const windowDream: Draw = ({ t, dur }) => {
  const z = K(t, [
    [0, 1],
    [dur, 1.45],
  ]);
  const sunY = K(t, [
    [0, 820],
    [dur, 700, "out"],
  ]);
  const world = `<rect width="${W}" height="${H}" fill="url(#sky_golden)"/>
    <circle cx="700" cy="${fmt(sunY)}" r="160" fill="#FFF1C9"/><circle cx="700" cy="${fmt(sunY)}" r="420" fill="url(#glow)" opacity=".6"/>
    <path d="M0 1100 Q270 960 540 1060 Q820 1150 1080 1000 L1080 1920 L0 1920Z" fill="#E59A6B"/>
    <path d="M0 1260 Q360 1120 700 1240 Q900 1300 1080 1220 L1080 1920 L0 1920Z" fill="#C9725A"/>
    <path d="M500 1920 L600 1250 L640 1250 L860 1920Z" fill="#F4D7A8"/>
    <path d="M${fmt(300 + t * 30)} 700 q16 -14 32 0 q16 -14 32 0" stroke="${C.slate}" stroke-width="6" fill="none" opacity="${fmt(ramp(t, 1, 1.8))}"/>`;
  const sh = K(t, [
    [0, 0],
    [dur, 1],
  ]);
  return {
    bg: C.sun,
    svg: `<g transform="translate(540 960) scale(${fmt(z)}) translate(-640 -900)">${world}</g>
      <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="${C.woodDark}" stroke-width="${fmt(
        K(t, [
          [0, 120],
          [dur, 30],
        ]),
      )}"/>
      <g transform="translate(${fmt(-260 * sh)} ${fmt(260 * sh)})"><path d="M-80 1920 Q-40 1500 200 1430 Q420 1380 520 1560 L560 1920Z" fill="#1A2238"/><ellipse cx="300" cy="1270" rx="190" ry="210" fill="#1A2238"/></g>`,
  };
};

const cards: Draw = ({ t, params }) => {
  const left = params["left"] as { title: string; lines: string[] };
  const right = params["right"] as { title: string; lines: string[] };
  const card = (x: number, d: { title: string; lines: string[] }, t0: number, accent: string): string => {
    const p = K(t, [
      [t0, 0],
      [t0 + 0.5, 1, "back"],
    ]);
    return `<g transform="translate(${x} ${fmt(980 + (1 - p) * 120)})" opacity="${fmt(clamp(p * 1.5))}"><rect x="-230" y="-380" width="460" height="760" rx="18" fill="#FBF7F0"/>
      ${label(0, -300, d.title.toUpperCase(), fit(d.title.toUpperCase(), 38, 400), accent, 900, "middle", 1)}
      ${Array.from({ length: 8 }, (_, i) => `<line x1="-190" y1="${-230 + i * 70}" x2="190" y2="${-230 + i * 70}" stroke="#D9CFBF" stroke-width="3"/>`).join("")}
      ${d.lines
        .map((l, i) => {
          const w = ramp(t, t0 + 0.7 + i * 0.5, t0 + 1.1 + i * 0.5, "out");
          return `<g opacity="${fmt(w)}">${label(-185, -245 + i * 70, l, fit(l, 34, 370, "light"), C.ink, 500, "start", 0)}</g>`;
        })
        .join("")}</g>`;
  };
  return { bg: C.night, svg: card(290, left, 0.2, C.teal) + card(790, right, 0.5, C.coral) };
};

export const TEMPLATES: Record<Template, Draw> = {
  statement,
  clock,
  scale,
  curves,
  bars,
  counter,
  word_shadow: wordShadow,
  time_strip: timeStrip,
  receipts,
  calendar,
  window_dream: windowDream,
  cards,
};

/** Unused key type kept for template authors who add keyed motion. */
export type TemplateKey = Key;
