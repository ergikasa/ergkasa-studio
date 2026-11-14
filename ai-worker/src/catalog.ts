import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GENERIC_RECIPES, IDLE_MOTIONS, PARTICLE_PRESETS, describeSets } from "@erkasa/compiler";
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
  tags: string[];
  items: string[];
  front: string[];
  side: string[];
  expressions: string[];
  outfits: string[];
  /** World characters: the script cast member (library id) this character plays. */
  plays?: string;
}

export interface AssetInfo {
  id: string;
  name: string;
  category: string;
  tags: string[];
  /** Metaphors: named animations (recipes); objects/icons: generic animations. */
  animations: string[];
  extra?: string;
  /** English description + story use, when the asset has them: searched, not printed in full. */
  about?: string;
  /** The asset's story use alone (in a world: the object's job in this story). */
  use?: string;
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
  /** Screen overlay effects (vignette, film grain...), used in a scene's `effects`. */
  readonly overlays: AssetInfo[] = [];
  readonly source: FsAssetSource;

  /** Asset roots, searched in order: a video's world first (when it has one), then the library. */
  readonly roots: string[];
  /** The library folder (the last root). */
  readonly assetsDir: string;
  /** Set when the catalog is a video's own world: the planner then sees only the world's assets. */
  readonly world?: { id: string; style: string };

  constructor(roots: string | string[]) {
    this.roots = Array.isArray(roots) ? roots : [roots];
    this.assetsDir = this.roots[this.roots.length - 1] as string;
    this.source = new FsAssetSource(this.roots);
    const read = (dir: string) =>
      JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as {
        world?: string;
        style?: string;
        assets: ManifestEntry[];
      };
    const first = read(this.roots[0] as string);
    let entries: ManifestEntry[];
    if (this.roots.length > 1 && first.world) {
      this.world = { id: first.world, style: first.style ?? "" };
      // a world is one picture: its own cast, places and objects; from the library only the screen textures
      const library = read(this.assetsDir).assets.filter((e) => e.category === "effect");
      entries = [...first.assets, ...library];
    } else entries = this.roots.flatMap((r) => read(r).assets);
    const seen = new Set<string>();
    for (const e of entries) {
      if (seen.has(e.assetId)) continue;
      seen.add(e.assetId);
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
      // a world's copies of a set's furniture are placed by the set, not by the planner
      else if (m.category === "object" || m.category === "icon") {
        if (!e.assetId.startsWith("wld_set_")) this.props.push(info(m));
      } else if (m.category === "effect") {
        if (m.capabilities["placement"] === "screen") this.overlays.push(info(m));
        else if (!this.world) this.props.push(info(m)); // fire, smoke, sparks...: placed like objects
      }
    }
  }

  /** Set id -> the world background that holds a copy of that set. */
  worldSets(): Record<string, string> {
    const out: Record<string, string> = {};
    if (!this.world) return out;
    for (const b of this.backgrounds) {
      const set = this.source.meta(b.id).capabilities["set"];
      if (typeof set === "string") out[set] = b.id;
    }
    return out;
  }

  get textStyles(): string[] {
    return Object.keys(TEXT_STYLES).filter((s) => !s.startsWith("caption"));
  }

