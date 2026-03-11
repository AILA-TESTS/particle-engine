import { describe, it, expect } from "vitest";
import { formatMessages } from "../src/format-messages.js";
import type { Message } from "@particle-engine/tools";

describe("formatMessages", () => {
	it("converts a system message (stays in messages array, unlike Anthropic/Gemini)", () => {
		const messages: Message[] = [
			{ role: "system", content: "You are a helpful assistant." },
		];

		const result = formatMessages(messages);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			role: "system",
			content: "You are a helpful assistant.",
		});
	});

	it("converts a user message to correct format", () => {
		const messages: Message[] = [
			{ role: "user", content: "Hello!" },
		];

		const result = formatMessages(messages);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			role: "user",
			content: "Hello!",
		});
	});

	it("converts assistant text to correct format", () => {
		const messages: Message[] = [
			{ role: "user", content: "Hi" },
			{ role: "assistant", content: "Hello there!" },
		];

		const result = formatMessages(messages);

		expect(result).toHaveLength(2);
		expect(result[1]).toEqual({
			role: "assistant",
			content: "Hello there!",
		});
	});

	it("converts assistant with tool calls to tool_calls array", () => {
		const messages: Message[] = [
			{ role: "user", content: "Set some particles" },
			{
				role: "assistant",
				toolCalls: [
					{
						id: "call_123",
						name: "set_particles",
						arguments: { particles: [{ row: 0, col: 0 }] },
					},
				],
			},
		];

		const result = formatMessages(messages);

		expect(result).toHaveLength(2);
		expect(result[1]).toEqual({
			role: "assistant",
			content: null,
			tool_calls: [
				{
					id: "call_123",
					type: "function",
					function: {
						name: "set_particles",
						arguments: JSON.stringify({ particles: [{ row: 0, col: 0 }] }),
					},
				},
			],
		});
	});

	it("converts assistant with text AND tool calls", () => {
		const messages: Message[] = [
			{ role: "user", content: "Do something" },
			{
				role: "assistant",
				content: "Let me do that for you.",
				toolCalls: [
					{ id: "call_1", name: "get_state", arguments: {} },
				],
			},
		];

		const result = formatMessages(messages);

		expect(result[1]).toEqual({
			role: "assistant",
			content: "Let me do that for you.",
			tool_calls: [
				{
					id: "call_1",
					type: "function",
					function: {
						name: "get_state",
						arguments: "{}",
					},
				},
			],
		});
	});

	it("converts tool results to separate role: 'tool' messages", () => {
		const messages: Message[] = [
			{
				role: "tool",
				toolResults: [
					{
						toolCallId: "call_123",
						name: "get_space_info",
						result: { success: true, data: { rows: 10, cols: 10 } },
					},
				],
			},
		];

		const result = formatMessages(messages);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			role: "tool",
			tool_call_id: "call_123",
			content: JSON.stringify({ success: true, data: { rows: 10, cols: 10 } }),
		});
	});

	it("splits multiple tool results into separate messages", () => {
		const messages: Message[] = [
			{
				role: "tool",
				toolResults: [
					{ toolCallId: "call_1", name: "get_space_info", result: { success: true } },
					{ toolCallId: "call_2", name: "get_state", result: { success: true, data: [] } },
				],
			},
		];

		const result = formatMessages(messages);

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({
			role: "tool",
			tool_call_id: "call_1",
			content: JSON.stringify({ success: true }),
		});
		expect(result[1]).toEqual({
			role: "tool",
			tool_call_id: "call_2",
			content: JSON.stringify({ success: true, data: [] }),
		});
	});

	it("handles a mixed conversation correctly", () => {
		const messages: Message[] = [
			{ role: "system", content: "System prompt" },
			{ role: "user", content: "What's the grid size?" },
			{
				role: "assistant",
				toolCalls: [{ id: "call_1", name: "get_space_info", arguments: {} }],
			},
			{
				role: "tool",
				toolResults: [
					{
						toolCallId: "call_1",
						name: "get_space_info",
						result: { success: true, data: { rows: 20, cols: 20 } },
					},
				],
			},
			{ role: "assistant", content: "The grid is 20x20." },
			{ role: "user", content: "Thanks!" },
		];

		const result = formatMessages(messages);

		expect(result).toHaveLength(6);
		expect(result[0].role).toBe("system");
		expect(result[1].role).toBe("user");
		expect(result[2].role).toBe("assistant");
		expect(result[3].role).toBe("tool");
		expect(result[4].role).toBe("assistant");
		expect(result[5].role).toBe("user");
	});

	it("handles user message with undefined content", () => {
		const messages: Message[] = [
			{ role: "user" },
		];

		const result = formatMessages(messages);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({ role: "user", content: "" });
	});

	it("skips assistant message with no content and no tool calls", () => {
		const messages: Message[] = [
			{ role: "user", content: "Hi" },
			{ role: "assistant" },
			{ role: "user", content: "Hello again" },
		];

		const result = formatMessages(messages);

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ role: "user", content: "Hi" });
		expect(result[1]).toEqual({ role: "user", content: "Hello again" });
	});

	it("handles multiple tool calls in single assistant message", () => {
		const messages: Message[] = [
			{
				role: "assistant",
				toolCalls: [
					{ id: "call_1", name: "get_space_info", arguments: {} },
					{ id: "call_2", name: "get_state", arguments: { includeInactive: true } },
				],
			},
		];

		const result = formatMessages(messages);

		expect(result).toHaveLength(1);
		const msg = result[0] as { role: string; tool_calls?: unknown[] };
		expect(msg.tool_calls).toHaveLength(2);
	});

	it("handles system message with undefined content", () => {
		const messages: Message[] = [
			{ role: "system" },
		];

		const result = formatMessages(messages);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({ role: "system", content: "" });
	});
});
