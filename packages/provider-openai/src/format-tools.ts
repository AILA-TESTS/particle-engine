import type { ToolDefinition } from "@particle-engine/tools";

/** OpenAI tool format for chat completions */
export interface OpenAITool {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: ToolDefinition["parameters"];
	};
}

/** Convert our ToolDefinition[] to OpenAI's ChatCompletionTool[] format */
export function formatTools(tools: ToolDefinition[]): OpenAITool[] {
	return tools.map((tool) => ({
		type: "function" as const,
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
		},
	}));
}
