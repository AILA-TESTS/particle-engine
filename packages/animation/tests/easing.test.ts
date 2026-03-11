import { describe, it, expect } from 'vitest';
import {
  pennerEasings,
  resolveEasing,
  cubicBezier,
  createSpringEasing,
  createSteps,
  springPresets,
} from '../src/easing/index.js';

describe('Penner Easing Functions', () => {
  const easingNames = Object.keys(pennerEasings);

  it('should have 31 easing functions (30 Penner + linear)', () => {
    expect(easingNames.length).toBe(31);
  });

  for (const name of easingNames) {
    describe(name, () => {
      const fn = pennerEasings[name];

      it('should return 0 at t=0', () => {
        expect(fn(0)).toBeCloseTo(0, 5);
      });

      it('should return 1 at t=1', () => {
        expect(fn(1)).toBeCloseTo(1, 5);
      });

      it('should return a number for t=0.5', () => {
        expect(typeof fn(0.5)).toBe('number');
        expect(Number.isNaN(fn(0.5))).toBe(false);
      });
    });
  }

  it('easeInQuad should have correct shape (starts slow)', () => {
    // At t=0.25, easeInQuad should be 0.0625
    expect(pennerEasings.easeInQuad(0.25)).toBeCloseTo(0.0625, 5);
    // At t=0.5, easeInQuad should be 0.25
    expect(pennerEasings.easeInQuad(0.5)).toBeCloseTo(0.25, 5);
  });

  it('easeOutQuad should have correct shape (ends slow)', () => {
    // At t=0.5, easeOutQuad should be 0.75
    expect(pennerEasings.easeOutQuad(0.5)).toBeCloseTo(0.75, 5);
  });

  it('easeInOutCubic should be symmetric', () => {
    const fn = pennerEasings.easeInOutCubic;
    expect(fn(0.5)).toBeCloseTo(0.5, 5);
    // Check symmetry: fn(t) + fn(1-t) = 1
    for (const t of [0.1, 0.2, 0.3, 0.4]) {
      expect(fn(t) + fn(1 - t)).toBeCloseTo(1, 4);
    }
  });

  it('easeOutBounce should produce bounce-like behavior', () => {
    const fn = pennerEasings.easeOutBounce;
    // The function should be below 1 and increase overall
    expect(fn(0.5)).toBeGreaterThan(0);
    expect(fn(0.5)).toBeLessThanOrEqual(1);
  });

  it('easeOutElastic should overshoot', () => {
    const fn = pennerEasings.easeOutElastic;
    // Elastic easing typically overshoots 1.0 around t≈0.3-0.5
    let hasOvershoot = false;
    for (let t = 0.1; t < 1.0; t += 0.01) {
      if (fn(t) > 1.0) {
        hasOvershoot = true;
        break;
      }
    }
    expect(hasOvershoot).toBe(true);
  });
});

describe('Cubic Bezier Easing', () => {
  it('should produce identity for linear (0,0,1,1)', () => {
    const fn = cubicBezier(0, 0, 1, 1);
    expect(fn(0)).toBe(0);
    expect(fn(0.5)).toBeCloseTo(0.5, 3);
    expect(fn(1)).toBe(1);
  });

  it('should handle ease-in-out (0.42, 0, 0.58, 1)', () => {
    const fn = cubicBezier(0.42, 0, 0.58, 1);
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
    // Should be symmetric around 0.5
    expect(fn(0.5)).toBeCloseTo(0.5, 2);
  });

  it('should produce values in expected range', () => {
    const fn = cubicBezier(0.25, 0.1, 0.25, 1.0);
    for (let t = 0; t <= 1; t += 0.1) {
      const v = fn(t);
      expect(v).toBeGreaterThanOrEqual(-0.1);
      expect(v).toBeLessThanOrEqual(1.1);
    }
  });
});

describe('Spring Easing', () => {
  it('should return 0 at t=0 and 1 at t=1', () => {
    const fn = createSpringEasing(120, 14, 1);
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
  });

  it('preset gentle should produce valid easing', () => {
    const { stiffness, damping, mass } = springPresets.gentle;
    const fn = createSpringEasing(stiffness, damping, mass);
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
    expect(fn(0.5)).toBeGreaterThan(0);
  });

  it('preset wobbly should overshoot', () => {
    const { stiffness, damping, mass } = springPresets.wobbly;
    const fn = createSpringEasing(stiffness, damping, mass);
    let hasOvershoot = false;
    for (let t = 0; t < 1; t += 0.01) {
      if (fn(t) > 1.01) {
        hasOvershoot = true;
        break;
      }
    }
    expect(hasOvershoot).toBe(true);
  });
});

describe('Steps Easing', () => {
  it('should create 4 steps with jump=end', () => {
    const fn = createSteps(4, 'end');
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
    expect(fn(0.1)).toBe(0);
    expect(fn(0.3)).toBeCloseTo(0.25, 5);
    expect(fn(0.6)).toBeCloseTo(0.5, 5);
    expect(fn(0.8)).toBeCloseTo(0.75, 5);
  });

  it('should create 4 steps with jump=start', () => {
    const fn = createSteps(4, 'start');
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
    // At t=0.1, should jump to 0.25 (first step)
    expect(fn(0.1)).toBeCloseTo(0.25, 5);
  });
});

describe('resolveEasing', () => {
  it('should resolve named easings', () => {
    const fn = resolveEasing('linear');
    expect(fn(0.5)).toBeCloseTo(0.5, 5);
  });

  it('should resolve cubicBezier spec', () => {
    const fn = resolveEasing({ type: 'cubicBezier', x1: 0, y1: 0, x2: 1, y2: 1 });
    expect(fn(0.5)).toBeCloseTo(0.5, 3);
  });

  it('should resolve spring spec', () => {
    const fn = resolveEasing({ type: 'spring', stiffness: 120, damping: 14, mass: 1 });
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
  });

  it('should resolve steps spec', () => {
    const fn = resolveEasing({ type: 'steps', count: 3, jump: 'end' });
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
  });

  it('should use cache', () => {
    const cache = new Map();
    const fn1 = resolveEasing('easeInQuad', cache);
    const fn2 = resolveEasing('easeInQuad', cache);
    expect(fn1).toBe(fn2);
  });

  it('should throw for unknown easing', () => {
    expect(() => resolveEasing('unknownEasing' as any)).toThrow();
  });
});
