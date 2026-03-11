import type { ToolDefinition } from "../types.js";

export const getSpaceInfoDefinition: ToolDefinition = {
	name: "get_space_info",
	description: "Get grid dimensions and summary statistics including active particle count, connection count, and groups.",
	parameters: {
		type: "object",
		properties: {},
	},
};

export const getStateDefinition: ToolDefinition = {
	name: "get_state",
	description: "Get active particles and connections. Optionally filter by region, group, or include inactive particles.",
	parameters: {
		type: "object",
		properties: {
			region: {
				type: "object",
				description: "Filter to a rectangular region",
				properties: {
					rowStart: { type: "number", description: "Start row (inclusive)" },
					rowEnd: { type: "number", description: "End row (inclusive)" },
					colStart: { type: "number", description: "Start column (inclusive)" },
					colEnd: { type: "number", description: "End column (inclusive)" },
				},
				required: ["rowStart", "rowEnd", "colStart", "colEnd"],
			},
			group: {
				type: "string",
				description: "Filter by group name",
			},
			includeInactive: {
				type: "boolean",
				description: "Include inactive particles",
			},
		},
	},
};
