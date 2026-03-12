import { VertexAI } from "@google-cloud/vertexai";
import type {
	FunctionDeclarationsTool as VertexFunctionDeclarationsTool,
	Content as VertexContent,
	Part as VertexPart,
} from "@google-cloud/vertexai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
	FunctionDeclarationsTool as GenAIFunctionDeclarationsTool,
	Content as GenAIContent,
	Part as GenAIPart,
} from "@google/generative-ai";
import type {
	LLMProvider,
	LLMEvent,
	Message,
	ToolCall,
	ToolDefinition,
	ToolResult,
	ProviderConfig,
} from "@particle-engine/tools";
import type { GeminiProviderConfig, GeminiAuthMode } from "./types.js";
import { formatTools } from "./format-tools.js";
import { formatToolsGenAI } from "./format-tools-genai.js";
import { formatMessages } from "./format-messages.js";
import { parseResponseChunk, generateToolCallId } from "./parse-response.js";

/**
 * Detect auth mode from config.
 * - If explicit authMode is set, use that.
 * - If apiKey is provided, use 'apiKey'.
 * - If projectId is provided, use 'vertexai'.
 * - Otherwise, throw.
 */
function detectAuthMode(config: GeminiProviderConfig): GeminiAuthMode {
	if (config.authMode) return config.authMode;
	if (config.apiKey) return "apiKey";
	if (config.projectId) return "vertexai";
	throw new Error(
		"GeminiProvider: either 'apiKey' or 'projectId' must be provided in config",
	);
}

/** GeminiProvider implements LLMProvider for Google's Gemini models via Vertex AI or API Key */
export class GeminiProvider implements LLMProvider {
	readonly name = "gemini";

	private authMode: GeminiAuthMode;
	private vertexAI: VertexAI | null = null;
	private genAI: GoogleGenerativeAI | null = null;
	private modelId: string;
	private defaultConfig: ProviderConfig;

	constructor(config: GeminiProviderConfig, defaultConfig?: ProviderConfig) {
		this.authMode = detectAuthMode(config);
		this.modelId = config.modelId ?? "gemini-2.0-flash";
		this.defaultConfig = defaultConfig ?? {};

		if (this.authMode === "vertexai") {
			if (!config.projectId) {
				throw new Error(
					"GeminiProvider: 'projectId' is required for Vertex AI mode",
				);
			}
			this.vertexAI = new VertexAI({
				project: config.projectId,
				location: config.location ?? "us-central1",
			});
		} else {
			if (!config.apiKey) {
				throw new Error(
					"GeminiProvider: 'apiKey' is required for API key mode",
				);
			}
			this.genAI = new GoogleGenerativeAI(config.apiKey);
		}
	}

	/** Get the current auth mode */
	getAuthMode(): GeminiAuthMode {
		return this.authMode;
	}

	/** Convert our tool definitions to Gemini's FunctionDeclarationsTool format */
	formatTools(tools: ToolDefinition[]): VertexFunctionDeclarationsTool[] | GenAIFunctionDeclarationsTool[] {
		if (this.authMode === "vertexai") {
			return formatTools(tools);
		}
		return formatToolsGenAI(tools);
	}

	/** Stream messages to Gemini and yield LLMEvents */
	async *stream(
		messages: Message[],
		tools: ToolDefinition[],
		config?: ProviderConfig,
	): AsyncIterable<LLMEvent> {
		if (this.authMode === "vertexai") {
			yield* this.streamVertexAI(messages, tools, config);
		} else {
			yield* this.streamGenAI(messages, tools, config);
		}
	}

	/** Stream via Vertex AI SDK */
	private async *streamVertexAI(
		messages: Message[],
		tools: ToolDefinition[],
		config?: ProviderConfig,
	): AsyncIterable<LLMEvent> {
		const mergedConfig = { ...this.defaultConfig, ...config };
		const { systemInstruction, contents } = formatMessages(messages);

		// Separate history (all but last) from the current message (last)
		const history = contents.slice(0, -1) as VertexContent[];
		const lastContent = contents[contents.length - 1];
		const lastParts = (lastContent?.parts ?? [{ text: "" }]) as VertexPart[];

		// Create the generative model with tools and config
		const geminiTools = formatTools(tools);
		const model = this.vertexAI!.getGenerativeModel({
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

	/** Stream via Google Generative AI SDK (API key mode) */
	private async *streamGenAI(
		messages: Message[],
		tools: ToolDefinition[],
		config?: ProviderConfig,
	): AsyncIterable<LLMEvent> {
		const mergedConfig = { ...this.defaultConfig, ...config };
		const { systemInstruction, contents } = formatMessages(messages);

		// Separate history (all but last) from the current message (last)
		const history = contents.slice(0, -1) as GenAIContent[];
		const lastContent = contents[contents.length - 1];
		const lastParts = (lastContent?.parts ?? [{ text: "" }]) as GenAIPart[];

		// Create the generative model with tools and config
		const geminiTools = formatToolsGenAI(tools);
		const model = this.genAI!.getGenerativeModel({
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
				// The GenAI SDK returns EnhancedGenerateContentResponse which is compatible
				// with our GeminiResponseChunk interface
				const events = parseResponseChunk(chunk as unknown as import("./parse-response.js").GeminiResponseChunk);
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
				const usage = aggregated.usageMetadata;
				if (usage) {
					yield {
						type: "done",
						usage: {
							inputTokens: usage.promptTokenCount ?? 0,
							outputTokens: usage.candidatesTokenCount ?? 0,
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
