// ============================================================
// Step Function Easing
// ============================================================

import type { EasingFn } from '../types.js';

/**
 * Create a step easing function.
 *
 * @param count - Number of steps
 * @param jump - 'start' = step at the beginning of each interval,
 *               'end' = step at the end of each interval
 */
export function createSteps(count: number, jump: 'start' | 'end'): EasingFn {
  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    if (jump === 'start') {
      // Step up at the beginning of each interval
      return Math.ceil(t * count) / count;
    }
    // jump === 'end': step up at the end of each interval
    return Math.floor(t * count) / count;
  };
}