  /**
   * Objects and icons ranked by overlap with the given text (script narration + visual ideas).
   * Same idea as the backend's /api/assets/candidates: tag match counts most, id/name substring less.
   */
  relevantProps(text: string, limit = 60): AssetInfo[] {
    // a world holds only what its story needs: all of it is relevant
    if (this.world) return this.props.slice(0, limit);
    const words = new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w)),
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
      // the description and story use help, but never outweigh a tag: long prose would match everything
      const about = (p.about ?? "").toLowerCase();
      score += Math.min(2, stems.filter((s) => about.includes(s)).length);
      // same concept drawn in the house style and as an emoji: prefer the house style
      if (score > 0 && p.id.startsWith("prop_")) score += 0.5;
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
      `Characters: ${this.characters.map((c) => `${c.id} = ${c.name} (${c.tags.join(", ")}${c.outfits.length > 1 ? `; outfits ${c.outfits.join("/")}` : ""})`).join("; ")}.`,
      `Staged sets where people walk in, sit, talk across a desk and hand things over: ${describeSets().split("\n")[0] ?? ""}`,
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
    if (this.world)
      lines.push(
        `## This video has its own world ("${this.world.id}", style ${this.world.style}). Every character, place and object below was made for this story and drawn in one style: use only these ids. A world has few places on purpose: return to them with a different shot, a different moment of the action and different positions, never the same picture twice. Objects are tools, not decoration: use one only in the scenes and for the job written next to it; a scene may have no object at all.\n`,
      );
    lines.push(
      "## Characters (type actor). Use `front` actions when facing front, `side` actions when facing left/right.",
    );
    // the actions are shared by (almost) every character: listed once, then only the differences
    const shared = (pick: (c: CharacterInfo) => string[]): string[] =>
      (pick(this.characters[0] as CharacterInfo) ?? []).filter((a) =>
        this.characters.every((c) => pick(c).includes(a)),
      );
    const front = shared((c) => c.front);
    const side = shared((c) => c.side);
    const expressions = shared((c) => c.expressions);
    lines.push(
      `All characters: front: ${front.join(", ")} | side: ${side.join(", ")} | expressions: ${expressions.join(", ")}`,
    );
    for (const c of this.characters) {
      const extra = [
        ...c.front.filter((a) => !front.includes(a)).map((a) => `front ${a}`),
        ...c.side.filter((a) => !side.includes(a)).map((a) => `side ${a}`),
        ...c.expressions.filter((e) => !expressions.includes(e)).map((e) => `expression ${e}`),
      ];
      lines.push(
        `- ${c.id}: ${c.name} (${c.tags.join(", ")}) | can hold: ${c.items.join(", ") || "nothing"}${c.outfits.length > 1 ? ` | outfits: ${c.outfits.join(", ")}` : ""}${extra.length ? ` | also: ${extra.join(", ")}` : ""}`,
      );
    }
    // staged sets are built on library backgrounds: not part of a world (scene.set stays "none")
    const worldSets = this.worldSets();
    if (!this.world || Object.keys(worldSets).length) {
      lines.push(
        "\n## Staged sets (scene.set). Actors on a set use `blocking` (marks below) instead of x and walk actions. Use a set whenever people meet, enter, sit, talk across a desk or hand something over: that is how a situation is shown, not told.",
      );
      lines.push(this.world ? describeSets(worldSets) : describeSets());
      lines.push("Scene props (in the object list below) can attachTo an actor on a set.");
    } else lines.push('\nStaged sets: none in this world (scene.set = "none").');
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
    for (const p of props)
      lines.push(
        `- ${p.id} (${p.category}): ${p.tags.slice(0, 8).join(", ")}${this.world && p.use ? ` | job in this story: ${p.use}` : ""}`,
      );
    lines.push(`\n## Text styles: ${this.textStyles.join(", ")}`);
    lines.push(`## Chart kinds: ${CHART_KINDS.join(", ")}`);
    lines.push(`## Camera moves: ${CameraMove.shape.move.options.join(", ")}`);
    lines.push(`## Transitions: ${Transition.shape.type.options.join(", ")}`);
    lines.push(`## Particle effects: ${PARTICLE_PRESETS.join(", ")}`);
    if (this.overlays.length)
      lines.push(
        `## Screen overlays (scene effects, preset = id; intensity = strength, keep 0.2-0.5 for textures): ${this.overlays
          .map((o) => `${o.id} (${o.tags.slice(0, 4).join(", ")})`)
          .join("; ")}`,
      );
    return lines.join("\n");
  }
}

/** Words that say nothing about a picture; as stems they would match half the library ("and" in "hand"). */
const STOP_WORDS = new Set(
  "and the for with you your are was were our that this these those from into not but its they them their has have had what when why how who all can will just than then there here about over more most very much".split(
    " ",
  ),
);

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
    tags: m.tags,
    items: strings(caps["items"]),
    front: strings(actions["front"]),
    side: strings(actions["side"]),
    expressions: strings(caps["expressions"]),
    outfits: strings((caps["outfits"] as { available?: unknown } | undefined)?.available),
    ...(m.tags.find((t) => t.startsWith("plays:"))
      ? { plays: (m.tags.find((t) => t.startsWith("plays:")) as string).slice(6) }
      : {}),
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
    ...(m.description || m.storyUse ? { about: [m.description, m.storyUse].filter(Boolean).join(" ") } : {}),
    ...(m.storyUse ? { use: m.storyUse } : {}),
  };
}
