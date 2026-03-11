import { describe, it, expect } from 'vitest';
import {
  createParticleStore,
  toIndex,
  toRowCol,
  parseHexColor,
  toHexColor,
  countActive,
} from '../src/particle-store.js';
import type { GridConfig } from '../src/types.js';

const config: GridConfig = { rows: 10, cols: 20, spacing: 16 };

describe('createParticleStore', () => {
  it('creates arrays of the correct size', () => {
    const store = createParticleStore(config);
    const total = 10 * 20;
    expect(store.active.length).toBe(total);
    expect(store.colorR.length).toBe(total);
    expect(store.colorG.length).toBe(total);
    expect(store.colorB.length).toBe(total);
    expect(store.opacity.length).toBe(total);
    expect(store.size.length).toBe(total);
    expect(store.layer.length).toBe(total);
    expect(store.group.length).toBe(total);
  });

  it('initializes all arrays to zero', () => {
    const store = createParticleStore(config);
    for (let i = 0; i < store.active.length; i++) {
      expect(store.active[i]).toBe(0);
      expect(store.colorR[i]).toBe(0);
      expect(store.opacity[i]).toBe(0);
      expect(store.size[i]).toBe(0);
    }
  });

  it('stores the config', () => {
    const store = createParticleStore(config);
    expect(store.config).toEqual(config);
  });
});

describe('toIndex', () => {
  it('converts (0, 0) to 0', () => {
    expect(toIndex(config, 0, 0)).toBe(0);
  });

  it('converts (row, col) correctly', () => {
    expect(toIndex(config, 1, 0)).toBe(20);
    expect(toIndex(config, 0, 5)).toBe(5);
    expect(toIndex(config, 3, 7)).toBe(3 * 20 + 7);
  });

  it('last cell is rows*cols - 1', () => {
    expect(toIndex(config, 9, 19)).toBe(199);
  });
});

describe('toRowCol', () => {
  it('converts index 0 to (0, 0)', () => {
    expect(toRowCol(config, 0)).toEqual([0, 0]);
  });

  it('round-trips with toIndex', () => {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 20; c++) {
        const idx = toIndex(config, r, c);
        expect(toRowCol(config, idx)).toEqual([r, c]);
      }
    }
  });
});

describe('parseHexColor', () => {
  it('parses #FFFFFF', () => {
    expect(parseHexColor('#FFFFFF')).toEqual([255, 255, 255]);
  });

  it('parses #000000', () => {
    expect(parseHexColor('#000000')).toEqual([0, 0, 0]);
  });

  it('parses #FF8800', () => {
    expect(parseHexColor('#FF8800')).toEqual([255, 136, 0]);
  });

  it('parses lowercase', () => {
    expect(parseHexColor('#ff0000')).toEqual([255, 0, 0]);
  });

  it('throws on invalid format', () => {
    expect(() => parseHexColor('#FFF')).toThrow();
    expect(() => parseHexColor('red')).toThrow();
  });
});

describe('toHexColor', () => {
  it('converts (255, 255, 255) to #FFFFFF', () => {
    expect(toHexColor(255, 255, 255)).toBe('#FFFFFF');
  });

  it('converts (0, 0, 0) to #000000', () => {
    expect(toHexColor(0, 0, 0)).toBe('#000000');
  });

  it('pads single-digit hex values', () => {
    expect(toHexColor(1, 2, 3)).toBe('#010203');
  });

  it('round-trips with parseHexColor', () => {
    const hex = '#AB12CD';
    const [r, g, b] = parseHexColor(hex);
    expect(toHexColor(r, g, b)).toBe(hex);
  });
});

describe('countActive', () => {
  it('returns 0 for a fresh store', () => {
    const store = createParticleStore(config);
    expect(countActive(store)).toBe(0);
  });

  it('counts active particles correctly', () => {
    const store = createParticleStore(config);
    store.active[0] = 1;
    store.active[5] = 1;
    store.active[100] = 1;
    expect(countActive(store)).toBe(3);
  });
});
