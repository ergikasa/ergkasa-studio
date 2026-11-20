/**
 * Wardrobe & costume intelligence (Character Acting Engine; Standard v2.1 CA-I and CA-W).
 *
 * Three jobs, all deterministic (the same plan always dresses people the same way):
 *
 *   1. Costume selection (CA-W1): dress a person for who they are (era, profession) and for the situation
 *      (occasion, weather), from a rule table, not at random. Colours come from the show palette; the cast
 *      member's own coat colour, when the plan gives one, colours their outer layer.
 *   2. Wardrobe continuity (CA-W2): a person keeps their outfit through the shots of one event. A change of
 *      outfit is refused inside an event (same set, continuity carried) and needs a narrative reason outside it.
 *   3. Identity (CA-I): one person is one cast member whatever they wear. Two cast members that are visibly the
 *      same person (same name and build) are reported: change their clothes with outfits instead.
 *
 * The rig draws the garments (rig.ts); the stager writes them into the Render Package, where the gate checks
 * that the rig draws every kind and that each person's identity is the same in every scene.
 */
import { GARMENT_LAYER, outfitProblems, type Garment, type GarmentKind } from "@erkasa/contracts";
import type { CastMember, Era, FilmPlan, Occasion, Outfit, Profession, Weather } from "./contract.js";
import { hash01 } from "./motion.js";
import type { Issue } from "./perform.js";

// ------------------------------------------------------------------------------------------------ colours

/** Clothes colours: the show palette and its darker companions (Style Bible §9). */
export const CLOTH = {
  charcoal: "#2B2D42",
  navy: "#14213D",
  coat: "#3D5A80",
  slate: "#264653",
  teal: "#2A9D8F",
  coral: "#E76F51",
  ochre: "#F4A261",
  sun: "#FFD27D",
  cream: "#F4EBDD",
  paper: "#EADFCB",
  brown: "#6B452B",
  wood: "#8B5E3C",
  plum: "#8E6BB0",
  grey: "#4A4E69",
  shoe: "#1A1A22",
  denim: "#3D5A80",
} as const;

// ------------------------------------------------------------------------------------------------ selection

export interface DressContext {
  build: "man" | "woman";
  era: Era;
  profession: Profession;
  occasion: Occasion;
  weather: Weather;
  /** The plan's colour for this person's outer layer, if any. */
  coat?: string | undefined;
  /** Seed for the choices the rules leave open (which of two suitable colours): the person's id. */
  seed: string;
  /** Main colours (suits, tops) other people of the film already wear: two people must not read as one. */
  avoid?: readonly string[];
}

export interface Dressed {
  garments: Garment[];
  /** Why each piece is there, for the report (CA-W1: no arbitrary choices). */
  reasons: string[];
}

const seedOf = (s: string): number => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 100000;
};
const pick = <T>(seed: string, n: number, xs: readonly T[]): T =>
  xs[Math.floor(hash01(seedOf(seed), n) * xs.length) % xs.length] as T;

/** Garments that did not exist (or were not worn this way) in an era: the selection never uses them there. */
export const ANACHRONISTIC: Record<Era, ReadonlySet<GarmentKind>> = {
  contemporary: new Set(),
  "1990s": new Set(),
  "1970s": new Set(["puffer", "hoodie"]),
  "1950s": new Set(["puffer", "hoodie", "hi_vis_vest", "scrubs_top", "scrubs_trousers", "sneakers"]),
  "1920s": new Set([
    "puffer",
    "hoodie",
    "hi_vis_vest",
    "scrubs_top",
    "scrubs_trousers",
    "sneakers",
    "jeans",
    "tshirt",
    "polo",
    "cap",
    "beanie",
    "hard_hat",
  ]),
  victorian: new Set([
    "puffer",
    "hoodie",
    "hi_vis_vest",
    "scrubs_top",
    "scrubs_trousers",
    "sneakers",
    "jeans",
    "tshirt",
    "polo",
    "cap",
    "beanie",
    "hard_hat",
    "blazer",
    "cloche",
    "raincoat",
    "shorts",
  ]),
};

