// ============================================================
// Stagger Effect — Delay computation for cascaded animations
// ============================================================

/**
 * Compute stagger delays for a set of particles.
 *
 * Each particle receives a delay based on its index and the total stagger duration.
 * The actual animation for each particle starts at its delay time.
 *
 * @param count - Total number of particles
 * @param totalStaggerMs - Total stagger spread in milliseconds
 * @param order - Order of stagger ('index' = by array order, 'reverse' = reversed)
 * @returns Array of delay values in milliseconds
 */
export function computeStaggerDelays(
  count: number,
  totalStaggerMs: number,
  order: 'index' | 'reverse' = 'index'
): number[] {
  if (count <= 1) return [0];

  const delays: number[] = new Array(count);
  const step = totalStaggerMs / (count - 1);

  for (let i = 0; i < count; i++) {
    const index = order === 'reverse' ? count - 1 - i : i;
    delays[i] = index * step;
  }

  return delays;
}
