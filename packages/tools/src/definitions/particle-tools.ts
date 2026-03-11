import type { ToolDefinition } from "../types.js";

export const setParticlesDefinition: ToolDefinition = {
	name: "set_particles",
	description: "Activate or modify particles at specified coordinates with optional color, size, opacity, group, label, and layer.",
	parameters: {
		type: "object",
		properties: {
			particles: {
				type: "array",
				description: "Array of particles to set",
				items: {
					type: "object",
					properties: {
						row: { type: "number", description: "Row index" },
						col: { type: "number", description: "Column index" },
						color: { type: "string", description: "Hex color (#RRGGBB)" },
						size: { type: "number", description: "Size multiplier (default 1)" },
						opacity: { type: "number", description: "Opacity 0.0-1.0 (default 1)" },
						group: { type: "string", description: "Group name" },
						label: { type: "string", description: "Particle label" },
						layer: { type: "number", description: "Layer z-index" },
					},
					required: ["row", "col"],
				},
			},
		},
		required: ["particles"],
	},
};

export const clearParticlesDefinition: ToolDefinition = {
	name: "clear_particles",
	description: "Deactivate particles by coordinates, group, or all at once. At least one parameter must be provided.",
	parameters: {
		type: "object",
		properties: {
			coordinates: {
				type: "array",
				description: "Array of [row, col] coordinate pairs to clear",
				items: {
					type: "array",
					items: { type: "number" },
				},
			},
			group: {
				type: "string",
				description: "Clear all particles in this group",
			},
			all: {
				type: "boolean",
				description: "Clear all particles",
			},
		},
	},
};
