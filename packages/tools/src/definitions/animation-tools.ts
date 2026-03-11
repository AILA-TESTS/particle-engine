import type { ToolDefinition } from "../types.js";

export const createAnimationDefinition: ToolDefinition = {
	name: "create_animation",
	description: "Define a new animation with duration, FPS, and keyframes. Returns the animation ID.",
	parameters: {
		type: "object",
		properties: {
			duration: { type: "number", description: "Duration in milliseconds" },
			fps: { type: "number", description: "Frames per second" },
			keyframes: {
				type: "array",
				description: "Array of keyframes",
				items: {
					type: "object",
					properties: {
						time: { type: "number", description: "Time in ms from start" },
						targets: {
							type: "array",
							description: "Particles to animate at this keyframe",
							items: {
								type: "object",
								properties: {
									row: { type: "number" },
									col: { type: "number" },
									color: { type: "string" },
									opacity: { type: "number" },
									size: { type: "number" },
								},
								required: ["row", "col"],
							},
						},
						easing: { type: "string", description: "Easing function name" },
					},
					required: ["time", "targets"],
				},
			},
			events: {
				type: "array",
				description: "Optional animation events",
				items: {
					type: "object",
					properties: {
						time: { type: "number" },
						type: { type: "string" },
						params: { type: "object" },
					},
					required: ["time", "type"],
				},
			},
			defaultEasing: { type: "string", description: "Default easing function" },
		},
		required: ["duration", "fps", "keyframes"],
	},
};

export const modifyAnimationDefinition: ToolDefinition = {
	name: "modify_animation",
	description: "Modify an existing animation by adding/updating keyframes or changing properties.",
	parameters: {
		type: "object",
		properties: {
			id: { type: "string", description: "Animation ID to modify" },
			keyframes: {
				type: "array",
				description: "Keyframes to add or update",
				items: {
					type: "object",
					properties: {
						time: { type: "number" },
						targets: {
							type: "array",
							items: {
								type: "object",
								properties: {
									row: { type: "number" },
									col: { type: "number" },
									color: { type: "string" },
									opacity: { type: "number" },
									size: { type: "number" },
								},
								required: ["row", "col"],
							},
						},
						easing: { type: "string" },
					},
					required: ["time", "targets"],
				},
			},
			duration: { type: "number", description: "New duration in ms" },
			fps: { type: "number", description: "New FPS" },
			events: {
				type: "array",
				items: {
					type: "object",
					properties: {
						time: { type: "number" },
						type: { type: "string" },
						params: { type: "object" },
					},
					required: ["time", "type"],
				},
			},
			defaultEasing: { type: "string" },
		},
		required: ["id"],
	},
};
