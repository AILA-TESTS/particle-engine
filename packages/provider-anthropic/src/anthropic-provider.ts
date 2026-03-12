import Anthropic from "@anthropic-ai/sdk";
import type {
	LLMProvider,
	LLMEvent,
	Message,
	ToolCall,
	ToolDefinition,
	ToolResult,
	ProviderConfig,
} from "@particle-engine/tools";
import type { AnthropicProviderConfig } from "./types.js";
import { formatTools } from "./format-tools.js";
import type { AnthropicTool } from "./format-tools.js";
import { formatMessages } from "./format-messages.js";
import {
	parseContentBlockStart,
	parseContentBlockDelta,
	parseContentBlockStop,
	parseDoneEvent,
	type PendingToolCall,
} from "./parse-response.js";

/** AnthropicProvider implements LLMProvider for Anthropic's Claude models */
export class AnthropicProvider implements LLMProvider {
	readonly name = "anthropic";

	private client: Anthropic;
	private modelId: string;
	private maxTokens: number;

	constructor(config: AnthropicProviderConfig) {
		this.client = new Anthropic({
			apiKey: config.apiKey,
			...(config.baseURL ? { baseURL: config.baseURL } : {}),
		});
		this.modelId = config.modelId ?? "claude-sonnet-4-20250514";
		this.maxTokens = config.maxTokens ?? 4096;
	}

	/** Convert our tool definitions to Anthropic's tool format */
	formatTools(tools: ToolDefinition[]): AnthropicTool[] {
		return formatTools(tools);
	}

	/** Stream messages to Claude and yield LLMEvents */
	async *stream(
		messages: Message[],
		tools: ToolDefinition[],
		config?: ProviderConfig,
	): AsyncIterable<LLMEvent> {
		const { systemMessage, apiMessages } = formatMessages(messages);
		const formattedTools = this.formatTools(tools);

		try {
			const stream = this.client.messages.stream({
				model: this.modelId,
				max_tokens: config?.maxOutputTokens ?? this.maxTokens,
				...(systemMessage ? { system: systemMessage } : {}),
				messages: apiMessages as Anthropic.MessageParam[],
				tools: formattedTools as Anthropic.Tool[],
				...(config?.temperature !== undefined ? { temperature: config.temperature } : {}),
				...(config?.topP !== undefined ? { top_p: config.topP } : {}),
				...(config?.topK !== undefined ? { top_k: config.topK } : {}),
				...(config?.stopSequences ? { stop_sequences: config.stopSequences } : {}),
			});

			// Track tool calls being built from streamed deltas
			const pendingToolCalls = new Map<number, PendingToolCall>();

			for await (const event of stream) {
				const eventObj = event as unknown as Record<string, unknown>;

				if (eventObj.type === "content_block_start") {
					const result = parseContentBlockStart(eventObj);
					if (result?.pending) {
						pendingToolCalls.set(result.index, result.pending);
					}
				} else if (eventObj.type === "content_block_delta") {
					const llmEvent = parseContentBlockDelta(eventObj, pendingToolCalls);
					if (llmEvent) {
						yield llmEvent;
					}
				} else if (eventObj.type === "content_block_stop") {
					const llmEvent = parseContentBlockStop(eventObj, pendingToolCalls);
					if (llmEvent) {
						yield llmEvent;
					}
				} else if (eventObj.type === "message_stop") {
					// Get final message for usage data
					const finalMessage = await stream.finalMessage();
					yield parseDoneEvent(finalMessage as unknown as Record<string, unknown>);
				}
			}
		} catch (error) {
			yield {
				type: "error",
				error: error instanceof Error ? error : new Error(String(error)),
			};
		}
	}

	/** Parse a raw Anthropic tool_use content block into our ToolCall format */
	parseToolCall(raw: unknown): ToolCall {
		const block = raw as { id?: string; name?: string; input?: Record<string, unknown> };
		return {
			id: block.id ?? "",
			name: block.name ?? "",
			arguments: block.input ?? {},
		};
	}

	/** Format a tool result for sending back to Anthropic */
	formatToolResult(toolCallId: string, result: ToolResult): unknown {
		return {
			type: "tool_result",
			tool_use_id: toolCallId,
			content: JSON.stringify(result),
		};
	}
}
