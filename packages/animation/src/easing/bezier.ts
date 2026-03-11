// ============================================================
// Cubic Bezier Easing — Newton-Raphson + Bisection fallback
// ============================================================
//
// Port of the bezier-easing algorithm (~100 lines, no deps).
// A cubic bezier curve defined by two control points (x1, y1) and (x2, y2),
// with (0,0) and (1,1) as the start and end points.

import type { EasingFn } from '../types.js';

const NEWTON_ITERATIONS = 4;
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_PRECISION = 0.0000001;
const SUBDIVISION_MAX_ITERATIONS = 10;
const TABLE_SIZE = 11;
const SAMPLE_STEP_SIZE = 1.0 / (TABLE_SIZE - 1);

function a(a1: number, a2: number): number {
  return 1.0 - 3.0 * a2 + 3.0 * a1;
}

function b(a1: number, a2: number): number {
  return 3.0 * a2 - 6.0 * a1;
}

function c(a1: number): number {
  return 3.0 * a1;
}

/** Evaluate the bezier curve polynomial at t */
function calcBezier(aT: number, a1: number, a2: number): number {
  return ((a(a1, a2) * aT + b(a1, a2)) * aT + c(a1)) * aT;
}

/** Evaluate the derivative of the bezier curve polynomial at t */
function getSlope(aT: number, a1: number, a2: number): number {
  return 3.0 * a(a1, a2) * aT * aT + 2.0 * b(a1, a2) * aT + c(a1);
}

/** Newton-Raphson iteration to find t for a given x */
function newtonRaphsonIterate(aX: number, aGuessT: number, mX1: number, mX2: number): number {
  let currentT = aGuessT;
  for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
    const currentSlope = getSlope(currentT, mX1, mX2);
    if (currentSlope === 0.0) return currentT;
    const currentX = calcBezier(currentT, mX1, mX2) - aX;
    currentT -= currentX / currentSlope;
  }
  return currentT;
}

/** Bisection fallback when Newton-Raphson fails */
function binarySubdivide(aX: number, aA: number, aB: number, mX1: number, mX2: number): number {
  let currentT: number;
  let currentX: number;
  let i = 0;
  let low = aA;
  let high = aB;
  do {
    currentT = low + (high - low) / 2.0;
    currentX = calcBezier(currentT, mX1, mX2) - aX;
    if (currentX > 0.0) {
      high = currentT;
    } else {
      low = currentT;
    }
  } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
  return currentT;
}

/**
 * Create a cubic bezier easing function.
 * @param x1 - x of first control point (0-1)
 * @param y1 - y of first control point
 * @param x2 - x of second control point (0-1)
 * @param y2 - y of second control point
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  // Linear case
  if (x1 === y1 && x2 === y2) {
    return (t: number) => t;
  }

  // Precompute sample table
  const sampleValues = new Float32Array(TABLE_SIZE);
  for (let i = 0; i < TABLE_SIZE; ++i) {
    sampleValues[i] = calcBezier(i * SAMPLE_STEP_SIZE, x1, x2);
  }

  function getTForX(aX: number): number {
    let intervalStart = 0.0;
    let currentSample = 1;
    const lastSample = TABLE_SIZE - 1;

    // Find the interval in the sample table
    for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
      intervalStart += SAMPLE_STEP_SIZE;
    }
    --currentSample;

    // Interpolate to get initial guess
    const dist = (aX - sampleValues[currentSample]) /
      (sampleValues[currentSample + 1] - sampleValues[currentSample]);
    const guessForT = intervalStart + dist * SAMPLE_STEP_SIZE;

    const initialSlope = getSlope(guessForT, x1, x2);
    if (initialSlope >= NEWTON_MIN_SLOPE) {
      return newtonRaphsonIterate(aX, guessForT, x1, x2);
    }
    if (initialSlope === 0.0) {
      return guessForT;
    }
    return binarySubdivide(aX, intervalStart, intervalStart + SAMPLE_STEP_SIZE, x1, x2);
  }

  return (t: number): number => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return calcBezier(getTForX(t), y1, y2);
  };
}
