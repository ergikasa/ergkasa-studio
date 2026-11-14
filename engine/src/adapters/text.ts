import { OPACITY_GUARD, fmt } from "../core/svg-template.js";
import { sampleNumber, type Tracks } from "../core/tracks.js";

/**
 * Animated text. Fonts are bundled by the render worker (Montserrat, OFL), never system fonts,
 * so a frame renders the same everywhere.
 */
export interface TextStyle {
  family: string;
  weight: number;
  size: number;
  fill: string;
  highlight: string;
  stroke?: { color: string; width: number };
  uppercase: boolean;
  lineHeight: number;
  /** Average glyph advance as a fraction of the font size, for line wrapping. */
  advance: number;
  shadow?: boolean;
}

export const TEXT_STYLES: Record<string, TextStyle> = {
  hook_impact: {
    family: "Montserrat",
    weight: 900,
    size: 112,
    fill: "#FFFFFF",
    highlight: "#FFD23F",
    stroke: { color: "#14110F", width: 16 },
    uppercase: true,
    lineHeight: 1.08,
    advance: 0.68,
    shadow: true,
  },
  title_clean: {
    family: "Montserrat",
    weight: 800,
    size: 84,
    fill: "#2A1E18",
    highlight: "#E8833A",
    uppercase: false,
    lineHeight: 1.12,
    advance: 0.6,
  },
  title_light: {
    family: "Montserrat",
    weight: 800,
    size: 84,
    fill: "#FFFFFF",
    highlight: "#FFD23F",
    stroke: { color: "#14110F", width: 10 },
    uppercase: false,
    lineHeight: 1.12,
    advance: 0.6,
  },
  label: {
    family: "Montserrat",
    weight: 700,
    size: 52,
    fill: "#2A1E18",
    highlight: "#2F8F8A",
    uppercase: false,
    lineHeight: 1.2,
    advance: 0.58,
  },
  /** A sign standing in the world next to an object: bold, outlined, readable at any zoom. */
  world_label: {
    family: "Montserrat",
    weight: 900,
    size: 64,
    fill: "#FFFFFF",
    highlight: "#FFD23F",
    stroke: { color: "#14110F", width: 12 },
    uppercase: true,
    lineHeight: 1.08,
    advance: 0.68,
    shadow: true,
  },
  caption_word_pop: {
    family: "Montserrat",
    weight: 900,
    size: 76,
    fill: "#FFFFFF",
    highlight: "#FFD23F",
    stroke: { color: "#14110F", width: 13 },
    uppercase: true,
    lineHeight: 1.1,
    advance: 0.66,
    shadow: true,
  },
};

export const escapeXml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function wrapWords(words: string[], style: TextStyle, maxWidth: number): string[][] {
  const lines: string[][] = [];
  let line: string[] = [];
  let width = 0;
  const space = style.size * style.advance * 0.5;
  for (const w of words) {
    const ww = w.length * style.size * style.advance;
    if (line.length && width + space + ww > maxWidth) {
      lines.push(line);
      line = [];
      width = 0;
    }
    width += (line.length ? space : 0) + ww;
    line.push(w);
  }
  if (line.length) lines.push(line);
  return lines;
}

/** Renders centered multi-line text; words in `highlight` (or the `active` index) get the accent color. */
export function textMarkup(
  content: string,
  style: TextStyle,
  opts: { maxWidth: number; highlight?: string[]; activeWord?: number; reveal?: number },
): string {
  const raw = content.split(/\s+/).filter(Boolean);
  const words = style.uppercase ? raw.map((w) => w.toUpperCase()) : raw;
  const hl = new Set((opts.highlight ?? []).map((h) => h.toUpperCase().replace(/[^A-Z0-9']/g, "")));
  const lines = wrapWords(words, style, opts.maxWidth);
  const lh = style.size * style.lineHeight;
  const top = -((lines.length - 1) * lh) / 2 + style.size * 0.36;
  let index = 0;
  let shown = opts.reveal ?? Number.POSITIVE_INFINITY;
  const tspans: string[] = [];
  lines.forEach((line, li) => {
    const parts: string[] = [];
    for (const w of line) {
      const isHl = hl.has(w.toUpperCase().replace(/[^A-Z0-9']/g, "")) || opts.activeWord === index;
      let text = w;
      if (shown < text.length) text = text.slice(0, Math.max(0, Math.floor(shown)));
      shown -= w.length + 1;
      index++;
      if (!text) continue;
      parts.push(isHl ? `<tspan fill="${style.highlight}">${escapeXml(text)}</tspan>` : escapeXml(text));
    }
    tspans.push(`<tspan x="0" y="${fmt(top + li * lh)}">${parts.join(" ")}</tspan>`);
  });
  const font = `font-family="${style.family}" font-weight="${style.weight}" font-size="${style.size}" text-anchor="middle"`;
  const body = tspans.join("");
  const stroke = style.stroke
    ? `<text ${font} fill="${style.stroke.color}" stroke="${style.stroke.color}" stroke-width="${style.stroke.width}" stroke-linejoin="round">${body}</text>`
    : "";
  const shadow = style.shadow
    ? `<text ${font} fill="#000000" fill-opacity="0.28" stroke="#000000" stroke-opacity="0.28" stroke-width="${(style.stroke?.width ?? 0) + 4}" stroke-linejoin="round" transform="translate(0 10)">${body}</text>`
    : "";
  return `${shadow}${stroke}<text ${font} fill="${style.fill}">${body}</text>`;
}

/** Text node: props.content, props.style, props.highlight, props.maxWidth. Tracks: x, y, scale, rotation, opacity, reveal. */
export function renderText(
  nodeId: string,
  tracks: Tracks,
  props: Record<string, unknown>,
  frame: number,
): string {
  const styleName = typeof props["style"] === "string" ? props["style"] : "title_clean";
  const style = TEXT_STYLES[styleName];
  if (!style) throw new Error(`text ${nodeId}: unknown style '${styleName}'`);
  const content = typeof props["content"] === "string" ? props["content"] : "";
  const opacity = sampleNumber(tracks["opacity"], frame, 1);
  const scale = sampleNumber(tracks["scale"], frame, 1);
  if (!content || opacity <= 0.001 || scale <= 0.0001) return "";
  const x = sampleNumber(tracks["x"], frame, 540);
  const y = sampleNumber(tracks["y"], frame, 400);
  const rotation = sampleNumber(tracks["rotation"], frame, 0);
  const reveal = tracks["reveal"] ? sampleNumber(tracks["reveal"], frame, 0) : undefined;
  const highlight = Array.isArray(props["highlight"]) ? props["highlight"].map(String) : [];
  const maxWidth = typeof props["maxWidth"] === "number" ? props["maxWidth"] : 900;
  const markup = textMarkup(content, style, {
    maxWidth,
    highlight,
    ...(reveal !== undefined ? { reveal } : {}),
  });
  const op = opacity < 1 ? ` opacity="${fmt(opacity)}"` : "";
  return `<g data-node="${nodeId}"${op} transform="translate(${fmt(x)} ${fmt(y)}) rotate(${fmt(rotation)}) scale(${fmt(scale)})">${op ? OPACITY_GUARD : ""}${markup}</g>`;
}
