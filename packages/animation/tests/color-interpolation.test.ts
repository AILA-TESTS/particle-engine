import { describe, it, expect } from 'vitest';
import {
  hexToRGB,
  rgbToOKLAB,
  oklabToRGB,
  hexToOKLAB,
  oklabToHex,
  rgbToHex,
} from '../src/utils/oklab.js';
import { interpolateColorOKLAB, batchInterpolateColors } from '../src/interpolators/color.js';

describe('Hex <-> RGB conversion', () => {
  it('should parse #FF0000 to [255, 0, 0]', () => {
    expect(hexToRGB('#FF0000')).toEqual([255, 0, 0]);
  });

  it('should parse #00FF00 to [0, 255, 0]', () => {
    expect(hexToRGB('#00FF00')).toEqual([0, 255, 0]);
  });

  it('should parse #0000FF to [0, 0, 255]', () => {
    expect(hexToRGB('#0000FF')).toEqual([0, 0, 255]);
  });

  it('should parse #FFFFFF to [255, 255, 255]', () => {
    expect(hexToRGB('#FFFFFF')).toEqual([255, 255, 255]);
  });

  it('should parse #000000 to [0, 0, 0]', () => {
    expect(hexToRGB('#000000')).toEqual([0, 0, 0]);
  });

  it('rgbToHex should convert back correctly', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#FF0000');
    expect(rgbToHex(0, 255, 0)).toBe('#00FF00');
    expect(rgbToHex(0, 0, 255)).toBe('#0000FF');
  });
});

describe('OKLAB roundtrip', () => {
  const testColors: [number, number, number][] = [
    [255, 0, 0],     // Red
    [0, 255, 0],     // Green
    [0, 0, 255],     // Blue
    [255, 255, 255], // White
    [0, 0, 0],       // Black
    [128, 128, 128], // Gray
    [255, 128, 0],   // Orange
    [128, 0, 255],   // Purple
    [0, 255, 255],   // Cyan
    [255, 255, 0],   // Yellow
  ];

  for (const [r, g, b] of testColors) {
    it(`should roundtrip RGB(${r}, ${g}, ${b}) within +-1 per channel`, () => {
      const oklab = rgbToOKLAB(r, g, b);
      const [rOut, gOut, bOut] = oklabToRGB(oklab.L, oklab.a, oklab.b);

      expect(Math.abs(rOut - r)).toBeLessThanOrEqual(1);
      expect(Math.abs(gOut - g)).toBeLessThanOrEqual(1);
      expect(Math.abs(bOut - b)).toBeLessThanOrEqual(1);
    });
  }

  it('should roundtrip hex colors', () => {
    const hex = '#FF8800';
    const oklab = hexToOKLAB(hex);
    const outHex = oklabToHex(oklab.L, oklab.a, oklab.b);
    // Parse both and compare channels
    const [r1, g1, b1] = hexToRGB(hex);
    const [r2, g2, b2] = hexToRGB(outHex);
    expect(Math.abs(r1 - r2)).toBeLessThanOrEqual(1);
    expect(Math.abs(g1 - g2)).toBeLessThanOrEqual(1);
    expect(Math.abs(b1 - b2)).toBeLessThanOrEqual(1);
  });
});

describe('OKLAB color interpolation', () => {
  it('should return from color at t=0', () => {
    const red = rgbToOKLAB(255, 0, 0);
    const blue = rgbToOKLAB(0, 0, 255);
    const result = interpolateColorOKLAB(red, blue, 0);
    expect(result.L).toBeCloseTo(red.L, 5);
    expect(result.a).toBeCloseTo(red.a, 5);
    expect(result.b).toBeCloseTo(red.b, 5);
  });

  it('should return to color at t=1', () => {
    const red = rgbToOKLAB(255, 0, 0);
    const blue = rgbToOKLAB(0, 0, 255);
    const result = interpolateColorOKLAB(red, blue, 1);
    expect(result.L).toBeCloseTo(blue.L, 5);
    expect(result.a).toBeCloseTo(blue.a, 5);
    expect(result.b).toBeCloseTo(blue.b, 5);
  });

  it('red->blue midpoint should NOT be muddy brown (should be distinct in OKLAB)', () => {
    // In RGB space, the midpoint of red and blue is (128, 0, 128) — a dark purple.
    // In OKLAB, we should get a perceptually more uniform result.
    const red = rgbToOKLAB(255, 0, 0);
    const blue = rgbToOKLAB(0, 0, 255);
    const mid = interpolateColorOKLAB(red, blue, 0.5);
    const [r, g, b] = oklabToRGB(mid.L, mid.a, mid.b);

    // The midpoint should NOT be a muddy brown (which would have r≈g≈b in the 100-130 range)
    // It should have distinct color with noticeable red and blue components
    const isMuddyBrown = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r > 80 && r < 150;
    expect(isMuddyBrown).toBe(false);

    // The OKLAB midpoint should maintain perceptual vibrancy
    // It should have a meaningful L value (not too dark)
    expect(mid.L).toBeGreaterThan(0.3);
  });

  it('should interpolate identical colors to the same color', () => {
    const color = rgbToOKLAB(100, 150, 200);
    const result = interpolateColorOKLAB(color, color, 0.5);
    expect(result.L).toBeCloseTo(color.L, 5);
    expect(result.a).toBeCloseTo(color.a, 5);
    expect(result.b).toBeCloseTo(color.b, 5);
  });
});

describe('Batch color interpolation', () => {
  it('should produce correct results for a batch', () => {
    const count = 3;
    const fromL = new Float32Array(count);
    const fromA = new Float32Array(count);
    const fromB = new Float32Array(count);
    const toL = new Float32Array(count);
    const toA = new Float32Array(count);
    const toB = new Float32Array(count);
    const outR = new Uint8Array(count);
    const outG = new Uint8Array(count);
    const outB_ = new Uint8Array(count);

    // Set up: red at index 0
    const red = rgbToOKLAB(255, 0, 0);
    const blue = rgbToOKLAB(0, 0, 255);
    fromL[0] = red.L; fromA[0] = red.a; fromB[0] = red.b;
    toL[0] = red.L; toA[0] = red.a; toB[0] = red.b;

    // blue at index 1
    fromL[1] = blue.L; fromA[1] = blue.a; fromB[1] = blue.b;
    toL[1] = blue.L; toA[1] = blue.a; toB[1] = blue.b;

    // red->blue at index 2
    fromL[2] = red.L; fromA[2] = red.a; fromB[2] = red.b;
    toL[2] = blue.L; toA[2] = blue.a; toB[2] = blue.b;

    batchInterpolateColors(fromL, fromA, fromB, toL, toA, toB, outR, outG, outB_, 0.5, count);

    // Index 0: should be red (same from/to)
    expect(Math.abs(outR[0] - 255)).toBeLessThanOrEqual(1);
    expect(outG[0]).toBeLessThanOrEqual(1);
    expect(outB_[0]).toBeLessThanOrEqual(1);

    // Index 1: should be blue
    expect(outR[1]).toBeLessThanOrEqual(1);
    expect(outG[1]).toBeLessThanOrEqual(1);
    expect(Math.abs(outB_[1] - 255)).toBeLessThanOrEqual(1);
  });
});
