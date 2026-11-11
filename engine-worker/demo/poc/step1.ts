/**
 * Visual PoC, step 1: walking to a chair, sitting, talking seated, standing up and leaving.
 * Hand-built timeline (no compiler) to judge the animation itself before automating it.
 *
 *   pnpm --filter @erkasa/engine-worker exec tsx demo/poc/step1.ts [outDir]
 */
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SEAT, sideGaitSpeed } from "@erkasa/engine";
import { loadEngine, renderStill, renderVideo } from "../../src/render.js";

const ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const ASSETS = join(ROOT, "assets");
const OUT = resolve(process.argv[2] ?? join(ROOT, "out", "poc"));

const FPS = 30;
const FLOOR = 1690;
const SCALE = 0.92;
const WALK = sideGaitSpeed("walk") * SCALE; // world px / s with no foot sliding
const BACK = SEAT.back * SCALE; // seated hips sit this far behind the feet

type KF = { f: number; v: number | string; ease?: string; blend?: number };
const kf = (f: number, v: number | string, extra: Partial<KF> = {}): KF => ({
  f: Math.round(f),
  v,
  ...extra,
});

/**
 * x keyframes of a walk from `x0` to `x1` starting at frame `f0`: eases in over the gait's ramp,
 * then moves at exactly the gait speed. Returns the keyframes and the arrival frame.
 */
function walkX(f0: number, x0: number, x1: number): { keys: KF[]; arrive: number } {
  const dir = Math.sign(x1 - x0);
  const dist = Math.abs(x1 - x0);
  const ramp = 0.25 * FPS; // the walk action eases in over 0.25 s
  const rampDist = (WALK * 0.25) / 2;
  // no ease-out: the body stops with a planted foot and the legs settle into the idle pose (blend)
  const cruise = ((dist - rampDist) / WALK) * FPS;
  const a = f0 + ramp;
  const arrive = a + cruise;
  return {
    keys: [kf(f0, x0), kf(a, x0 + dir * rampDist, { ease: "easeIn" }), kf(arrive, x1, { ease: "linear" })],
    arrive: Math.round(arrive),
  };
}

// --- stage (matches bg_interview_office_01 anchors) ---
const DOOR_X = 560;
const ALEX_HIP = 880; // chair seat, facing right
const MARIA_HIP = 1720; // chair seat, facing left
const DESK_X = 1300;
const DESK_TOP = FLOOR - 348;

const alexFeet = ALEX_HIP + BACK;
const mariaFeet = MARIA_HIP - BACK;

const enter = walkX(22, DOOR_X, alexFeet);
const sitAt = enter.arrive + 3;
const seatedAt = sitAt + Math.round(0.85 * FPS);
const talkAt = seatedAt + 20;
const standAt = 250;
const leave = walkX(standAt + Math.round(0.85 * FPS) + 8, alexFeet, DOOR_X);
const total = leave.arrive + 30;

