import {
	clearParticlesDefinition,
	connectDefinition,
	createAnimationDefinition,
	disconnectDefinition,
	getSpaceInfoDefinition,
	getStateDefinition,
	modifyAnimationDefinition,
	renderImageDefinition,
	renderVideoDefinition,
	restoreDefinition,
	setParticlesDefinition,
	snapshotDefinition,
	undoDefinition,
} from "./definitions/index.js";
import { ParticleGrid } from "./grid/particle-grid.js";
import type { StateSnapshot } from "./grid/types.js";
import {
	handleClearParticles,
	handleConnect,
	handleCreateAnimation,
	handleDisconnect,
	handleGetSpaceInfo,
	handleGetState,
	handleModifyAnimation,
	handleRenderImage,
	handleRenderVideo,
	handleRestore,
	handleSetParticles,
	handleSnapshot,
	handleUndo,
} from "./handlers/index.js";
import type { Animation, ToolDefinition, ToolResult } from "./types.js";

/** Tools that do NOT need an undo snapshot before execution.
 *  Read-only tools don't mutate state.
 *  "undo" manages the undo stack itself.
 *  "snapshot" only saves state, it doesn't mutate the grid.
 */
const NO_UNDO_SNAPSHOT_TOOLS = new Set([
	"get_space_info",
	"get_state",
	"render_image",
	"render_video",
	"undo",
	"snapshot",
]);

export class ToolExecutor {
	private grid: ParticleGrid;
	private undoStack: StateSnapshot[];
	private namedSnapshots: Map<string, StateSnapshot>;
	private animations: Map<string, Animation>;
	private nextAnimationId: { value: number };
	private definitions: ToolDefinition[];

	constructor(config: { rows: number; cols: number; spacing: number }) {
		this.grid = new ParticleGrid(config);
		this.undoStack = [];
		this.namedSnapshots = new Map();
		this.animations = new Map();
		this.nextAnimationId = { value: 1 };
		this.definitions = [
			getSpaceInfoDefinition,
			getStateDefinition,
			setParticlesDefinition,
			clearParticlesDefinition,
			connectDefinition,
			disconnectDefinition,
			createAnimationDefinition,
			modifyAnimationDefinition,
			renderImageDefinition,
			renderVideoDefinition,
			snapshotDefinition,
			restoreDefinition,
			undoDefinition,
		];
	}

	getToolDefinitions(): ToolDefinition[] {
		return this.definitions;
	}

	getGrid(): ParticleGrid {
		return this.grid;
	}

	execute(toolName: string, params: Record<string, unknown>): ToolResult {
		// Validate tool name
		const def = this.definitions.find((d) => d.name === toolName);
		if (!def) {
			return { success: false, error: `Unknown tool: ${toolName}` };
		}

		// Save undo snapshot for mutating tools
		const needsUndo = !NO_UNDO_SNAPSHOT_TOOLS.has(toolName);
		if (needsUndo) {
			this.undoStack.push(this.grid.snapshot());
		}

		try {
			const result = this.dispatch(toolName, params);
			// If the handler returned an error, pop the undo snapshot since no change occurred
			if (!result.success && needsUndo) {
				this.undoStack.pop();
			}
			return result;
		} catch (e) {
			// On error for mutating tools, pop the undo snapshot since no change occurred
			if (needsUndo) {
				this.undoStack.pop();
			}
			const message = e instanceof Error ? e.message : String(e);
			return { success: false, error: message };
		}
	}

	private dispatch(toolName: string, params: Record<string, unknown>): ToolResult {
		switch (toolName) {
			case "get_space_info":
				return handleGetSpaceInfo(this.grid);
			case "get_state":
				return handleGetState(this.grid, params);
			case "set_particles":
				return handleSetParticles(this.grid, params);
			case "clear_particles":
				return handleClearParticles(this.grid, params);
			case "connect":
				return handleConnect(this.grid, params);
			case "disconnect":
				return handleDisconnect(this.grid, params);
			case "create_animation":
				return handleCreateAnimation(this.animations, this.nextAnimationId, params);
			case "modify_animation":
				return handleModifyAnimation(this.animations, params);
			case "render_image":
				return handleRenderImage(params);
			case "render_video":
				return handleRenderVideo(params);
			case "snapshot":
				return handleSnapshot(this.grid, this.namedSnapshots, params);
			case "restore":
				return handleRestore(this.grid, this.namedSnapshots, params);
			case "undo":
				return handleUndo(this.grid, this.undoStack);
			default:
				return { success: false, error: `Unknown tool: ${toolName}` };
		}
	}
}
