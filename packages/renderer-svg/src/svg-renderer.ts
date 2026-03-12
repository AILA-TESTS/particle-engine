// ============================================================
// SVGRenderer — Main renderer class
// ============================================================

import type { SpaceState, SerializedParticle, SerializedConnection } from '@particle-engine/core';
import type { RenderConfig, SVGRenderResult, Renderer } from './types.js';
import { gridToPixel, computeViewBox, resolveConfig } from './layout.js';
import { renderParticle, renderConnection, renderGridDot, renderArrowMarker } from './elements.js';

/** Renderable element with layer for sorting */
interface LayeredElement {
	layer: number;
	type: 'connection' | 'particle';
	svg: string;
}

/**
 * SVGRenderer converts a SpaceState into a complete SVG string.
 *
 * Rendering order:
 * - Elements are sorted by layer (lower layers first)
 * - Within the same layer, connections render before particles
 *   so particles appear on top of connection lines
 */
export class SVGRenderer implements Renderer {
	render(state: SpaceState, config: RenderConfig): SVGRenderResult {
		const spacing = state.grid.spacing;
		const resolved = resolveConfig(config, spacing);
		const viewBox = computeViewBox(
			state.grid.rows,
			state.grid.cols,
			spacing,
			resolved.padding,
		);

		const shapeRendering = resolved.antialiasing ? 'geometricPrecision' : 'crispEdges';

		// Scale viewBox by pixel ratio
		const vbWidth = viewBox.width / resolved.pixelRatio;
		const vbHeight = viewBox.height / resolved.pixelRatio;

		const parts: string[] = [];

		// SVG opening tag
		parts.push(
			`<svg xmlns="http://www.w3.org/2000/svg" ` +
			`viewBox="0 0 ${vbWidth} ${vbHeight}" ` +
			`width="${resolved.width}" height="${resolved.height}" ` +
			`shape-rendering="${shapeRendering}">`,
		);

		// Background
		parts.push(
			`<rect width="100%" height="100%" fill="${resolved.backgroundColor}"/>`,
		);

		// Collect directed connections that need arrowhead markers
		const directedConnections = state.connections.filter(c => c.directed);
		if (directedConnections.length > 0) {
			parts.push('<defs>');
			for (const conn of directedConnections) {
				parts.push(renderArrowMarker(conn));
			}
			parts.push('</defs>');
		}

		// Render grid dots if enabled
		if (resolved.showGrid) {
			const gridDots = this.renderGridDots(state, resolved);
			if (gridDots) {
				parts.push(gridDots);
			}
		}

		// Collect all renderable elements with layer info
		const elements: LayeredElement[] = [];

		// Render connections
		for (const conn of state.connections) {
			const fromPixel = gridToPixel(conn.from[0], conn.from[1], spacing, resolved.padding);
			const toPixel = gridToPixel(conn.to[0], conn.to[1], spacing, resolved.padding);

			elements.push({
				layer: conn.layer,
				type: 'connection',
				svg: renderConnection(conn, fromPixel.x, fromPixel.y, toPixel.x, toPixel.y, conn.directed),
			});
		}

		// Render particles
		for (const particle of state.particles) {
			const pixel = gridToPixel(particle.r, particle.c, spacing, resolved.padding);

			elements.push({
				layer: particle.layer,
				type: 'particle',
				svg: renderParticle(
					particle,
					pixel.x,
					pixel.y,
					resolved.defaultParticleRadius,
					resolved.particleShape,
				),
			});
		}

		// Sort by layer (ascending), then connections before particles within same layer
		elements.sort((a, b) => {
			if (a.layer !== b.layer) return a.layer - b.layer;
			if (a.type === 'connection' && b.type === 'particle') return -1;
			if (a.type === 'particle' && b.type === 'connection') return 1;
			return 0;
		});

		// Add sorted elements to output
		for (const el of elements) {
			parts.push(el.svg);
		}

		// Close SVG
		parts.push('</svg>');

		return {
			svg: parts.join('\n'),
			width: resolved.width,
			height: resolved.height,
		};
	}

	/**
	 * Render grid dots for all inactive particle positions.
	 */
	private renderGridDots(
		state: SpaceState,
		config: Required<RenderConfig>,
	): string | null {
		const activePositions = new Set<string>();
		for (const p of state.particles) {
			activePositions.add(`${p.r},${p.c}`);
		}

		const dots: string[] = [];
		for (let row = 0; row < state.grid.rows; row++) {
			for (let col = 0; col < state.grid.cols; col++) {
				if (!activePositions.has(`${row},${col}`)) {
					const pixel = gridToPixel(row, col, state.grid.spacing, config.padding);
					dots.push(renderGridDot(pixel.x, pixel.y, config.gridDotRadius, config.gridDotColor));
				}
			}
		}

		if (dots.length === 0) return null;
		return dots.join('\n');
	}
}
