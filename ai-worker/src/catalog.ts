import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GENERIC_RECIPES, IDLE_MOTIONS, PARTICLE_PRESETS } from "@erkasa/compiler";
import { CameraMove, Transition, type AssetMeta } from "@erkasa/contracts";
import { CHART_KINDS, TEXT_STYLES } from "@erkasa/engine";
import { FsAssetSource } from "@erkasa/engine-worker";

interface ManifestEntry {
  assetId: string;
  category: string;
  kind: string;
}

export interface CharacterInfo {
  id: string;
  name: string;
  description: string;
  gender: "male" | "female" | "unknown";
  front: string[];
  side: string[];
  expressions: string[];
}

export interface AssetInfo {
  id: string;
  name: string;
  category: string;
  tags: string[];
  /** Metaphors: named animations (recipes); objects/icons: generic animations. */
  animations: string[];
  extra?: string;
}

/**
 * Everything the planner may use, read from the asset library itself. The planner prompt is built
 * from this, so the model only ever sees ids, actions and animations that exist.
 */
export class Catalog {
  readonly characters: CharacterInfo[] = [];
  readonly backgrounds: AssetInfo[] = [];
  readonly metaphors: AssetInfo[] = [];
  readonly props: AssetInfo[] = [];
  readonly source: FsAssetSource;

  constructor(readonly assetsDir: string) {
    this.source = new FsAssetSource(assetsDir);
    const manifest = JSON.parse(readFileSync(join(assetsDir, "manifest.json"), "utf8")) as {
      assets: ManifestEntry[];
    };
    for (const e of manifest.assets) {
      const m = this.source.meta(e.assetId);
      if (m.kind === "rigged_character") this.characters.push(character(m));
      else if (m.category === "background")
        this.backgrounds.push(info(m, `mood: ${(m.mood ?? []).join(", ")}`));
      else if (m.category === "metaphor")
        this.metaphors.push(
          info(
            m,
            Object.entries(m.parts ?? {})
              .filter(([k]) => k !== "backdrop")
              .map(([k, v]) => `${k}=${v}`)
              .join("; "),
          ),
        );
      else if (m.category === "object" || m.category === "icon") this.props.push(info(m));
    }
  }

  get textStyles(): string[] {
    return Object.keys(TEXT_STYLES).filter((s) => !s.startsWith("caption"));
  }

  /**
   * Objects and icons ranked by overlap with the given text (script narration + visual ideas).
   * Same idea as the backend's /api/assets/candidates: tag match counts most, id/name substring less.
   */
  relevantProps(text: string, limit = 60): AssetInfo[] {
    const words = new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3),
    );
    const stems = [...words].map((w) => w.replace(/(ing|ed|es|s)$/, "")).filter((w) => w.length >= 3);
    const scored = this.props.map((p) => {
      let score = 0;
      for (const t of p.tags) {
        const tl = t.toLowerCase();
        if (words.has(tl)) score += 3;
        else if (stems.some((s) => tl.startsWith(s))) score += 1;
      }
      const hay = `${p.id} ${p.name}`.toLowerCase();
      for (const s of stems) if (hay.includes(s)) score += 1;
      return { p, score };
    });
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id))
      .slice(0, limit)
      .map((s) => s.p);
  }

  /** Short list for the script writer: what kinds of pictures the studio can draw. */
  vocabulary(): string {
    return [
      `Characters: ${this.characters.map((c) => `${c.name} (${c.description})`).join("; ")}.`,
      `Character actions: ${[...new Set(this.characters.flatMap((c) => [...c.front, ...c.side]))].join(", ")}.`,
      `Places: ${this.backgrounds.map((b) => b.tags.join("/")).join("; ")}.`,
      `Visual metaphors: ${this.metaphors.map((m) => `${m.id.replace(/^met_|_\d+$/g, "")} (${m.tags.join(", ")})`).join("; ")}.`,
      `Charts: ${CHART_KINDS.join(", ")}. Big bold text overlays. About ${this.props.length} simple objects and icons.`,
    ].join("\n");
  }

  /** The full catalog section of the planner prompt. */
  plannerSection(scriptText: string): string {
    const props = this.relevantProps(scriptText);
    const lines: string[] = [];
    lines.push(
      "## Characters (type actor). Use `front` actions when facing front, `side` actions when facing left/right.",
    );
    for (const c of this.characters)
      lines.push(
        `- ${c.id}: ${c.name} (${c.gender}), ${c.description} | front: ${c.front.join(", ")} | side: ${c.side.join(", ")} | expressions: ${c.expressions.join(", ")}`,
      );
    lines.push("\n## Backgrounds (scene.background)");
    for (const b of this.backgrounds) lines.push(`- ${b.id}: ${b.tags.join(", ")}; ${b.extra}`);
    lines.push("\n## Metaphors (type metaphor). Animation names are exact; play them with `animations`.");
    for (const m of this.metaphors)
      lines.push(
        `- ${m.id}: ${m.tags.join(", ")} | animations: ${m.animations.join(", ")}${m.extra ? ` | parts: ${m.extra}` : ""}`,
      );
    lines.push(
      `\n## Objects and icons (type object or icon) relevant to this script (${props.length} of ${this.props.length}). Animations: ${Object.keys(GENERIC_RECIPES).join(", ")}, ${IDLE_MOTIONS.join(", ")}.`,
    );
    for (const p of props) lines.push(`- ${p.id} (${p.category}): ${p.tags.join(", ")}`);
    lines.push(`\n## Text styles: ${this.textStyles.join(", ")}`);
    lines.push(`## Chart kinds: ${CHART_KINDS.join(", ")}`);
    lines.push(`## Camera moves: ${CameraMove.shape.move.options.join(", ")}`);
    lines.push(`## Transitions: ${Transition.shape.type.options.join(", ")}`);
    lines.push(`## Particle effects: ${PARTICLE_PRESETS.join(", ")}`);
    return lines.join("\n");
  }
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function character(m: AssetMeta): CharacterInfo {
  const caps = m.capabilities;
  const actions = (caps["actions"] ?? {}) as Record<string, unknown>;
  return {
    id: m.assetId,
    name: m.name,
    description: m.description ?? "",
    gender: m.tags.includes("female") ? "female" : m.tags.includes("male") ? "male" : "unknown",
    front: strings(actions["front"]),
    side: strings(actions["side"]),
    expressions: strings(caps["expressions"]),
  };
}

function info(m: AssetMeta, extra?: string): AssetInfo {
  return {
    id: m.assetId,
    name: m.name,
    category: m.category,
    tags: m.tags,
    animations: strings(m.capabilities["animations"]),
    ...(extra ? { extra } : {}),
  };
}