const PERIOD = (era: Era): "old" | "mid" | "modern" =>
  era === "1920s" || era === "victorian" ? "old" : era === "1950s" || era === "1970s" ? "mid" : "modern";

/**
 * Dress a person. The rules, in order: the base outfit of the profession for the occasion and era; then the
 * weather adds or swaps layers; then anything the era did not have is replaced by its period equivalent.
 */
export function dressFor(c: DressContext): Dressed {
  const g = new Map<string, Garment>(); // by slot, so a later rule replaces an earlier one
  const reasons: string[] = [];
  const put = (slot: string, kind: GarmentKind, color: string, why: string, color2?: string): void => {
    g.set(slot, { kind, color, ...(color2 ? { color2 } : {}) });
    reasons.push(`${kind}: ${why}`);
  };
  const drop = (slot: string, why: string): void => {
    const was = g.get(slot);
    if (was) reasons.push(`no ${was.kind}: ${why}`);
    g.delete(slot);
  };
  const man = c.build === "man";
  const period = PERIOD(c.era);
  const formal = c.occasion === "formal" || c.occasion === "interview";
  // a suit is a suit colour; the person's own colour (the plan's `coat`) shows in their everyday clothes
  const suits = [CLOTH.charcoal, CLOTH.navy, CLOTH.coat, CLOTH.grey, CLOTH.slate];
  const free = suits.filter((x) => !(c.avoid ?? []).includes(x));
  const suit = pick(c.seed, 1, free.length ? free : suits);
  // accents (ties, scarves) contrast with every suit colour
  const accent = pick(c.seed, 2, [CLOTH.coral, CLOTH.ochre, CLOTH.sun]);
  // everyday tops: the person's own colour, or one nobody else in the film wears
  const tops = [CLOTH.teal, CLOTH.coral, CLOTH.ochre, CLOTH.slate, CLOTH.plum];
  const freeTops = tops.filter((x) => !(c.avoid ?? []).includes(x));
  const casualTop = c.coat ?? pick(c.seed, 3, freeTops.length ? freeTops : tops);
  const shoes = (why: string): void => put("feet", "shoes", CLOTH.shoe, why);

  // -- 1. the profession, for the occasion
  const office = ["office", "business", "executive", "teacher"].includes(c.profession);
  const dressUp = (office && c.occasion === "work") || formal;
  if (c.occasion === "home" && !formal) {
    put("top", man ? "tshirt" : "sweater", casualTop, "at home: comfortable");
    put("bottom", "trousers", CLOTH.grey, "at home");
    shoes("at home");
  } else if (c.profession === "construction" || c.profession === "factory" || c.profession === "farmer") {
    const builder = c.profession === "construction";
    put(
      "top",
      period === "modern" ? "tshirt" : "shirt",
      period === "modern" ? CLOTH.slate : CLOTH.paper,
      "manual work",
    );
    put(
      "bottom",
      c.profession === "farmer" || period === "old" ? "overalls" : "jeans",
      CLOTH.denim,
      "hard-wearing work trousers",
    );
    put("feet", "boots", CLOTH.brown, "safety boots for the site");
    if (builder && period !== "old") {
      put("layer", "hi_vis_vest", CLOTH.ochre, "a construction site requires high visibility", CLOTH.cream);
      put("head", "hard_hat", CLOTH.sun, "a construction site requires a hard hat");
    } else if (period === "old") put("head", "flat_cap", CLOTH.grey, `a ${c.era} labourer's cap`);
  } else if (c.profession === "doctor" || c.profession === "scientist") {
    put("top", "shirt", CLOTH.cream, "professional under the coat");
    if (man) put("neck", "tie", accent, "a doctor's or scientist's formal shirt and tie");
    put("bottom", man ? "trousers" : "skirt", CLOTH.grey, "professional");
    put("layer", "lab_coat", CLOTH.cream, `a ${c.profession} works in a lab coat`);
    shoes("professional");
  } else if (c.profession === "nurse" && period !== "modern") {
    // before scrubs: the nurse's uniform dress (women), white shirt and trousers (men)
    if (man) put("top", "shirt", CLOTH.cream, `a ${c.era} male nurse's white uniform`);
    put("bottom", man ? "trousers" : "dress", man ? CLOTH.paper : CLOTH.coat, `a ${c.era} nurse's uniform`);
    if (!man) put("layer", "apron", CLOTH.cream, `a ${c.era} nurse's white apron`);
    shoes("nurse's shoes");
  } else if (c.profession === "nurse") {
    put("top", "scrubs_top", CLOTH.teal, "a nurse on shift wears scrubs");
    put("bottom", "scrubs_trousers", CLOTH.teal, "scrubs");
    put("feet", "sneakers", CLOTH.cream, "long shifts on the feet");
  } else if (c.profession === "chef") {
    put("top", "shirt", CLOTH.cream, "chef's whites");
    put("bottom", "trousers", CLOTH.charcoal, "kitchen trousers");
    put("layer", "apron", CLOTH.cream, "a cook wears an apron");
    put("head", "chef_hat", CLOTH.cream, "a chef's toque");
    shoes("kitchen");
  } else if (dressUp) {
    put("top", man ? "shirt" : "blouse", CLOTH.cream, "a working or formal day: a collared shirt");
    if (man) {
      put("bottom", "trousers", suit, "suit trousers");
      put(
        "layer",
        "suit_jacket",
        suit,
        formal ? `a ${c.occasion} calls for a suit` : "an office job: a suit",
      );
      if (formal || c.profession !== "teacher") put("neck", "tie", accent, "a suit is worn with a tie");
      if (period === "old") put("layer2", "waistcoat", suit, `a ${c.era} suit is three-piece`);
      if (period === "old")
        put("head", "fedora", CLOTH.charcoal, `${c.era} men wore a hat outdoors and to work`, accent);
    } else if (period === "old") {
      put("bottom", "dress", suit, `${c.era} women wore a dress to work and on formal occasions`);
      g.delete("top");
      if (c.era === "1920s") put("head", "cloche", accent, "the 1920s cloche hat");
    } else {
      put("bottom", pick(c.seed, 4, ["skirt", "trousers"] as const), suit, "a suit: skirt or trousers");
      put("layer", "blazer", suit, formal ? `a ${c.occasion} calls for a blazer` : "an office job: a blazer");
    }
    shoes("dress shoes");
  } else if (c.profession === "student") {
    put("top", period === "modern" ? "hoodie" : "sweater", casualTop, "a student, casual");
    put("bottom", period === "modern" ? "jeans" : "trousers", CLOTH.denim, "casual");
    put(
      "feet",
      period === "modern" ? "sneakers" : "shoes",
      period === "modern" ? CLOTH.cream : CLOTH.shoe,
      "casual",
    );
  } else {
    // everyone else, at work or out: smart-casual for the period
    put(
      "top",
      period === "old" ? "shirt" : pick(c.seed, 5, ["shirt", "sweater", "polo"] as const),
      casualTop,
      "everyday clothes",
    );
    put(
      "bottom",
      period === "modern" && !man
        ? pick(c.seed, 6, ["jeans", "skirt"] as const)
        : period === "modern"
          ? "jeans"
          : "trousers",
      period === "modern" ? CLOTH.denim : CLOTH.grey,
      "everyday clothes",
    );
    shoes("everyday");
    if (period === "old" && man) put("head", "flat_cap", CLOTH.grey, `everyday ${c.era} headwear`);
  }

  // -- 2. the weather
  if (c.weather === "cold" || c.weather === "snow") {
    const warmLayer: GarmentKind =
      dressUp && period !== "modern"
        ? "overcoat"
        : dressUp
          ? "overcoat"
          : period === "modern"
            ? "puffer"
            : "overcoat";
    if (
      !g.has("layer") ||
      ["suit_jacket", "blazer", "waistcoat", "cardigan"].includes(g.get("layer")?.kind ?? "")
    ) {
      // a coat goes over the jacket: the jacket stays (we only see the outer layer and the cuffs)
      put("outer", warmLayer, warmLayer === "puffer" ? accent : CLOTH.brown, `${c.weather}: a warm coat`);
    }
    put("scarf", "scarf", accent, `${c.weather}: a scarf`);
    if (!g.has("head") && !dressUp)
      put("head", period === "modern" ? "beanie" : "flat_cap", CLOTH.grey, `${c.weather}: a warm hat`);
    if (g.get("feet")?.kind === "sneakers") put("feet", "boots", CLOTH.brown, `${c.weather}: boots`);
  } else if (c.weather === "rain") {
    if (!["hi_vis_vest", "lab_coat", "apron"].includes(g.get("layer")?.kind ?? ""))
      put(
        "outer",
        period === "old" ? "overcoat" : "raincoat",
        period === "old" ? CLOTH.brown : CLOTH.sun,
        "rain: a raincoat",
      );
  } else if (c.weather === "warm") {
    if (!formal && g.get("layer")?.kind === "suit_jacket" && c.profession !== "executive")
      drop("layer", "warm weather: jacket off");
    if (["sweater", "hoodie"].includes(g.get("top")?.kind ?? ""))
      put("top", "tshirt", casualTop, "warm weather");
    drop("scarf", "warm weather");
  }

  // -- 3. the era: replace what it did not have
  const banned = ANACHRONISTIC[c.era];
  const PERIOD_SWAP: Partial<Record<GarmentKind, GarmentKind>> = {
    puffer: "overcoat",
    hoodie: "sweater",
    sneakers: "shoes",
    jeans: "trousers",
    tshirt: "shirt",
    polo: "shirt",
    beanie: "flat_cap",
    cap: "flat_cap",
    blazer: "suit_jacket",
    raincoat: "overcoat",
    cloche: "fedora",
  };
  for (const [slot, piece] of g) {
    if (!banned.has(piece.kind)) continue;
    const swap = PERIOD_SWAP[piece.kind];
    if (swap && !banned.has(swap))
      put(
        slot,
        swap,
        piece.kind === "sneakers" ? CLOTH.shoe : piece.color,
        `${c.era}: ${piece.kind} did not exist yet`,
      );
    else drop(slot, `${c.era}: did not exist yet`);
  }

  // never leave the body without what every outfit needs (a swap above may have removed it)
  const dressOn = g.get("bottom")?.kind === "dress" || g.get("bottom")?.kind === "overalls";
  if (!g.has("top") && !dressOn) put("top", "shirt", CLOTH.cream, "every outfit needs a top");
  if (!g.has("bottom")) put("bottom", "trousers", CLOTH.grey, "every outfit needs a bottom");
  if (!g.has("feet")) shoes("every outfit needs shoes");
  const neck = g.get("neck");
  if (neck && (neck.kind === "tie" || neck.kind === "bow_tie") && g.get("top")?.kind !== "shirt")
    drop("neck", "a tie needs a shirt");

  // inside out: top, bottom, layers, neck, head, face, feet
  const ORDER = ["top", "bottom", "layer2", "layer", "outer", "neck", "scarf", "head", "face", "feet"];
  const garments = ORDER.flatMap((s) => (g.has(s) ? [g.get(s) as Garment] : []));
  return { garments: orderGarments(garments), reasons };
}

