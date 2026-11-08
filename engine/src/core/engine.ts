import { RenderTimeline, type RenderTimeline as Timeline } from "@erkasa/contracts";
import { prepareBackground, type PreparedBackground } from "../adapters/background.js";
import { CaptionTrack, type Word } from "../adapters/captions.js";
import { renderChart } from "../adapters/charts.js";
import { prepareCharacter, renderCharacter, type PreparedCharacter } from "../adapters/character.js";
import { renderParticles } from "../adapters/particles.js";
import { prepareSvgAsset, renderSvgAsset, type PreparedSvgAsset } from "../adapters/svg-asset.js";
import { renderText } from "../adapters/text.js";
import { resolveAsset, type AssetSource } from "./assets.js";
import { layerTransform, sampleCamera, type Viewport } from "./camera.js";
import { easeFn } from "./easing.js";
import { OPACITY_GUARD, fmt } from "./svg-template.js";

type Scene = Timeline["scenes"][number];
type TimelineNode = Scene["nodes"][number];

export interface EngineOptions {
  assets: AssetSource;
  /** Caption words resolved by the caller when the timeline references a captions file. */
  captionWords?: Word[];
}

/**
 * The 2D engine. `renderFrame(n)` is a pure function of the timeline, the assets and n:
 * no clock, no randomness outside the timeline seed, no state carried between frames.
 */
export class Engine {
  readonly timeline: Timeline;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly totalFrames: number;
  private readonly backgrounds = new Map<string, PreparedBackground>();
  private readonly characters = new Map<string, PreparedCharacter>();
  private readonly svgAssets = new Map<string, PreparedSvgAsset>();
  private readonly captions: CaptionTrack | undefined;

  constructor(timeline: unknown, opts: EngineOptions) {
    this.timeline = RenderTimeline.parse(timeline);
    this.width = this.timeline.width;
    this.height = this.timeline.height;
    this.fps = this.timeline.fps;
    this.totalFrames = Math.max(...this.timeline.scenes.map((s) => s.from + s.duration));
    const { assets } = opts;

    for (const scene of this.timeline.scenes) {
      const bgRef = scene.background.asset;
      if (!this.backgrounds.has(bgRef)) {
        const meta = resolveAsset(assets, bgRef);
        this.backgrounds.set(
          bgRef,
          prepareBackground(meta, assets.text(meta.assetId, meta.files["svg"] ?? "asset.svg")),
        );
      }
      for (const node of scene.nodes) this.prepareNode(node, assets);
    }

    const c = this.timeline.captions;
    if (c) {
      const words = c.words ?? opts.captionWords;
      if (!words) throw new Error("timeline captions reference a file: pass captionWords to the engine");
      this.captions = new CaptionTrack(words, c.wordsPerChunk, c.style);
    }
  }

  private prepareNode(node: TimelineNode, assets: AssetSource): void {
    if (!node.asset) {
      if (node.adapter === "character" || node.adapter === "svg")
        throw new Error(`node ${node.id}: ${node.adapter} needs an asset`);
      return;
    }
    const meta = resolveAsset(assets, node.asset);
    const svg = (): string => assets.text(meta.assetId, meta.files["svg"] ?? "asset.svg");
    if (node.adapter === "character" && !this.characters.has(node.asset)) {
      const rigFile = meta.files["rig"];
      if (!rigFile) throw new Error(`${meta.assetId}: character without rig`);
      const sideSvg = meta.files["svg_side"];
      const sideRig = meta.files["rig_side"];
      const side =
        sideSvg && sideRig
          ? { svg: assets.text(meta.assetId, sideSvg), rig: assets.text(meta.assetId, sideRig) }
          : undefined;
      this.characters.set(
        node.asset,
        prepareCharacter(meta, svg(), assets.text(meta.assetId, rigFile), side),
      );
    } else if (node.adapter === "svg" && !this.svgAssets.has(node.asset)) {
      this.svgAssets.set(node.asset, prepareSvgAsset(meta, svg()));
    } else if (node.adapter === "sprite") {
      throw new Error(`node ${node.id}: adapter 'sprite' (Lottie/sprite sheets) is not implemented yet`);
    }
  }

