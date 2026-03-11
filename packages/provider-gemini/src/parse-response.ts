import type { LLMEvent } from "@particle-engine/tools";

/**
 * Minimal response shape shared by both @google-cloud/vertexai and @google/generative-ai.
 * Both SDKs produce this same structure in their streaming responses.
 */
export interface GeminiResponseChunk {
	candidates?: Array<{
		content?: {
			role?: string;
			parts?: Array<{
				text?: string | null;
				functionCall?: {
					name: string;
					args: Record<string, unknown>;
				};
			}>;
		};
		index?: number;
	}>;
	usageMetadata?: {
		promptTokenCount?: number;
		candidatesTokenCount?: number;
		totalTokenCount?: number;
	};
}

/** Counter for generating unique tool call IDs (Gemini doesn't provide them) */
let toolCallCounter = 0;

/** Generate a unique tool call ID */
export function generateToolCallId(): string {
	return `tc_${Date.now()}_${++toolCallCounter}`;
}

/** Reset the tool call counter (useful for testing) */
export function resetToolCallCounter(): void {
	toolCallCounter = 0;
}

/** Parse a Gemini streaming response chunk into LLMEvent(s) */
export function parseResponseChunk(chunk: GeminiResponseChunk): LLMEvent[] {
	const events: LLMEvent[] = [];
	const candidates = chunk.candidates;

	if (!candidates || candidates.length === 0) {
		// Check for usage metadata in the final chunk
		if (chunk.usageMetadata) {
			events.push({
				type: "done",
				usage: {
					inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
					outputTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
				},
			});
		}
		return events;
	}

	for (const candidate of candidates) {
		const parts = candidate.content?.parts;
		if (!parts) continue;

		for (const part of parts) {
			if (part.text !== undefined && part.text !== null) {
				events.push({
					type: "text",
					content: part.text,
				});
			}

			if (part.functionCall) {
				events.push({
					type: "tool_call",
					id: generateToolCallId(),
					name: part.functionCall.name,
					arguments: part.functionCall.args as Record<string, unknown>,
				});
			}
		}
	}

	// Include usage metadata if present alongside content
	if (chunk.usageMetadata) {
		events.push({
			type: "done",
			usage: {
				inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
				outputTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
			},
		});
	}

	return events;
}
