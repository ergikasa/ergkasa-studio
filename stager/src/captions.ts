/**
 * E1.6 subphase 4b: the captions of a v2 film, synced to the narration. The words and their times come from the
 * voice alignment (the film's timing, seconds from the film's start); the stager only groups them into phrases:
 *   - a new phrase at a new scene, after a pause longer than PAUSE_SEC, or when the next word would make the line
 *     wider than the caption band (contracts captionPhraseWidth, the Gate's own measure) or longer than MAX_WORDS;
 *   - a word is current from its start until the next word starts (the highlight never goes dark mid-phrase);
 *   - a phrase shows from just before its first word until shortly after its last, never over the next phrase.
 * The band and its width come from the engine's capabilities (captions.zone, E-D2). Type that would reach into the
 * band while a phrase shows is lifted above it (`liftKineticType`): captions own the bottom of the frame.
 */
import {
  captionPhraseWidth,
  kineticTypeExtent,
  type KineticLine,
  type RenderPackage,
} from "@erkasa/contracts";

type Overlay = Extract<RenderPackage["overlays"][number], { kind: "captions" }>;
type Scene = RenderPackage["scenes"][number];
type Cut = RenderPackage["edit"][number];

export const CAPTION_STYLE = {
  size: 60,
  weight: 800,
  color: "#FBF6EC",
  stroke: { color: "#0C1529", width: 10 },
  highlight: "#F4A261",
  /** Baseline, px from the top of the 1920 px frame. */
  baseline: 1600,
} as const;
export const PAUSE_SEC = 0.45;
export const MAX_WORDS = 7;
/** Kept between the band and lifted type, px. */
export const BAND_GAP = 12;

export interface Zone {
  top: number;
  bottom: number;
  maxWidth: number;
}

export interface CaptionWord {
  sceneId: string;
  word: string;
  /** Seconds from the film's start. */
  start: number;
  end: number;
}

/** The phrases of the narration, as the captions overlay holds them. */
export function captionPhrases(words: CaptionWord[], zone: Zone, filmSec: number): Overlay["phrases"] {
  const S = CAPTION_STYLE;
  const groups: CaptionWord[][] = [];
  let cur: CaptionWord[] = [];
  for (const w of words) {
    const text = w.word.trim();
    if (!text) continue;
    const prev = cur[cur.length - 1];
    const wider =
      captionPhraseWidth([...cur.map((x) => x.word.trim()), text], S.size, S.weight, S.stroke.width) >
      zone.maxWidth;
    if (
      prev &&
      (prev.sceneId !== w.sceneId || w.start - prev.end > PAUSE_SEC || cur.length >= MAX_WORDS || wider)
    ) {
      groups.push(cur);
      cur = [];
    }
    if (captionPhraseWidth([text], S.size, S.weight, S.stroke.width) > zone.maxWidth)
      throw new Error(`the word '${text}' alone is wider than the caption band`);
    cur.push({ ...w, word: text.slice(0, 64) });
  }
  if (cur.length) groups.push(cur);
  const ms = (x: number): number => Math.round(x * 1000) / 1000;
  return groups.map((g, i) => {
    const next = groups[i + 1]?.[0];
    const first = g[0] as CaptionWord;
    const last = g[g.length - 1] as CaptionWord;
    const tIn = ms(Math.max(0, first.start - 0.05));
    let tOut = ms(Math.min(filmSec, last.end + 0.25, next ? next.start - 0.06 : Infinity));
    if (tOut <= tIn) tOut = ms(Math.min(filmSec, tIn + 0.1));
    return {
      in: tIn,
      out: tOut,
      words: g.map((w, k) => {
        const t = ms(Math.max(tIn, w.start));
        const nx = g[k + 1];
        const end = ms(Math.min(tOut, Math.max(t + 0.04, nx ? nx.start : w.end)));
        return { text: w.word, t, end: end > t ? end : ms(t + 0.04) };
      }),
    };
  });
}

/** The captions overlay of a film, in the band's font, colours and place. */
export function captionsOverlay(font: string, phrases: Overlay["phrases"], frameHeight: number): Overlay {
  const S = CAPTION_STYLE;
  return {
    kind: "captions",
    id: "captions",
    style: { font, size: S.size, color: S.color, stroke: { ...S.stroke }, align: "center" },
    at: { x: 0.5, y: S.baseline / frameHeight },
    highlight: S.highlight,
    phrases,
  };
}

/**
 * Lifts every type.kinetic node that reaches into the caption band, in a scene shown while a phrase is, until its
 * lowest line ends BAND_GAP px above the band. Returns the scenes (changed copies) and what was moved.
 */
export function liftKineticType(
  scenes: Scene[],
  edit: Cut[],
  phrases: Overlay["phrases"],
  zone: Zone,
  isKinetic: (assetRef: string) => boolean,
): { scenes: Scene[]; lifted: string[] } {
  const lifted: string[] = [];
  const shown = (sceneId: string): boolean =>
    edit.some((c) => c.scene === sceneId && phrases.some((p) => c.start < p.out && p.in < c.end));
  const out = scenes.map((scene) => {
    if (!shown(scene.id)) return scene;
    const fix = <L extends { nodes: Scene["layers"][number]["nodes"] }>(layer: L): L => ({
      ...layer,
      nodes: layer.nodes.map((n) => {
        if (n.kind !== "asset" || !n.params || !Array.isArray(n.params["lines"]) || !isKinetic(n.asset))
          return n;
        const y = typeof n.params["y"] === "number" ? n.params["y"] : 260;
        const e = kineticTypeExtent(n.params["lines"] as unknown as KineticLine[], y);
        if (!(e.bottom > zone.top && e.top < zone.bottom)) return n;
        const dy = Math.ceil(e.bottom - (zone.top - BAND_GAP));
        lifted.push(`${scene.id}/${n.id}: y ${y} → ${y - dy}`);
        return { ...n, params: { ...n.params, y: y - dy } };
      }),
    });
    return {
      ...scene,
      layers: scene.layers.map(fix),
      ...(scene.screen ? { screen: scene.screen.map(fix) } : {}),
    };
  });
  return { scenes: out, lifted };
}
