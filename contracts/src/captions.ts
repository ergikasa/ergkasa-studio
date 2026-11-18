/**
 * E1.6 subphase 4b: measuring captions and kinetic type the way the engine draws them, shared by the stager (it
 * breaks the narration into phrases that fit) and the Validation Gate (it checks that they do and that captions
 * never meet kinetic type): both measure with the same code, like camera-view.
 */
import { MONTSERRAT_ADVANCE } from "./font-metrics.js";

/** Width in px of `text` in Montserrat at `size` px (no kerning: never narrower than drawn). */
export function textWidth(text: string, size: number, weight: number): number {
  const table = MONTSERRAT_ADVANCE[weight];
  if (!table) throw new Error(`no Montserrat metrics for weight ${weight}`);
  const wide = table["W"] as number;
  let units = 0;
  for (const ch of text) units += table[ch] ?? wide;
  return (units * size) / 1000;
}

/**
 * Width in px of a caption phrase as the engine draws it (w0/compositor.ts captionSvg): every word followed by a
 * space, in one centred line, with its stroke (half of it on each side).
 */
export function captionPhraseWidth(words: string[], size: number, weight: number, strokeWidth = 0): number {
  return words.reduce((n, w) => n + textWidth(`${w} `, size, weight), 0) + strokeWidth;
}

/** One line of the type.kinetic builtin, as its params give it. */
export interface KineticLine {
  t: string;
  weight?: "light" | "bold";
  accent?: boolean;
  size?: number;
}

/**
 * The vertical extent in px of a type.kinetic node (film/src/style.ts kineticType): each line drawn inside its clip
 * rectangle from baseline − size to baseline + 0.28 × size, lines 0.98 × size + 0.16 × size apart; sizes as given
 * or the defaults (bold 112, light 66), never the shrunk size (the extent is an upper bound).
 */
export function kineticTypeExtent(lines: KineticLine[], y = 260): { top: number; bottom: number } {
  let yy = y;
  let top = Infinity;
  let bottom = -Infinity;
  lines.forEach((ln, i) => {
    const weight = ln.weight ?? (ln.accent ? "bold" : "light");
    const sz = ln.size ?? (weight === "bold" ? 112 : 66);
    if (i > 0) yy += sz * 0.98;
    top = Math.min(top, yy - sz);
    bottom = Math.max(bottom, yy + sz * 0.28);
    yy += sz * 0.16;
  });
  return { top, bottom };
}
