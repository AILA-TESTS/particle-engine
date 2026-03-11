// ============================================================
// Spawn & Death Effects — Transition curves for particle appear/disappear
// ============================================================

import { clamp } from '../utils/math.js';

/**
 * Fade-in curve: linear ramp from 0 to 1.
 * @param t - Progress (0-1)
 * @returns Opacity value (0-1)
 */
export function fadeIn(t: number): number {
  return clamp(t, 0, 1);
}

/**
 * Fade-out curve: linear ramp from 1 to 0.
 * @param t - Progress (0-1)
 * @returns Opacity value (0-1)
 */
export function fadeOut(t: number): number {
  return clamp(1 - t, 0, 1);
}

/**
 * Grow curve: size ramps from 0 to 1 with ease-out.
 * @param t - Progress (0-1)
 * @returns Size multiplier (0-1)
 */
export function grow(t: number): number {
  const ct = clamp(t, 0, 1);
  // ease-out quadratic
  return 1 - (1 - ct) * (1 - ct);
}

/**
 * Shrink curve: size ramps from 1 to 0 with ease-in.
 * @param t - Progress (0-1)
 * @returns Size multiplier (0-1)
 */
export function shrink(t: number): number {
  const ct = clamp(t, 0, 1);
  // ease-in quadratic (reversed)
  return (1 - ct) * (1 - ct);
}

/**
 * Pop curve: quick overshoot then settle.
 * Size goes 0 -> ~1.2 -> 1.0 using an elastic-like curve.
 * @param t - Progress (0-1)
 * @returns Size multiplier (can momentarily exceed 1.0)
 */
export function pop(t: number): number {
  const ct = clamp(t, 0, 1);
  if (ct === 0) return 0;
  if (ct === 1) return 1;
  // Overshoot with back easing
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(ct - 1, 3) + c1 * Math.pow(ct - 1, 2);
}

/**
 * Get the appropriate transition curve based on the transition name.
 */
export function getTransitionCurve(
  transition: 'instant' | 'fadeIn' | 'fadeOut' | 'grow' | 'shrink' | 'pop'
): ((t: number) => number) | null {
  switch (transition) {
    case 'instant': return null;
    case 'fadeIn': return fadeIn;
    case 'fadeOut': return fadeOut;
    case 'grow': return grow;
    case 'shrink': return shrink;
    case 'pop': return pop;
  }
}
