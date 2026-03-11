import type { LLMEvent } from "@particle-engine/tools";

/**
 * Anthropic streaming event types (subset relevant to our parsing).
 *
 * The SDK's `.stream()` helper emits raw SSE events with these shapes:
 * - content_block_start: { index, content_block: { type, id?, name?, text? } }
 * - content_block_delta: { index, delta: { type, text?, partial_json? } }
 * - content_block_stop: { index }
 * - message_stop: {}
 *
 * We parse these into our LLMEvent union type.
 */

/** State tracker for building tool calls from streamed deltas */
export interface PendingToolCall {
	id: string;
	name: string;
	jsonAccumulator: string;
}

/** Parse a content_block_start event */
export function parseContentBlockStart(
	event: Record<string, unknown>,
): { index: number; pending?: PendingToolCall } | null {
	const index = event.index as number;
	const block = event.content_block as Record<string, unknown> | undefined;

	if (!block) return null;

	if (block.type === "tool_use") {
		return {
			index,
			pending: {
				id: block.id as string,
				name: block.name as string,
				jsonAccumulator: "",
			},
		};
	}

	return { index };
}

/** Parse a content_block_delta event into an LLMEvent (if applicable) */
export function parseContentBlockDelta(
	event: Record<string, unknown>,
	pendingToolCalls: Map<number, PendingToolCall>,
): LLMEvent | null {
	const index = event.index as number;
	const delta = event.delta as Record<string, unknown> | undefined;

	if (!delta) return null;

	if (delta.type === "text_delta") {
		return { type: "text", content: delta.text as string };
	}

	if (delta.type === "input_json_delta") {
		const pending = pendingToolCalls.get(index);
		if (pending) {
			const partialJson = delta.partial_json as string;
			pending.jsonAccumulator += partialJson;
			return {
				type: "tool_call_delta",
				id: pending.id,
				argumentsDelta: partialJson,
			};
		}
	}

	return null;
}

/** Parse a content_block_stop event — completes a pending tool call */
export function parseContentBlockStop(
	event: Record<string, unknown>,
	pendingToolCalls: Map<number, PendingToolCall>,
): LLMEvent | null {
	const index = event.index as number;
	const pending = pendingToolCalls.get(index);

	if (pending) {
		const args = JSON.parse(pending.jsonAccumulator || "{}");
		pendingToolCalls.delete(index);
		return {
			type: "tool_call",
			id: pending.id,
			name: pending.name,
			arguments: args,
		};
	}

	return null;
}

/** Create a done event from an Anthropic final message */
export function parseDoneEvent(finalMessage: Record<string, unknown>): LLMEvent {
	const usage = finalMessage.usage as Record<string, number> | undefined;
	return {
		type: "done",
		usage: {
			inputTokens: usage?.input_tokens ?? 0,
			outputTokens: usage?.output_tokens ?? 0,
		},
	};
}