/** Inside-out drawing order for any list of garments (explicit outfits come in any order). */
export function orderGarments(gs: readonly Garment[]): Garment[] {
  const rank: Record<string, number> = { top: 0, bottom: 1, layer: 2, neck: 4, head: 5, face: 6, feet: 7 };
  const LAYER_RANK: Partial<Record<GarmentKind, number>> = {
    waistcoat: 0,
    cardigan: 1,
    suit_jacket: 2,
    blazer: 2,
    work_jacket: 2,
    hi_vis_vest: 3,
    apron: 3,
    lab_coat: 4,
    overcoat: 5,
    raincoat: 5,
    puffer: 5,
  };
  return [...gs]
    .map((x, i) => ({ x, i }))
    .sort((a, b) => {
      const la = GARMENT_LAYER[a.x.kind],
        lb = GARMENT_LAYER[b.x.kind];
      const ra = (rank[la] ?? 9) + (la === "layer" ? (LAYER_RANK[a.x.kind] ?? 0) * 0.1 : 0);
      const rb = (rank[lb] ?? 9) + (lb === "layer" ? (LAYER_RANK[b.x.kind] ?? 0) * 0.1 : 0);
      return ra - rb || a.i - b.i;
    })
    .map(({ x }) => x);
}

// ------------------------------------------------------------------------------------------------ outfits

