import { fmt } from "../core/svg-template.js";
import { TEXT_STYLES, textMarkup } from "./text.js";

export interface Word {
  word: string;
  start: number;
  end: number;
}

interface Chunk {
  words: Word[];
  start: number;
  end: number;
}

/**
 * Groups words into short chunks (TikTok style: 2-4 words on screen at a time).
 * A chunk never continues past the end of a sentence or across a pause longer than 0.5 s.
 */
export function chunkWords(words: Word[], perChunk: number): Chunk[] {
  const chunks: Chunk[] = [];
  let ws: Word[] = [];
  const flush = (): void => {
    if (!ws.length) return;
    chunks.push({ words: ws, start: (ws[0] as Word).start, end: (ws[ws.length - 1] as Word).end });
    ws = [];
  };
  words.forEach((w, i) => {
    ws.push(w);
    const next = words[i + 1];
    const sentenceEnd = /[.!?]["')]?$/.test(w.word);
    const pause = next !== undefined && next.start - w.end > 0.5;
    if (ws.length >= perChunk || sentenceEnd || pause) flush();
  });
  flush();
  // keep each chunk on screen until the next one starts (no flicker in short pauses)
  for (let i = 0; i < chunks.length - 1; i++) {
    const cur = chunks[i] as Chunk;
    const next = chunks[i + 1] as Chunk;
    if (next.start - cur.end < 0.6) cur.end = next.start;
  }
  return chunks;
}

export class CaptionTrack {
  private readonly chunks: Chunk[];
  private readonly words: Word[];

  constructor(
    words: Word[],
    perChunk: number,
    private readonly style: string,
  ) {
    this.words = [...words].sort((a, b) => a.start - b.start);
    this.chunks = chunkWords(this.words, perChunk);
    if (!TEXT_STYLES[style] && !TEXT_STYLES[`caption_${style}`])
      throw new Error(`unknown caption style '${style}'`);
  }

  /** The word being spoken at `sec`, with progress, for lip-sync. */
  speechAt(sec: number): { word: string; progress: number } | undefined {
    for (const w of this.words) {
      if (sec >= w.start && sec < w.end)
        return { word: w.word, progress: (sec - w.start) / (w.end - w.start) };
      if (w.start > sec) break;
    }
    return undefined;
  }

  render(sec: number, width: number, height: number): string {
    const chunk = this.chunks.find((c) => sec >= c.start && sec < c.end);
    if (!chunk) return "";
    const style = TEXT_STYLES[`caption_${this.style}`] ?? TEXT_STYLES[this.style];
    if (!style) return "";
    const active = chunk.words.findIndex((w) => sec >= w.start && sec < w.end);
    // pop-in when the chunk appears
    const age = sec - chunk.start;
    const k = Math.min(1, age / 0.12);
    const scale = 0.85 + 0.15 * (1 - Math.pow(1 - k, 3)) + (k >= 1 ? 0 : 0.04 * Math.sin(k * Math.PI));
    const markup = textMarkup(chunk.words.map((w) => w.word).join(" "), style, {
      maxWidth: width * 0.84,
      ...(active >= 0 ? { activeWord: active } : {}),
    });
    // TikTok safe zone: centered horizontally, above the bottom UI band (~68% of height)
    return `<g data-node="captions" transform="translate(${fmt(width / 2)} ${fmt(height * 0.68)}) scale(${fmt(scale)})">${markup}</g>`;
  }
}
