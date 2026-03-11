// ============================================================
// Easing Registry — resolveEasing(spec) -> EasingFn
// ============================================================

import type { EasingFn, EasingSpec } from '../types.js';
import { pennerEasings } from './penner.js';
import { cubicBezier } from './bezier.js';
import { createSpringEasing, springKey, computeSpringLUT, springEasingFromLUT } from './spring.js';
import { createSteps } from './steps.js';

export { pennerEasings } from './penner.js';
export { cubicBezier } from './bezier.js';
export { createSpringEasing, computeSpringLUT, springEasingFromLUT, springKey, springPresets } from './spring.js';
export { createSteps } from './steps.js';

/**
 * Generate a unique key for an EasingSpec (for caching).
 */
export function easingSpecKey(spec: EasingSpec): string {
  if (typeof spec === 'string') return spec;
  if (spec.type === 'cubicBezier') return `bezier:${spec.x1}:${spec.y1}:${spec.x2}:${spec.y2}`;
  if (spec.type === 'spring') return springKey(spec.stiffness, spec.damping, spec.mass);
  return `steps:${spec.count}:${spec.jump}`;
}

/**
 * Resolve an EasingSpec to an EasingFn.
 * Looks up named easings from the Penner registry,
 * creates cubic bezier / spring / step functions on the fly.
 *
 * @param spec - The easing specification
 * @param cache - Optional cache map for reuse
 * @returns The resolved easing function
 */
export function resolveEasing(spec: EasingSpec, cache?: Map<string, EasingFn>): EasingFn {
  const key = easingSpecKey(spec);

  // Check cache first
  if (cache?.has(key)) {
    return cache.get(key)!;
  }

  let fn: EasingFn;

  if (typeof spec === 'string') {
    fn = pennerEasings[spec];
    if (!fn) {
      throw new Error(`Unknown easing function: ${spec}`);
    }
  } else if (spec.type === 'cubicBezier') {
    fn = cubicBezier(spec.x1, spec.y1, spec.x2, spec.y2);
  } else if (spec.type === 'spring') {
    fn = createSpringEasing(spec.stiffness, spec.damping, spec.mass);
  } else {
    fn = createSteps(spec.count, spec.jump);
  }

  // Store in cache
  cache?.set(key, fn);

  return fn;
}
