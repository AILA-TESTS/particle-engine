// ============================================================
// Keyframe Matcher — Match particles across keyframes
// ============================================================

import type { Keyframe, KeyframeMatchResult } from '../types.js';

/**
 * Create a position key for a particle.
 */
function particleKey(row: number, col: number): string {
  return `${row},${col}`;
}

/**
 * Create a connection key.
 */
function connectionKey(from: [number, number], to: [number, number]): string {
  return `${from[0]},${from[1]}->${to[0]},${to[1]}`;
}

/**
 * Match particles between two consecutive keyframes.
 *
 * Uses position-based matching: particles at the same [row, col] in both
 * keyframes are considered the same particle.
 *
 * Returns matched, appearing, and disappearing particles.
 */
export function matchKeyframes(from: Keyframe, to: Keyframe): KeyframeMatchResult {
  // Build lookup maps for the 'from' keyframe
  const fromParticleMap = new Map<string, number>();
  for (let i = 0; i < from.particles.length; i++) {
    const p = from.particles[i];
    fromParticleMap.set(particleKey(p.row, p.col), i);
  }

  // Build lookup maps for the 'to' keyframe
  const toParticleMap = new Map<string, number>();
  for (let i = 0; i < to.particles.length; i++) {
    const p = to.particles[i];
    toParticleMap.set(particleKey(p.row, p.col), i);
  }

  // Find matches, appearing, and disappearing particles
  const matched: KeyframeMatchResult['matched'] = [];
  const appearing: KeyframeMatchResult['appearing'] = [];
  const disappearing: KeyframeMatchResult['disappearing'] = [];

  // Check each 'to' particle against 'from'
  for (const [key, toIndex] of toParticleMap) {
    const fromIndex = fromParticleMap.get(key);
    if (fromIndex !== undefined) {
      matched.push({ fromIndex, toIndex, key });
    } else {
      appearing.push({ toIndex, key });
    }
  }

  // Check for disappearing (in 'from' but not in 'to')
  for (const [key, fromIndex] of fromParticleMap) {
    if (!toParticleMap.has(key)) {
      disappearing.push({ fromIndex, key });
    }
  }

  // Connection matching
  const fromConnMap = new Map<string, number>();
  for (let i = 0; i < from.connections.length; i++) {
    const c = from.connections[i];
    fromConnMap.set(connectionKey(c.from, c.to), i);
  }

  const toConnMap = new Map<string, number>();
  for (let i = 0; i < to.connections.length; i++) {
    const c = to.connections[i];
    toConnMap.set(connectionKey(c.from, c.to), i);
  }

  const connectionMatched: KeyframeMatchResult['connectionMatched'] = [];
  const connectionAppearing: KeyframeMatchResult['connectionAppearing'] = [];
  const connectionDisappearing: KeyframeMatchResult['connectionDisappearing'] = [];

  for (const [key, toIndex] of toConnMap) {
    const fromIndex = fromConnMap.get(key);
    if (fromIndex !== undefined) {
      connectionMatched.push({ fromIndex, toIndex, key });
    } else {
      connectionAppearing.push({ toIndex, key });
    }
  }

  for (const [key, fromIndex] of fromConnMap) {
    if (!toConnMap.has(key)) {
      connectionDisappearing.push({ fromIndex, key });
    }
  }

  return {
    matched,
    appearing,
    disappearing,
    connectionMatched,
    connectionAppearing,
    connectionDisappearing,
  };
}

/**
 * Match all consecutive keyframe pairs in an animation.
 */
export function matchAllKeyframes(keyframes: Keyframe[]): KeyframeMatchResult[] {
  const results: KeyframeMatchResult[] = [];
  for (let i = 0; i < keyframes.length - 1; i++) {
    results.push(matchKeyframes(keyframes[i], keyframes[i + 1]));
  }
  return results;
}
