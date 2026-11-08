/** Word timing for a scene, in seconds from the start of the scene's narration. */
export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

const normalize = (w: string): string => w.toLowerCase().replace(/[^a-z0-9']/g, "");

/**
 * Estimated timing when no voice exists yet (before the Voice worker runs): ~165 words per minute,
 * longer words take longer, sentence ends pause. Replaced by real ElevenLabs alignment in Phase E.
 */
export function estimateWords(narration: string, startSec = 0.3): TimedWord[] {
  const out: TimedWord[] = [];
  let t = startSec;
  for (const word of narration.split(/\s+/).filter(Boolean)) {
    const letters = word.replace(/[^A-Za-z0-9]/g, "").length;
    const d = Math.min(0.62, Math.max(0.16, 0.1 + 0.048 * letters));
    out.push({ word, start: round(t), end: round(t + d) });
    t += d + (/[.!?]$/.test(word) ? 0.32 : /[,;:]$/.test(word) ? 0.14 : 0.05);
  }
  return out;
}

/** Start time of the n-th occurrence of `target` in the narration (punctuation and case ignored). */
export function findWord(words: TimedWord[], target: string, occurrence = 1): TimedWord | undefined {
  const t = normalize(target);
  let seen = 0;
  for (const w of words) {
    if (normalize(w.word) === t && ++seen === occurrence) return w;
  }
  // allow a prefix match ("behavior" matches "behavioral") only if there is no exact match
  seen = 0;
  for (const w of words) {
    if (normalize(w.word).startsWith(t) && ++seen === occurrence) return w;
  }
  return undefined;
}

const round = (n: number): number => Math.round(n * 1000) / 1000;
