import { z } from "zod";

/**
 * Wardrobe and character identity (Character Acting Engine, CA-I / CA-W, Standard v2.1).
 *
 * A person keeps one identity for the whole film (build, skin, hair, hair style, facial hair: what makes them
 * recognisable) and wears outfits over it. An outfit is a list of garments, each a kind the rig knows how to draw
 * plus its colours. Identity and wardrobe are separate on purpose: changing clothes never changes who someone is,
 * and the same person is never split into two cast members to change clothes.
 */

export const GarmentKind = z.enum([
  // tops (worn on the torso, under any layer)
  "tshirt",
  "shirt",
  "blouse",
  "polo",
  "sweater",
  "hoodie",
  "scrubs_top",
  // layers (over a top)
  "waistcoat",
  "cardigan",
  "suit_jacket",
  "blazer",
  "work_jacket",
  "overcoat",
  "raincoat",
  "puffer",
  "lab_coat",
  "hi_vis_vest",
  "apron",
  // neck
  "tie",
  "bow_tie",
  "scarf",
  // bottoms
  "trousers",
  "jeans",
  "shorts",
  "skirt",
  "dress",
  "overalls",
  "scrubs_trousers",
  // head and face
  "fedora",
  "flat_cap",
  "cloche",
  "hard_hat",
  "beanie",
  "cap",
  "chef_hat",
  "glasses",
  // feet
  "shoes",
  "boots",
  "sneakers",
]);
export type GarmentKind = z.infer<typeof GarmentKind>;

const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const Garment = z
  .object({
    kind: GarmentKind,
    /** Main colour of the garment. */
    color: Hex,
    /** Second colour where the garment has one (stripes of a hi-vis vest, a tie's pattern, a hat band). */
    color2: Hex.optional(),
  })
  .strict();
export type Garment = z.infer<typeof Garment>;

export const HairStyle = z.enum([
  "short",
  "side_part",
  "slicked",
  "curly",
  "receding",
  "bald",
  "long",
  "bob",
  "bun",
  "ponytail",
]);
export type HairStyle = z.infer<typeof HairStyle>;

export const FacialHair = z.enum(["none", "stubble", "moustache", "beard"]);
export type FacialHair = z.infer<typeof FacialHair>;

/** What makes a person recognisable beyond colours: drawn by the rig, constant for the whole film. */
export const Features = z
  .object({
    hair: HairStyle,
    facialHair: FacialHair,
  })
  .strict();
export type Features = z.infer<typeof Features>;

/** Which layer a garment belongs to: the order the rig draws them in, inside out. */
export const GARMENT_LAYER: Record<
  GarmentKind,
  "top" | "layer" | "neck" | "bottom" | "head" | "face" | "feet"
> = {
  tshirt: "top",
  shirt: "top",
  blouse: "top",
  polo: "top",
  sweater: "top",
  hoodie: "top",
  scrubs_top: "top",
  waistcoat: "layer",
  cardigan: "layer",
  suit_jacket: "layer",
  blazer: "layer",
  work_jacket: "layer",
  overcoat: "layer",
  raincoat: "layer",
  puffer: "layer",
  lab_coat: "layer",
  hi_vis_vest: "layer",
  apron: "layer",
  tie: "neck",
  bow_tie: "neck",
  scarf: "neck",
  trousers: "bottom",
  jeans: "bottom",
  shorts: "bottom",
  skirt: "bottom",
  dress: "bottom",
  overalls: "bottom",
  scrubs_trousers: "bottom",
  fedora: "head",
  flat_cap: "head",
  cloche: "head",
  hard_hat: "head",
  beanie: "head",
  cap: "head",
  chef_hat: "head",
  glasses: "face",
  shoes: "feet",
  boots: "feet",
  sneakers: "feet",
};

/**
 * An outfit the rig can draw: at most one garment per head/face/feet/bottom slot (a dress is the bottom and the
 * top at once), at least one bottom, tops before the layers worn over them. Returns the problems, empty when valid.
 */
export function outfitProblems(garments: readonly Garment[]): string[] {
  const out: string[] = [];
  const count = (layer: string): number => garments.filter((g) => GARMENT_LAYER[g.kind] === layer).length;
  for (const one of ["head", "face", "feet", "bottom"] as const)
    if (count(one) > 1) out.push(`more than one ${one} garment`);
  if (count("bottom") === 0) out.push("no bottom garment (trousers, skirt, dress...)");
  const hasDress = garments.some((g) => g.kind === "dress" || g.kind === "overalls");
  if (count("top") === 0 && !hasDress) out.push("no top garment (shirt, t-shirt...) and no dress");
  if (count("top") > 1) out.push("more than one top garment");
  const kinds = new Set<string>();
  for (const g of garments) {
    if (kinds.has(g.kind)) out.push(`${g.kind} twice`);
    kinds.add(g.kind);
  }
  const neck = garments.filter((g) => g.kind === "tie" || g.kind === "bow_tie");
  if (neck.length > 1) out.push("a tie and a bow tie");
  if (neck.length && !garments.some((g) => g.kind === "shirt")) out.push(`a ${neck[0]?.kind} needs a shirt`);
  return out;
}

/**
 * A stable fingerprint of what makes a person recognisable: the same person has the same fingerprint in every
 * scene, whatever they wear. Colours are compared lowercase.
 */
export function identityFingerprint(p: {
  rig: string;
  skin: string;
  hair: string;
  features?: Features | undefined;
}): string {
  const f = p.features ?? { hair: "default", facialHair: "default" };
  // the rig's version is not identity (a dressed rig is a later version of the same body)
  return [p.rig.replace(/@\d+$/, ""), p.skin.toLowerCase(), p.hair.toLowerCase(), f.hair, f.facialHair].join(
    "|",
  );
}
