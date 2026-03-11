import type { ToolDefinition } from "../types.js";

export const renderImageDefinition: ToolDefinition = {
	name: "render_image",
	description: "Render the current state as an image. (Placeholder - renderer not yet implemented.)",
	parameters: {
		type: "object",
		properties: {
			format: {
				type: "string",
				enum: ["png", "svg", "webp"],
				description: "Output format",
			},
			width: { type: "number", description: "Image width in pixels" },
			height: { type: "number", description: "Image height in pixels" },
		},
	},
};

export const renderVideoDefinition: ToolDefinition = {
	name: "render_video",
	description: "Render an animation as a video. (Placeholder - renderer not yet implemented.)",
	parameters: {
		type: "object",
		properties: {
			animationId: { type: "string", description: "Animation ID to render" },
			format: {
				type: "string",
				enum: ["mp4", "webm", "gif"],
				description: "Output format",
			},
			width: { type: "number", description: "Video width in pixels" },
			height: { type: "number", description: "Video height in pixels" },
		},
	},
};
