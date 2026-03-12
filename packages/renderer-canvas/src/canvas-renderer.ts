// ============================================================
// CanvasRenderer — Main Canvas 2D renderer for particle grid states
// ============================================================

import type { SpaceState, SerializedParticle, SerializedConnection } from '@particle-engine/core';
import type { RenderConfig, CanvasContext2D, CanvasFactory, CanvasLike } from './types.js';
import { gridToPixel, resolveConfig } from './layout.js';
import { drawParticle, drawGridDot } from './draw-particles.js';
import { drawConnection } from './draw-connections.js';

/**
 * Isomorphic Canvas 2D renderer for particle grid states.
 *
 * Works with any canvas implementation (browser Canvas, node-canvas, @napi-rs/canvas)
 * by accepting a CanvasContext2D or CanvasFactory rather than depending on any specific
 * canvas library.
 */
export class CanvasRenderer {
	/**
	 * Render a particle grid state onto an existing canvas context.
	 *
	 * @param ctx - Canvas 2D rendering context
	 * @param state - The particle grid state to render
	 * @param config - Render configuration
	 */
	renderToCanvas(ctx: CanvasContext2D, state: SpaceState, config: RenderConfig): void {
		const resolved = resolveConfig(config, state.grid.spacing);
		const { pixelRatio } = resolved;

		ctx.save();

		// Handle HiDPI scaling
		if (pixelRatio !== 1) {
			ctx.scale(pixelRatio, pixelRatio);
		}

		// Set antialiasing
		ctx.imageSmoothingEnabled = resolved.antialiasing;

		// 1. Clear canvas with background color
		this.drawBackground(ctx, resolved);

		// 2. Draw grid dots for inactive positions (if enabled)
		if (resolved.showGrid) {
			this.drawGridDots(ctx, state, resolved);
		}

		// 3. Sort and draw connections (BEFORE particles, so particles render on top)
		const sortedConnections = this.sortByLayer(state.connections);
		for (const conn of sortedConnections) {
			const from = gridToPixel(conn.from[0], conn.from[1], state.grid.spacing, resolved.padding);
			const to = gridToPixel(conn.to[0], conn.to[1], state.grid.spacing, resolved.padding);
			drawConnection(ctx, from.x, from.y, to.x, to.y, conn);
		}

		// 4. Sort and draw particles (ON TOP of connections)
		const sortedParticles = this.sortByLayer(state.particles);
		for (const particle of sortedParticles) {
			const pos = gridToPixel(particle.r, particle.c, state.grid.spacing, resolved.padding);
			const radius = resolved.defaultParticleRadius * particle.size;
			drawParticle(
				ctx,
				pos.x,
				pos.y,
				radius,
				particle.color,
				particle.opacity,
				resolved.particleShape,
			);
		}

		ctx.restore();
	}

	/**
	 * Create a canvas via factory, render the state onto it, and return it.
	 *
	 * @param state - The particle grid state to render
	 * @param config - Render configuration
	 * @param factory - Factory to create canvas instances
	 * @returns The canvas with the rendered state
	 */
	renderToBuffer(state: SpaceState, config: RenderConfig, factory: CanvasFactory): CanvasLike {
		const pixelRatio = config.pixelRatio ?? 1;
		const canvas = factory.createCanvas(
			config.width * pixelRatio,
			config.height * pixelRatio,
		);

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error('Failed to get 2D rendering context from canvas');
		}

		this.renderToCanvas(ctx, state, config);
		return canvas;
	}

	/**
	 * Fill the canvas with the background color.
	 */
	private drawBackground(ctx: CanvasContext2D, config: Required<RenderConfig>): void {
		ctx.fillStyle = config.backgroundColor;
		ctx.fillRect(0, 0, config.width, config.height);
	}

	/**
	 * Draw grid dots at all positions, skipping active particle positions.
	 */
	private drawGridDots(
		ctx: CanvasContext2D,
		state: SpaceState,
		config: Required<RenderConfig>,
	): void {
		// Build a set of active positions for quick lookup
		const activePositions = new Set<string>();
		for (const p of state.particles) {
			activePositions.add(`${p.r},${p.c}`);
		}

		for (let row = 0; row < state.grid.rows; row++) {
			for (let col = 0; col < state.grid.cols; col++) {
				if (!activePositions.has(`${row},${col}`)) {
					const pos = gridToPixel(row, col, state.grid.spacing, config.padding);
					drawGridDot(ctx, pos.x, pos.y, config.gridDotRadius, config.gridDotColor);
				}
			}
		}
	}

	/**
	 * Sort elements by layer (ascending) for proper z-ordering.
	 */
	private sortByLayer<T extends { layer: number }>(items: T[]): T[] {
		return [...items].sort((a, b) => a.layer - b.layer);
	}
}