  /** Full SVG document for global frame `frame`. */
  renderFrame(frame: number): string {
    const defs = new Set<string>();
    const scenes = this.timeline.scenes;
    let curIdx = 0;
    for (let i = 0; i < scenes.length; i++) if ((scenes[i] as Scene).from <= frame) curIdx = i;
    const cur = scenes[curIdx] as Scene;
    const prev = curIdx > 0 ? (scenes[curIdx - 1] as Scene) : undefined;

    let content: string;
    const tf = cur.transitionIn.frames;
    if (prev && tf > 0 && frame < cur.from + tf) {
      const p = easeFn("easeInOutCubic")((frame - cur.from) / tf);
      const a = this.renderScene(prev, frame - prev.from, defs);
      const b = this.renderScene(cur, frame - cur.from, defs);
      content = this.transition(cur.transitionIn.type, cur.transitionIn.direction, p, a, b, defs);
    } else {
      content = this.renderScene(cur, frame - cur.from, defs);
    }

    const captions = this.captions?.render(frame / this.fps, this.width, this.height) ?? "";
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">` +
      `<defs>${[...defs].join("")}</defs><rect width="${this.width}" height="${this.height}" fill="#000"/>` +
      content +
      captions +
      `</svg>`
    );
  }

  private renderScene(scene: Scene, local: number, defs: Set<string>): string {
    const bg = this.backgrounds.get(scene.background.asset) as PreparedBackground;
    if (bg.defs) defs.add(bg.defs);
    const vp: Viewport = {
      width: this.width,
      height: this.height,
      worldWidth: bg.width,
      worldHeight: bg.height,
    };
    const cam = sampleCamera(scene.camera, local, vp);
    const seed = this.timeline.seed;
    const globalSec = (scene.from + local) / this.fps;
    const speechWord = this.captions?.speechAt(globalSec);

    const nodes = [...scene.nodes].sort((a, b) => a.z - b.z);
    const draw = (n: TimelineNode): string => {
      switch (n.adapter) {
        case "character": {
          const c = this.characters.get(n.asset as string) as PreparedCharacter;
          return renderCharacter(c, n.id, n.tracks, n.props, {
            frame: local,
            fps: this.fps,
            seed,
            ...(speechWord ? { speech: speechWord } : {}),
          });
        }
        case "svg": {
          const a = this.svgAssets.get(n.asset as string) as PreparedSvgAsset;
          if (a.template.defs) defs.add(a.template.defs);
          return renderSvgAsset(a, n.id, n.tracks, n.props, local, this.fps, seed);
        }
        case "text":
          return renderText(n.id, n.tracks, n.props, local);
        case "particle":
          return renderParticles(n.id, n.tracks, n.props, local, this.fps, seed);
        case "motion_graphics":
          return renderChart(n.id, n.tracks, n.props, local);
        default:
          return "";
      }
    };

    const world = nodes
      .filter((n) => n.space === "world")
      .map(draw)
      .join("");
    const screen = nodes
      .filter((n) => n.space === "screen")
      .map(draw)
      .join("");
    const layer = (depth: number, markup: string): string =>
      `<g transform="${layerTransform(cam, depth, vp, local, seed)}">${markup}</g>`;

    let out = "";
    for (const l of bg.layers) if (l.depth >= 0) out += layer(l.depth, l.markup);
    out += layer(0, world);
    for (const l of bg.layers) if (l.depth < 0) out += layer(l.depth, l.markup);
    return out + screen;
  }

  private transition(
    type: string,
    direction: string | undefined,
    p: number,
    a: string,
    b: string,
    defs: Set<string>,
  ): string {
    const W = this.width;
    const H = this.height;
    const dir = direction ?? "left";
    switch (type) {
      case "fade":
        return `${a}<g opacity="${fmt(p)}">${OPACITY_GUARD}${b}</g>`;
      case "wipe": {
        const r =
          dir === "left"
            ? [W * (1 - p), 0, W * p, H]
            : dir === "right"
              ? [0, 0, W * p, H]
              : dir === "up"
                ? [0, H * (1 - p), W, H * p]
                : [0, 0, W, H * p];
        defs.add(
          `<clipPath id="erk_wipe"><rect x="${fmt(r[0] ?? 0)}" y="${fmt(r[1] ?? 0)}" width="${fmt(r[2] ?? 0)}" height="${fmt(r[3] ?? 0)}"/></clipPath>`,
        );
        return `${a}<g clip-path="url(#erk_wipe)">${b}</g>`;
      }
      case "slide":
      case "whip": {
        const sign = dir === "right" || dir === "down" ? 1 : -1;
        const horiz = dir === "left" || dir === "right";
        const d = (horiz ? W : H) * sign;
        const ta = horiz ? `translate(${fmt(d * p)} 0)` : `translate(0 ${fmt(d * p)})`;
        const tb = horiz ? `translate(${fmt(-d * (1 - p))} 0)` : `translate(0 ${fmt(-d * (1 - p))})`;
        return `<g transform="${ta}">${a}</g><g transform="${tb}">${b}</g>`;
      }
      case "zoom": {
        const s = 1.25 - 0.25 * p;
        return `${a}<g opacity="${fmt(p)}" transform="translate(${W / 2} ${H / 2}) scale(${fmt(s)}) translate(${-W / 2} ${-H / 2})">${OPACITY_GUARD}${b}</g>`;
      }
      default:
        return b;
    }
  }
}
