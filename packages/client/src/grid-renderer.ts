// ============================================================
// GridRenderer — Canvas rendering wrapper for the browser
// ============================================================

import { CanvasRenderer } from '@particle-engine/renderer-canvas';
import type { SpaceState } from '@particle-engine/core';

/**
 * Wraps the CanvasRenderer to manage a browser canvas element.
 *
 * Handles canvas sizing and context management, delegating the actual
 * drawing to the isomorphic CanvasRenderer from @particle-engine/renderer-canvas.
 */
export class GridRenderer {
	private renderer: CanvasRenderer;
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.renderer = new CanvasRenderer();

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error('Failed to get 2D rendering context from canvas');
		}
		this.ctx = ctx;
	}

	/**
	 * Render a particle grid state onto the canvas.
	 */
	render(
		state: SpaceState,
		config: {
			width: number;
			height: number;
			backgroundColor?: string;
			padding?: number;
		},
	): void {
		this.renderer.renderToCanvas(this.ctx, state, {
			width: config.width,
			height: config.height,
			backgroundColor: config.backgroundColor,
			padding: config.padding,
		});
	}

	/**
	 * Clear the canvas.
	 */
	clear(): void {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	/**
	 * Resize the canvas to the given dimensions.
	 */
	resize(width: number, height: number): void {
		this.canvas.width = width;
		this.canvas.height = height;
	}
}
