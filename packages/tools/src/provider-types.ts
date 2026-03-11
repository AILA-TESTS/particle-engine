import type { ToolDefinition, ToolResult } from "./types.js";

/** Generic message format (provider-agnostic) */
export interface Message {
	role: "system" | "user" | "assistant" | "tool";
	content?: string;
	toolCalls?: ToolCall[];
	toolResults?: ToolCallResult[];
}

/** A tool call requested by the LLM */
export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

/** Result of executing a tool call */
export interface ToolCallResult {
	toolCallId: string;
	name: string;
	result: ToolResult;
}

/** Provider configuration (provider-agnostic) */
export interface ProviderConfig {
	temperature?: number; // 0.0-2.0
	maxOutputTokens?: number;
	topP?: number;
	topK?: number;
	stopSequences?: string[];
}

/** Events emitted during streaming */
export type LLMEvent =
	| { type: "text"; content: string }
	| { type: "tool_call"; id: string; name: string; arguments: Record<string, unknown> }
	| { type: "tool_call_delta"; id: string; argumentsDelta: string }
	| { type: "done"; usage: { inputTokens: number; outputTokens: number } }
	| { type: "error"; error: Error };

/** The interface all providers must implement */
export interface LLMProvider {
	readonly name: string;

	/** Convert our tool definitions to provider-specific format */
	formatTools(tools: ToolDefinition[]): unknown;

	/** Send messages and receive events (streaming) */
	stream(
		messages: Message[],
		tools: ToolDefinition[],
		config?: ProviderConfig,
	): AsyncIterable<LLMEvent>;

	/** Parse a raw tool call from provider response */
	parseToolCall(raw: unknown): ToolCall;

	/** Format tool result for sending back to provider */
	formatToolResult(name: string, result: ToolResult): unknown;
}
