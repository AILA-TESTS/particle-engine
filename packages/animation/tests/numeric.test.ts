import { describe, it, expect } from 'vitest';
import { lerp, clampedLerp, smoothstep, inverseLerp } from '../src/interpolators/numeric.js';

describe('lerp', () => {
  it('should return a at t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('should return b at t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('should return midpoint at t=0.5', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it('should handle negative values', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0);
  });

  it('should allow overshoot (t > 1)', () => {
    expect(lerp(0, 10, 1.5)).toBe(15);
  });

  it('should allow undershoot (t < 0)', () => {
    expect(lerp(0, 10, -0.5)).toBe(-5);
  });
});

describe('clampedLerp', () => {
  it('should clamp result within [a, b]', () => {
    expect(clampedLerp(0, 10, 1.5)).toBe(10);
    expect(clampedLerp(0, 10, -0.5)).toBe(0);
  });

  it('should work when b < a', () => {
    expect(clampedLerp(10, 0, 0.5)).toBe(5);
    expect(clampedLerp(10, 0, 1.5)).toBe(0);
    expect(clampedLerp(10, 0, -0.5)).toBe(10);
  });

  it('should return correct value within range', () => {
    expect(clampedLerp(0, 10, 0.5)).toBe(5);
  });
});

describe('smoothstep', () => {
  it('should return 0 below edge0', () => {
    expect(smoothstep(0, 1, -0.5)).toBe(0);
  });

  it('should return 1 above edge1', () => {
    expect(smoothstep(0, 1, 1.5)).toBe(1);
  });

  it('should return 0.5 at midpoint', () => {
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
  });

  it('should have zero derivative at edges', () => {
    // smoothstep should be very close to 0 near edge0 and very close to 1 near edge1
    expect(smoothstep(0, 1, 0.01)).toBeLessThan(0.01);
    expect(smoothstep(0, 1, 0.99)).toBeGreaterThan(0.99);
  });
});

describe('inverseLerp', () => {
  it('should return 0 when value equals a', () => {
    expect(inverseLerp(10, 20, 10)).toBe(0);
  });

  it('should return 1 when value equals b', () => {
    expect(inverseLerp(10, 20, 20)).toBe(1);
  });

  it('should return 0.5 at midpoint', () => {
    expect(inverseLerp(10, 20, 15)).toBe(0.5);
  });

  it('should handle a === b', () => {
    expect(inverseLerp(10, 10, 10)).toBe(0);
  });

  it('should handle values outside range', () => {
    expect(inverseLerp(0, 10, 15)).toBe(1.5);
    expect(inverseLerp(0, 10, -5)).toBe(-0.5);
  });
});
