import type { ParticleGrid } from "../grid/particle-grid.js";
import type { StateSnapshot } from "../grid/types.js";
import type { ToolResult } from "../types.js";

export function handleSnapshot(
	grid: ParticleGrid,
	snapshots: Map<string, StateSnapshot>,
	params: Record<string, unknown>,
): ToolResult {
	const name = params.name as string;
	if (!name || typeof name !== "string") {
		return { success: false, error: "Snapshot name is required" };
	}

	const snap = grid.snapshot();
	snapshots.set(name, snap);

	return {
		success: true,
		data: { name, particleCount: snap.particles.size, connectionCount: snap.connections.size },
	};
}

export function handleRestore(
	grid: ParticleGrid,
	snapshots: Map<string, StateSnapshot>,
	params: Record<string, unknown>,
): ToolResult {
	const name = params.name as string;
	if (!name || typeof name !== "string") {
		return { success: false, error: "Snapshot name is required" };
	}

	const snap = snapshots.get(name);
	if (!snap) {
		return { success: false, error: `Snapshot '${name}' not found` };
	}

	grid.restore(snap);

	return {
		success: true,
		data: { name, restored: true },
	};
}

export function handleUndo(
	grid: ParticleGrid,
	undoStack: StateSnapshot[],
): ToolResult {
	if (undoStack.length === 0) {
		return { success: false, error: "Nothing to undo" };
	}

	const snap = undoStack.pop()!;
	grid.restore(snap);

	return {
		success: true,
		data: { undone: true, remainingUndos: undoStack.length },
	};
}