/** Does this cast member get dressed garment by garment (otherwise: the plain look of earlier films)? */
export const isDressed = (m: CastMember): boolean => !!(m.outfits?.length || m.era || m.profession);

/** The outfits of a cast member: theirs, or one "default" outfit for work when only a profile is given. */
export function outfitsOf(m: CastMember): Outfit[] {
  if (m.outfits?.length) return m.outfits;
  return isDressed(m) ? [{ id: "default", occasion: "work" }] : [];
}

/** The garments of one outfit: given, or selected from the person's profile. */
export function garmentsOf(m: CastMember, o: Outfit, avoid: readonly string[] = []): Dressed {
  if (o.garments) return { garments: orderGarments(o.garments), reasons: ["given by the plan"] };
  return dressFor({
    avoid,
    build: m.build,
    era: m.era ?? "contemporary",
    profession: m.profession ?? "none",
    occasion: o.occasion ?? "work",
    weather: o.weather ?? "mild",
    coat: m.coat,
    seed: m.id,
  });
}

// ------------------------------------------------------------------------------------------------ continuity

export interface Worn {
  outfit: string;
  garments: Garment[];
}

export interface WardrobePlan {
  /** What each person wears in each shot (by shot id, then actor id). Plain-look people are absent. */
  byShot: Map<string, Map<string, Worn>>;
  /** Every outfit a person wears in the film, in order, with why. */
  report: Array<{
    actor: string;
    outfit: string;
    fromShot: string;
    garments: GarmentKind[];
    reasons: string[];
  }>;
  issues: Issue[];
}

