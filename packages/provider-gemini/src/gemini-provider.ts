import { VertexAI } from "@google-cloud/vertexai";
import type {
	FunctionDeclarationsTool,
	Content,
	Part,
} from "@google-cloud/vertexai";
import type {
	LLMProvider,
	LLMEvent,
	Message,
	ToolCall,
	ToolDefinition,
	ToolResult,
	ProviderConfig,
} from "@particle-engine/tools";
import type { GeminiProviderConfig } from "./types.js";
import { formatTools } from "./format-tools.js";
import { formatMessages } from "./format-messages.js";
import { parseResponseChunk, generateToolCallId } from "./parse-response.js";

/** GeminiProvider implements LLMProvider for Google's Gemini models via Vertex AI */
export class GeminiProvider implements LLMProvider {
	readonly name = "gemini";

	private vertexAI: VertexAI;
	private modelId: string;
	private defaultConfig: ProviderConfig;

	constructor(config: GeminiProviderConfig, defaultConfig?: ProviderConfig) {
		this.vertexAI = new VertexAI({
			project: config.projectId,
			location: config.location ?? "us-central1",
		});
		this.modelId = config.modelId ?? "gemini-2.0-flash";
		this.defaultConfig = defaultConfig ?? {};
	}

	/** Convert our tool definitions to Gemini's FunctionDeclarationsTool format */
	formatTools(tools: ToolDefinition[]): FunctionDeclarationsTool[] {
		return formatTools(tools);
	}

	/** Stream messages to Gemini and yield LLMEvents */
	async *stream(
		messages: Message[],
		tools: ToolDefinition[],
		config?: ProviderConfig,
	): AsyncIterable<LLMEvent> {
		const mergedConfig = { ...this.defaultConfig, ...config };
		const { systemInstruction, contents } = formatMessages(messages);

		// Separate history (all but last) from the current message (last)
		const history: Content[] = contents.slice(0, -1);
		const lastContent = contents[contents.length - 1];
		const lastParts: Part[] = lastContent?.parts ?? [{ text: "" }];

		// Create the generative model with tools and config
		const geminiTools = formatTools(tools);
		const model = this.vertexAI.getGenerativeModel({
			model: this.modelId,
			tools: geminiTools,
			generationConfig: {
				temperature: mergedConfig.temperature,
				maxOutputTokens: mergedConfig.maxOutputTokens,
				topP: mergedConfig.topP,
				topK: mergedConfig.topK,
				stopSequences: mergedConfig.stopSequences,
			},
			...(systemInstruction ? { systemInstruction } : {}),
		});

		try {
			// Start chat with history and send the last message via streaming
			const chat = model.startChat({ history });
			const streamResult = await chat.sendMessageStream(lastParts);

			let hasDone = false;

			for await (const chunk of streamResult.stream) {
				const events = parseResponseChunk(chunk);
				for (const event of events) {
					if (event.type === "done") {
						hasDone = true;
					}
					yield event;
				}
			}

			// If no done event was emitted from streaming, get usage from aggregated response
			if (!hasDone) {
				const aggregated = await streamResult.response;
				if (aggregated.usageMetadata) {
					yield {
						type: "done",
						usage: {
							inputTokens: aggregated.usageMetadata.promptTokenCount ?? 0,
							outputTokens: aggregated.usageMetadata.candidatesTokenCount ?? 0,
						},
					};
				} else {
					yield {
						type: "done",
						usage: { inputTokens: 0, outputTokens: 0 },
					};
				}
			}
		} catch (error) {
			yield {
				type: "error",
				error: error instanceof Error ? error : new Error(String(error)),
			};
		}
	}

	/** Parse a raw Gemini function call into our ToolCall format */
	parseToolCall(raw: unknown): ToolCall {
		const fc = raw as { name?: string; args?: Record<string, unknown> };
		return {
			id: generateToolCallId(),
			name: fc.name ?? "",
			arguments: fc.args ?? {},
		};
	}

	/** Format a tool result for sending back to Gemini */
	formatToolResult(name: string, result: ToolResult): unknown {
		return {
			functionResponse: {
				name,
				response: result,
			},
		};
	}
}
