// ============================================================
// Animation Buffer — SoA typed arrays for batch interpolation
// ============================================================

import type { AnimationBuffer } from '../types.js';
import { nextPowerOf2 } from '../utils/math.js';

/**
 * Create an AnimationBuffer with the given capacity.
 * Capacity is rounded up to the nearest power of 2.
 *
 * @param particleCount - Number of particles to support
 * @returns A new AnimationBuffer
 */
export function createAnimationBuffer(particleCount: number): AnimationBuffer {
  const size = nextPowerOf2(particleCount);

  return {
    fromOpacity:  new Float32Array(size),
    fromSize:     new Float32Array(size),
    fromColorL:   new Float32Array(size),
    fromColorA:   new Float32Array(size),
    fromColorB:   new Float32Array(size),
    toOpacity:    new Float32Array(size),
    toSize:       new Float32Array(size),
    toColorL:     new Float32Array(size),
    toColorA:     new Float32Array(size),
    toColorB:     new Float32Array(size),
    outOpacity:   new Float32Array(size),
    outSize:      new Float32Array(size),
    outColorR:    new Uint8Array(size),
    outColorG:    new Uint8Array(size),
    outColorB:    new Uint8Array(size),
  };
}

/**
 * Get the capacity (length) of an AnimationBuffer.
 */
export function getBufferCapacity(buffer: AnimationBuffer): number {
  return buffer.fromOpacity.length;
}
