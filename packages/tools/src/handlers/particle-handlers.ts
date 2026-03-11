import type { ParticleGrid } from "../grid/particle-grid.js";
import { setParticlesSchema, clearParticlesSchema } from "../schemas/index.js";
import type { ToolResult } from "../types.js";
import { validateBounds, validateParams } from "../validation.js";

export function handleSetParticles(
	grid: ParticleGrid,
	params: Record<string, unknown>,
): ToolResult {
	const validation = validateParams(setParticlesSchema, params);
	if (!validation.success) return validation.result;

	const { particles } = validation.data;
	const config = grid.getConfig();
	const set: Array<{ row: number; col: number }> = [];

	for (const p of particles) {
		const boundsError = validateBounds(p.row, p.col, config.rows, config.cols);
		if (boundsError) {
			return { success: false, error: boundsError };
		}
	}

	for (const p of particles) {
		grid.setParticle(p.row, p.col, {
			color: p.color,
			size: p.size,
			opacity: p.opacity,
			group: p.group,
			label: p.label,
			layer: p.layer,
		});
		set.push({ row: p.row, col: p.col });
	}

	return {
		success: true,
		data: { set: set.length, particles: set },
	};
}

export function handleClearParticles(
	grid: ParticleGrid,
	params: Record<string, unknown>,
): ToolResult {
	const validation = validateParams(clearParticlesSchema, params);
	if (!validation.success) return validation.result;

	const data = validation.data;
	let cleared = 0;

	if (data.all) {
		const info = grid.getSpaceInfo();
		cleared = info.activeCount;
		grid.clearAll();
		return { success: true, data: { cleared } };
	}

	if (data.group) {
		const stateBefore = grid.getState({ group: data.group });
		cleared += stateBefore.particles.length;
		grid.clearGroup(data.group);
	}

	if (data.coordinates) {
		const config = grid.getConfig();
		for (const [r, c] of data.coordinates) {
			const boundsError = validateBounds(r, c, config.rows, config.cols);
			if (boundsError) {
				return { success: false, error: boundsError };
			}
			if (grid.isActive(r, c)) {
				grid.clearParticle(r, c);
				cleared++;
			}
		}
	}

	return { success: true, data: { cleared } };
}
