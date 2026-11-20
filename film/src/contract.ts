import { FacialHair, Garment, HairStyle } from "@erkasa/contracts";
import { z } from "zod";

/**
 * Film Plan (erkasa.film/1): a film directed as moments and shots, not one scene per sentence.
 *
 * A shot starts at a word of a script scene's narration and lasts until the next shot starts, so one sentence
 * can hold several shots and one shot can run across sentences. A shot is either a staged scene (actors on a
 * set, doing things to props and to each other, framed by a named shot size) or an editorial scene (a designed
 * template: a clock, a scale, two curves...). Every coordinate is computed by the engine; the plan only names
 * marks, props, people and verbs.
 */

/** `start`, `word:<word>` (first occurrence), `word:<word>#2` (second), `sec:<seconds after the shot starts>`. */
export const Anchor = z
  .string()
  .regex(/^(start|word:[^\s#]+(#\d+)?|sec:\d+(\.\d+)?)$/, "start | word:<w>[#n] | sec:<s>");
export type Anchor = z.infer<typeof Anchor>;

/**
 * An action's anchor: any Anchor, or `then`: when the same person's previous action in the plan has finished, so
 * a performance can be written as a sequence (walks to the desk, then picks up the paper, then reads it...).
 */
export const ActionAnchor = z.union([Anchor, z.literal("then")]);
export type ActionAnchor = z.infer<typeof ActionAnchor>;

export const Id = z.string().regex(/^[a-z][a-z0-9_]{0,30}$/);

export const Mood = z.enum([
  "neutral",
  "tired",
  "sad",
  "anxious",
  "hopeful",
  "determined",
  "happy",
  "thinking",
]);
export type Mood = z.infer<typeof Mood>;

/** What a person can do. Targets are marks, props or other people of the shot. */
export const Verb = z.enum([
  "look", // keep looking at target (eyes lead, the head follows)
  "glance", // look at target, then back
  "type", // seated at a desk: type (sec = how long)
  "write", // seated: write on paper
  "sigh",
  "stand_up",
  "sit_down",
  "walk_to", // target = a mark
  "pick_up", // target = a prop within reach
  "put_down", // target = a mark with a surface (or omitted: where it was)
  "drink", // the held cup
  "give", // target = a person within reach; gives what is in the hand
  "lean_in", // toward target
  "hesitate", // starts toward target, stops, pulls back
  "cross_arms",
  "hand_on_face",
  "point", // at target
  "nod",
  "shake_head",
  "shrug",
  "talk", // gestures while speaking (sec)
  "mood", // target = the new mood (neutral, tired, sad...)
  "glow", // a soft halo appears around the person (a judgement, a first impression)
  "open", // a door or the cage door (no `who`)
  "read", // the held paper, notebook or phone: raised, read line by line (sec)
  "turn_to", // target = a person, mark or look target: eyes first, then the head, then the body if it is behind
  "react", // target = the mood reacted into: anticipation, a physical beat, then the mood settles (overshoot)
]);
export type Verb = z.infer<typeof Verb>;

/**
 * How a person speaks (`talk`): what they want while talking. The acting engine (acting.ts) turns it into a
 * posture, a gesture vocabulary and rhythm, a way of holding or avoiding the listener's eyes, and a face.
 */
export const Delivery = z.enum([
  "explain",
  "convince",
  "worry",
  "question",
  "reassure",
  "defend",
  "confess",
  "announce",
]);
export type Delivery = z.infer<typeof Delivery>;

export const Action = z
  .object({
    who: Id.optional(),
    do: Verb,
    target: z.string().max(40).optional(),
    at: ActionAnchor.default("start"),
    /** How long a timed action lasts (type, talk, look); others take their natural time. */
    sec: z.number().min(0.3).max(20).optional(),
    /** talk: what the person wants while speaking (absent: the plain talking gestures of earlier films). */
    how: Delivery.optional(),
    /** talk: how strongly, 0..1 (default 0.6). */
    intensity: z.number().min(0).max(1).optional(),
  })
  .strict();
export type Action = z.infer<typeof Action>;

export const SetId = z.enum(["office", "interview", "room", "cage"]);
export type SetId = z.infer<typeof SetId>;

export const Light = z.enum(["day", "golden", "dusk", "night"]);

export const ActorPlacement = z
  .object({
    id: Id,
    at: Id, // a mark of the set
    pose: z.enum(["seated", "standing"]).default("standing"),
    facing: z.enum(["left", "right"]).optional(),
    mood: Mood.default("neutral"),
    holding: z.string().max(30).optional(), // a prop of the set already in the hand
    /**
     * The outfit (an id from the cast member's `outfits`) worn from this shot on. Absent: what the person wore in
     * their previous shot, or their first outfit. Changing it inside the same event is refused (wardrobe.ts).
     */
    outfit: Id.optional(),
  })
  .strict();
export type ActorPlacement = z.infer<typeof ActorPlacement>;

export const TypeLine = z
  .object({
    t: z.string().min(1).max(40),
    weight: z.enum(["light", "bold"]).optional(),
    accent: z.boolean().optional(),
  })
  .strict();

export const Text = z
  .object({
    lines: z.array(TypeLine).min(1).max(4),
    at: Anchor.default("start"),
    out: Anchor.optional(),
    place: z.enum(["top", "bottom", "center"]).default("top"),
  })
  .strict();

export const Template = z.enum([
  "statement", // type only, on the show's backdrop
  "clock", // params: time "5:58"
  "scale", // params: left, right (labels), items [{label, side, at}], clearAt
  "curves", // params: a {label, end}, b {label, end}, splitAt
  "bars", // params: unit, bars [{label, value}]
  "counter", // params: from, to, decimals, suffix, label
  "word_shadow", // params: word, shadow
  "time_strip", // params: label, segments [string], keep (index), pushAt
  "receipts", // params: front {title, lines}, back {title, lines}, revealAt
  "calendar", // params: from (n), to (n), label ("Week")
  "window_dream", // the imagined other life seen over a shoulder
  "cards", // params: left {title, lines}, right {title, lines}
]);
export type Template = z.infer<typeof Template>;

export const Shot = z
  .object({
    id: Id,
    /** The script scene whose narration this shot starts in. */
    scene: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/),
    from: Anchor.default("start"),
    /** What the viewer must understand or feel in this shot, in a sentence. */
    moment: z.string().min(3).max(200),
    kind: z.enum(["set", "editorial"]),
    // staged scenes
    set: SetId.optional(),
    light: Light.optional(),
    lightTo: z.object({ to: Light, at: Anchor }).strict().optional(),
    framing: z.enum(["wide", "medium", "close", "ots", "insert"]).optional(),
    subject: z.string().max(30).optional(),
    camera: z.enum(["static", "push_in", "pull_out", "follow", "drift"]).default("drift"),
    actors: z.array(ActorPlacement).max(3).default([]),
    actions: z.array(Action).max(16).default([]),
    // editorial scenes
    template: Template.optional(),
    params: z.record(z.string(), z.unknown()).default({}),
    // both
    text: Text.optional(),
    transition: z.enum(["cut", "fade", "whip"]).default("cut"),
    /**
     * How the people of this shot relate to the previous shot on the same set. "carry" (the default) picks
     * them up exactly where the last shot left them; "reset" declares a deliberate jump (time passes, a new
     * situation) so the shot starts from its own placements.
     */
    continuity: z.enum(["carry", "reset"]).optional(),
  })
  .strict();
export type Shot = z.infer<typeof Shot>;

export const Era = z.enum(["contemporary", "1990s", "1970s", "1950s", "1920s", "victorian"]);
export type Era = z.infer<typeof Era>;
export const Profession = z.enum([
  "none",
  "office",
  "business",
  "executive",
  "construction",
  "factory",
  "doctor",
  "nurse",
  "scientist",
  "chef",
  "teacher",
  "student",
  "retail",
  "artist",
  "farmer",
]);
export type Profession = z.infer<typeof Profession>;
/** What the situation asks of clothes. */
export const Occasion = z.enum(["work", "formal", "interview", "casual", "home", "outdoor"]);
export type Occasion = z.infer<typeof Occasion>;
export const Weather = z.enum(["mild", "warm", "cold", "rain", "snow"]);
export type Weather = z.infer<typeof Weather>;

/**
 * One outfit of a person. Either the garments are given, or the wardrobe engine dresses the person for the
 * occasion and weather from their profile (era, profession), deterministically. `reason` is the narrative reason
 * the person wears it; a change of outfit during a film needs one.
 */
export const Outfit = z
  .object({
    id: Id,
    occasion: Occasion.optional(),
    weather: Weather.optional(),
    garments: z.array(Garment).min(1).max(16).optional(),
    reason: z.string().min(3).max(160).optional(),
  })
  .strict();
export type Outfit = z.infer<typeof Outfit>;

export const CastMember = z
  .object({
    id: Id,
    name: z.string().min(1).max(30),
    build: z.enum(["man", "woman"]),
    /** Clothes colour (one of the show palette or a hex). */
    coat: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    hair: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    skin: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    /** Identity beyond colours (constant for the film). */
    hairStyle: HairStyle.optional(),
    facialHair: FacialHair.optional(),
    /** Who the person is in the story: what the wardrobe engine dresses them from. */
    era: Era.optional(),
    profession: Profession.optional(),
    /**
     * Their clothes. A cast member with outfits (or with a profession or era, which gets one "default" outfit for
     * work) is dressed garment by garment; one without keeps the plain look (coat colour) of earlier films.
     */
    outfits: z.array(Outfit).max(8).optional(),
  })
  .strict();
export type CastMember = z.infer<typeof CastMember>;

export const FilmPlan = z
  .object({
    schema: z.literal("erkasa.film/1"),
    title: z.string().min(1).max(100),
    voiceId: z.string().min(1),
    /** The music mood of the film: it changes with the story. */
    cast: z.array(CastMember).max(3).default([]),
    shots: z.array(Shot).min(1).max(80),
  })
  .strict()
  .superRefine((p, ctx) => {
    const ids = new Set<string>();
    p.shots.forEach((s, i) => {
      if (ids.has(s.id))
        ctx.addIssue({ code: "custom", message: `duplicate shot id ${s.id}`, path: ["shots", i, "id"] });
      ids.add(s.id);
      if (s.kind === "set" && !s.set)
        ctx.addIssue({ code: "custom", message: "a set shot needs `set`", path: ["shots", i, "set"] });
      if (s.kind === "editorial" && !s.template)
        ctx.addIssue({
          code: "custom",
          message: "an editorial shot needs `template`",
          path: ["shots", i, "template"],
        });
    });
  });
export type FilmPlan = z.infer<typeof FilmPlan>;
