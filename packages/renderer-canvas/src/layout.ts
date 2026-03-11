// ============================================================
// Layout — Grid-to-pixel coordinate mapping
// ============================================================

import type { RenderConfig } from './types.js';

/** Pixel coordinates */
export interface PixelCoord {
	x: number;
	y: number;
}

/** Canvas dimensions */
export interface CanvasSize {
	width: number;
	height: number;
}

/**
 * Convert grid [row, col] to pixel [x, y].
 * Column maps to x-axis, row maps to y-axis.
 */
export function gridToPixel(
	row: number,
	col: number,
	spacing: number,
	padding: number,
): PixelCoord {
	return {
		x: padding + col * spacing,
		y: padding + row * spacing,
	};
}

/**
 * Compute the natural canvas dimensions from grid config and padding.
 * This is the area that contains all grid points plus padding on all sides.
 */
export function computeCanvasSize(
	rows: number,
	cols: number,
	spacing: number,
	padding: number,
): CanvasSize {
	const width = (cols - 1) * spacing + padding * 2;
	const height = (rows - 1) * spacing + padding * 2;

	return {
		width: Math.max(width, 1),
		height: Math.max(height, 1),
	};
}

/**
 * Resolve the effective render config with defaults applied.
 */
export function resolveConfig(config: RenderConfig, spacing: number): Required<RenderConfig> {
	return {
		width: config.width,
		height: config.height,
		backgroundColor: config.backgroundColor ?? '#000000',
		antialiasing: config.antialiasing ?? true,
		pixelRatio: config.pixelRatio ?? 1,
		padding: config.padding ?? 0,
		particleShape: config.particleShape ?? 'circle',
		defaultParticleRadius: config.defaultParticleRadius ?? spacing / 3,
		showGrid: config.showGrid ?? false,
		gridDotColor: config.gridDotColor ?? '#333333',
		gridDotRadius: config.gridDotRadius ?? 1,
	};
}
