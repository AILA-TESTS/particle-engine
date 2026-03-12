import { describe, it, expect } from "vitest";
import { formatMessages } from "../src/format-messages.js";
import type { Message } from "@particle-engine/tools";

describe("formatMessages", () => {
	it("converts a user message to Gemini user Content", () => {
		const messages: Message[] = [
			{ role: "user", content: "Hello!" },
		];

		const result = formatMessages(messages);

		expect(result.systemInstruction).toBeUndefined();
		expect(result.contents).toHaveLength(1);
		expect(result.contents[0]).toEqual({
			role: "user",
			parts: [{ text: "Hello!" }],
		});
	});

	it("extracts system message as systemInstruction", () => {
		const messages: Message[] = [
			{ role: "system", content: "You are a helpful assistant." },
			{ role: "user", content: "Hi" },
		];

		const result = formatMessages(messages);

		expect(result.systemInstruction).toBe("You are a helpful assistant.");
		expect(result.contents).toHaveLength(1);
		expect(result.contents[0].role).toBe("user");
	});

	it("converts assistant text to model Content", () => {
		const messages: Message[] = [
			{ role: "user", content: "Hi" },
			{ role: "assistant", content: "Hello there!" },
		];

		const result = formatMessages(messages);

		expect(result.contents).toHaveLength(2);
		expect(result.contents[1]).toEqual({
			role: "model",
			parts: [{ text: "Hello there!" }],
		});
	});

	it("converts assistant with tool calls to model Content with functionCall parts", () => {
		const messages: Message[] = [
			{ role: "user", content: "Set some particles" },
			{
				role: "assistant",
				toolCalls: [
					{
						id: "tc_1",
						name: "set_particles",
						arguments: { particles: [{ row: 0, col: 0 }] },
					},
				],
			},
		];

		const result = formatMessages(messages);

		expect(result.contents).toHaveLength(2);
		expect(result.contents[1].role).toBe("model");
		expect(result.contents[1].parts).toHaveLength(1);
		expect(result.contents[1].parts[0]).toEqual({
			functionCall: {
				name: "set_particles",
				args: { particles: [{ row: 0, col: 0 }] },
			},
		});
	});

	it("converts assistant with text AND tool calls", () => {
		const messages: Message[] = [
			{ role: "user", content: "Do something" },
			{
				role: "assistant",
				content: "Let me do that for you.",
				toolCalls: [
					{ id: "tc_1", name: "get_state", arguments: {} },
				],
			},
		];

		const result = formatMessages(messages);

		expect(result.contents[1].role).toBe("model");
		expect(result.contents[1].parts).toHaveLength(2);
		expect(result.contents[1].parts[0]).toEqual({ text: "Let me do that for you." });
		expect(result.contents[1].parts[1]).toEqual({
			functionCall: { name: "get_state", args: {} },
		});
	});

	it("converts tool results to user Content with functionResponse parts", () => {
		const messages: Message[] = [
			{ role: "user", content: "Hi" },
			{
				role: "assistant",
				toolCalls: [{ id: "tc_1", name: "get_space_info", arguments: {} }],
			},
			{
				role: "tool",
				toolResults: [
					{
						toolCallId: "tc_1",
						name: "get_space_info",
						result: { success: true, data: { rows: 10, cols: 10 } },
					},
				],
			},
		];

		const result = formatMessages(messages);

		expect(result.contents).toHaveLength(3);
		expect(result.contents[2].role).toBe("user");
		expect(result.contents[2].parts).toHaveLength(1);
		expect(result.contents[2].parts[0]).toEqual({
			functionResponse: {
				name: "get_space_info",
				response: { success: true, data: { rows: 10, cols: 10 } },
			},
		});
	});

	it("handles a mixed conversation correctly", () => {
		const messages: Message[] = [
			{ role: "system", content: "System prompt" },
			{ role: "user", content: "What's the grid size?" },
			{
				role: "assistant",
				toolCalls: [{ id: "tc_1", name: "get_space_info", arguments: {} }],
			},
			{
				role: "tool",
				toolResults: [
					{
						toolCallId: "tc_1",
						name: "get_space_info",
						result: { success: true, data: { rows: 20, cols: 20 } },
					},
				],
			},
			{ role: "assistant", content: "The grid is 20x20." },
			{ role: "user", content: "Thanks!" },
		];

		const result = formatMessages(messages);

		expect(result.systemInstruction).toBe("System prompt");
		// System message should NOT be in contents
		expect(result.contents).toHaveLength(5);
		expect(result.contents[0].role).toBe("user");
		expect(result.contents[1].role).toBe("model");
		expect(result.contents[2].role).toBe("user"); // tool results go as user
		expect(result.contents[3].role).toBe("model");
		expect(result.contents[4].role).toBe("user");
	});

	it("handles user message with undefined content", () => {
		const messages: Message[] = [
			{ role: "user" },
		];

		const result = formatMessages(messages);

		expect(result.contents).toHaveLength(1);
		expect(result.contents[0].parts[0]).toEqual({ text: "" });
	});

	it("handles multiple tool results in one tool message", () => {
		const messages: Message[] = [
			{
				role: "tool",
				toolResults: [
					{ toolCallId: "tc_1", name: "get_space_info", result: { success: true } },
					{ toolCallId: "tc_2", name: "get_state", result: { success: true } },
				],
			},
		];

		const result = formatMessages(messages);

		expect(result.contents).toHaveLength(1);
		expect(result.contents[0].parts).toHaveLength(2);
		expect(result.contents[0].parts[0]).toEqual({
			functionResponse: { name: "get_space_info", response: { success: true } },
		});
		expect(result.contents[0].parts[1]).toEqual({
			functionResponse: { name: "get_state", response: { success: true } },
		});
	});

	it("skips assistant message with no content and no tool calls", () => {
		const messages: Message[] = [
			{ role: "user", content: "Hi" },
			{ role: "assistant" },
			{ role: "user", content: "Hello again" },
		];

		const result = formatMessages(messages);

		expect(result.contents).toHaveLength(2);
		expect(result.contents[0].parts[0]).toEqual({ text: "Hi" });
		expect(result.contents[1].parts[0]).toEqual({ text: "Hello again" });
	});
});
