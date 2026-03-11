import { describe, it, expect, beforeEach } from "vitest";
import { parseResponseChunk } from "../src/parse-response.js";
import type { OpenAIChunk, PendingToolCall } from "../src/parse-response.js";

describe("parseResponseChunk", () => {
	let pendingToolCalls: Map<number, PendingToolCall>;

	beforeEach(() => {
		pendingToolCalls = new Map();
	});

	it("parses a text delta into a text event", () => {
		const chunk: OpenAIChunk = {
			choices: [
				{
					delta: { content: "Hello!" },
				},
			],
		};

		const events = parseResponseChunk(chunk, pendingToolCalls);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({ type: "text", content: "Hello!" });
	});

	it("ignores null content in delta", () => {
		const chunk: OpenAIChunk = {
			choices: [
				{
					delta: { content: null },
				},
			],
		};

		const events = parseResponseChunk(chunk, pendingToolCalls);

		expect(events).toHaveLength(0);
	});

	it("starts a new tool call with name and id", () => {
		const chunk: OpenAIChunk = {
			choices: [
				{
					delta: {
						tool_calls: [
							{
								index: 0,
								id: "call_abc",
								function: { name: "get_state", arguments: "" },
							},
						],
					},
				},
			],
		};

		const events = parseResponseChunk(chunk, pendingToolCalls);

		// No events yet (empty arguments)
		expect(events).toHaveLength(0);
		expect(pendingToolCalls.has(0)).toBe(true);
		expect(pendingToolCalls.get(0)!.id).toBe("call_abc");
		expect(pendingToolCalls.get(0)!.name).toBe("get_state");
	});

	it("accumulates tool call argument deltas", () => {
		// First chunk: start the tool call
		parseResponseChunk(
			{
				choices: [
					{
						delta: {
							tool_calls: [
								{ index: 0, id: "call_abc", function: { name: "set_particles", arguments: '{"par' } },
							],
						},
					},
				],
			},
			pendingToolCalls,
		);

		// Second chunk: continue arguments
		const events = parseResponseChunk(
			{
				choices: [
					{
						delta: {
							tool_calls: [
								{ index: 0, function: { arguments: 'ticles":[]}' } },
							],
						},
					},
				],
			},
			pendingToolCalls,
		);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			type: "tool_call_delta",
			id: "call_abc",
			argumentsDelta: 'ticles":[]}',
		});
		expect(pendingToolCalls.get(0)!.args).toBe('{"particles":[]}');
	});

	it("emits tool_call_delta events for argument chunks", () => {
		const chunk: OpenAIChunk = {
			choices: [
				{
					delta: {
						tool_calls: [
							{ index: 0, id: "call_xyz", function: { name: "test", arguments: '{"a":1}' } },
						],
					},
				},
			],
		};

		const events = parseResponseChunk(chunk, pendingToolCalls);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			type: "tool_call_delta",
			id: "call_xyz",
			argumentsDelta: '{"a":1}',
		});
	});

	it("emits completed tool calls on finish_reason", () => {
		// Build up a pending tool call
		pendingToolCalls.set(0, { id: "call_abc", name: "get_state", args: '{"includeInactive":true}' });

		const chunk: OpenAIChunk = {
			choices: [
				{
					delta: {},
					finish_reason: "tool_calls",
				},
			],
		};

		const events = parseResponseChunk(chunk, pendingToolCalls);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			type: "tool_call",
			id: "call_abc",
			name: "get_state",
			arguments: { includeInactive: true },
		});
		expect(pendingToolCalls.size).toBe(0);
	});

	it("emits multiple completed tool calls on finish_reason", () => {
		pendingToolCalls.set(0, { id: "call_1", name: "get_space_info", args: "{}" });
		pendingToolCalls.set(1, { id: "call_2", name: "get_state", args: '{"group":"a"}' });

		const chunk: OpenAIChunk = {
			choices: [
				{
					delta: {},
					finish_reason: "tool_calls",
				},
			],
		};

		const events = parseResponseChunk(chunk, pendingToolCalls);

		expect(events).toHaveLength(2);
		expect(events[0]).toEqual({
			type: "tool_call",
			id: "call_1",
			name: "get_space_info",
			arguments: {},
		});
		expect(events[1]).toEqual({
			type: "tool_call",
			id: "call_2",
			name: "get_state",
			arguments: { group: "a" },
		});
	});

	it("emits done event with usage data", () => {
		const chunk: OpenAIChunk = {
			choices: [],
			usage: {
				prompt_tokens: 150,
				completion_tokens: 50,
			},
		};

		const events = parseResponseChunk(chunk, pendingToolCalls);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			type: "done",
			usage: { inputTokens: 150, outputTokens: 50 },
		});
	});

	it("handles finish_reason 'stop' for text completion", () => {
		const chunk: OpenAIChunk = {
			choices: [
				{
					delta: {},
					finish_reason: "stop",
				},
			],
		};

		const events = parseResponseChunk(chunk, pendingToolCalls);

		// No pending tool calls, so no tool_call events
		expect(events).toHaveLength(0);
	});

	it("handles missing usage counts gracefully", () => {
		const chunk: OpenAIChunk = {
			usage: {},
		};

		const events = parseResponseChunk(chunk, pendingToolCalls);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			type: "done",
			usage: { inputTokens: 0, outputTokens: 0 },
		});
	});

	it("handles chunk with no choices", () => {
		const chunk: OpenAIChunk = {};

		const events = parseResponseChunk(chunk, pendingToolCalls);

		expect(events).toHaveLength(0);
	});

	it("handles text and tool call usage in final chunk together", () => {
		pendingToolCalls.set(0, { id: "call_1", name: "test", args: '{"x":1}' });

		const chunk: OpenAIChunk = {
			choices: [
				{
					delta: {},
					finish_reason: "tool_calls",
				},
			],
			usage: {
				prompt_tokens: 100,
				completion_tokens: 25,
			},
		};

		const events = parseResponseChunk(chunk, pendingToolCalls);

		// Should have tool_call + done
		expect(events).toHaveLength(2);
		expect(events[0].type).toBe("tool_call");
		expect(events[1]).toEqual({
			type: "done",
			usage: { inputTokens: 100, outputTokens: 25 },
		});
	});

	it("handles empty args string by defaulting to empty object", () => {
		pendingToolCalls.set(0, { id: "call_1", name: "undo", args: "" });

		const chunk: OpenAIChunk = {
			choices: [
				{
					delta: {},
					finish_reason: "tool_calls",
				},
			],
		};

		const events = parseResponseChunk(chunk, pendingToolCalls);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			type: "tool_call",
			id: "call_1",
			name: "undo",
			arguments: {},
		});
	});
});
