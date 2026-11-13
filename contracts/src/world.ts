import { z } from "zod";

/**
 * World Spec: the world of one video, written by Claude after the script (or by hand). It says what the
 * world looks like, never how it is drawn: the World Builder (tools/world-builder) turns it into assets
 * with the studio's generators, all graded with one style kit, so every video gets its own place,
 * costumes and props while everything inside one video looks drawn by the same hand.
 *
 * Asset ids are role ids (`wld_char_ruler`, `wld_place_main`...): a plan written against roles renders in
 * any world that fills them, which is how the same story can be shown in a castle, an office or a rooftop.
 */

const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const RoleId = z.string().regex(/^wld_[a-z0-9_]+$/, "world asset ids start with wld_");

/** The look shared by every asset of the video. */
export const StyleKit = z.enum(["storybook", "clean_editorial", "night_noir", "sunset_warm"]);

export const WorldCharacter = z
  .object({
    id: RoleId,
    name: z.string().min(1).max(40),
    role: z.string().max(120).optional(),
    /** Identity: stays the same in every outfit and scene. */
    body: z
      .object({
        presentation: z.enum(["man", "woman"]),
        age: z.enum(["young", "adult", "middle", "old"]),
        skin: z.enum(["light", "medium", "tan", "brown", "dark"]),
        hair: z.enum(["short", "swept", "messy", "long", "bob", "buzz", "bald"]),
        hairColor: z.enum(["black", "brown", "auburn", "blond", "grey", "white"]),
        beard: z.enum(["none", "full", "moustache"]).default("none"),
        glasses: z.boolean().default(false),
      })
      .strict(),
    /** A costume preset of the World Builder, coloured with the character's own colours. */
    costume: z
      .object({
        preset: z.enum([
          "king",
          "queen",
          "prince",
          "knight",
          "peasant",
          "chef",
          "official",
          "business_suit",
          "office_casual",
          "street",
          "worker",
          "toga",
        ]),
        main: Hex.optional(),
        accent: Hex.optional(),
      })
      .strict(),
  })
  .strict();
export type WorldCharacter = z.infer<typeof WorldCharacter>;

export const WorldPlace = z
  .object({
    id: RoleId,
    kind: z.enum(["castle_rampart", "office_floor", "rooftop_night"]),
    time: z.enum(["day", "golden", "dusk", "night"]).default("day"),
    /** Two colours that tell the sides of the story apart (banners, flags, details). */
    sides: z.tuple([Hex, Hex]).optional(),
    seed: z.number().int().min(0).default(1),
  })
  .strict();

export const WorldProp = z
  .object({
    id: RoleId,
    kind: z.enum(["coin", "balance_scale", "board", "pedestal"]),
    /** coin: gold | silver | copper; board: parchment | whiteboard | neon; others ignore it. */
    material: z
      .string()
      .regex(/^[a-z_]+$/)
      .optional(),
    /** coin: the face motif. */
    motif: z.enum(["crown", "star", "plain"]).optional(),
  })
  .strict();

export const WorldSpec = z
  .object({
    schema: z.literal("erkasa.world-spec/1"),
    worldId: z.string().regex(/^[a-z][a-z0-9_]*$/),
    title: z.string().min(1).max(80),
    /** In one sentence: where and when the story happens. */
    setting: z.string().min(1).max(300),
    style: StyleKit,
    places: z.array(WorldPlace).min(1).max(6),
    cast: z.array(WorldCharacter).min(1).max(8),
    props: z.array(WorldProp).max(40).default([]),
  })
  .strict()
  .superRefine((w, ctx) => {
    const seen = new Set<string>();
    for (const [i, id] of [...w.places, ...w.cast, ...w.props].map((x) => x.id).entries()) {
      if (seen.has(id)) ctx.addIssue({ code: "custom", message: `duplicate id '${id}'`, path: [i] });
      seen.add(id);
    }
  });
export type WorldSpec = z.infer<typeof WorldSpec>;
