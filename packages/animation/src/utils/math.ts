// ============================================================
// Math Utilities
// ============================================================

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Round up to the nearest power of 2 */
export function nextPowerOf2(n: number): number {
  if (n <= 0) return 1;
  n = Math.ceil(n);
  n--;
  n |= n >> 1;
  n |= n >> 2;
  n |= n >> 4;
  n |= n >> 8;
  n |= n >> 16;
  n++;
  return n;
}