/**
 * Who wears what in every shot, and the continuity and identity problems of the plan.
 *
 * An event is a run of staged shots on one set whose continuity is carried. Inside an event clothes never change
 * (WARDROBE_CHANGE_IN_EVENT). Between events they may, but only into an outfit that says why
 * (WARDROBE_CHANGE_NO_REASON): the viewer must be able to tell it is a different time or situation.
 */
export function resolveWardrobe(plan: FilmPlan): WardrobePlan {
  const issues: Issue[] = [];
  const byShot = new Map<string, Map<string, Worn>>();
  const report: WardrobePlan["report"] = [];
  const cast = new Map(plan.cast.map((m) => [m.id, m]));

  // identity: the same person split into two cast members to change clothes
  plan.cast.forEach((m, i) => {
    const twin = plan.cast
      .slice(0, i)
      .find((o) => o.name.toLowerCase() === m.name.toLowerCase() && o.build === m.build);
    if (twin)
      issues.push({
        level: "warning",
        code: "IDENTITY_SPLIT",
        path: `cast[${i}]`,
        message: `'${m.id}' and '${twin.id}' are both ${m.name}: one person is one cast member; give ${twin.id} outfits and change them by shot`,
      });
  });

  // the outfits themselves; a suit colour taken by one person is not given to the next
  const dressed = new Map<string, Map<string, Dressed>>();
  const suitsTaken: string[] = [];
  plan.cast.forEach((m, i) => {
    const outs = outfitsOf(m);
    const map = new Map<string, Dressed>();
    const seen = new Set<string>();
    outs.forEach((o, k) => {
      const path = `cast[${i}].outfits[${k}]`;
      if (seen.has(o.id))
        issues.push({
          level: "error",
          code: "OUTFIT_DUPLICATE",
          path,
          message: `${m.id} has two outfits '${o.id}'`,
        });
      seen.add(o.id);
      const d = garmentsOf(m, o, suitsTaken);
      for (const p of outfitProblems(d.garments))
        issues.push({ level: "error", code: "OUTFIT_INVALID", path, message: `${m.id}/${o.id}: ${p}` });
      if (o.garments)
        for (const p of contextProblems(m, o))
          issues.push({ level: "warning", code: "WARDROBE_CONTEXT", path, message: `${m.id}/${o.id}: ${p}` });
      map.set(o.id, d);
    });
    for (const d of map.values())
      for (const g of d.garments)
        // what reads from afar: the jacket or the top
        if (
          (GARMENT_LAYER[g.kind] === "top" || ["suit_jacket", "blazer"].includes(g.kind)) &&
          !suitsTaken.includes(g.color)
        )
          suitsTaken.push(g.color);
    if (outs.length) dressed.set(m.id, map);
  });

  const last = new Map<string, { outfit: string; set: string | undefined; shot: string }>();
  plan.shots.forEach((s, i) => {
    if (s.kind !== "set") return;
    const worn = new Map<string, Worn>();
    s.actors.forEach((a, k) => {
      const m = cast.get(a.id);
      const outfits = dressed.get(a.id);
      const path = `shots[${i}].actors[${k}].outfit`;
      if (!m || !outfits) {
        if (a.outfit)
          issues.push({
            level: "error",
            code: "OUTFIT_UNKNOWN",
            path,
            message: `${a.id} has no outfits (give the cast member outfits or a profession)`,
          });
        return;
      }
      const prev = last.get(a.id);
      const first = outfitsOf(m)[0]?.id as string;
      const want = a.outfit ?? prev?.outfit ?? first;
      if (!outfits.has(want)) {
        issues.push({
          level: "error",
          code: "OUTFIT_UNKNOWN",
          path,
          message: `${a.id} has no outfit '${want}' (outfits: ${[...outfits.keys()].join(", ")})`,
        });
        return;
      }
      if (prev && prev.outfit !== want) {
        const sameEvent = prev.set === s.set && s.continuity !== "reset";
        if (sameEvent)
          issues.push({
            level: "error",
            code: "WARDROBE_CHANGE_IN_EVENT",
            path,
            message: `${a.id} changes from '${prev.outfit}' to '${want}' between ${prev.shot} and ${s.id}, inside the same event (same set, continuity carried): declare continuity "reset" if time has passed`,
          });
        else if (!outfitsOf(m).find((o) => o.id === want)?.reason)
          issues.push({
            level: "error",
            code: "WARDROBE_CHANGE_NO_REASON",
            path,
            message: `${a.id} changes into '${want}' at ${s.id}: an outfit worn after a change needs a 'reason' (the story's reason for the new clothes)`,
          });
      }
      if (!prev || prev.outfit !== want) {
        const d = outfits.get(want) as Dressed;
        report.push({
          actor: a.id,
          outfit: want,
          fromShot: s.id,
          garments: d.garments.map((x) => x.kind),
          reasons: d.reasons,
        });
      }
      worn.set(a.id, { outfit: want, garments: (outfits.get(want) as Dressed).garments });
      last.set(a.id, { outfit: want, set: s.set, shot: s.id });
    });
    if (worn.size) byShot.set(s.id, worn);
  });
  return { byShot, report, issues };
}

