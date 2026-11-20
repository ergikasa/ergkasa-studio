/**
 * 2D affine matrices in the canvas convention: [a, b, c, d, e, f] maps (x, y) to (a·x + c·y + e, b·x + d·y + f).
 * Angles are degrees, clockwise on screen (y down), as in erkasa.render/1.
 */
export type Mat = readonly [number, number, number, number, number, number];

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

export const rad = (deg: number): number => (deg * Math.PI) / 180;

export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];

export function rotate(deg: number): Mat {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [c, s, -s, c, 0, 0];
}

export const scale = (s: number): Mat => [s, 0, 0, s, 0, 0];

/** m · n: apply n first, then m. */
export function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function invert(m: Mat): Mat {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) throw new Error("singular matrix");
  const a = m[3] / det;
  const b = -m[1] / det;
  const c = -m[2] / det;
  const d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

export const apply = (m: Mat, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];
