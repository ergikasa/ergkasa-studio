/**
 * One 1080×1920 frame of the test character on the pipeline's canvas library, and its pixels' sha256.
 * Run as a script, it prints the sha256 of every pose in FRAME_POSES (render.test.ts compares them with its own).
 */
import { createHash } from "node:crypto";
import { createCanvas } from "@napi-rs/canvas";
import { drawCharacter, evaluate, loadCharacter, type LoadedCharacter } from "../src/runtime/index.js";
import { TEST_DIR } from "./helpers.js";

export interface Pose {
  channels: Record<string, number>;
  outfit?: string;
}

export const FRAME_POSES: Pose[] = [
  { channels: {}, outfit: "test_tee" },
  { channels: { head_yaw: 30, au12: 1, gaze_x: -200, arm_l_upper: 60, arm_l_lower: 70 }, outfit: "test_tee" },
  { channels: { head_yaw: 14, lid_r: 1, jaw_open: 0.7, spine_bend: 6 }, outfit: "test_tee" },
  { channels: { au04: 1, head_roll: -12, breath: 1 } },
];

export function renderFrame(c: LoadedCharacter, pose: Pose): { rgba: Buffer; sha: string } {
  const canvas = createCanvas(1080, 1920);
  const g = canvas.getContext("2d");
  g.fillStyle = "#2E3A40";
  g.fillRect(0, 0, 1080, 1920);
  drawCharacter(c, g, evaluate(c, { channels: pose.channels, outfit: pose.outfit }), {
    x: 540,
    y: 1780,
    scale: 1.9,
  });
  // canvas.data(): the frame's RGBA (opaque, so the same bytes as getImageData, which leaks native memory)
  const rgba = Buffer.from(canvas.data());
  return { rgba, sha: createHash("sha256").update(rgba).digest("hex") };
}

if (process.argv[1]?.endsWith("render-frame.ts")) {
  const c = await loadCharacter(TEST_DIR);
  for (const p of FRAME_POSES) console.info(renderFrame(c, p).sha);
}
