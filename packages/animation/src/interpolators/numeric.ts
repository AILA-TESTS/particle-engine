// ============================================================
// Numeric Interpolators — lerp, clampedLerp, smoothstep, inverseLerp
// ============================================================

import { clamp } from '../utils/math.js';

/**
 * Linear interpolation between a and b by t.
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor (0 = a, 1 = b, can overshoot)
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Linear interpolation clamped to [a, b] (or [b, a] if b < a).
 */
export function clampedLerp(a: number, b: number, t: number): number {
  const result = lerp(a, b, t);
  return a < b ? clamp(result, a, b) : clamp(result, b, a);
}

/**
 * Hermite smoothstep interpolation.
 * Maps t from [edge0, edge1] to a smooth [0, 1] curve.
 * Uses 3t^2 - 2t^3 for smooth acceleration/deceleration.
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Inverse linear interpolation: given a value between a and b,
 * returns the interpolation factor t.
 * @param a - Start value
 * @param b - End value
 * @param value - Value to find t for
 * @returns t such that lerp(a, b, t) === value
 */
export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) return 0;
  return (value - a) / (b - a);
}
