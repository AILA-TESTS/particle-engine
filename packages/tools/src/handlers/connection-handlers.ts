import type { ParticleGrid } from "@particle-engine/core";
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
		const from = conn.from as [number, number];
		const to = conn.to as [number, number];
		const id = grid.connect(from, to, {
			color: conn.color,
			width: conn.width,
			opacity: conn.opacity,
			style: conn.style,
			curve: conn.curve,
			directed: conn.directed,
			group: conn.group,
			label: conn.label,
		});
		created.push({ id, from, to });
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
			const conn = grid.getConnection(id);
			if (conn) {
				grid.disconnect(id);
				removed++;
			}
		}
	}

	if (data.endpoints) {
		for (const [from, to] of data.endpoints) {
			// Count connections matching these endpoints before removing
			const connStore = grid.getConnectionStore();
			const toRemove: string[] = [];
			for (const [id, conn] of connStore.edges) {
				if (
					(conn.from[0] === from[0] &&
						conn.from[1] === from[1] &&
						conn.to[0] === to[0] &&
						conn.to[1] === to[1]) ||
					(conn.from[0] === to[0] &&
						conn.from[1] === to[1] &&
						conn.to[0] === from[0] &&
						conn.to[1] === from[1])
				) {
					toRemove.push(id);
				}
			}
			for (const id of toRemove) {
				grid.disconnect(id);
				removed++;
			}
		}
	}

	if (data.group) {
		const connStore = grid.getConnectionStore();
		const toRemove: string[] = [];
		for (const [id, conn] of connStore.edges) {
			if (conn.group === data.group) {
				toRemove.push(id);
			}
		}
		for (const id of toRemove) {
			grid.disconnect(id);
			removed++;
		}
	}

	return {
		success: true,
		data: { removed },
	};
}
