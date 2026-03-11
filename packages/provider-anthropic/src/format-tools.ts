import type { ToolDefinition } from "@particle-engine/tools";

/** Anthropic tool format */
export interface AnthropicTool {
	name: string;
	description: string;
	input_schema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
}

/** Convert our ToolDefinition[] to Anthropic's tool format */
export function formatTools(tools: ToolDefinition[]): AnthropicTool[] {
	return tools.map((tool) => ({
		name: tool.name,
		description: tool.description,
		input_schema: {
			type: "object" as const,
			properties: tool.parameters.properties,
			...(tool.parameters.required ? { required: tool.parameters.required } : {}),
		},
	}));
}
