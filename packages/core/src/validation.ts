// ============================================================
// Validation — Bounds checking and input validation
// ============================================================

import type { GridConfig } from './types.js';

/**
 * Check whether a (row, col) coordinate is within the grid bounds.
 */
export function isInBounds(config: GridConfig, row: number, col: number): boolean {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row < config.rows &&
    col >= 0 &&
    col < config.cols
  );
}

/**
 * Assert that a (row, col) coordinate is within bounds, throwing if not.
 */
export function assertInBounds(config: GridConfig, row: number, col: number): void {
  if (!isInBounds(config, row, col)) {
    throw new RangeError(
      `Coordinates (${row}, ${col}) out of bounds for grid ${config.rows}x${config.cols}`
    );
  }
}

/**
 * Validate a GridConfig, throwing if invalid.
 */
export function validateGridConfig(config: GridConfig): void {
  if (!Number.isInteger(config.rows) || config.rows < 1) {
    throw new RangeError(`rows must be a positive integer, got ${config.rows}`);
  }
  if (!Number.isInteger(config.cols) || config.cols < 1) {
    throw new RangeError(`cols must be a positive integer, got ${config.cols}`);
  }
  if (typeof config.spacing !== 'number' || config.spacing <= 0) {
    throw new RangeError(`spacing must be a positive number, got ${config.spacing}`);
  }
}
