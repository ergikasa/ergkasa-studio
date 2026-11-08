import type { Keyframe } from "@erkasa/contracts";

/**
 * Named animations the compiler knows how to build. The Visual Planner may only use these names;
 * each metaphor's asset.json lists exactly the names defined here (checked by a test).
 *
 * A recipe returns track keyframes in scene-local frames. `start` is when it begins, `end` the
 * last frame of the scene (for continuous motions).
 */
export type Tracks = Record<string, Keyframe[]>;
export type Recipe = (start: number, end: number, fps: number) => { tracks: Tracks; duration: number };

const kf = (f: number, v: number, ease?: Keyframe["ease"]): Keyframe =>
  ease ? { f: Math.round(f), v, ease } : { f: Math.round(f), v };

/** Animations every svg asset (object, icon, metaphor) supports. */
export const GENERIC_RECIPES: Record<string, Recipe> = {
  pop_in: (s) => ({
    tracks: { scale: [kf(s, 0), kf(s + 8, 1.12, "easeOutCubic"), kf(s + 13, 1, "easeInOut")] },
    duration: 13,
  }),
  fade: (s) => ({ tracks: { opacity: [kf(s, 0), kf(s + 12, 1, "easeInOut")] }, duration: 12 }),
  bounce: (s) => ({
    tracks: {
      bounce: [
        kf(s, 0),
        kf(s + 6, -60, "easeOutCubic"),
        kf(s + 12, 0, "easeInCubic"),
        kf(s + 16, -20, "easeOutCubic"),
        kf(s + 20, 0, "easeInCubic"),
      ],
    },
    duration: 20,
  }),
  shake: (s) => ({
    tracks: { wiggle: [kf(s, 0), kf(s + 3, 9), kf(s + 6, -9), kf(s + 9, 7), kf(s + 12, -5), kf(s + 15, 0)] },
    duration: 15,
  }),
  scale_pulse: (s) => ({
    tracks: { pulse: [kf(s, 1), kf(s + 6, 1.15, "easeOutCubic"), kf(s + 14, 1, "easeInOut")] },
    duration: 14,
  }),
};

/** Continuous motions, set from a moment until the end of the scene (engine props.idle). */
export const IDLE_MOTIONS = ["float", "bob", "spin", "pulse", "sway"] as const;

function sequence(
  parts: string[],
  prop: string,
  from: number,
  to: number,
  start: number,
  gap: number,
  len: number,
  ease: Keyframe["ease"],
): Tracks {
  const t: Tracks = {};
  parts.forEach((p, i) => {
    t[`part.${p}.${prop}`] = [kf(0, from), kf(start + i * gap, from), kf(start + i * gap + len, to, ease)];
  });
  return t;
}

