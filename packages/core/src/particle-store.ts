// ============================================================
// ParticleStore — Creation and operations on particle typed arrays
// ============================================================

import type { GridConfig, ParticleStore } from './types.js';

/**
 * Create a new ParticleStore with all arrays zeroed out.
 */
export function createParticleStore(config: GridConfig): ParticleStore {
  const total = config.rows * config.cols;
  return {
    config,
    active: new Uint8Array(total),
    colorR: new Uint8Array(total),
    colorG: new Uint8Array(total),
    colorB: new Uint8Array(total),
    opacity: new Float32Array(total),
    size: new Float32Array(total),
    layer: new Int16Array(total),
    group: new Uint16Array(total),
  };
}

/**
 * Convert (row, col) to flat array index.
 */
export function toIndex(config: GridConfig, row: number, col: number): number {
  return row * config.cols + col;
}

/**
 * Convert flat array index to (row, col).
 */
export function toRowCol(config: GridConfig, index: number): [number, number] {
  const row = Math.floor(index / config.cols);
  const col = index % config.cols;
  return [row, col];
}

/**
 * Parse a hex color string "#RRGGBB" into [R, G, B].
 */
export function parseHexColor(hex: string): [number, number, number] {
  // Strip leading '#'
  const raw = hex.startsWith('#') ? hex.slice(1) : hex;
  if (raw.length !== 6) {
    throw new Error(`Invalid hex color: "${hex}". Expected format "#RRGGBB".`);
  }
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    throw new Error(`Invalid hex color: "${hex}". Contains non-hex characters.`);
  }
  return [r, g, b];
}

/**
 * Convert RGB values to a hex color string "#RRGGBB".
 */
export function toHexColor(r: number, g: number, b: number): string {
  const rr = r.toString(16).padStart(2, '0').toUpperCase();
  const gg = g.toString(16).padStart(2, '0').toUpperCase();
  const bb = b.toString(16).padStart(2, '0').toUpperCase();
  return `#${rr}${gg}${bb}`;
}

/**
 * Count the number of active particles in the store.
 */
export function countActive(store: ParticleStore): number {
  let count = 0;
  for (let i = 0; i < store.active.length; i++) {
    if (store.active[i] === 1) count++;
  }
  return count;
}
