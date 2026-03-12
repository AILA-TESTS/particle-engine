// ============================================================
// Frame Converter — Converts FrameState → SpaceState for the canvas renderer
// ============================================================

import type { FrameState, FrameParticle, FrameConnection } from '@particle-engine/animation';
import type {
	SpaceState,
	SerializedParticle,
	SerializedConnection,
	GridConfig,
} from '@particle-engine/core';

/**
 * Convert an RGB component (0-255) to a two-character hex string.
 */
function componentToHex(c: number): string {
	const clamped = Math.max(0, Math.min(255, Math.round(c)));
	const hex = clamped.toString(16).toUpperCase();
	return hex.length === 1 ? '0' + hex : hex;
}

/**
 * Convert RGB components (0-255) to a hex color string "#RRGGBB".
 */
export function rgbToHex(r: number, g: number, b: number): string {
	return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

/**
 * Convert a FrameParticle to a SerializedParticle.
 */
function convertParticle(fp: FrameParticle): SerializedParticle {
	return {
		r: fp.row,
		c: fp.col,
		color: rgbToHex(fp.colorR, fp.colorG, fp.colorB),
		opacity: fp.opacity,
		size: fp.size,
		layer: 0,
		group: '',
	};
}

/**
 * Convert a FrameConnection to a SerializedConnection.
 */
function convertConnection(fc: FrameConnection, index: number): SerializedConnection {
	return {
		id: `conn_${index}`,
		from: [fc.fromRow, fc.fromCol],
		to: [fc.toRow, fc.toCol],
		color: rgbToHex(fc.colorR, fc.colorG, fc.colorB),
		width: fc.width,
		opacity: fc.opacity,
		style: fc.style,
		curve: fc.curve,
		directed: fc.directed,
		group: '',
		layer: 0,
		label: '',
	};
}

/**
 * Collect unique group names from particles and connections.
 */
function collectGroups(
	particles: SerializedParticle[],
	connections: SerializedConnection[],
): string[] {
	const groups = new Set<string>();
	for (const p of particles) {
		if (p.group) groups.add(p.group);
	}
	for (const c of connections) {
		if (c.group) groups.add(c.group);
	}
	return Array.from(groups);
}

/**
 * Convert a FrameState (from the animation engine) to a SpaceState
 * (for the canvas renderer).
 *
 * This bridges the gap between the animation pipeline output and
 * the renderer input format.
 */
export function frameToSpaceState(frame: FrameState, gridConfig: GridConfig): SpaceState {
	const particles = frame.particles.map(convertParticle);
	const connections = frame.connections.map(convertConnection);
	const groups = collectGroups(particles, connections);

	return {
		grid: {
			rows: gridConfig.rows,
			cols: gridConfig.cols,
			spacing: gridConfig.spacing,
		},
		summary: {
			active_count: particles.length,
			connection_count: connections.length,
			groups,
		},
		particles,
		connections,
	};
}
