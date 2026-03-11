import type { ToolResult } from "../types.js";

export function handleRenderImage(_params: Record<string, unknown>): ToolResult {
	return {
		success: true,
		data: { message: "Renderer not implemented yet" },
	};
}

export function handleRenderVideo(_params: Record<string, unknown>): ToolResult {
	return {
		success: true,
		data: { message: "Renderer not implemented yet" },
	};
}