/**
 * An outfit the plan gives garment by garment, checked against the person and the situation (CA-W1): what the
 * weather or the era rules out, what the occasion or the profession requires.
 */
export function contextProblems(m: CastMember, o: Outfit): string[] {
  const out: string[] = [];
  const kinds = new Set((o.garments ?? []).map((g) => g.kind));
  const has = (...ks: GarmentKind[]): boolean => ks.some((k) => kinds.has(k));
  const era = m.era ?? "contemporary";
  for (const k of kinds) if (ANACHRONISTIC[era].has(k)) out.push(`${k} is anachronistic in the ${era}`);
  if (
    (o.weather === "cold" || o.weather === "snow") &&
    !has("overcoat", "puffer", "raincoat", "sweater", "hoodie", "cardigan")
  )
    out.push(`${o.weather} weather and no warm layer`);
  if (o.weather === "rain" && !has("raincoat", "overcoat")) out.push("rain and no coat");
  if (
    (o.occasion === "formal" || o.occasion === "interview") &&
    ["business", "executive", "office"].includes(m.profession ?? "") &&
    !has("suit_jacket", "blazer", "dress")
  )
    out.push(`a ${o.occasion} for a ${m.profession} person without a jacket`);
  if (
    m.profession === "construction" &&
    o.occasion === "work" &&
    !(has("hard_hat") && has("hi_vis_vest")) &&
    era !== "1920s" &&
    era !== "victorian"
  )
    out.push("a construction site without a hard hat and a hi-vis vest");
  return out;
}
