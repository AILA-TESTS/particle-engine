import type { ParticleGrid, StateSnapshot } from "@particle-engine/core";
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

	// Count active particles from the snapshot's typed array
	let particleCount = 0;
	for (let i = 0; i < snap.particles.active.length; i++) {
		if (snap.particles.active[i] === 1) particleCount++;
	}

	return {
		success: true,
		data: { name, particleCount, connectionCount: snap.edges.size },
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
