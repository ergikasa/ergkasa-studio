/**
 * E1.6 subphase 4b: how the stager groups the narration into caption phrases (pauses, scenes, a maximum of words,
 * the band's width) and lifts kinetic type out of the band.
 */
import { captionPhraseWidth } from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { CAPTION_STYLE, MAX_WORDS, captionPhrases, type CaptionWord } from "../src/captions.js";

const ZONE = { top: 1450, bottom: 1720, maxWidth: 900 };
const words = (sceneId: string, from: number, text: string, gap = 0.3): CaptionWord[] =>
  text.split(" ").map((w, i) => ({ sceneId, word: w, start: from + i * gap, end: from + i * gap + 0.25 }));
const texts = (ph: ReturnType<typeof captionPhrases>): string[] =>
  ph.map((p) => p.words.map((w) => w.text).join(" "));

describe("caption phrases", () => {
  it("a new phrase at a new scene and after a pause longer than 0.45 s", () => {
    const ws = [
      ...words("s01", 0, "we stay"),
      ...words("s01", 2, "because leaving"),
      ...words("s02", 2.6, "feels"),
    ];
    expect(texts(captionPhrases(ws, ZONE, 10))).toEqual(["we stay", "because leaving", "feels"]);
  });

  it(`at most ${MAX_WORDS} words, and never wider than the band`, () => {
    const many = captionPhrases(words("s01", 0, "a b c d e f g h i j k l m n o"), ZONE, 10);
    expect(many.every((p) => p.words.length <= MAX_WORDS)).toBe(true);
    const wide = captionPhrases(
      words("s01", 0, "UNDERSTANDABLY EXTRAORDINARILY COUNTERPRODUCTIVE BEHAVIOUR"),
      ZONE,
      10,
    );
    for (const p of wide)
      expect(
        captionPhraseWidth(
          p.words.map((w) => w.text),
          CAPTION_STYLE.size,
          CAPTION_STYLE.weight,
          CAPTION_STYLE.stroke.width,
        ),
      ).toBeLessThanOrEqual(ZONE.maxWidth);
    expect(wide.length).toBeGreaterThan(1);
  });

  it("a word is current until the next one starts; phrases never overlap; times in whole ms inside the film", () => {
    const ph = captionPhrases(
      [...words("s01", 0.1234, "one two three"), ...words("s01", 1.6, "four")],
      ZONE,
      1.9,
    );
    const [a, b] = ph;
    expect(a?.words.map((w) => [w.t, w.end])).toEqual([
      [0.123, 0.423],
      [0.423, 0.723],
      [0.723, 0.973],
    ]);
    expect((a?.out ?? 0) <= (b?.in ?? 0)).toBe(true);
    expect(b?.out).toBeLessThanOrEqual(1.9);
  });

  it("refuses a single word wider than the band (it could never be drawn)", () => {
    expect(() => captionPhrases(words("s01", 0, "W".repeat(30)), ZONE, 10)).toThrow(/alone is wider/);
  });
});
