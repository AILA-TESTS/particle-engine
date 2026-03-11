// ============================================================
// OKLAB Color Space Conversion Utilities
// ============================================================

import type { OKLABColor } from '../types.js';
import { clamp } from './math.js';

/**
 * Convert sRGB component (0-255) to linear RGB (0-1).
 * sRGB gamma: linear = sRGB <= 0.04045 ? sRGB/12.92 : ((sRGB+0.055)/1.055)^2.4
 */
export function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Convert linear RGB (0-1) to sRGB component (0-255).
 */
export function linearToSrgb(c: number): number {
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(clamp(s * 255, 0, 255));
}

/**
 * Parse hex color string "#RRGGBB" to [r, g, b] (0-255).
 */
export function hexToRGB(hex: string): [number, number, number] {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return [r, g, b];
}

/**
 * Convert [r, g, b] (0-255) to hex color string "#RRGGBB".
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const h = clamp(Math.round(c), 0, 255).toString(16);
    return h.length === 1 ? `0${h}` : h;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Convert sRGB (0-255) to OKLAB.
 * Pipeline: sRGB -> linear RGB -> LMS (M1) -> cube root -> Lab (M2)
 *
 * M1: linear RGB to LMS
 * | 0.4122214708  0.5363325363  0.0514459929 |
 * | 0.2119034982  0.6806995451  0.1073969566 |
 * | 0.0883024619  0.2817188376  0.6299787005 |
 *
 * M2: LMS^(1/3) to Lab
 * | 0.2104542553  0.7936177850 -0.0040720468 |
 * | 1.9779984951 -2.4285922050  0.4505937099 |
 * | 0.0259040371  0.7827717662 -0.8086757660 |
 */
export function rgbToOKLAB(r: number, g: number, b: number): OKLABColor {
  // sRGB to linear
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  // Linear RGB to LMS (M1)
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  // Cube root
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  // LMS^(1/3) to Lab (M2)
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bOut = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  return { L, a, b: bOut };
}

/**
 * Convert OKLAB to sRGB (0-255).
 * Pipeline: Lab -> LMS^(1/3) (M2^-1) -> cube -> linear RGB (M1^-1) -> sRGB
 *
 * M2^-1 (Lab to LMS^(1/3)):
 * | 1.0  0.3963377774  0.2158037573 |
 * | 1.0 -0.1055613458 -0.0638541728 |
 * | 1.0 -0.0894841775 -1.2914855480 |
 *
 * M1^-1 (LMS to linear RGB):
 * |  4.0767416621 -3.3077115913  0.2309699292 |
 * | -1.2684380046  2.6097574011 -0.3413193965 |
 * | -0.0041960863 -0.7034186147  1.7076147010 |
 */
export function oklabToRGB(L: number, a: number, b: number): [number, number, number] {
  // Lab to LMS^(1/3) (M2 inverse)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  // Cube (undo cube root)
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS to linear RGB (M1 inverse)
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  // Linear to sRGB
  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
}

/**
 * Convert hex color to OKLAB.
 */
export function hexToOKLAB(hex: string): OKLABColor {
  const [r, g, b] = hexToRGB(hex);
  return rgbToOKLAB(r, g, b);
}

/**
 * Convert OKLAB to hex color string.
 */
export function oklabToHex(L: number, a: number, b: number): string {
  const [r, g, bVal] = oklabToRGB(L, a, b);
  return rgbToHex(r, g, bVal);
}
