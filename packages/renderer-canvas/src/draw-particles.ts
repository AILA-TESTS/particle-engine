// ============================================================
// Draw Particles — Particle rendering onto Canvas 2D context
// ============================================================

import type { CanvasContext2D } from './types.js';

const TWO_PI = Math.PI * 2;

/**
 * Draw a single particle onto the canvas context.
 *
 * @param ctx - Canvas 2D rendering context
 * @param x - X position in pixels
 * @param y - Y position in pixels
 * @param radius - Particle radius in pixels
 * @param color - Fill color (hex string)
 * @param opacity - Opacity (0.0 to 1.0)
 * @param shape - 'circle' or 'square'
 */
export function drawParticle(
	ctx: CanvasContext2D,
	x: number,
	y: number,
	radius: number,
	color: string,
	opacity: number,
	shape: 'circle' | 'square',
): void {
	ctx.save();
	ctx.globalAlpha = opacity;
	ctx.fillStyle = color;

	if (shape === 'circle') {
		ctx.beginPath();
		ctx.arc(x, y, radius, 0, TWO_PI);
		ctx.fill();
	} else {
		// Square: center at (x, y) with side = 2 * radius
		ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
	}

	ctx.restore();
}

/**
 * Draw a grid dot (inactive particle position marker).
 *
 * @param ctx - Canvas 2D rendering context
 * @param x - X position in pixels
 * @param y - Y position in pixels
 * @param radius - Dot radius in pixels
 * @param color - Dot color (hex string)
 */
export function drawGridDot(
	ctx: CanvasContext2D,
	x: number,
	y: number,
	radius: number,
	color: string,
): void {
	ctx.save();
	ctx.globalAlpha = 1.0;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, TWO_PI);
	ctx.fill();
	ctx.restore();
}
