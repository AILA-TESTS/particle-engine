import { describe, it, expect } from "vitest";
import { formatMessages } from "../src/format-messages.js";
import type { Message } from "@particle-engine/tools";

describe("formatMessages", () => {
	it("converts a user message to Anthropic format", () => {
		const messages: Message[] = [
			{ role: "user", content: "Hello!" },
		];

		const result = formatMessages(messages);

		expect(result.systemMessage).toBeUndefined();
		expect(result.apiMessages).toHaveLength(1);
		expect(result.apiMessages[0]).toEqual({
			role: "user",
			content: "Hello!",
		});
	});

	it("extracts system message separately", () => {
		const messages: Message[] = [
			{ role: "system", content: "You are a helpful assistant." },
			{ role: "user", content: "Hi" },
		];

		const result = formatMessages(messages);

		expect(result.systemMessage).toBe("You are a helpful assistant.");
		expect(result.apiMessages).toHaveLength(1);
		expect(result.apiMessages[0].role).toBe("user");
	});

	it("converts assistant text to content blocks", () => {
		const messages: Message[] = [
			{ role: "user", content: "Hi" },
			{ role: "assistant", content: "Hello there!" },
		];

		const result = formatMessages(messages);

		expect(result.apiMessages).toHaveLength(2);
		expect(result.apiMessages[1]).toEqual({
			role: "assistant",
			content: [{ type: "text", text: "Hello there!" }],
		});
	});

	it("converts assistant with tool calls to tool_use content blocks", () => {
		const messages: Message[] = [
			{ role: "user", content: "Set some particles" },
			{
				role: "assistant",
				toolCalls: [
					{
						id: "toolu_01ABC",
						name: "set_particles",
						arguments: { particles: [{ row: 0, col: 0 }] },
					},
				],
			},
		];

		const result = formatMessages(messages);

		expect(result.apiMessages).toHaveLength(2);
		expect(result.apiMessages[1].role).toBe("assistant");
		const content = result.apiMessages[1].content as Array<Record<string, unknown>>;
		expect(content).toHaveLength(1);
		expect(content[0]).toEqual({
			type: "tool_use",
			id: "toolu_01ABC",
			name: "set_particles",
			input: { particles: [{ row: 0, col: 0 }] },
		});
	});

	it("converts assistant with text AND tool calls", () => {
		const messages: Message[] = [
			{ role: "user", content: "Do something" },
			{
				role: "assistant",
				content: "Let me do that for you.",
				toolCalls: [
					{ id: "toolu_01XYZ", name: "get_state", arguments: {} },
				],
			},
		];

		const result = formatMessages(messages);

		expect(result.apiMessages[1].role).toBe("assistant");
		const content = result.apiMessages[1].content as Array<Record<string, unknown>>;
		expect(content).toHaveLength(2);
		expect(content[0]).toEqual({ type: "text", text: "Let me do that for you." });
		expect(content[1]).toEqual({
			type: "tool_use",
			id: "toolu_01XYZ",
			name: "get_state",
			input: {},
		});
	});

	it("converts tool results to tool_result content blocks in user message", () => {
		const messages: Message[] = [
			{ role: "user", content: "Hi" },
			{
				role: "assistant",
				toolCalls: [{ id: "toolu_01ABC", name: "get_space_info", arguments: {} }],
			},
			{
				role: "tool",
				toolResults: [
					{
						toolCallId: "toolu_01ABC",
						name: "get_space_info",
						result: { success: true, data: { rows: 10, cols: 10 } },
					},
				],
			},
		];

		const result = formatMessages(messages);

		expect(result.apiMessages).toHaveLength(3);
		expect(result.apiMessages[2].role).toBe("user");
		const content = result.apiMessages[2].content as Array<Record<string, unknown>>;
		expect(content).toHaveLength(1);
		expect(content[0]).toEqual({
			type: "tool_result",
			tool_use_id: "toolu_01ABC",
			content: JSON.stringify({ success: true, data: { rows: 10, cols: 10 } }),
		});
	});

	it("handles multiple tool results in one tool message", () => {
		const messages: Message[] = [
			{
				role: "tool",
				toolResults: [
					{ toolCallId: "toolu_01A", name: "get_space_info", result: { success: true } },
					{ toolCallId: "toolu_01B", name: "get_state", result: { success: true } },
				],
			},
		];

		const result = formatMessages(messages);

		expect(result.apiMessages).toHaveLength(1);
		expect(result.apiMessages[0].role).toBe("user");
		const content = result.apiMessages[0].content as Array<Record<string, unknown>>;
		expect(content).toHaveLength(2);
		expect(content[0]).toEqual({
			type: "tool_result",
			tool_use_id: "toolu_01A",
			content: JSON.stringify({ success: true }),
		});
		expect(content[1]).toEqual({
			type: "tool_result",
			tool_use_id: "toolu_01B",
			content: JSON.stringify({ success: true }),
		});
	});

	it("handles a mixed conversation with correct alternation", () => {
		const messages: Message[] = [
			{ role: "system", content: "System prompt" },
			{ role: "user", content: "What's the grid size?" },
			{
				role: "assistant",
				toolCalls: [{ id: "toolu_01ABC", name: "get_space_info", arguments: {} }],
			},
			{
				role: "tool",
				toolResults: [
					{
						toolCallId: "toolu_01ABC",
						name: "get_space_info",
						result: { success: true, data: { rows: 20, cols: 20 } },
					},
				],
			},
			{ role: "assistant", content: "The grid is 20x20." },
			{ role: "user", content: "Thanks!" },
		];

		const result = formatMessages(messages);

		expect(result.systemMessage).toBe("System prompt");
		// System message should NOT be in apiMessages
		expect(result.apiMessages).toHaveLength(5);
		expect(result.apiMessages[0].role).toBe("user");
		expect(result.apiMessages[1].role).toBe("assistant");
		expect(result.apiMessages[2].role).toBe("user"); // tool results go as user
		expect(result.apiMessages[3].role).toBe("assistant");
		expect(result.apiMessages[4].role).toBe("user");
	});

	it("handles user message with undefined content", () => {
		const messages: Message[] = [
			{ role: "user" },
		];

		const result = formatMessages(messages);

		expect(result.apiMessages).toHaveLength(1);
		expect(result.apiMessages[0]).toEqual({
			role: "user",
			content: "",
		});
	});

	it("skips assistant message with no content and no tool calls", () => {
		const messages: Message[] = [
			{ role: "user", content: "Hi" },
			{ role: "assistant" },
			{ role: "user", content: "Hello again" },
		];

		const result = formatMessages(messages);

		expect(result.apiMessages).toHaveLength(2);
		expect(result.apiMessages[0]).toEqual({ role: "user", content: "Hi" });
		expect(result.apiMessages[1]).toEqual({ role: "user", content: "Hello again" });
	});
});
