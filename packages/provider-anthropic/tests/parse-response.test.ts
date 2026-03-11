import { describe, it, expect, beforeEach } from "vitest";
import {
	parseContentBlockStart,
	parseContentBlockDelta,
	parseContentBlockStop,
	parseDoneEvent,
	type PendingToolCall,
} from "../src/parse-response.js";

describe("parseContentBlockStart", () => {
	it("returns pending tool call for tool_use block", () => {
		const event = {
			type: "content_block_start",
			index: 0,
			content_block: {
				type: "tool_use",
				id: "toolu_01ABC",
				name: "get_space_info",
			},
		};

		const result = parseContentBlockStart(event);

		expect(result).not.toBeNull();
		expect(result!.index).toBe(0);
		expect(result!.pending).toEqual({
			id: "toolu_01ABC",
			name: "get_space_info",
			jsonAccumulator: "",
		});
	});

	it("returns index only for text block (no pending)", () => {
		const event = {
			type: "content_block_start",
			index: 0,
			content_block: {
				type: "text",
				text: "",
			},
		};

		const result = parseContentBlockStart(event);

		expect(result).not.toBeNull();
		expect(result!.index).toBe(0);
		expect(result!.pending).toBeUndefined();
	});

	it("returns null when content_block is missing", () => {
		const event = {
			type: "content_block_start",
			index: 0,
		};

		const result = parseContentBlockStart(event);

		expect(result).toBeNull();
	});
});

describe("parseContentBlockDelta", () => {
	it("parses text_delta into text event", () => {
		const event = {
			type: "content_block_delta",
			index: 0,
			delta: {
				type: "text_delta",
				text: "Hello ",
			},
		};

		const pendingToolCalls = new Map<number, PendingToolCall>();
		const result = parseContentBlockDelta(event, pendingToolCalls);

		expect(result).toEqual({ type: "text", content: "Hello " });
	});

	it("parses input_json_delta into tool_call_delta event", () => {
		const pendingToolCalls = new Map<number, PendingToolCall>();
		pendingToolCalls.set(1, { id: "toolu_01ABC", name: "set_particles", jsonAccumulator: "" });

		const event = {
			type: "content_block_delta",
			index: 1,
			delta: {
				type: "input_json_delta",
				partial_json: '{"par',
			},
		};

		const result = parseContentBlockDelta(event, pendingToolCalls);

		expect(result).toEqual({
			type: "tool_call_delta",
			id: "toolu_01ABC",
			argumentsDelta: '{"par',
		});
		// Should accumulate JSON
		expect(pendingToolCalls.get(1)!.jsonAccumulator).toBe('{"par');
	});

	it("accumulates multiple JSON deltas", () => {
		const pendingToolCalls = new Map<number, PendingToolCall>();
		pendingToolCalls.set(0, { id: "toolu_01ABC", name: "test", jsonAccumulator: '{"a":' });

		const event = {
			type: "content_block_delta",
			index: 0,
			delta: {
				type: "input_json_delta",
				partial_json: '"hello"}',
			},
		};

		parseContentBlockDelta(event, pendingToolCalls);

		expect(pendingToolCalls.get(0)!.jsonAccumulator).toBe('{"a":"hello"}');
	});

	it("returns null when delta is missing", () => {
		const event = {
			type: "content_block_delta",
			index: 0,
		};

		const result = parseContentBlockDelta(event, new Map());

		expect(result).toBeNull();
	});

	it("returns null for input_json_delta with no matching pending tool call", () => {
		const event = {
			type: "content_block_delta",
			index: 5,
			delta: {
				type: "input_json_delta",
				partial_json: "{}",
			},
		};

		const result = parseContentBlockDelta(event, new Map());

		expect(result).toBeNull();
	});
});

describe("parseContentBlockStop", () => {
	it("completes a pending tool call and returns tool_call event", () => {
		const pendingToolCalls = new Map<number, PendingToolCall>();
		pendingToolCalls.set(0, {
			id: "toolu_01ABC",
			name: "set_particles",
			jsonAccumulator: '{"particles":[{"row":1,"col":2}]}',
		});

		const event = { type: "content_block_stop", index: 0 };
		const result = parseContentBlockStop(event, pendingToolCalls);

		expect(result).toEqual({
			type: "tool_call",
			id: "toolu_01ABC",
			name: "set_particles",
			arguments: { particles: [{ row: 1, col: 2 }] },
		});
		// Should remove from pending map
		expect(pendingToolCalls.has(0)).toBe(false);
	});

	it("handles empty JSON accumulator as empty object", () => {
		const pendingToolCalls = new Map<number, PendingToolCall>();
		pendingToolCalls.set(0, {
			id: "toolu_01XYZ",
			name: "get_space_info",
			jsonAccumulator: "",
		});

		const event = { type: "content_block_stop", index: 0 };
		const result = parseContentBlockStop(event, pendingToolCalls);

		expect(result).toEqual({
			type: "tool_call",
			id: "toolu_01XYZ",
			name: "get_space_info",
			arguments: {},
		});
	});

	it("returns null when no pending tool call for index", () => {
		const event = { type: "content_block_stop", index: 5 };
		const result = parseContentBlockStop(event, new Map());

		expect(result).toBeNull();
	});
});

describe("parseDoneEvent", () => {
	it("extracts usage data from final message", () => {
		const finalMessage = {
			usage: {
				input_tokens: 150,
				output_tokens: 75,
			},
		};

		const result = parseDoneEvent(finalMessage);

		expect(result).toEqual({
			type: "done",
			usage: { inputTokens: 150, outputTokens: 75 },
		});
	});

	it("handles missing usage data gracefully", () => {
		const result = parseDoneEvent({});

		expect(result).toEqual({
			type: "done",
			usage: { inputTokens: 0, outputTokens: 0 },
		});
	});

	it("handles partial usage data", () => {
		const finalMessage = {
			usage: {
				input_tokens: 100,
			},
		};

		const result = parseDoneEvent(finalMessage);

		expect(result).toEqual({
			type: "done",
			usage: { inputTokens: 100, outputTokens: 0 },
		});
	});
});
