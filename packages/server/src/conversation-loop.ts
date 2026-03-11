// ============================================================
// Conversation Loop — Run LLM tool-use conversation to completion
// ============================================================

import type { ToolExecutor, ToolDefinition, ToolResult } from '@particle-engine/tools';
import type {
	LLMProvider,
	LLMEvent,
	Message,
	ToolCall,
	ToolCallResult,
	ProviderConfig,
} from './types.js';

/** Result of a completed conversation */
export interface ConversationResult {
	messages: Message[];
	toolCallCount: number;
	usage: { inputTokens: number; outputTokens: number };
}

/** Events emitted during conversation (extends LLMEvent with tool results) */
export type ConversationEvent =
	| LLMEvent
	| { type: 'tool_result'; name: string; result: ToolResult };

/**
 * Run a conversation loop with the LLM.
 *
 * The loop:
 * 1. Streams LLM response, collecting text and tool calls
 * 2. If tool calls are received, executes them via the ToolExecutor
 * 3. Adds assistant + tool messages to history and loops back
 * 4. If no tool calls (just text), the conversation is done
 */
export async function runConversation(
	provider: LLMProvider,
	executor: ToolExecutor,
	messages: Message[],
	tools: ToolDefinition[],
	config?: ProviderConfig,
	onEvent?: (event: ConversationEvent) => void,
): Promise<ConversationResult> {
	const allMessages = [...messages];
	let totalToolCalls = 0;
	let totalInputTokens = 0;
	let totalOutputTokens = 0;

	// Loop until the LLM responds with text only (no tool calls)
	while (true) {
		let textContent = '';
		const pendingToolCalls: ToolCall[] = [];
		let roundDone = false;

		// Stream the LLM response
		const stream = provider.stream(allMessages, tools, config);

		for await (const event of stream) {
			// Forward events to the callback
			if (onEvent) {
				onEvent(event);
			}

			switch (event.type) {
				case 'text':
					textContent += event.content;
					break;

				case 'tool_call':
					pendingToolCalls.push({
						id: event.id,
						name: event.name,
						arguments: event.arguments,
					});
					break;

				case 'done':
					totalInputTokens += event.usage.inputTokens;
					totalOutputTokens += event.usage.outputTokens;
					roundDone = true;
					break;

				case 'error':
					throw event.error;
			}
		}

		// If the stream ended without a 'done' event, treat it as done
		if (!roundDone) {
			// no-op, we still proceed
		}

		// No tool calls — conversation is complete
		if (pendingToolCalls.length === 0) {
			if (textContent) {
				allMessages.push({
					role: 'assistant',
					content: textContent,
				});
			}
			break;
		}

		// Execute all tool calls
		totalToolCalls += pendingToolCalls.length;

		const toolResults: ToolCallResult[] = [];
		for (const tc of pendingToolCalls) {
			const result = executor.execute(tc.name, tc.arguments);
			toolResults.push({
				toolCallId: tc.id,
				name: tc.name,
				result,
			});

			if (onEvent) {
				onEvent({ type: 'tool_result', name: tc.name, result });
			}
		}

		// Add assistant message with tool calls
		allMessages.push({
			role: 'assistant',
			content: textContent || undefined,
			toolCalls: pendingToolCalls,
		});

		// Add tool results message
		allMessages.push({
			role: 'tool',
			toolResults,
		});
	}

	return {
		messages: allMessages,
		toolCallCount: totalToolCalls,
		usage: {
			inputTokens: totalInputTokens,
			outputTokens: totalOutputTokens,
		},
	};
}
