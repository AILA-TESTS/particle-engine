import type { ParticleGrid } from "@particle-engine/core";
import type { ToolResult } from "../types.js";

export function handleGetSpaceInfo(grid: ParticleGrid): ToolResult {
	const info = grid.getSpaceInfo();
	return {
		success: true,
		data: info,
	};
}

export function handleGetState(
	grid: ParticleGrid,
	params: Record<string, unknown>,
): ToolResult {
	const options: {
		region?: { rowStart: number; rowEnd: number; colStart: number; colEnd: number };
		group?: string;
		includeInactive?: boolean;
	} = {};

	if (params.region) {
		const r = params.region as {
			rowStart: number;
			rowEnd: number;
			colStart: number;
			colEnd: number;
		};
		const config = grid.getConfig();
		// Validate region bounds
		if (r.rowStart < 0 || r.rowEnd >= config.rows) {
			return {
				success: false,
				error: `Region row range [${r.rowStart}, ${r.rowEnd}] out of bounds [0, ${config.rows - 1}]`,
			};
		}
		if (r.colStart < 0 || r.colEnd >= config.cols) {
			return {
				success: false,
				error: `Region col range [${r.colStart}, ${r.colEnd}] out of bounds [0, ${config.cols - 1}]`,
			};
		}
		options.region = r;
	}

	if (typeof params.group === "string") {
		options.group = params.group;
	}

	if (typeof params.includeInactive === "boolean") {
		options.includeInactive = params.includeInactive;
	}

	const state = grid.getState(options);
	// Map serialized particles (short keys r/c) to full form (row/col) for backward compatibility
	const particles = state.particles.map((p) => ({
		row: p.r,
		col: p.c,
		active: true,
		color: p.color,
		opacity: p.opacity,
		size: p.size,
		layer: p.layer,
		group: p.group,
	}));
	return {
		success: true,
		data: {
			particles,
			connections: state.connections,
		},
	};
}
