import { fmt } from "./svg-template.js";
import { sampleNumber, type Tracks } from "./tracks.js";

export interface CameraState {
  /** Center of view in world (background) pixels. */
  x: number;
  y: number;
  zoom: number;
  rotation: number;
  /** Shake amplitude in screen pixels. */
  shake: number;
}

export interface Viewport {
  width: number;
  height: number;
  worldWidth: number;
  worldHeight: number;
}

export function sampleCamera(tracks: Tracks, frame: number, vp: Viewport): CameraState {
  return {
    x: sampleNumber(tracks["x"], frame, vp.worldWidth / 2),
    y: sampleNumber(tracks["y"], frame, vp.worldHeight / 2),
    zoom: sampleNumber(tracks["zoom"], frame, 1),
    rotation: sampleNumber(tracks["rotation"], frame, 0),
    shake: sampleNumber(tracks["shake"], frame, 0),
  };
}

/** How much a layer at `depth` follows the camera: far layers move less, foreground more. */
export function parallaxFactor(depth: number): number {
  return depth >= 0 ? 1 / (1 + depth) : 1 - depth;
}

/**
 * Transform for a world layer at the given depth. The background is scaled to cover the frame
 * (9:16 shows a 1080-wide slice of the 2560-wide world; 16:9 a 1920x1440 slice).
 */
export function layerTransform(
  cam: CameraState,
  depth: number,
  vp: Viewport,
  frame: number,
  seed: number,
): string {
  const f = parallaxFactor(depth);
  const cover = Math.max(vp.width / vp.worldWidth, vp.height / vp.worldHeight);
  const cx = vp.worldWidth / 2 + (cam.x - vp.worldWidth / 2) * f;
  const cy = vp.worldHeight / 2 + (cam.y - vp.worldHeight / 2) * f;
  const zoom = 1 + (cam.zoom - 1) * f;
  let sx = 0;
  let sy = 0;
  if (cam.shake > 0) {
    const p = frame + seed * 0.001;
    sx = cam.shake * f * (Math.sin(p * 1.73) + Math.sin(p * 3.11 + 1.3)) * 0.5;
    sy = cam.shake * f * (Math.sin(p * 2.31 + 0.7) + Math.sin(p * 4.07)) * 0.5;
  }
  const rot = cam.rotation * f;
  return (
    `translate(${fmt(vp.width / 2 + sx)} ${fmt(vp.height / 2 + sy)})` +
    (rot ? ` rotate(${fmt(rot)})` : "") +
    ` scale(${fmt(cover * zoom)}) translate(${fmt(-cx)} ${fmt(-cy)})`
  );
}
