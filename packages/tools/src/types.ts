/** Tool definition for LLM consumption (JSON Schema format) */
export interface ToolDefinition {
	name: string;
	description: string;
	parameters: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
}

/** Result returned from tool execution */
export interface ToolResult {
	success: boolean;
	data?: unknown;
	error?: string;
}

/** Keyframe for animation */
export interface AnimationKeyframe {
	time: number;
	targets: Array<{
		row: number;
		col: number;
		color?: string;
		opacity?: number;
		size?: number;
	}>;
	easing?: string;
}

/** Animation event */
export interface AnimationEvent {
	time: number;
	type: string;
	params?: Record<string, unknown>;
}

/** Animation definition */
export interface Animation {
	id: string;
	duration: number;
	fps: number;
	keyframes: AnimationKeyframe[];
	events: AnimationEvent[];
	defaultEasing: string;
}

/** Tool handler function signature */
export type ToolHandler = (params: Record<string, unknown>) => ToolResult;