const timeline = {
  schema: "erkasa.timeline/1",
  fps: FPS,
  width: 1080,
  height: 1920,
  seed: 20261111,
  audio: { ref: "file://poc/silent.wav" },
  scenes: [
    {
      sceneId: "s01",
      from: 0,
      duration: total,
      background: { asset: "bg_interview_office_01@1" },
      camera: {
        x: [
          kf(0, 860),
          kf(enter.arrive, 1320, { ease: "easeInOutCubic" }),
          kf(standAt + 30, 1320),
          kf(total - 1, 900, { ease: "easeInOutCubic" }),
        ],
        y: [kf(0, 1500)],
        // door close-up -> wide while he walks -> slow push to a medium two-shot while they talk -> back out
        zoom: [
          kf(0, 1.3),
          kf(enter.arrive, 1.0, { ease: "easeInOutCubic" }),
          kf(talkAt, 1.0),
          kf(standAt - 10, 1.3, { ease: "easeInOut" }),
          kf(standAt + 20, 1.05, { ease: "easeInOutCubic" }),
        ],
      },
      transitionIn: { type: "cut", frames: 0 },
      nodes: [
        {
          id: "door",
          adapter: "svg",
          asset: "prop_door_01@1",
          z: 2,
          space: "world",
          props: {},
          tracks: {
            x: [kf(0, DOOR_X)],
            y: [kf(0, 1560 - 465)],
            "part.leaf.scaleX": [
              kf(8, 1),
              kf(24, 0.12, { ease: "easeOutCubic" }),
              kf(enter.arrive - 10, 0.12),
              kf(enter.arrive + 8, 1, { ease: "easeInOutCubic" }),
              kf(leave.arrive - 24, 1),
              kf(leave.arrive - 8, 0.12, { ease: "easeOutCubic" }),
            ],
          },
        },
        {
          id: "clock",
          adapter: "svg",
          asset: "prop_wall_clock_01@1",
          z: 2,
          space: "world",
          props: {},
          tracks: { x: [kf(0, 1220)], y: [kf(0, 640)], scale: [kf(0, 0.8)] },
        },
        {
          id: "plant",
          adapter: "svg",
          asset: "prop_plant_floor_01@1",
          z: 3,
          space: "world",
          props: {},
          tracks: { x: [kf(0, 2010)], y: [kf(0, 1600 - 210)] },
        },
        {
          id: "chair_alex",
          adapter: "svg",
          asset: "prop_chair_office_side_01@1",
          z: 5,
          space: "world",
          props: {},
          tracks: { x: [kf(0, ALEX_HIP + 30)], y: [kf(0, FLOOR - 280)] },
        },
        {
          id: "chair_maria",
          adapter: "svg",
          asset: "prop_chair_office_side_01@1",
          z: 5,
          space: "world",
          props: { flip: true },
          tracks: { x: [kf(0, MARIA_HIP - 30)], y: [kf(0, FLOOR - 280)] },
        },
        {
          id: "alex",
          adapter: "character",
          asset: "char_arti_01@1",
          z: 10,
          space: "world",
          props: { speaks: false },
          tracks: {
            x: [...enter.keys, ...leave.keys],
            y: [kf(0, FLOOR)],
            scale: [kf(0, SCALE)],
            opacity: [kf(0, 0), kf(22, 0), kf(32, 1), kf(leave.arrive - 12, 1), kf(leave.arrive - 2, 0)],
            facing: [kf(0, "right"), kf(leave.keys[0]?.f ?? 0, "left")],
            clip: [
              kf(0, "idle"),
              kf(enter.keys[0]?.f ?? 0, "walk"),
              kf(enter.arrive, "idle", { blend: 6 }),
              kf(sitAt, "sit", { blend: 4 }),
              kf(talkAt, "seated_talk", { blend: 8 }),
              kf(talkAt + 70, "seated", { blend: 10 }),
              kf(standAt, "stand_up", { blend: 4 }),
              kf(leave.keys[0]?.f ?? 0, "walk", { blend: 6 }),
            ],
            expression: [kf(0, "neutral"), kf(talkAt, "happy"), kf(standAt, "neutral")],
          },
        },
        {
          id: "maria",
          adapter: "character",
          asset: "char_era_01@1",
          z: 10,
          space: "world",
          props: { speaks: false },
          tracks: {
            x: [kf(0, mariaFeet)],
            y: [kf(0, FLOOR)],
            scale: [kf(0, SCALE)],
            facing: [kf(0, "left")],
            clip: [
              kf(0, "seated_type"),
              kf(enter.arrive - 8, "seated", { blend: 8 }),
              kf(talkAt + 20, "seated_nod", { blend: 6 }),
              kf(talkAt + 80, "seated_talk", { blend: 8 }),
              kf(standAt + 10, "seated", { blend: 10 }),
              kf(leave.arrive - 20, "seated_type", { blend: 10 }),
            ],
            expression: [kf(0, "neutral"), kf(talkAt + 20, "happy")],
          },
        },
        {
          id: "desk",
          adapter: "svg",
          asset: "prop_desk_side_01@1",
          z: 15,
          space: "world",
          props: {},
          tracks: { x: [kf(0, DESK_X)], y: [kf(0, FLOOR - 190)] },
        },
        {
          id: "laptop",
          adapter: "svg",
          asset: "prop_laptop_side_01@1",
          z: 16,
          space: "world",
          props: {},
          tracks: { x: [kf(0, 1440)], y: [kf(0, DESK_TOP - (162 - 85))] },
        },
        {
          id: "mug",
          adapter: "svg",
          asset: "prop_mug_01@1",
          z: 16,
          space: "world",
          props: {},
          tracks: { x: [kf(0, 1160)], y: [kf(0, DESK_TOP - (88 - 45))] },
        },
      ],
    },
  ],
};

writeFileSync(join(OUT, "step1.timeline.json"), JSON.stringify(timeline, null, 1));
const engine = loadEngine(timeline, ASSETS);
for (const f of [
  0,
  20,
  enter.arrive - 15,
  sitAt + 12,
  seatedAt + 5,
  talkAt + 30,
  standAt + 12,
  leave.keys[0]?.f ?? 0,
  total - 25,
])
  renderStill(engine, f, join(OUT, `step1-f${String(f).padStart(3, "0")}.png`));
const res = await renderVideo({ timeline, assetsDir: ASSETS, out: join(OUT, "step1.mp4") });
console.info(
  `walk speed ${WALK.toFixed(0)} px/s, seat back ${BACK.toFixed(0)} px; ${res.frames} frames -> ${join(OUT, "step1.mp4")}`,
);
