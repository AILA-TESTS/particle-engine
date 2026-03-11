// ============================================================
// Color Interpolation — OKLAB-based perceptually uniform blending
// ============================================================

import type { OKLABColor } from '../types.js';
import { hexToRGB, rgbToOKLAB, oklabToRGB } from '../utils/oklab.js';

export { hexToRGB, rgbToOKLAB, oklabToRGB };

/**
 * Interpolate between two OKLAB colors by factor t.
 * @param from - Source color in OKLAB
 * @param to - Target color in OKLAB
 * @param t - Interpolation factor (0 = from, 1 = to)
 * @returns Interpolated color in OKLAB
 */
export function interpolateColorOKLAB(from: OKLABColor, to: OKLABColor, t: number): OKLABColor {
  const mt = 1 - t;
  return {
    L: from.L * mt + to.L * t,
    a: from.a * mt + to.a * t,
    b: from.b * mt + to.b * t,
  };
}

/**
 * Batch interpolation of OKLAB colors using typed arrays.
 *
 * Reads from separate L/a/b Float32Arrays for source and target,
 * writes to separate R/G/B Uint8Arrays for output (sRGB).
 *
 * @param fromL - Source L channel
 * @param fromA - Source a channel
 * @param fromB - Source b channel
 * @param toL - Target L channel
 * @param toA - Target a channel
 * @param toB - Target b channel
 * @param outR - Output red channel (sRGB, 0-255)
 * @param outG - Output green channel (sRGB, 0-255)
 * @param outB_ - Output blue channel (sRGB, 0-255)
 * @param alpha - Interpolation factor
 * @param count - Number of particles to process
 */
export function batchInterpolateColors(
  fromL: Float32Array, fromA: Float32Array, fromB: Float32Array,
  toL: Float32Array, toA: Float32Array, toB: Float32Array,
  outR: Uint8Array, outG: Uint8Array, outB_: Uint8Array,
  alpha: number, count: number
): void {
  const mt = 1 - alpha;
  for (let i = 0; i < count; i++) {
    const L = fromL[i] * mt + toL[i] * alpha;
    const a = fromA[i] * mt + toA[i] * alpha;
    const b = fromB[i] * mt + toB[i] * alpha;
    const [r, g, bVal] = oklabToRGB(L, a, b);
    outR[i] = r;
    outG[i] = g;
    outB_[i] = bVal;
  }
}
