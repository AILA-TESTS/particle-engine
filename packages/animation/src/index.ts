// ============================================================
// @particle-engine/animation — Public API
// ============================================================

// Types
export type {
  EasingFn,
  EasingSpec,
  Keyframe,
  KeyframeParticle,
  KeyframeConnection,
  DiscreteEvent,
  Animation,
  InterpolationEngine,
  PreparedAnimation,
  KeyframeMatchResult,
  FrameState,
  FrameParticle,
  FrameConnection,
  OKLABColor,
  OKLABBuffer,
  AnimationBuffer,
  ActiveEvent,
  SubGridParticle,
} from './types.js';

// Engine
export { AnimationEngine } from './engine/interpolation-engine.js';
export { matchKeyframes, matchAllKeyframes } from './engine/keyframe-matcher.js';
export { findActiveEvents, processEvents } from './engine/event-processor.js';

// Easing
export {
  resolveEasing,
  easingSpecKey,
  pennerEasings,
  cubicBezier,
  createSpringEasing,
  computeSpringLUT,
  springEasingFromLUT,
  springKey,
  springPresets,
  createSteps,
} from './easing/index.js';

// Interpolators
export { lerp, clampedLerp, smoothstep, inverseLerp } from './interpolators/numeric.js';
export { interpolateColorOKLAB, batchInterpolateColors } from './interpolators/color.js';
export { midpointSwitch, opacityMediatedBoolean } from './interpolators/discrete.js';
export { bilinearDistribute, bresenhamLine } from './interpolators/grid-position.js';

// Effects
export { fadeIn, fadeOut, grow, shrink, pop, getTransitionCurve } from './effects/spawn-death.js';
export { computeStaggerDelays } from './effects/stagger.js';

// Buffers
export { createAnimationBuffer, getBufferCapacity } from './buffers/animation-buffer.js';
export { BufferPool } from './buffers/buffer-pool.js';

// Utils
export { clamp, nextPowerOf2 } from './utils/math.js';
export {
  hexToRGB,
  rgbToHex,
  rgbToOKLAB,
  oklabToRGB,
  hexToOKLAB,
  oklabToHex,
  srgbToLinear,
  linearToSrgb,
} from './utils/oklab.js';
