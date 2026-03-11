// ============================================================
// Grid Position Interpolators — Bilinear distribution, Bresenham line
// ============================================================

import type { SubGridParticle } from '../types.js';

/**
 * Distribute a continuous position across surrounding grid cells
 * using bilinear interpolation weights.
 *
 * When the position is exactly on a grid point, returns a single particle with weight=1.
 * When between grid points, returns 2-4 particles with weights proportional
 * to the bilinear interpolation.
 *
 * Weights below 0.01 are filtered out.
 *
 * @param continuousR - Continuous row coordinate
 * @param continuousC - Continuous column coordinate
 * @returns Array of sub-grid particles with weights
 */
export function bilinearDistribute(
  continuousR: number,
  continuousC: number
): SubGridParticle[] {
  const rFloor = Math.floor(continuousR);
  const cFloor = Math.floor(continuousC);
  const rFrac = continuousR - rFloor;
  const cFrac = continuousC - cFloor;

  const particles: SubGridParticle[] = [];

  const w00 = (1 - rFrac) * (1 - cFrac);
  const w01 = (1 - rFrac) * cFrac;
  const w10 = rFrac * (1 - cFrac);
  const w11 = rFrac * cFrac;

  if (w00 > 0.01) particles.push({ row: rFloor,     col: cFloor,     weight: w00 });
  if (w01 > 0.01) particles.push({ row: rFloor,     col: cFloor + 1, weight: w01 });
  if (w10 > 0.01) particles.push({ row: rFloor + 1, col: cFloor,     weight: w10 });
  if (w11 > 0.01) particles.push({ row: rFloor + 1, col: cFloor + 1, weight: w11 });

  return particles;
}

/**
 * Bresenham's line algorithm — compute all integer grid points
 * along a line from (r0, c0) to (r1, c1).
 *
 * Returns an array of [row, col] pairs.
 */
export function bresenhamLine(
  r0: number, c0: number,
  r1: number, c1: number
): [number, number][] {
  const points: [number, number][] = [];

  let dr = Math.abs(r1 - r0);
  let dc = Math.abs(c1 - c0);
  const sr = r0 < r1 ? 1 : -1;
  const sc = c0 < c1 ? 1 : -1;
  let err = dr - dc;

  let r = r0;
  let c = c0;

  while (true) {
    points.push([r, c]);

    if (r === r1 && c === c1) break;

    const e2 = 2 * err;
    if (e2 > -dc) {
      err -= dc;
      r += sr;
    }
    if (e2 < dr) {
      err += dr;
      c += sc;
    }
  }

  return points;
}
