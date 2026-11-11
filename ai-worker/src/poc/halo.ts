import type { Keyframe, RenderTimeline, StoryBeat } from "@erkasa/contracts";
import { staging, type TimedWord } from "@erkasa/compiler";

/**
 * Visual Proof of Concept: "The Halo Effect", directed by hand.
 *
 * Every placement comes from staging (walk speeds, seat geometry, where hands meet), not from guesses,
 * so this is also the reference the automatic director (step 5) must reach.
 * Cast: the Host (main character, narrator), Alex (char_arti_01, two outfits, one identity),
 * Maria (char_era_01).
 */

const { kf, walkKeys, feetForSeat, handPoint, FLOOR, SCALE, SIT_FRAMES } = staging;
const FPS = 30;

export interface HaloScene {
  sceneId: string;
  beat: StoryBeat;
  emotion: string;
  narration: string;
}

export const HALO_SCRIPT: HaloScene[] = [
  {
    sceneId: "s01",
    beat: "hook",
    emotion: "curious",
    narration: "Same person. Same answers. Two completely different interviews. Here's why.",
  },
  {
    sceneId: "s02",
    beat: "relate",
    emotion: "hopeful",
    narration: "Meet Alex. Wrinkled hoodie, a great résumé, and an interviewer who barely looks up.",
  },
  {
    sceneId: "s03",
    beat: "tension",
    emotion: "uneasy",
    narration: "He answers every question well. She nods politely, and writes almost nothing.",
  },
  {
    sceneId: "s04",
    beat: "twist",
    emotion: "surprised",
    narration: "Now rewind. Same Alex. Same résumé. Same answers. Just a suit.",
  },
  {
    sceneId: "s05",
    beat: "turn",
    emotion: "impressed",
    narration: "Suddenly he seems smarter. More reliable. A natural leader.",
  },
  {
    sceneId: "s06",
    beat: "explain",
    emotion: "curious",
    narration:
      "Psychologists call this the halo effect. In 1920, Edward Thorndike noticed that officers who rated a soldier highly on one trait, like his physique, rated him higher on everything else.",
  },
  {
    sceneId: "s07",
    beat: "resolve",
    emotion: "thoughtful",
    narration:
      "One good impression spills over onto everything. So next time someone seems brilliant, ask yourself what you're actually judging.",
  },
];

export interface SceneTiming {
  sceneId: string;
  /** Length of the narration clip, seconds. */
  durationSec: number;
  /** Words relative to the start of the clip. */
  words: TimedWord[];
}

/** Without a voice: ~2.6 words per second, for silent previews. */
export function estimateTiming(scenes = HALO_SCRIPT): SceneTiming[] {
  return scenes.map((s) => {
    const tokens = s.narration.split(/\s+/).filter(Boolean);
    let t = 0.1;
    const words = tokens.map((w) => {
      const len = 0.18 + 0.045 * w.replace(/[^a-z]/gi, "").length + (/[.,]$/.test(w) ? 0.22 : 0);
      const word = { word: w, start: t, end: t + len * 0.85 };
      t += len;
      return word;
    });
    return { sceneId: s.sceneId, durationSec: t + 0.1, words };
  });
}

// ---------------------------------------------------------------- the set
const DOOR_X = 560;
const ALEX_HIP = 880;
const MARIA_HIP = 1540;
const ALEX_FEET = feetForSeat(ALEX_HIP, "right");
const MARIA_FEET = feetForSeat(MARIA_HIP, "left");
const DESK_X = 1230;
const DESK_TOP = FLOOR - 348;
const HAND_OVER = handPoint(ALEX_FEET, "right", "give");
const HALO_AT: [number, number] = [ALEX_HIP + 10, 1032];
const HOST_X = 720; // between the bookshelf and the desk of bg_office_01: a calm wall behind him

type Node = RenderTimeline["scenes"][number]["nodes"][number];
type Scene = RenderTimeline["scenes"][number];

const svg = (
  id: string,
  asset: string,
  z: number,
  x: number,
  y: number,
  extra: Partial<Node> & { scale?: number } = {},
): Node => {
  const { scale, tracks, props, ...rest } = extra;
  return {
    id,
    adapter: "svg",
    asset,
    z,
    space: "world",
    props: props ?? {},
    tracks: {
      x: [kf(0, x)],
      y: [kf(0, y)],
      ...(scale !== undefined ? { scale: [kf(0, scale)] } : {}),
      ...tracks,
    },
    ...rest,
  } as Node;
};

