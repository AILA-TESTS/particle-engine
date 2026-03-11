// ============================================================
// Buffer Pool — Power-of-2 buffer pool for reuse
// ============================================================

import type { AnimationBuffer } from '../types.js';
import { createAnimationBuffer } from './animation-buffer.js';
import { nextPowerOf2 } from '../utils/math.js';

/**
 * A pool that manages AnimationBuffer instances for reuse.
 * Buffers are keyed by their power-of-2 capacity.
 */
export class BufferPool {
  private available: Map<number, AnimationBuffer[]> = new Map();

  /**
   * Acquire a buffer that can hold at least `particleCount` particles.
   * Returns a pooled buffer if available, or creates a new one.
   */
  acquire(particleCount: number): AnimationBuffer {
    const size = nextPowerOf2(particleCount);
    const pool = this.available.get(size);

    if (pool && pool.length > 0) {
      return pool.pop()!;
    }

    return createAnimationBuffer(particleCount);
  }

  /**
   * Release a buffer back to the pool for reuse.
   */
  release(buffer: AnimationBuffer): void {
    const size = buffer.fromOpacity.length;
    let pool = this.available.get(size);
    if (!pool) {
      pool = [];
      this.available.set(size, pool);
    }
    pool.push(buffer);
  }

  /**
   * Clear all pooled buffers to free memory.
   */
  clear(): void {
    this.available.clear();
  }

  /**
   * Get the number of buffers currently in the pool.
   */
  get pooledCount(): number {
    let count = 0;
    for (const pool of this.available.values()) {
      count += pool.length;
    }
    return count;
  }
}
