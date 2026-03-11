import type { ParticleGrid } from "../grid/particle-grid.js";
import { connectSchema, disconnectSchema } from "../schemas/index.js";
import type { ToolResult } from "../types.js";
import { validateBounds, validateParams } from "../validation.js";

export function handleConnect(
	grid: ParticleGrid,
	params: Record<string, unknown>,
): ToolResult {
	const validation = validateParams(connectSchema, params);
	if (!validation.success) return validation.result;

	const { connections } = validation.data;
	const config = grid.getConfig();
	const created: Array<{ id: string; from: [number, number]; to: [number, number] }> = [];

	// Validate all first
	for (const conn of connections) {
		const fromBounds = validateBounds(conn.from[0], conn.from[1], config.rows, config.cols);
		if (fromBounds) return { success: false, error: fromBounds };

		const toBounds = validateBounds(conn.to[0], conn.to[1], config.rows, config.cols);
		if (toBounds) return { success: false, error: toBounds };

		if (!grid.isActive(conn.from[0], conn.from[1])) {
			return {
				success: false,
				error: `Particle at [${conn.from[0]}, ${conn.from[1]}] is not active`,
			};
		}
		if (!grid.isActive(conn.to[0], conn.to[1])) {
			return {
				success: false,
				error: `Particle at [${conn.to[0]}, ${conn.to[1]}] is not active`,
			};
		}
	}

	// Create all
	for (const conn of connections) {
		const result = grid.addConnection(
			conn.from as [number, number],
			conn.to as [number, number],
			{
				color: conn.color,
				width: conn.width,
				opacity: conn.opacity,
				style: conn.style,
				curve: conn.curve,
				directed: conn.directed,
				group: conn.group,
				label: conn.label,
			},
		);
		created.push({ id: result.id, from: result.from, to: result.to });
	}

	return {
		success: true,
		data: { created: created.length, connections: created },
	};
}

export function handleDisconnect(
	grid: ParticleGrid,
	params: Record<string, unknown>,
): ToolResult {
	const validation = validateParams(disconnectSchema, params);
	if (!validation.success) return validation.result;

	const data = validation.data;
	let removed = 0;

	if (data.ids) {
		for (const id of data.ids) {
			if (grid.removeConnection(id)) {
				removed++;
			}
		}
	}

	if (data.endpoints) {
		for (const [from, to] of data.endpoints) {
			removed += grid.removeConnectionsByEndpoints(
				from as [number, number],
				to as [number, number],
			);
		}
	}

	if (data.group) {
		removed += grid.removeConnectionsByGroup(data.group);
	}

	return {
		success: true,
		data: { removed },
	};
}
