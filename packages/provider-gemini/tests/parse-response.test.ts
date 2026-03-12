import { describe, it, expect, beforeEach } from "vitest";
import { parseResponseChunk, resetToolCallCounter } from "../src/parse-response.js";
import type { GeminiResponseChunk } from "../src/parse-response.js";

describe("parseResponseChunk", () => {
	beforeEach(() => {
		resetToolCallCounter();
	});

	it("parses a text response into a text event", () => {
		const chunk: GeminiResponseChunk = {
			candidates: [
				{
					content: {
						role: "model",
						parts: [{ text: "Hello!" }],
					},
					index: 0,
				},
			],
		};

		const events = parseResponseChunk(chunk);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({ type: "text", content: "Hello!" });
	});

	it("parses a function call response into a tool_call event", () => {
		const chunk: GeminiResponseChunk = {
			candidates: [
				{
					content: {
						role: "model",
						parts: [
							{
								functionCall: {
									name: "get_space_info",
									args: {},
								},
							},
						],
					},
					index: 0,
				},
			],
		};

		const events = parseResponseChunk(chunk);

		expect(events).toHaveLength(1);
		expect(events[0].type).toBe("tool_call");
		if (events[0].type === "tool_call") {
			expect(events[0].name).toBe("get_space_info");
			expect(events[0].arguments).toEqual({});
			expect(events[0].id).toMatch(/^tc_\d+_\d+$/);
		}
	});

	it("parses multiple function calls into multiple events", () => {
		const chunk: GeminiResponseChunk = {
			candidates: [
				{
					content: {
						role: "model",
						parts: [
							{
								functionCall: {
									name: "get_space_info",
									args: {},
								},
							},
							{
								functionCall: {
									name: "get_state",
									args: { includeInactive: true },
								},
							},
						],
					},
					index: 0,
				},
			],
		};

		const events = parseResponseChunk(chunk);

		expect(events).toHaveLength(2);
		expect(events[0].type).toBe("tool_call");
		expect(events[1].type).toBe("tool_call");
		if (events[0].type === "tool_call" && events[1].type === "tool_call") {
			expect(events[0].name).toBe("get_space_info");
			expect(events[1].name).toBe("get_state");
			expect(events[1].arguments).toEqual({ includeInactive: true });
			// IDs should be unique
			expect(events[0].id).not.toBe(events[1].id);
		}
	});

	it("parses usage metadata into a done event", () => {
		const chunk: GeminiResponseChunk = {
			candidates: [
				{
					content: {
						role: "model",
						parts: [{ text: "Done." }],
					},
					index: 0,
				},
			],
			usageMetadata: {
				promptTokenCount: 100,
				candidatesTokenCount: 50,
				totalTokenCount: 150,
			},
		};

		const events = parseResponseChunk(chunk);

		expect(events).toHaveLength(2);
		expect(events[0]).toEqual({ type: "text", content: "Done." });
		expect(events[1]).toEqual({
			type: "done",
			usage: { inputTokens: 100, outputTokens: 50 },
		});
	});

	it("handles chunk with no candidates but usage metadata", () => {
		const chunk: GeminiResponseChunk = {
			candidates: [],
			usageMetadata: {
				promptTokenCount: 200,
				candidatesTokenCount: 100,
				totalTokenCount: 300,
			},
		};

		const events = parseResponseChunk(chunk);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			type: "done",
			usage: { inputTokens: 200, outputTokens: 100 },
		});
	});

	it("handles chunk with no candidates and no metadata", () => {
		const chunk: GeminiResponseChunk = {};

		const events = parseResponseChunk(chunk);

		expect(events).toHaveLength(0);
	});

	it("handles chunk with text and function call in same candidate", () => {
		const chunk: GeminiResponseChunk = {
			candidates: [
				{
					content: {
						role: "model",
						parts: [
							{ text: "Let me check that." },
							{ functionCall: { name: "get_state", args: {} } },
						],
					},
					index: 0,
				},
			],
		};

		const events = parseResponseChunk(chunk);

		expect(events).toHaveLength(2);
		expect(events[0]).toEqual({ type: "text", content: "Let me check that." });
		expect(events[1].type).toBe("tool_call");
	});

	it("handles missing usage counts gracefully", () => {
		const chunk: GeminiResponseChunk = {
			usageMetadata: {},
		};

		const events = parseResponseChunk(chunk);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			type: "done",
			usage: { inputTokens: 0, outputTokens: 0 },
		});
	});
});
