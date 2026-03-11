import type { LLMEvent } from "@particle-engine/tools";

/** Minimal type for an OpenAI streaming chunk delta */
export interface OpenAIChunkDelta {
	content?: string | null;
	tool_calls?: Array<{
		index: number;
		id?: string;
		function?: {
			name?: string;
			arguments?: string;
		};
	}>;
}

/** Minimal type for an OpenAI streaming chunk */
export interface OpenAIChunk {
	choices?: Array<{
		delta?: OpenAIChunkDelta;
		finish_reason?: string | null;
	}>;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
	} | null;
}

/** Accumulator for building tool calls from streaming deltas */
export interface PendingToolCall {
	id: string;
	name: string;
	args: string;
}

/**
 * Parse a single OpenAI streaming chunk into LLMEvent(s).
 *
 * Because tool call arguments are streamed across multiple chunks,
 * the caller must maintain a `pendingToolCalls` map that persists
 * across chunks. This function mutates that map.
 */
export function parseResponseChunk(
	chunk: OpenAIChunk,
	pendingToolCalls: Map<number, PendingToolCall>,
): LLMEvent[] {
	const events: LLMEvent[] = [];
	const choice = chunk.choices?.[0];

	// Text content delta
	if (choice?.delta?.content) {
		events.push({ type: "text", content: choice.delta.content });
	}

	// Tool call deltas
	if (choice?.delta?.tool_calls) {
		for (const tc of choice.delta.tool_calls) {
			if (!pendingToolCalls.has(tc.index)) {
				pendingToolCalls.set(tc.index, { id: tc.id ?? "", name: tc.function?.name ?? "", args: "" });
			}
			const pending = pendingToolCalls.get(tc.index)!;
			if (tc.id) pending.id = tc.id;
			if (tc.function?.name) pending.name = tc.function.name;
			if (tc.function?.arguments) {
				pending.args += tc.function.arguments;
				events.push({
					type: "tool_call_delta",
					id: pending.id,
					argumentsDelta: tc.function.arguments,
				});
			}
		}
	}

	// Finish reason — emit completed tool calls
	if (choice?.finish_reason) {
		for (const [, pending] of pendingToolCalls) {
			const args = JSON.parse(pending.args || "{}");
			events.push({
				type: "tool_call",
				id: pending.id,
				name: pending.name,
				arguments: args,
			});
		}
		pendingToolCalls.clear();
	}

	// Usage data (comes in final chunk when stream_options.include_usage is true)
	if (chunk.usage) {
		events.push({
			type: "done",
			usage: {
				inputTokens: chunk.usage.prompt_tokens ?? 0,
				outputTokens: chunk.usage.completion_tokens ?? 0,
			},
		});
	}

	return events;
}
