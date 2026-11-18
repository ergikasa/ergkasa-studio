/**
 * E1.6 subphase 4b: the caption widths the stager and the Gate compute (contracts captionPhraseWidth, from the
 * generated Montserrat advance table) agree with Skia measuring the same text in the engine's own font files.
 */
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { captionPhraseWidth } from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { fontFiles } from "../../src/style.js";

const WEIGHTS = [300, 500, 800, 900];
fontFiles().forEach((f, i) => GlobalFonts.registerFromPath(f, `Mtest${WEIGHTS[i] as number}`));
const ctx = createCanvas(10, 10).getContext("2d");

const PHRASES = [
  "Why do we stay",
  "in jobs we hate?",
  "Because leaving feels like losing.",
  "Your brain hates losses",
  "twice as much as it loves gains",
  "WAIT. Read that again —",
  "It's 1% better, every single day…",
];

describe("caption metrics", () => {
  it.each(WEIGHTS.map((w) => [w]))(
    "weight %i: within 2% of Skia (kerning aside), never more than 1 px narrower",
    (w) => {
      for (const p of PHRASES) {
        const words = p.split(" ");
        ctx.font = `60px Mtest${w}`;
        const skia = ctx.measureText(words.map((x) => `${x} `).join("")).width;
        const ours = captionPhraseWidth(words, 60, w);
        expect(Math.abs(ours - skia) / skia, p).toBeLessThan(0.02);
        expect(ours, p).toBeGreaterThan(skia - 1);
      }
    },
  );
});
