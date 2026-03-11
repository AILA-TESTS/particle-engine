import { describe, it, expect } from 'vitest';
import { BufferPool } from '../src/buffers/buffer-pool.js';
import { createAnimationBuffer, getBufferCapacity } from '../src/buffers/animation-buffer.js';
import { nextPowerOf2 } from '../src/utils/math.js';

describe('BufferPool', () => {
  it('should acquire a new buffer', () => {
    const pool = new BufferPool();
    const buffer = pool.acquire(100);
    expect(buffer).toBeDefined();
    expect(buffer.fromOpacity.length).toBe(nextPowerOf2(100));
  });

  it('should reuse a released buffer', () => {
    const pool = new BufferPool();
    const buffer1 = pool.acquire(100);
    pool.release(buffer1);

    const buffer2 = pool.acquire(100);
    expect(buffer2).toBe(buffer1);
  });

  it('should not reuse buffers of different sizes', () => {
    const pool = new BufferPool();
    const buffer1 = pool.acquire(100); // rounds to 128
    pool.release(buffer1);

    const buffer2 = pool.acquire(200); // rounds to 256
    expect(buffer2).not.toBe(buffer1);
    expect(buffer2.fromOpacity.length).toBe(nextPowerOf2(200));
  });

  it('should track pooled count', () => {
    const pool = new BufferPool();
    expect(pool.pooledCount).toBe(0);

    const b1 = pool.acquire(10);
    const b2 = pool.acquire(10);
    pool.release(b1);
    expect(pool.pooledCount).toBe(1);

    pool.release(b2);
    expect(pool.pooledCount).toBe(2);

    pool.acquire(10);
    expect(pool.pooledCount).toBe(1);
  });

  it('should clear all pooled buffers', () => {
    const pool = new BufferPool();
    pool.release(pool.acquire(10));
    pool.release(pool.acquire(20));
    expect(pool.pooledCount).toBe(2);

    pool.clear();
    expect(pool.pooledCount).toBe(0);
  });
});

describe('createAnimationBuffer', () => {
  it('should create buffer with power-of-2 capacity', () => {
    const buffer = createAnimationBuffer(100);
    expect(getBufferCapacity(buffer)).toBe(128);
  });

  it('should create buffer with all typed arrays', () => {
    const buffer = createAnimationBuffer(10);
    expect(buffer.fromOpacity).toBeInstanceOf(Float32Array);
    expect(buffer.fromSize).toBeInstanceOf(Float32Array);
    expect(buffer.fromColorL).toBeInstanceOf(Float32Array);
    expect(buffer.fromColorA).toBeInstanceOf(Float32Array);
    expect(buffer.fromColorB).toBeInstanceOf(Float32Array);
    expect(buffer.toOpacity).toBeInstanceOf(Float32Array);
    expect(buffer.toSize).toBeInstanceOf(Float32Array);
    expect(buffer.toColorL).toBeInstanceOf(Float32Array);
    expect(buffer.toColorA).toBeInstanceOf(Float32Array);
    expect(buffer.toColorB).toBeInstanceOf(Float32Array);
    expect(buffer.outOpacity).toBeInstanceOf(Float32Array);
    expect(buffer.outSize).toBeInstanceOf(Float32Array);
    expect(buffer.outColorR).toBeInstanceOf(Uint8Array);
    expect(buffer.outColorG).toBeInstanceOf(Uint8Array);
    expect(buffer.outColorB).toBeInstanceOf(Uint8Array);
  });
});

describe('nextPowerOf2', () => {
  it('should return correct power of 2', () => {
    expect(nextPowerOf2(1)).toBe(1);
    expect(nextPowerOf2(2)).toBe(2);
    expect(nextPowerOf2(3)).toBe(4);
    expect(nextPowerOf2(5)).toBe(8);
    expect(nextPowerOf2(100)).toBe(128);
    expect(nextPowerOf2(128)).toBe(128);
    expect(nextPowerOf2(129)).toBe(256);
  });

  it('should handle edge cases', () => {
    expect(nextPowerOf2(0)).toBe(1);
    expect(nextPowerOf2(-5)).toBe(1);
  });
});