function officeSet(): Node[] {
  return [
    svg("clock", "prop_wall_clock_01@1", 2, 1220, 640, { scale: 0.8 }),
    svg("plant", "prop_plant_floor_01@1", 3, 1840, 1600 - 210),
    svg("chair_alex", "prop_chair_office_side_01@1", 5, ALEX_HIP + 30, FLOOR - 280),
    svg("chair_maria", "prop_chair_office_side_01@1", 5, MARIA_HIP - 30, FLOOR - 280, {
      props: { flip: true },
    }),
    svg("desk", "prop_desk_side_01@1", 15, DESK_X, FLOOR - 190),
    svg("laptop", "prop_laptop_side_01@1", 16, DESK_X + 70, DESK_TOP - (162 - 85) * 0.62, { scale: 0.62 }),
    svg("mug", "prop_mug_01@1", 16, DESK_X - 100, DESK_TOP - 43, { scale: 0.85 }),
  ];
}

function door(open: Array<[number, number]>): Node {
  // [frame, scaleX] pairs; 1 = closed, 0.12 = open
  return svg("door", "prop_door_01@1", 2, DOOR_X, 1560 - 465, {
    tracks: { "part.leaf.scaleX": open.map(([f, v], i) => kf(f, v, i ? { ease: "easeInOutCubic" } : {})) },
  });
}

function person(
  id: string,
  asset: string,
  tracks: Record<string, Keyframe[]>,
  props: Record<string, unknown> = {},
): Node {
  return {
    id,
    adapter: "character",
    asset,
    z: 10,
    space: "world",
    props: { speaks: false, ...props },
    tracks: { y: [kf(0, FLOOR)], scale: [kf(0, SCALE)], ...tracks },
  } as Node;
}

function text(
  id: string,
  content: string,
  style: string,
  y: number,
  inF: number,
  outF: number,
  extra: Record<string, unknown> = {},
): Node {
  return {
    id,
    adapter: "text",
    z: 40,
    space: "screen",
    props: { content, style, maxWidth: 940, ...extra },
    tracks: {
      x: [kf(0, 540)],
      y: [kf(0, y)],
      scale: [kf(inF, 0), kf(inF + 9, 1.1, { ease: "easeOutCubic" }), kf(inF + 14, 1, { ease: "easeOut" })],
      opacity: [kf(outF, 1), kf(outF + 8, 0, { ease: "easeIn" })],
    },
  } as Node;
}

