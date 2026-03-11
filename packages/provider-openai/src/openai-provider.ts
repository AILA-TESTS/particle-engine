import OpenAI from "openai";
import type {
	LLMProvider,
	LLMEvent,
	Message,
	ToolCall,
	ProviderConfig,
} from "@particle-engine/tools";
import type { ToolDefinition, ToolResult } from "@particle-engine/tools";
import type { OpenAIProviderConfig } from "./types.js";
import type { OpenAITool } from "./format-tools.js";
import { formatTools } from "./format-tools.js";
import { formatMessages } from "./format-messages.js";
import { parseResponseChunk } from "./parse-response.js";
import type { PendingToolCall } from "./parse-response.js";

/** OpenAIProvider implements LLMProvider for OpenAI's chat completion models */
export class OpenAIProvider implements LLMProvider {
	readonly name = "openai";

	private client: OpenAI;
	private modelId: string;
	private defaultConfig: ProviderConfig;

	constructor(config: OpenAIProviderConfig, defaultConfig?: ProviderConfig) {
		this.client = new OpenAI({
			apiKey: config.apiKey,
			...(config.baseURL ? { baseURL: config.baseURL } : {}),
			...(config.organization ? { organization: config.organization } : {}),
		});
		this.modelId = config.modelId ?? "gpt-4o";
		this.defaultConfig = defaultConfig ?? {};
	}

	/** Convert our tool definitions to OpenAI's ChatCompletionTool format */
	formatTools(tools: ToolDefinition[]): OpenAITool[] {
		return formatTools(tools);
	}

	/** Stream messages to OpenAI and yield LLMEvents */
	async *stream(
		messages: Message[],
		tools: ToolDefinition[],
		config?: ProviderConfig,
	): AsyncIterable<LLMEvent> {
		const mergedConfig = { ...this.defaultConfig, ...config };
		const formattedMessages = formatMessages(messages);
		const formattedTools = formatTools(tools);

		try {
			const stream = await this.client.chat.completions.create({
				model: this.modelId,
				messages: formattedMessages as OpenAI.ChatCompletionMessageParam[],
				tools: formattedTools as OpenAI.ChatCompletionTool[],
				stream: true,
				stream_options: { include_usage: true },
				...(mergedConfig.temperature !== undefined ? { temperature: mergedConfig.temperature } : {}),
				...(mergedConfig.maxOutputTokens ? { max_tokens: mergedConfig.maxOutputTokens } : {}),
				...(mergedConfig.topP !== undefined ? { top_p: mergedConfig.topP } : {}),
				...(mergedConfig.stopSequences ? { stop: mergedConfig.stopSequences } : {}),
			});

			const pendingToolCalls = new Map<number, PendingToolCall>();

			for await (const chunk of stream) {
				const events = parseResponseChunk(chunk, pendingToolCalls);
				for (const event of events) {
					yield event;
				}
			}

			// If no done event was emitted (no usage data in stream), emit one
			yield {
				type: "done",
				usage: { inputTokens: 0, outputTokens: 0 },
			};
		} catch (error) {
			yield {
				type: "error",
				error: error instanceof Error ? error : new Error(String(error)),
			};
		}
	}

	/** Parse a raw OpenAI tool call into our ToolCall format */
	parseToolCall(raw: unknown): ToolCall {
		const tc = raw as { id: string; function: { name: string; arguments: string } };
		return {
			id: tc.id,
			name: tc.function.name,
			arguments: JSON.parse(tc.function.arguments),
		};
	}

	/** Format a tool result for sending back to OpenAI */
	formatToolResult(name: string, result: ToolResult): unknown {
		return {
			role: "tool",
			tool_call_id: name,
			content: JSON.stringify(result),
		};
	}
}
