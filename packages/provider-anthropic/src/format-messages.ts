import type { Message } from "@particle-engine/tools";

/** Anthropic message content block types */
export type AnthropicContentBlock =
	| { type: "text"; text: string }
	| { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
	| { type: "tool_result"; tool_use_id: string; content: string };

/** Anthropic API message format */
export interface AnthropicMessage {
	role: "user" | "assistant";
	content: string | AnthropicContentBlock[];
}

/** Result of formatting messages — system text is separated from messages */
export interface FormattedMessages {
	/** System message text (if any) */
	systemMessage: string | undefined;
	/** Converted message array for Anthropic API */
	apiMessages: AnthropicMessage[];
}

/** Convert our Message[] to Anthropic API format, extracting system message */
export function formatMessages(messages: Message[]): FormattedMessages {
	let systemMessage: string | undefined;
	const apiMessages: AnthropicMessage[] = [];

	for (const message of messages) {
		switch (message.role) {
			case "system":
				// System messages are passed as a separate parameter, not in the messages array
				systemMessage = message.content;
				break;

			case "user":
				apiMessages.push({
					role: "user",
					content: message.content ?? "",
				});
				break;

			case "assistant": {
				const contentBlocks: AnthropicContentBlock[] = [];

				// Add text content if present
				if (message.content) {
					contentBlocks.push({ type: "text", text: message.content });
				}

				// Add tool use blocks if present
				if (message.toolCalls) {
					for (const toolCall of message.toolCalls) {
						contentBlocks.push({
							type: "tool_use",
							id: toolCall.id,
							name: toolCall.name,
							input: toolCall.arguments,
						});
					}
				}

				// Only add if there are content blocks
				if (contentBlocks.length > 0) {
					apiMessages.push({
						role: "assistant",
						content: contentBlocks,
					});
				}
				break;
			}

			case "tool": {
				// Tool results become user messages with tool_result content blocks
				// Anthropic requires alternating user/assistant, and tool results go in user messages
				if (message.toolResults) {
					const contentBlocks: AnthropicContentBlock[] = message.toolResults.map((tr) => ({
						type: "tool_result" as const,
						tool_use_id: tr.toolCallId,
						content: JSON.stringify(tr.result),
					}));
					apiMessages.push({
						role: "user",
						content: contentBlocks,
					});
				}
				break;
			}
		}
	}

	return { systemMessage, apiMessages };
}