/** Metaphor-specific animations: asset id -> name -> recipe. */
export const METAPHOR_RECIPES: Record<string, Record<string, Recipe>> = {
  met_dominoes_01: {
    fall: (s) => ({
      tracks: sequence(
        ["domino_1", "domino_2", "domino_3", "domino_4", "domino_5", "domino_6", "domino_7"],
        "rotation",
        0,
        76,
        s,
        7,
        9,
        "easeInCubic",
      ),
      duration: 6 * 7 + 9,
    }),
  },
  met_snowball_01: {
    roll: (s) => ({
      tracks: {
        "part.ball.x": [kf(0, -680), kf(s, -680), kf(s + 75, 0, "easeInCubic")],
        "part.ball.y": [kf(0, -265), kf(s, -265), kf(s + 75, 0, "easeInCubic")],
        "part.ball.scaleX": [kf(0, 0.3), kf(s, 0.3), kf(s + 75, 1, "easeIn")],
        "part.ball.scaleY": [kf(0, 0.3), kf(s, 0.3), kf(s + 75, 1, "easeIn")],
        "part.ball.rotation": [kf(s, 0), kf(s + 75, 720, "easeInCubic")],
      },
      duration: 75,
    }),
  },
  met_hourglass_01: {
    flow: (s) => ({
      tracks: {
        "part.sand_top.scaleY": [kf(s, 1), kf(s + 90, 0.02)],
        "part.sand_bottom.scaleY": [kf(0, 0.05), kf(s, 0.05), kf(s + 90, 1)],
      },
      duration: 90,
    }),
    flip: (s) => ({
      tracks: { "part.frame.rotation": [kf(s, 0), kf(s + 20, 180, "easeInOutBack")] },
      duration: 20,
    }),
  },
  met_brain_gears_01: {
    spin: (s, end, fps) => {
      const secs = Math.max(0.1, (end - s) / fps);
      return {
        tracks: {
          "part.gear_1.rotation": [kf(s, 0), kf(end, 90 * secs)],
          "part.gear_2.rotation": [kf(s, 0), kf(end, -130 * secs)],
          "part.gear_3.rotation": [kf(s, 0), kf(end, -158 * secs)],
        },
        duration: end - s,
      };
    },
  },
  met_balance_01: {
    tilt_left: (s) => balance(s, -14),
    tilt_right: (s) => balance(s, 14),
  },
  met_two_doors_01: {
    open_left: (s) => ({
      tracks: { "part.door_l.scaleX": [kf(s, 1), kf(s + 18, 0.15, "easeInOutCubic")] },
      duration: 18,
    }),
    open_right: (s) => ({
      tracks: { "part.door_r.scaleX": [kf(s, 1), kf(s + 18, 0.15, "easeInOutCubic")] },
      duration: 18,
    }),
  },
  met_seed_to_tree_01: {
    grow: (s) => ({
      tracks: sequence(
        ["stage_sprout", "stage_plant", "stage_tree"],
        "scaleY",
        0,
        1,
        s + 12,
        20,
        16,
        "easeOutBack",
      ),
      duration: 12 + 40 + 16,
    }),
  },
  met_stairs_01: {
    build: (s) => {
      const tracks = sequence(
        ["step_1", "step_2", "step_3", "step_4", "step_5", "step_6"],
        "scaleY",
        0,
        1,
        s,
        5,
        8,
        "easeOutBack",
      );
      tracks["part.flag.scaleY"] = [kf(0, 0), kf(s + 33, 0), kf(s + 43, 1, "easeOutBack")];
      return { tracks, duration: 43 };
    },
  },
  met_chain_break_01: {
    break: (s) => ({
      tracks: {
        "part.spark.opacity": [kf(0, 0), kf(s, 0), kf(s + 2, 1), kf(s + 12, 0)],
        "part.link_break_l.x": [kf(s, 0), kf(s + 18, -90, "easeOutCubic")],
        "part.link_break_l.rotation": [kf(s, 0), kf(s + 18, -35, "easeOutCubic")],
        "part.link_break_r.x": [kf(s, 0), kf(s + 18, 90, "easeOutCubic")],
        "part.link_break_r.rotation": [kf(s, 0), kf(s + 18, 35, "easeOutCubic")],
      },
      duration: 18,
    }),
  },
  met_iceberg_01: {
    reveal: (s) => ({
      tracks: { "part.underwater.opacity": [kf(0, 0), kf(s, 0), kf(s + 30, 1, "easeInOut")] },
      duration: 30,
    }),
  },
  met_comfort_zone_01: {
    expand: (s) => ({
      tracks: {
        "part.zone_mid.scaleX": [kf(0, 0), kf(s, 0), kf(s + 14, 1, "easeOutBack")],
        "part.zone_mid.scaleY": [kf(0, 0), kf(s, 0), kf(s + 14, 1, "easeOutBack")],
        "part.zone_outer.scaleX": [kf(0, 0), kf(s + 12, 0), kf(s + 28, 1, "easeOutBack")],
        "part.zone_outer.scaleY": [kf(0, 0), kf(s + 12, 0), kf(s + 28, 1, "easeOutBack")],
        "part.person.x": [kf(s + 28, 0), kf(s + 58, 260, "easeInOutCubic")],
      },
      duration: 58,
    }),
  },
  met_maze_01: {
    solve: (s) => ({
      tracks: {
        "part.solution.opacity": [kf(0, 0), kf(s, 0), kf(s + 30, 1, "easeInOut")],
        "part.goal.scaleY": [kf(s + 26, 1), kf(s + 32, 1.3, "easeOutCubic"), kf(s + 38, 1)],
      },
      duration: 38,
    }),
  },
  met_mountain_flag_01: {
    climb: (s) => {
      // climber starts at (200,722); waypoints of the zigzag path, relative
      const pts: Array<[number, number]> = [
        [0, 0],
        [270, -82],
        [80, -182],
        [270, -282],
        [130, -372],
        [230, -462],
        [200, -552],
      ];
      const step = 12;
      return {
        tracks: {
          "part.climber.x": pts.map(([x], i) => kf(s + i * step, x, i ? "easeInOut" : undefined)),
          "part.climber.y": pts.map(([, y], i) => kf(s + i * step, y, i ? "easeInOut" : undefined)),
          "part.flag.scaleY": [kf(0, 0), kf(s + 6 * step, 0), kf(s + 6 * step + 10, 1, "easeOutBack")],
        },
        duration: 6 * step + 10,
      };
    },
  },
  met_puppet_01: {
    dance: (s) => {
      const n = 6;
      const osc = (amp: number): Keyframe[] =>
        Array.from({ length: n + 1 }, (_, i) =>
          kf(s + i * 10, i === n ? 0 : i % 2 ? amp : -amp, "easeInOut"),
        );
      return {
        tracks: {
          "part.control.rotation": osc(14),
          "part.puppet_arm_l.rotation": osc(-28),
          "part.puppet_arm_r.rotation": osc(28),
          "part.puppet_head.rotation": osc(8),
          "part.puppet_leg_l.rotation": osc(10),
          "part.puppet_leg_r.rotation": osc(-10),
        },
        duration: n * 10,
      };
    },
  },
  met_crossroads_01: {
    choose_left: (s) => choose(s, "sign_left", "sign_right"),
    choose_right: (s) => choose(s, "sign_right", "sign_left"),
  },
};

function balance(s: number, angle: number): { tracks: Tracks; duration: number } {
  const dy = 220 * Math.sin((angle * Math.PI) / 180);
  return {
    tracks: {
      "part.beam.rotation": [kf(s, 0), kf(s + 22, angle, "easeOutBack")],
      "part.pan_l.y": [kf(s, 0), kf(s + 22, -dy, "easeOutBack")],
      "part.pan_r.y": [kf(s, 0), kf(s + 22, dy, "easeOutBack")],
    },
    duration: 22,
  };
}

function choose(s: number, picked: string, other: string): { tracks: Tracks; duration: number } {
  return {
    tracks: {
      [`part.${picked}.scaleX`]: [kf(s, 1), kf(s + 8, 1.25, "easeOutCubic"), kf(s + 16, 1.15, "easeInOut")],
      [`part.${picked}.scaleY`]: [kf(s, 1), kf(s + 8, 1.25, "easeOutCubic"), kf(s + 16, 1.15, "easeInOut")],
      [`part.${other}.opacity`]: [kf(s, 1), kf(s + 12, 0.35, "easeInOut")],
    },
    duration: 16,
  };
}
