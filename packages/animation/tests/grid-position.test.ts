import { describe, it, expect } from 'vitest';
import { bilinearDistribute, bresenhamLine } from '../src/interpolators/grid-position.js';

describe('bilinearDistribute', () => {
  it('exact integer position should return 1 particle with weight=1', () => {
    const result = bilinearDistribute(5, 10);
    expect(result.length).toBe(1);
    expect(result[0].row).toBe(5);
    expect(result[0].col).toBe(10);
    expect(result[0].weight).toBeCloseTo(1, 5);
  });

  it('center of 4 cells should return 4 particles with weight=0.25', () => {
    const result = bilinearDistribute(5.5, 10.5);
    expect(result.length).toBe(4);

    // All weights should be 0.25
    for (const p of result) {
      expect(p.weight).toBeCloseTo(0.25, 5);
    }

    // Check positions
    const positions = result.map(p => `${p.row},${p.col}`).sort();
    expect(positions).toEqual(['5,10', '5,11', '6,10', '6,11']);
  });

  it('midpoint on an edge (row=5, col=10.5) should return 2 particles with weight=0.5', () => {
    const result = bilinearDistribute(5, 10.5);
    expect(result.length).toBe(2);

    for (const p of result) {
      expect(p.weight).toBeCloseTo(0.5, 5);
    }

    expect(result[0].row).toBe(5);
    expect(result[0].col).toBe(10);
    expect(result[1].row).toBe(5);
    expect(result[1].col).toBe(11);
  });

  it('should filter out weights below 0.01', () => {
    // Position very close to integer should give ~1 particle
    const result = bilinearDistribute(5.001, 10.001);
    // The main particle should have weight ~0.998, others below threshold
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(4);
    // The dominant weight should be near 1
    const maxWeight = Math.max(...result.map(p => p.weight));
    expect(maxWeight).toBeGreaterThan(0.99);
  });

  it('weights should sum to approximately 1', () => {
    const testCases = [
      [3.3, 7.7],
      [0.1, 0.9],
      [10.5, 10.5],
      [5, 5],
    ];

    for (const [r, c] of testCases) {
      const result = bilinearDistribute(r, c);
      const sum = result.reduce((acc, p) => acc + p.weight, 0);
      expect(sum).toBeCloseTo(1, 1); // Allow some tolerance due to filtering
    }
  });
});

describe('bresenhamLine', () => {
  it('should return a single point for same start and end', () => {
    const result = bresenhamLine(5, 5, 5, 5);
    expect(result).toEqual([[5, 5]]);
  });

  it('should draw a horizontal line', () => {
    const result = bresenhamLine(5, 2, 5, 6);
    expect(result).toEqual([[5, 2], [5, 3], [5, 4], [5, 5], [5, 6]]);
  });

  it('should draw a vertical line', () => {
    const result = bresenhamLine(2, 5, 6, 5);
    expect(result).toEqual([[2, 5], [3, 5], [4, 5], [5, 5], [6, 5]]);
  });

  it('should draw a diagonal line', () => {
    const result = bresenhamLine(0, 0, 3, 3);
    expect(result.length).toBe(4);
    expect(result[0]).toEqual([0, 0]);
    expect(result[result.length - 1]).toEqual([3, 3]);
  });

  it('should include start and end points', () => {
    const result = bresenhamLine(1, 2, 7, 9);
    expect(result[0]).toEqual([1, 2]);
    expect(result[result.length - 1]).toEqual([7, 9]);
  });
});
