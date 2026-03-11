import type { Message } from "@particle-engine/tools";
import type { Content, Part } from "@google-cloud/vertexai";

/** Result of formatting messages — system instruction is separated from content */
export interface FormattedMessages {
	/** System instruction text (if any) */
	systemInstruction: string | undefined;
	/** Converted Content array for Gemini */
	contents: Content[];
}

/** Convert our Message[] to Gemini's Content[] format, extracting system instructions */
export function formatMessages(messages: Message[]): FormattedMessages {
	let systemInstruction: string | undefined;
	const contents: Content[] = [];

	for (const message of messages) {
		switch (message.role) {
			case "system":
				// System messages are handled separately via systemInstruction
				systemInstruction = message.content;
				break;

			case "user":
				contents.push({
					role: "user",
					parts: [{ text: message.content ?? "" }],
				});
				break;

			case "assistant": {
				const parts: Part[] = [];

				// Add text content if present
				if (message.content) {
					parts.push({ text: message.content });
				}

				// Add function calls if present
				if (message.toolCalls) {
					for (const toolCall of message.toolCalls) {
						parts.push({
							functionCall: {
								name: toolCall.name,
								args: toolCall.arguments,
							},
						});
					}
				}

				// Only add if there are parts
				if (parts.length > 0) {
					contents.push({ role: "model", parts });
				}
				break;
			}

			case "tool": {
				// Tool results become user messages with functionResponse parts
				if (message.toolResults) {
					const parts: Part[] = message.toolResults.map((tr) => ({
						functionResponse: {
							name: tr.name,
							response: tr.result as object,
						},
					}));
					contents.push({ role: "user", parts });
				}
				break;
			}
		}
	}

	return { systemInstruction, contents };
}
