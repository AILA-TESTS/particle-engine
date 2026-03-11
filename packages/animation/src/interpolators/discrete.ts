// ============================================================
// Discrete Interpolators — Midpoint switch, opacity-mediated booleans
// ============================================================

/**
 * Midpoint switch for discrete properties (e.g., line style).
 * Returns `from` for the first half, `to` for the second half.
 */
export function midpointSwitch<T>(from: T, to: T, t: number): T {
  return t < 0.5 ? from : to;
}

/**
 * Opacity-mediated boolean transition.
 *
 * For transitions like `active: true -> false`:
 * - Keep `true` until t=1, then switch to `false`
 * - Opacity should be animated to 0 separately
 *
 * For transitions like `active: false -> true`:
 * - Switch to `true` at t=0
 * - Opacity should be animated from 0 separately
 *
 * For `directed` and similar display-only booleans,
 * use midpoint switch.
 */
export function opacityMediatedBoolean(from: boolean, to: boolean, t: number): boolean {
  if (from === to) return from;

  if (from && !to) {
    // true -> false: keep true until the very end
    return t < 1;
  }
  // false -> true: switch immediately
  return true;
}
