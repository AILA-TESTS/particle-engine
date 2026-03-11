import { describe, it, expect } from 'vitest';
import { AnimationEngine } from '../src/engine/interpolation-engine.js';
import type { Animation } from '../src/types.js';

describe('AnimationEngine', () => {
  const engine = new AnimationEngine();

  function createSimpleAnimation(overrides?: Partial<Animation>): Animation {
    return {
      id: 'test',
      duration: 1000,
      fps: 30,
      defaultEasing: 'linear',
      keyframes: [
        {
          time: 0,
          easing: 'linear',
          particles: [
            { row: 5, col: 5, color: '#FF0000', opacity: 1, size: 1 },
          ],
          connections: [],
        },
        {
          time: 1000,
          easing: 'linear',
          particles: [
            { row: 5, col: 5, color: '#0000FF', opacity: 0.5, size: 2 },
          ],
          connections: [],
        },
      ],
      events: [],
      ...overrides,
    };
  }

  describe('prepare', () => {
    it('should prepare an animation without errors', () => {
      const anim = createSimpleAnimation();
      const prepared = engine.prepare(anim);
      expect(prepared.animation).toBe(anim);
      expect(prepared.easingFns.size).toBeGreaterThan(0);
      expect(prepared.keyframeMatches.length).toBe(1);
      expect(prepared.colorBuffers.length).toBe(2);
    });
  });

  describe('computeFrame', () => {
    it('should return keyframe state at t=0', () => {
      const anim = createSimpleAnimation();
      const prepared = engine.prepare(anim);
      const frame = engine.computeFrame(prepared, 0);

      expect(frame.timeMs).toBe(0);
      expect(frame.particles.length).toBe(1);
      expect(frame.particles[0].row).toBe(5);
      expect(frame.particles[0].col).toBe(5);
      expect(Math.abs(frame.particles[0].colorR - 255)).toBeLessThanOrEqual(1);
      expect(frame.particles[0].colorG).toBeLessThanOrEqual(1);
      expect(frame.particles[0].colorB).toBeLessThanOrEqual(1);
      expect(frame.particles[0].opacity).toBeCloseTo(1, 2);
      expect(frame.particles[0].size).toBeCloseTo(1, 2);
    });

    it('should return keyframe state at t=duration', () => {
      const anim = createSimpleAnimation();
      const prepared = engine.prepare(anim);
      const frame = engine.computeFrame(prepared, 1000);

      expect(frame.particles.length).toBe(1);
      expect(frame.particles[0].colorR).toBeLessThanOrEqual(1);
      expect(frame.particles[0].colorG).toBeLessThanOrEqual(1);
      expect(Math.abs(frame.particles[0].colorB - 255)).toBeLessThanOrEqual(1);
      expect(frame.particles[0].opacity).toBeCloseTo(0.5, 2);
      expect(frame.particles[0].size).toBeCloseTo(2, 2);
    });

    it('should interpolate correctly at midpoint', () => {
      const anim = createSimpleAnimation();
      const prepared = engine.prepare(anim);
      const frame = engine.computeFrame(prepared, 500);

      expect(frame.particles.length).toBe(1);
      // Opacity should be roughly 0.75 (lerp 1 -> 0.5 at t=0.5)
      expect(frame.particles[0].opacity).toBeCloseTo(0.75, 1);
      // Size should be roughly 1.5 (lerp 1 -> 2 at t=0.5)
      expect(frame.particles[0].size).toBeCloseTo(1.5, 1);
    });
  });

  describe('generateFrames', () => {
    it('should generate correct number of frames for 1s at 30fps', () => {
      const anim = createSimpleAnimation({ duration: 1000, fps: 30 });
      const prepared = engine.prepare(anim);
      const frames = [...engine.generateFrames(prepared)];

      expect(frames.length).toBe(30);
    });

    it('should generate frames with increasing time', () => {
      const anim = createSimpleAnimation({ duration: 1000, fps: 10 });
      const prepared = engine.prepare(anim);
      const frames = [...engine.generateFrames(prepared)];

      for (let i = 1; i < frames.length; i++) {
        expect(frames[i].timeMs).toBeGreaterThan(frames[i - 1].timeMs);
      }
    });

    it('each frame should have a valid frameIndex', () => {
      const anim = createSimpleAnimation({ duration: 1000, fps: 10 });
      const prepared = engine.prepare(anim);
      const frames = [...engine.generateFrames(prepared)];

      expect(frames[0].frameIndex).toBe(0);
      for (const frame of frames) {
        expect(frame.frameIndex).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('multi-keyframe animation', () => {
    it('should handle 3 keyframes', () => {
      const anim: Animation = {
        id: 'multi',
        duration: 2000,
        fps: 10,
        defaultEasing: 'linear',
        keyframes: [
          {
            time: 0,
            easing: 'linear',
            particles: [{ row: 1, col: 1, color: '#FF0000', opacity: 1 }],
            connections: [],
          },
          {
            time: 1000,
            easing: 'linear',
            particles: [{ row: 1, col: 1, color: '#00FF00', opacity: 0.5 }],
            connections: [],
          },
          {
            time: 2000,
            easing: 'linear',
            particles: [{ row: 1, col: 1, color: '#0000FF', opacity: 1 }],
            connections: [],
          },
        ],
        events: [],
      };

      const prepared = engine.prepare(anim);

      // At t=500, between kf0 and kf1
      const frame1 = engine.computeFrame(prepared, 500);
      expect(frame1.particles.length).toBe(1);
      expect(frame1.particles[0].opacity).toBeCloseTo(0.75, 1);

      // At t=1500, between kf1 and kf2
      const frame2 = engine.computeFrame(prepared, 1500);
      expect(frame2.particles.length).toBe(1);
      expect(frame2.particles[0].opacity).toBeCloseTo(0.75, 1);
    });
  });

  describe('appear/disappear', () => {
    it('should fade in appearing particles', () => {
      const anim: Animation = {
        id: 'appear',
        duration: 1000,
        fps: 10,
        defaultEasing: 'linear',
        keyframes: [
          {
            time: 0,
            easing: 'linear',
            particles: [],
            connections: [],
          },
          {
            time: 1000,
            easing: 'linear',
            particles: [{ row: 5, col: 5, color: '#FF0000', opacity: 1 }],
            connections: [],
          },
        ],
        events: [],
      };

      const prepared = engine.prepare(anim);

      // At t=0, no particles
      const frame0 = engine.computeFrame(prepared, 0);
      // There should be 1 appearing particle with opacity = 0 (alpha = 0)
      const p0 = frame0.particles.find(p => p.row === 5 && p.col === 5);
      if (p0) {
        expect(p0.opacity).toBeCloseTo(0, 1);
      }

      // At t=500, appearing with half opacity
      const frame1 = engine.computeFrame(prepared, 500);
      const p1 = frame1.particles.find(p => p.row === 5 && p.col === 5);
      expect(p1).toBeDefined();
      expect(p1!.opacity).toBeCloseTo(0.5, 1);
    });

    it('should fade out disappearing particles', () => {
      const anim: Animation = {
        id: 'disappear',
        duration: 1000,
        fps: 10,
        defaultEasing: 'linear',
        keyframes: [
          {
            time: 0,
            easing: 'linear',
            particles: [{ row: 5, col: 5, color: '#FF0000', opacity: 1 }],
            connections: [],
          },
          {
            time: 1000,
            easing: 'linear',
            particles: [],
            connections: [],
          },
        ],
        events: [],
      };

      const prepared = engine.prepare(anim);

      // At t=500, fading out with half opacity
      const frame = engine.computeFrame(prepared, 500);
      const p = frame.particles.find(p => p.row === 5 && p.col === 5);
      expect(p).toBeDefined();
      expect(p!.opacity).toBeCloseTo(0.5, 1);
    });
  });

  describe('easing integration', () => {
    it('should apply easeInQuad easing', () => {
      const anim: Animation = {
        id: 'eased',
        duration: 1000,
        fps: 10,
        defaultEasing: 'linear',
        keyframes: [
          {
            time: 0,
            easing: 'linear',
            particles: [{ row: 1, col: 1, opacity: 0, size: 1 }],
            connections: [],
          },
          {
            time: 1000,
            easing: 'easeInQuad',
            particles: [{ row: 1, col: 1, opacity: 1, size: 1 }],
            connections: [],
          },
        ],
        events: [],
      };

      const prepared = engine.prepare(anim);
      const frame = engine.computeFrame(prepared, 500);

      // At t=0.5, easeInQuad gives 0.25
      expect(frame.particles[0].opacity).toBeCloseTo(0.25, 1);
    });
  });
});
