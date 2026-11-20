/**
 * Vignette and moving film grain applied to raw RGBA after rasterising (the compositor's job in the engine),
 * instead of an feTurbulence layer that resvg would recompute every frame. Not production code.
 *
 * Calibrated to gradeSvg() in demo.mjs: the same linear radial ramp (black, 0 → .55 alpha between 55% and
 * 100% of r = 1250 around (600, 860)) and the same grain composite (mid-grey at alpha .16·noise − .04, mean
 * ≈ .04; the filter works in linearRGB, so its 0.5 grey lands as sRGB 188), so a frame graded here matches the SVG-graded frame apart from the grain's random pattern.
 * `pad` is the margin of a padded raster: canvas coordinates are (x − pad, y − pad) and the margin is left
 * ungraded, as in the SVG.
 */
let VIG = null;
let VW = 0,
  VH = 0,
  VP = -1;
export function gradePixels(buf, n, W, H, pad = 0) {
  if (!VIG || VW !== W || VH !== H || VP !== pad) {
    VW = W;
    VH = H;
    VP = pad;
    VIG = new Float32Array(W * H).fill(1);
    for (let y = pad; y < H - pad; y++)
      for (let x = pad; x < W - pad; x++) {
        const d = Math.hypot(x - pad + 0.5 - 600, y - pad + 0.5 - 860) / 1250;
        const v = Math.min(1, Math.max(0, (d - 0.55) / 0.45));
        VIG[y * W + x] = 1 - 0.55 * v;
      }
  }
  let seed = (n * 2654435761) >>> 0 || 1;
  for (let y = pad; y < H - pad; y++)
    for (let x = pad, i = y * W + pad, p = i * 4; x < W - pad; x++, i++, p += 4) {
      seed ^= seed << 13;
      seed >>>= 0;
      seed ^= seed >> 17;
      seed ^= seed << 5;
      seed >>>= 0;
      // grain alpha .04 ± .032 (fractal noise in [.3, .7] through .16·r − .04), composited as linearRGB 0.5 = sRGB 188
      const a = 0.04 + 0.16 * (((seed & 1023) / 1023 - 0.5) * 0.4);
      const v = VIG[i] * (1 - a);
      const g = 188 * a + 0.5;
      buf[p] = buf[p] * v + g;
      buf[p + 1] = buf[p + 1] * v + g;
      buf[p + 2] = buf[p + 2] * v + g;
    }
}
