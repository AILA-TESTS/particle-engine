import type { ToolDefinition } from "../types.js";

export const connectDefinition: ToolDefinition = {
	name: "connect",
	description: "Create connections between active particles. Both endpoints must be active.",
	parameters: {
		type: "object",
		properties: {
			connections: {
				type: "array",
				description: "Array of connections to create",
				items: {
					type: "object",
					properties: {
						from: {
							type: "array",
							description: "[row, col] of source particle",
							items: { type: "number" },
						},
						to: {
							type: "array",
							description: "[row, col] of target particle",
							items: { type: "number" },
						},
						color: { type: "string", description: "Hex color (#RRGGBB)" },
						width: { type: "number", description: "Line width" },
						opacity: { type: "number", description: "Opacity 0.0-1.0" },
						style: {
							type: "string",
							enum: ["solid", "dashed", "dotted"],
							description: "Line style",
						},
						curve: { type: "number", description: "Curve amount" },
						directed: { type: "boolean", description: "Whether connection is directed" },
						group: { type: "string", description: "Group name" },
						label: { type: "string", description: "Connection label" },
					},
					required: ["from", "to"],
				},
			},
		},
		required: ["connections"],
	},
};

export const disconnectDefinition: ToolDefinition = {
	name: "disconnect",
	description: "Remove connections by IDs, endpoints, or group. At least one parameter must be provided.",
	parameters: {
		type: "object",
		properties: {
			ids: {
				type: "array",
				description: "Connection IDs to remove",
				items: { type: "string" },
			},
			endpoints: {
				type: "array",
				description: "Array of [from, to] endpoint pairs to disconnect",
				items: {
					type: "array",
					items: {
						type: "array",
						items: { type: "number" },
					},
				},
			},
			group: {
				type: "string",
				description: "Remove all connections in this group",
			},
		},
	},
};
