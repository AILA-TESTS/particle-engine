// ============================================================
// Penner Easing Functions — All 30 standard easing functions
// ============================================================
//
// Each function maps t in [0,1] to an eased value.
// "In" = starts slow, "Out" = ends slow, "InOut" = both.

import type { EasingFn } from '../types.js';

const { PI, sin, cos, pow, sqrt } = Math;
const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;
const c4 = (2 * PI) / 3;
const c5 = (2 * PI) / 4.5;

// --- Linear ---
export const linear: EasingFn = (t) => t;

// --- Quad ---
export const easeInQuad: EasingFn = (t) => t * t;
export const easeOutQuad: EasingFn = (t) => 1 - (1 - t) * (1 - t);
export const easeInOutQuad: EasingFn = (t) =>
  t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2) / 2;

// --- Cubic ---
export const easeInCubic: EasingFn = (t) => t * t * t;
export const easeOutCubic: EasingFn = (t) => 1 - pow(1 - t, 3);
export const easeInOutCubic: EasingFn = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2;

// --- Quart ---
export const easeInQuart: EasingFn = (t) => t * t * t * t;
export const easeOutQuart: EasingFn = (t) => 1 - pow(1 - t, 4);
export const easeInOutQuart: EasingFn = (t) =>
  t < 0.5 ? 8 * t * t * t * t : 1 - pow(-2 * t + 2, 4) / 2;

// --- Quint ---
export const easeInQuint: EasingFn = (t) => t * t * t * t * t;
export const easeOutQuint: EasingFn = (t) => 1 - pow(1 - t, 5);
export const easeInOutQuint: EasingFn = (t) =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - pow(-2 * t + 2, 5) / 2;

// --- Sine ---
export const easeInSine: EasingFn = (t) => 1 - cos((t * PI) / 2);
export const easeOutSine: EasingFn = (t) => sin((t * PI) / 2);
export const easeInOutSine: EasingFn = (t) => -(cos(PI * t) - 1) / 2;

// --- Expo ---
export const easeInExpo: EasingFn = (t) =>
  t === 0 ? 0 : pow(2, 10 * t - 10);
export const easeOutExpo: EasingFn = (t) =>
  t === 1 ? 1 : 1 - pow(2, -10 * t);
export const easeInOutExpo: EasingFn = (t) =>
  t === 0 ? 0 : t === 1 ? 1 : t < 0.5
    ? pow(2, 20 * t - 10) / 2
    : (2 - pow(2, -20 * t + 10)) / 2;

// --- Circ ---
export const easeInCirc: EasingFn = (t) => 1 - sqrt(1 - pow(t, 2));
export const easeOutCirc: EasingFn = (t) => sqrt(1 - pow(t - 1, 2));
export const easeInOutCirc: EasingFn = (t) =>
  t < 0.5
    ? (1 - sqrt(1 - pow(2 * t, 2))) / 2
    : (sqrt(1 - pow(-2 * t + 2, 2)) + 1) / 2;

// --- Back ---
export const easeInBack: EasingFn = (t) => c3 * t * t * t - c1 * t * t;
export const easeOutBack: EasingFn = (t) =>
  1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2);
export const easeInOutBack: EasingFn = (t) =>
  t < 0.5
    ? (pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;

// --- Elastic ---
export const easeInElastic: EasingFn = (t) =>
  t === 0 ? 0 : t === 1 ? 1 : -pow(2, 10 * t - 10) * sin((10 * t - 10.75) * c4);
export const easeOutElastic: EasingFn = (t) =>
  t === 0 ? 0 : t === 1 ? 1 : pow(2, -10 * t) * sin((10 * t - 0.75) * c4) + 1;
export const easeInOutElastic: EasingFn = (t) =>
  t === 0 ? 0 : t === 1 ? 1 : t < 0.5
    ? -(pow(2, 20 * t - 10) * sin((20 * t - 11.125) * c5)) / 2
    : (pow(2, -20 * t + 10) * sin((20 * t - 11.125) * c5)) / 2 + 1;

// --- Bounce ---
export const easeOutBounce: EasingFn = (t) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) {
    return n1 * t * t;
  }
  if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  }
  if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  }
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

export const easeInBounce: EasingFn = (t) => 1 - easeOutBounce(1 - t);

export const easeInOutBounce: EasingFn = (t) =>
  t < 0.5
    ? (1 - easeOutBounce(1 - 2 * t)) / 2
    : (1 + easeOutBounce(2 * t - 1)) / 2;

/** Map of all Penner easing functions by name */
export const pennerEasings: Record<string, EasingFn> = {
  linear,
  easeInQuad, easeOutQuad, easeInOutQuad,
  easeInCubic, easeOutCubic, easeInOutCubic,
  easeInQuart, easeOutQuart, easeInOutQuart,
  easeInQuint, easeOutQuint, easeInOutQuint,
  easeInSine, easeOutSine, easeInOutSine,
  easeInExpo, easeOutExpo, easeInOutExpo,
  easeInCirc, easeOutCirc, easeInOutCirc,
  easeInBack, easeOutBack, easeInOutBack,
  easeInElastic, easeOutElastic, easeInOutElastic,
  easeInBounce, easeOutBounce, easeInOutBounce,
};