/** Frame (scene-local) where a word starts, or a fallback fraction of the scene. */
function wordAt(words: TimedWord[], needle: string, fallback: number): number {
  const n = needle.toLowerCase();
  const w = words.find((x) => x.word.toLowerCase().replace(/[^a-z0-9']/g, "") === n);
  return Math.round((w ? w.start : fallback) * FPS);
}

// ---------------------------------------------------------------- scenes
type Build = (len: number, words: TimedWord[]) => Omit<Scene, "sceneId" | "from" | "duration">;

const hostScene =
  (
    zoom: [number, number],
    y: number,
    extraNodes: (len: number, w: TimedWord[]) => Node[],
    clips: (len: number, w: TimedWord[]) => Keyframe[],
    expressions: (len: number, w: TimedWord[]) => Keyframe[] = () => [kf(0, "neutral")],
  ): Build =>
  (len, words) => ({
    background: { asset: "bg_office_01@1" },
    camera: {
      x: [kf(0, HOST_X + 150)],
      y: [kf(0, y)],
      zoom: [kf(0, zoom[0]), kf(len - 1, zoom[1], { ease: "easeInOut" })],
    },
    captionY: 0.8,
    transitionIn: { type: "cut", frames: 0 },
    nodes: [
      person(
        "host",
        "char_host_01@1",
        {
          x: [kf(0, HOST_X)],
          facing: [kf(0, "front")],
          clip: clips(len, words),
          expression: expressions(len, words),
        },
        { speaks: true },
      ),
      ...extraNodes(len, words),
    ],
  });

const BUILD: Record<string, Build> = {
  s01: hostScene(
    [2.1, 2.3],
    1160,
    (len) => [
      text("t_hook", "SAME PERSON. SAME ANSWERS.", "hook_impact", 300, 4, len - 10, { highlight: ["SAME"] }),
    ],
    (len, w) => [
      kf(0, "wave"),
      kf(26, "talk", { blend: 8 }),
      kf(wordAt(w, "different", 2.2), "point_side", { blend: 6 }),
      kf(Math.min(len - 20, wordAt(w, "here's", 3.3)), "talk", { blend: 8 }),
    ],
    (_len, w) => [kf(0, "happy"), kf(24, "neutral"), kf(wordAt(w, "here's", 3.3), "thinking")],
  ),

  // first interview: casual Alex places his CV on the desk; Maria keeps typing
  s02: (len, words) => {
    const enter = walkKeys(10, DOOR_X, ALEX_FEET);
    const A = enter.arrive;
    const G = A + 22; // the CV leaves his hand
    return {
      background: { asset: "bg_interview_office_01@1" },
      camera: {
        x: [kf(0, 760), kf(A, 1140, { ease: "easeInOutCubic" }), kf(len - 1, 1190, { ease: "easeInOut" })],
        y: [kf(0, 1400)],
        zoom: [kf(0, 1.55), kf(A, 1.35, { ease: "easeInOutCubic" }), kf(len - 1, 1.3)],
      },
      captionY: 0.3,
      transitionIn: { type: "whip", frames: 10, direction: "left" },
      nodes: [
        door([
          [2, 1],
          [16, 0.12],
          [A, 0.12],
          [A + 16, 1],
        ]),
        ...officeSet(),
        svg("cv", "prop_cv_flat_01@1", 16, HAND_OVER[0], DESK_TOP - 9, {
          tracks: { opacity: [kf(G - 1, 0), kf(G, 1)] },
        }),
        person(
          "alex",
          "char_arti_01@1",
          {
            x: enter.keys,
            opacity: [kf(0, 0), kf(10, 0), kf(18, 1)],
            facing: [kf(0, "right")],
            clip: [
              kf(0, "idle"),
              kf(10, "walk"),
              kf(A, "idle", { blend: 6 }),
              kf(A + 2, "give", { blend: 6 }),
              kf(G + 4, "idle", { blend: 8 }),
              kf(G + 12, "sit", { blend: 4 }),
              kf(G + 12 + SIT_FRAMES, "seated", { blend: 6 }),
            ],
            item: [kf(0, "document"), kf(G, "neutral")],
            expression: [kf(0, "happy"), kf(G + 20, "neutral")],
          },
          { outfit: "casual" },
        ),
        person("maria", "char_era_01@1", {
          x: [kf(0, MARIA_FEET)],
          facing: [kf(0, "left")],
          clip: [
            kf(0, "seated_type"),
            kf(wordAt(words, "barely", 3.5), "seated", { blend: 6 }),
            kf(wordAt(words, "barely", 3.5) + 14, "seated_type", { blend: 8 }),
          ],
          expression: [kf(0, "neutral")],
        }),
      ],
    };
  },

  // he talks well, she barely reacts
  s03: (len, words) => {
    const nods = wordAt(words, "nods", 1.9);
    const pan = Math.max(10, nods - 20);
    return {
      background: { asset: "bg_interview_office_01@1" },
      camera: {
        x: [kf(0, 960), kf(pan, 960), kf(pan + 20, 1460, { ease: "easeInOutCubic" })],
        y: [kf(0, 1300)],
        zoom: [kf(0, 2.0), kf(len - 1, 2.1, { ease: "easeInOut" })],
      },
      captionY: 0.3,
      transitionIn: { type: "cut", frames: 0 },
      nodes: [
        door([[0, 1]]),
        ...officeSet(),
        svg("cv", "prop_cv_flat_01@1", 16, HAND_OVER[0], DESK_TOP - 9),
        person(
          "alex",
          "char_arti_01@1",
          {
            x: [kf(0, ALEX_FEET)],
            facing: [kf(0, "right")],
            clip: [kf(0, "seated_talk")],
            expression: [kf(0, "happy")],
          },
          { outfit: "casual" },
        ),
        person("maria", "char_era_01@1", {
          x: [kf(0, MARIA_FEET)],
          facing: [kf(0, "left")],
          clip: [
            kf(0, "seated_type"),
            kf(nods, "seated_nod", { blend: 6 }),
            kf(wordAt(words, "writes", 3.2), "seated_type", { blend: 8 }),
          ],
          expression: [kf(0, "neutral"), kf(nods, "neutral")],
        }),
      ],
    };
  },

  // rewind: the same Alex in a suit; Maria stands up and takes the CV from his hand
  s04: (len, words) => {
    const enter = walkKeys(8, DOOR_X, ALEX_FEET);
    const A = enter.arrive;
    const G = A + 26; // both arms are out: the CV changes hands
    const up = A - SIT_FRAMES + 2;
    return {
      background: { asset: "bg_interview_office_01@1" },
      camera: {
        x: [
          kf(0, 760),
          kf(A, 1150, { ease: "easeInOutCubic" }),
          kf(G - 8, HAND_OVER[0], { ease: "easeInOut" }),
          kf(len - 1, 1220, { ease: "easeInOut" }),
        ],
        y: [kf(0, 1400), kf(A, 1300, { ease: "easeInOutCubic" }), kf(len - 1, 1360, { ease: "easeInOut" })],
        zoom: [
          kf(0, 1.55),
          kf(A, 1.45, { ease: "easeInOutCubic" }),
          kf(G - 8, 1.75, { ease: "easeInOut" }),
          kf(len - 1, 1.4, { ease: "easeInOut" }),
        ],
      },
      captionY: 0.3,
      transitionIn: { type: "whip", frames: 10, direction: "right" },
      nodes: [
        door([
          [0, 1],
          [12, 0.12],
          [A, 0.12],
          [A + 16, 1],
        ]),
        ...officeSet(),
        text(
          "t_rewind",
          "SAME ALEX. JUST A SUIT.",
          "hook_impact",
          300,
          wordAt(words, "rewind", 0.4),
          Math.min(len - 12, wordAt(words, "suit", 3.4) + 30),
          { highlight: ["SUIT."] },
        ),
        person(
          "alex",
          "char_arti_01@1",
          {
            x: enter.keys,
            opacity: [kf(0, 0), kf(8, 0), kf(16, 1)],
            facing: [kf(0, "right")],
            clip: [
              kf(0, "idle"),
              kf(8, "walk"),
              kf(A, "idle", { blend: 6 }),
              kf(A + 2, "give", { blend: 6 }),
              kf(G + 6, "idle", { blend: 8 }),
              kf(G + 20, "sit", { blend: 4 }),
              kf(G + 20 + SIT_FRAMES, "seated_talk", { blend: 8 }),
            ],
            item: [kf(0, "document"), kf(G, "neutral")],
            expression: [kf(0, "happy")],
          },
          { outfit: "business" },
        ),
        person("maria", "char_era_01@1", {
          x: [kf(0, MARIA_FEET)],
          facing: [kf(0, "left")],
          clip: [
            kf(0, "seated_type"),
            kf(up - 14, "seated", { blend: 6 }),
            kf(up, "stand_up", { blend: 4 }),
            kf(up + SIT_FRAMES, "idle", { blend: 6 }),
            kf(A + 4, "give", { blend: 6 }),
            kf(G + 6, "idle", { blend: 8 }),
            kf(G + 16, "sit", { blend: 4 }),
            kf(G + 16 + SIT_FRAMES, "seated_read", { blend: 8 }),
          ],
          item: [kf(0, "neutral"), kf(G, "document")],
          expression: [kf(0, "neutral"), kf(up - 14, "surprised"), kf(up + 6, "happy")],
        }),
      ],
    };
  },

  // the halo appears; every answer now sounds brilliant
  s05: (len, words) => {
    const smart = wordAt(words, "smarter", 1.0);
    const labels: Array<[string, string, number]> = [
      ["l1", "SMARTER", smart],
      ["l2", "MORE RELIABLE", wordAt(words, "reliable", 2.0)],
      ["l3", "A NATURAL LEADER", wordAt(words, "leader", 3.0)],
    ];
    return {
      background: { asset: "bg_interview_office_01@1" },
      camera: {
        x: [kf(0, 1200)],
        y: [kf(0, 1400)],
        zoom: [kf(0, 1.3), kf(len - 1, 1.42, { ease: "easeInOut" })],
      },
      captionY: 0.82,
      transitionIn: { type: "cut", frames: 0 },
      nodes: [
        door([[0, 1]]),
        ...officeSet(),
        svg("halo", "prop_halo_01@1", 30, HALO_AT[0], HALO_AT[1], {
          tracks: {
            scale: [kf(smart - 4, 0), kf(smart + 8, 0.7, { ease: "easeOutBack" })],
            "part.glow.scaleX": [kf(0, 1), kf(len - 1, 1.08)],
          },
          props: { idle: "float" },
        }),
        ...labels.map(([id, t, f], i) => text(id, t, "title_clean", 250 + i * 120, f, len - 10)),
        person(
          "alex",
          "char_arti_01@1",
          {
            x: [kf(0, ALEX_FEET)],
            facing: [kf(0, "right")],
            clip: [kf(0, "seated_talk")],
            expression: [kf(0, "happy")],
          },
          { outfit: "business" },
        ),
        person("maria", "char_era_01@1", {
          x: [kf(0, MARIA_FEET)],
          facing: [kf(0, "left")],
          clip: [
            kf(0, "seated_read"),
            kf(smart, "seated_nod", { blend: 6 }),
            kf(wordAt(words, "leader", 3.0), "seated_nod", { blend: 4 }),
          ],
          item: [kf(0, "document")],
          expression: [kf(0, "happy")],
        }),
      ],
    };
  },

  s06: hostScene(
    [1.6, 1.7],
    1200,
    (len, w) => [
      svg("halo_big", "prop_halo_01@1", 20, HOST_X + 330, 960, {
        tracks: {
          scale: [
            kf(wordAt(w, "halo", 1.4) - 4, 0),
            kf(wordAt(w, "halo", 1.4) + 8, 1.25, { ease: "easeOutBack" }),
          ],
        },
        props: { idle: "float" },
      }),
      text("t_title", "THE HALO EFFECT", "hook_impact", 300, wordAt(w, "halo", 1.4), len - 10, {
        highlight: ["HALO"],
      }),
      text("t_src", "Edward Thorndike · 1920", "label", 445, wordAt(w, "1920", 3.0), len - 10),
    ],
    (len, w) => [
      kf(0, "talk"),
      kf(wordAt(w, "halo", 1.4), "point_side", { blend: 6 }),
      kf(wordAt(w, "halo", 1.4) + 40, "talk", { blend: 8 }),
      kf(wordAt(w, "everything", 8), "arms_up", { blend: 6 }),
      kf(Math.min(len - 10, wordAt(w, "everything", 8) + 30), "talk", { blend: 8 }),
    ],
    (_len, w) => [
      kf(0, "neutral"),
      kf(wordAt(w, "noticed", 4), "thinking"),
      kf(wordAt(w, "everything", 8), "surprised"),
    ],
  ),

  s07: hostScene(
    [2.0, 2.4],
    1150,
    (len, w) => [
      text("t_end", "WHAT ARE YOU ACTUALLY JUDGING?", "hook_impact", 300, wordAt(w, "ask", 4.2), len - 9, {
        highlight: ["JUDGING?"],
      }),
    ],
    (_len, w) => [
      kf(0, "talk"),
      kf(wordAt(w, "brilliant", 3.4), "think", { blend: 8 }),
      kf(wordAt(w, "ask", 4.2), "point_side", { blend: 6 }),
    ],
    (_len, w) => [
      kf(0, "neutral"),
      kf(wordAt(w, "brilliant", 3.4), "thinking"),
      kf(wordAt(w, "ask", 4.2), "neutral"),
    ],
  ),
};

/** Minimum length of each scene so its action fits even with a short line (frames). */
const MIN_FRAMES: Record<string, number> = { s02: 150, s04: 160 };

export function buildHaloTimeline(
  timing: SceneTiming[],
  audioRef = "file://poc/halo/mix.wav",
): RenderTimeline {
  let from = 0;
  const scenes: Scene[] = [];
  const words: Array<{ word: string; start: number; end: number }> = [];
  for (const t of timing) {
    const build = BUILD[t.sceneId];
    if (!build) throw new Error(`no staging for ${t.sceneId}`);
    const duration = Math.max(MIN_FRAMES[t.sceneId] ?? 0, Math.round((t.durationSec + 0.45) * FPS));
    scenes.push({ sceneId: t.sceneId, from, duration, ...build(duration, t.words) } as Scene);
    for (const w of t.words)
      words.push({ word: w.word, start: from / FPS + w.start, end: from / FPS + w.end });
    from += duration;
  }
  return {
    schema: "erkasa.timeline/1",
    fps: 30,
    width: 1080,
    height: 1920,
    seed: 20261111,
    audio: { ref: audioRef },
    captions: { style: "word_pop", wordsPerChunk: 3, words },
    scenes,
  } as RenderTimeline;
}

/** Narration start of each scene (seconds), for the voice track. */
export function sceneStarts(timeline: RenderTimeline): Record<string, number> {
  return Object.fromEntries(timeline.scenes.map((s) => [s.sceneId, s.from / FPS]));
}
