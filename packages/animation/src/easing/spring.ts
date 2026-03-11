// ============================================================
// Spring Physics Easing — Precomputed LUT (120 samples)
// ============================================================

import type { EasingFn } from '../types.js';

const LUT_SIZE = 120;

/**
 * Presets for common spring configurations.
 * Each preset is [stiffness, damping, mass].
 */
export const springPresets = {
  gentle: { stiffness: 120, damping: 14, mass: 1 },
  wobbly: { stiffness: 180, damping: 12, mass: 1 },
  stiff:  { stiffness: 300, damping: 20, mass: 1 },
  slow:   { stiffness: 50,  damping: 10, mass: 1 },
} as const;

/**
 * Generate a unique key for a spring configuration.
 */
export function springKey(stiffness: number, damping: number, mass: number): string {
  return `spring:${stiffness}:${damping}:${mass}`;
}

/**
 * Simulate a spring and return a precomputed lookup table (LUT).
 *
 * Uses a damped harmonic oscillator model:
 *   x'' = (-k * (x - 1) - d * x') / m
 *
 * The spring starts at position 0 and settles at position 1.
 *
 * @param stiffness - Spring constant (k)
 * @param damping - Damping coefficient (d)
 * @param mass - Mass (m)
 * @returns Float32Array of LUT_SIZE samples mapping t:[0,1] to position
 */
export function computeSpringLUT(stiffness: number, damping: number, mass: number): Float32Array {
  const lut = new Float32Array(LUT_SIZE);

  // Simulation parameters
  const dt = 1 / 60;  // 60Hz simulation
  const totalTime = 4; // Simulate 4 seconds of spring physics
  const steps = Math.ceil(totalTime / dt);

  // Run the simulation
  let x = 0;  // position (starts at 0, settles to 1)
  let v = 0;  // velocity

  const positions: number[] = [];
  for (let i = 0; i < steps; i++) {
    const springForce = -stiffness * (x - 1);
    const dampingForce = -damping * v;
    const acceleration = (springForce + dampingForce) / mass;

    v += acceleration * dt;
    x += v * dt;
    positions.push(x);
  }

  // Sample the simulation into the LUT (map t:[0,1] to simulation time)
  // Find when the spring is "settled" (within 0.001 of target for 10 frames)
  let settledIndex = positions.length - 1;
  let settledCount = 0;
  for (let i = positions.length - 1; i >= 0; i--) {
    if (Math.abs(positions[i] - 1) < 0.001) {
      settledCount++;
      if (settledCount >= 10) {
        settledIndex = i;
      }
    } else {
      settledCount = 0;
      settledIndex = positions.length - 1;
    }
  }

  // Map LUT indices to simulation positions
  for (let i = 0; i < LUT_SIZE; i++) {
    const t = i / (LUT_SIZE - 1);
    const simIndex = t * settledIndex;
    const lo = Math.floor(simIndex);
    const hi = Math.min(lo + 1, positions.length - 1);
    const frac = simIndex - lo;
    lut[i] = positions[lo] * (1 - frac) + positions[hi] * frac;
  }

  // Ensure exact endpoints
  lut[0] = 0;
  lut[LUT_SIZE - 1] = 1;

  return lut;
}

/**
 * Create a spring easing function from a precomputed LUT.
 * Uses linear interpolation between LUT samples.
 */
export function springEasingFromLUT(lut: Float32Array): EasingFn {
  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    const index = t * (lut.length - 1);
    const lo = Math.floor(index);
    const hi = Math.min(lo + 1, lut.length - 1);
    const frac = index - lo;

    return lut[lo] * (1 - frac) + lut[hi] * frac;
  };
}

/**
 * Create a spring easing function.
 */
export function createSpringEasing(stiffness: number, damping: number, mass: number): EasingFn {
  const lut = computeSpringLUT(stiffness, damping, mass);
  return springEasingFromLUT(lut);
}
