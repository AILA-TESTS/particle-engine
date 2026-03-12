import type { Message } from "@particle-engine/tools";

/** OpenAI message types for chat completions */
export type OpenAIMessage =
	| { role: "system"; content: string }
	| { role: "user"; content: string }
	| { role: "assistant"; content: string | null; tool_calls?: OpenAIToolCall[] }
	| { role: "tool"; tool_call_id: string; content: string };

/** OpenAI tool call format */
export interface OpenAIToolCall {
	id: string;
	type: "function";
	function: {
		name: string;
		arguments: string;
	};
}

/** Convert our Message[] to OpenAI's ChatCompletionMessageParam[] format */
export function formatMessages(messages: Message[]): OpenAIMessage[] {
	const result: OpenAIMessage[] = [];

	for (const message of messages) {
		switch (message.role) {
			case "system":
				// System messages stay in the messages array for OpenAI
				result.push({
					role: "system",
					content: message.content ?? "",
				});
				break;

			case "user":
				result.push({
					role: "user",
					content: message.content ?? "",
				});
				break;

			case "assistant": {
				if (message.toolCalls && message.toolCalls.length > 0) {
					// Assistant with tool calls
					const toolCalls: OpenAIToolCall[] = message.toolCalls.map((tc) => ({
						id: tc.id,
						type: "function" as const,
						function: {
							name: tc.name,
							arguments: JSON.stringify(tc.arguments),
						},
					}));
					result.push({
						role: "assistant",
						content: message.content ?? null,
						tool_calls: toolCalls,
					});
				} else if (message.content) {
					// Assistant with text only
					result.push({
						role: "assistant",
						content: message.content,
					});
				}
				// Skip assistant messages with no content and no tool calls
				break;
			}

			case "tool": {
				// Each tool result becomes a SEPARATE message with role: 'tool'
				if (message.toolResults) {
					for (const tr of message.toolResults) {
						result.push({
							role: "tool",
							tool_call_id: tr.toolCallId,
							content: JSON.stringify(tr.result),
						});
					}
				}
				break;
			}
		}
	}

	return result;
}
