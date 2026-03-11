import { describe, it, expect } from 'vitest';
import { matchKeyframes, matchAllKeyframes } from '../src/engine/keyframe-matcher.js';
import type { Keyframe } from '../src/types.js';

describe('matchKeyframes', () => {
  it('should match particles at the same position', () => {
    const from: Keyframe = {
      time: 0,
      easing: 'linear',
      particles: [
        { row: 1, col: 1, color: '#FF0000' },
        { row: 2, col: 2, color: '#00FF00' },
      ],
      connections: [],
    };

    const to: Keyframe = {
      time: 1000,
      easing: 'linear',
      particles: [
        { row: 1, col: 1, color: '#0000FF' },
        { row: 2, col: 2, color: '#FFFF00' },
      ],
      connections: [],
    };

    const result = matchKeyframes(from, to);
    expect(result.matched.length).toBe(2);
    expect(result.appearing.length).toBe(0);
    expect(result.disappearing.length).toBe(0);
  });

  it('should detect appearing particles', () => {
    const from: Keyframe = {
      time: 0,
      easing: 'linear',
      particles: [{ row: 1, col: 1, color: '#FF0000' }],
      connections: [],
    };

    const to: Keyframe = {
      time: 1000,
      easing: 'linear',
      particles: [
        { row: 1, col: 1, color: '#FF0000' },
        { row: 3, col: 3, color: '#00FF00' }, // new
      ],
      connections: [],
    };

    const result = matchKeyframes(from, to);
    expect(result.matched.length).toBe(1);
    expect(result.appearing.length).toBe(1);
    expect(result.appearing[0].key).toBe('3,3');
    expect(result.disappearing.length).toBe(0);
  });

  it('should detect disappearing particles', () => {
    const from: Keyframe = {
      time: 0,
      easing: 'linear',
      particles: [
        { row: 1, col: 1, color: '#FF0000' },
        { row: 5, col: 5, color: '#00FF00' }, // will disappear
      ],
      connections: [],
    };

    const to: Keyframe = {
      time: 1000,
      easing: 'linear',
      particles: [{ row: 1, col: 1, color: '#0000FF' }],
      connections: [],
    };

    const result = matchKeyframes(from, to);
    expect(result.matched.length).toBe(1);
    expect(result.appearing.length).toBe(0);
    expect(result.disappearing.length).toBe(1);
    expect(result.disappearing[0].key).toBe('5,5');
  });

  it('should handle mixed match/appear/disappear', () => {
    const from: Keyframe = {
      time: 0,
      easing: 'linear',
      particles: [
        { row: 1, col: 1 }, // stays
        { row: 2, col: 2 }, // disappears
      ],
      connections: [],
    };

    const to: Keyframe = {
      time: 1000,
      easing: 'linear',
      particles: [
        { row: 1, col: 1 }, // stays
        { row: 3, col: 3 }, // appears
      ],
      connections: [],
    };

    const result = matchKeyframes(from, to);
    expect(result.matched.length).toBe(1);
    expect(result.appearing.length).toBe(1);
    expect(result.disappearing.length).toBe(1);
  });

  it('should match connections', () => {
    const from: Keyframe = {
      time: 0,
      easing: 'linear',
      particles: [],
      connections: [
        { from: [1, 1], to: [2, 2], color: '#FFFFFF' },
      ],
    };

    const to: Keyframe = {
      time: 1000,
      easing: 'linear',
      particles: [],
      connections: [
        { from: [1, 1], to: [2, 2], color: '#FF0000' },
        { from: [3, 3], to: [4, 4], color: '#00FF00' }, // new
      ],
    };

    const result = matchKeyframes(from, to);
    expect(result.connectionMatched.length).toBe(1);
    expect(result.connectionAppearing.length).toBe(1);
    expect(result.connectionDisappearing.length).toBe(0);
  });
});

describe('matchAllKeyframes', () => {
  it('should produce n-1 results for n keyframes', () => {
    const keyframes: Keyframe[] = [
      { time: 0, easing: 'linear', particles: [{ row: 1, col: 1 }], connections: [] },
      { time: 500, easing: 'linear', particles: [{ row: 1, col: 1 }], connections: [] },
      { time: 1000, easing: 'linear', particles: [{ row: 1, col: 1 }], connections: [] },
    ];

    const results = matchAllKeyframes(keyframes);
    expect(results.length).toBe(2);
  });
});
