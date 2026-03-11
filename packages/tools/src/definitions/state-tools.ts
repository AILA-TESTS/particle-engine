import type { ToolDefinition } from "../types.js";

export const snapshotDefinition: ToolDefinition = {
	name: "snapshot",
	description: "Save the current state as a named snapshot that can be restored later.",
	parameters: {
		type: "object",
		properties: {
			name: { type: "string", description: "Snapshot name" },
		},
		required: ["name"],
	},
};

export const restoreDefinition: ToolDefinition = {
	name: "restore",
	description: "Restore a previously saved named snapshot.",
	parameters: {
		type: "object",
		properties: {
			name: { type: "string", description: "Snapshot name to restore" },
		},
		required: ["name"],
	},
};

export const undoDefinition: ToolDefinition = {
	name: "undo",
	description: "Undo the last mutating operation.",
	parameters: {
		type: "object",
		properties: {},
	},
};
