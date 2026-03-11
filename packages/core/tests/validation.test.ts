import { describe, it, expect } from 'vitest';
import { isInBounds, assertInBounds, validateGridConfig } from '../src/validation.js';
import type { GridConfig } from '../src/types.js';

const config: GridConfig = { rows: 10, cols: 20, spacing: 16 };

describe('isInBounds', () => {
  it('returns true for valid coordinates', () => {
    expect(isInBounds(config, 0, 0)).toBe(true);
    expect(isInBounds(config, 9, 19)).toBe(true);
    expect(isInBounds(config, 5, 10)).toBe(true);
  });

  it('returns false for negative coordinates', () => {
    expect(isInBounds(config, -1, 0)).toBe(false);
    expect(isInBounds(config, 0, -1)).toBe(false);
  });

  it('returns false for out-of-range coordinates', () => {
    expect(isInBounds(config, 10, 0)).toBe(false);
    expect(isInBounds(config, 0, 20)).toBe(false);
    expect(isInBounds(config, 100, 100)).toBe(false);
  });

  it('returns false for non-integer coordinates', () => {
    expect(isInBounds(config, 1.5, 2)).toBe(false);
    expect(isInBounds(config, 1, 2.5)).toBe(false);
  });
});

describe('assertInBounds', () => {
  it('does not throw for valid coordinates', () => {
    expect(() => assertInBounds(config, 0, 0)).not.toThrow();
    expect(() => assertInBounds(config, 9, 19)).not.toThrow();
  });

  it('throws RangeError for out-of-bounds coordinates', () => {
    expect(() => assertInBounds(config, -1, 0)).toThrow(RangeError);
    expect(() => assertInBounds(config, 10, 0)).toThrow(RangeError);
    expect(() => assertInBounds(config, 0, 20)).toThrow(RangeError);
  });

  it('includes coordinates in error message', () => {
    expect(() => assertInBounds(config, 15, 25)).toThrow('(15, 25)');
  });
});

describe('validateGridConfig', () => {
  it('accepts valid config', () => {
    expect(() => validateGridConfig({ rows: 10, cols: 20, spacing: 16 })).not.toThrow();
    expect(() => validateGridConfig({ rows: 1, cols: 1, spacing: 0.5 })).not.toThrow();
  });

  it('rejects non-positive rows', () => {
    expect(() => validateGridConfig({ rows: 0, cols: 10, spacing: 16 })).toThrow(RangeError);
    expect(() => validateGridConfig({ rows: -1, cols: 10, spacing: 16 })).toThrow(RangeError);
  });

  it('rejects non-integer rows', () => {
    expect(() => validateGridConfig({ rows: 1.5, cols: 10, spacing: 16 })).toThrow(RangeError);
  });

  it('rejects non-positive cols', () => {
    expect(() => validateGridConfig({ rows: 10, cols: 0, spacing: 16 })).toThrow(RangeError);
  });

  it('rejects non-positive spacing', () => {
    expect(() => validateGridConfig({ rows: 10, cols: 10, spacing: 0 })).toThrow(RangeError);
    expect(() => validateGridConfig({ rows: 10, cols: 10, spacing: -1 })).toThrow(RangeError);
  });
});
