/**
 * Limits a package must stay within. All configurable; the defaults are set by the Product Owner (package size,
 * duration, scenes, nodes per scene) or derived from the six reference films staged in E1.2 (the rest):
 *
 *   aggregate limit = 10 × (highest per-second value measured in B1–B5 and W0) × 100 s, rounded up to two
 *   significant figures; asset count = 10 × the most assets one film used (11); asset file size = 10 × the
 *   largest SVG in the asset library (214 242 bytes), rounded up.
 *
 *   measured peak per second: nodes 2.36 (W0), tracks 20.4 (W0), sample values 823 (W0).
 *
 * E1.5: an audio file has its own limit, 2 × the largest WAV the pipeline writes for a film of the longest
 * duration (100 s): the v2 bed, 48 kHz stereo 16-bit, 19.2 MB; a voice clip as 44.1 kHz mono 32-bit float takes
 * 17.6 MB for the same 100 s. Rounded up: 40 MB.
 */
export interface Budgets {
  packageBytes: number;
  durationSec: number;
  scenes: number;
  nodesPerScene: number;
  nodes: number;
  tracks: number;
  samples: number;
  assets: number;
  assetBytes: number;
  /** E1.5: per audio file. */
  audioBytes: number;
}

export const DEFAULT_BUDGETS: Budgets = {
  packageBytes: 16 * 1024 * 1024,
  durationSec: 100,
  scenes: 200,
  nodesPerScene: 2000,
  nodes: 2400,
  tracks: 21_000,
  samples: 830_000,
  assets: 110,
  assetBytes: 2_200_000,
  audioBytes: 40_000_000,
};
