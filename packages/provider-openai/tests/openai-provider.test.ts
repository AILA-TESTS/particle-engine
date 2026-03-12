import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolDefinition } from "@particle-engine/tools";

// Mock the OpenAI SDK before importing OpenAIProvider
vi.mock("openai", () => {
	const MockOpenAI = vi.fn().mockImplementation((config: Record<string, unknown>) => ({
		_config: config,
		chat: {
			completions: {
				create: vi.fn(),
			},
		},
	}));
	return { default: MockOpenAI };
});

import { OpenAIProvider } from "../src/openai-provider.js";
import OpenAI from "openai";

describe("OpenAIProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("has name 'openai'", () => {
		const provider = new OpenAIProvider({ apiKey: "test-key" });
		expect(provider.name).toBe("openai");
	});

	it("creates an OpenAI client with API key", () => {
		new OpenAIProvider({ apiKey: "sk-test-123" });

		expect(OpenAI).toHaveBeenCalledWith(
			expect.objectContaining({ apiKey: "sk-test-123" }),
		);
	});

	it("passes custom baseURL to client", () => {
		new OpenAIProvider({
			apiKey: "test-key",
			baseURL: "https://custom.api.com/v1",
		});

		expect(OpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				apiKey: "test-key",
				baseURL: "https://custom.api.com/v1",
			}),
		);
	});

	it("passes organization to client", () => {
		new OpenAIProvider({
			apiKey: "test-key",
			organization: "org-abc123",
		});

		expect(OpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				apiKey: "test-key",
				organization: "org-abc123",
			}),
		);
	});

	it("does not include baseURL or organization when not provided", () => {
		new OpenAIProvider({ apiKey: "test-key" });

		const callArgs = (OpenAI as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
		expect(callArgs).toEqual({ apiKey: "test-key" });
		expect(callArgs).not.toHaveProperty("baseURL");
		expect(callArgs).not.toHaveProperty("organization");
	});

	it("formatTools returns correct OpenAI structure", () => {
		const provider = new OpenAIProvider({ apiKey: "test" });
		const tools: ToolDefinition[] = [
			{
				name: "test_tool",
				description: "A test",
				parameters: {
					type: "object",
					properties: { a: { type: "string" } },
					required: ["a"],
				},
			},
		];

		const result = provider.formatTools(tools);

		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("function");
		expect(result[0].function.name).toBe("test_tool");
		expect(result[0].function.description).toBe("A test");
		expect(result[0].function.parameters).toEqual({
			type: "object",
			properties: { a: { type: "string" } },
			required: ["a"],
		});
	});

	it("parseToolCall extracts from OpenAI format", () => {
		const provider = new OpenAIProvider({ apiKey: "test" });

		const toolCall = provider.parseToolCall({
			id: "call_abc123",
			function: {
				name: "set_particles",
				arguments: '{"particles":[{"row":1,"col":2}]}',
			},
		});

		expect(toolCall.id).toBe("call_abc123");
		expect(toolCall.name).toBe("set_particles");
		expect(toolCall.arguments).toEqual({ particles: [{ row: 1, col: 2 }] });
	});

	it("parseToolCall handles empty arguments", () => {
		const provider = new OpenAIProvider({ apiKey: "test" });

		const toolCall = provider.parseToolCall({
			id: "call_xyz",
			function: {
				name: "undo",
				arguments: "{}",
			},
		});

		expect(toolCall.id).toBe("call_xyz");
		expect(toolCall.name).toBe("undo");
		expect(toolCall.arguments).toEqual({});
	});

	it("formatToolResult creates correct tool message structure", () => {
		const provider = new OpenAIProvider({ apiKey: "test" });

		const result = provider.formatToolResult("call_abc", {
			success: true,
			data: { rows: 10, cols: 10 },
		});

		expect(result).toEqual({
			role: "tool",
			tool_call_id: "call_abc",
			content: JSON.stringify({ success: true, data: { rows: 10, cols: 10 } }),
		});
	});

	it("formatToolResult handles error results", () => {
		const provider = new OpenAIProvider({ apiKey: "test" });

		const result = provider.formatToolResult("call_xyz", {
			success: false,
			error: "Tool not found",
		});

		expect(result).toEqual({
			role: "tool",
			tool_call_id: "call_xyz",
			content: JSON.stringify({ success: false, error: "Tool not found" }),
		});
	});

	it("stream yields error event when API call fails", async () => {
		const provider = new OpenAIProvider({ apiKey: "test" });

		// Access the mock client and make create throw
		const mockClient = (OpenAI as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
		mockClient.chat.completions.create.mockRejectedValue(new Error("API rate limit"));

		const events = [];
		for await (const event of provider.stream(
			[{ role: "user", content: "Hi" }],
			[],
		)) {
			events.push(event);
		}

		expect(events).toHaveLength(1);
		expect(events[0].type).toBe("error");
		if (events[0].type === "error") {
			expect(events[0].error.message).toBe("API rate limit");
		}
	});

	it("stream processes chunks and yields events", async () => {
		const provider = new OpenAIProvider({ apiKey: "test" });

		// Create an async iterable mock for the stream
		const chunks = [
			{
				choices: [{ delta: { content: "Hello" } }],
			},
			{
				choices: [{ delta: { content: " world" } }],
			},
			{
				choices: [{ delta: {}, finish_reason: "stop" }],
			},
			{
				choices: [],
				usage: { prompt_tokens: 10, completion_tokens: 5 },
			},
		];

		async function* mockStream() {
			for (const chunk of chunks) {
				yield chunk;
			}
		}

		const mockClient = (OpenAI as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
		mockClient.chat.completions.create.mockResolvedValue(mockStream());

		const events = [];
		for await (const event of provider.stream(
			[{ role: "user", content: "Hi" }],
			[{ name: "test", description: "t", parameters: { type: "object", properties: {} } }],
		)) {
			events.push(event);
		}

		expect(events[0]).toEqual({ type: "text", content: "Hello" });
		expect(events[1]).toEqual({ type: "text", content: " world" });
		// The done event from usage chunk
		const doneEvent = events.find((e) => e.type === "done" && "usage" in e && e.usage.inputTokens === 10);
		expect(doneEvent).toBeTruthy();
	});

	it("stream handles tool call chunks correctly", async () => {
		const provider = new OpenAIProvider({ apiKey: "test" });

		const chunks = [
			{
				choices: [
					{
						delta: {
							tool_calls: [
								{ index: 0, id: "call_abc", function: { name: "get_state", arguments: '{"inc' } },
							],
						},
					},
				],
			},
			{
				choices: [
					{
						delta: {
							tool_calls: [
								{ index: 0, function: { arguments: 'lude":true}' } },
							],
						},
					},
				],
			},
			{
				choices: [{ delta: {}, finish_reason: "tool_calls" }],
			},
			{
				choices: [],
				usage: { prompt_tokens: 20, completion_tokens: 10 },
			},
		];

		async function* mockStream() {
			for (const chunk of chunks) {
				yield chunk;
			}
		}

		const mockClient = (OpenAI as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
		mockClient.chat.completions.create.mockResolvedValue(mockStream());

		const events = [];
		for await (const event of provider.stream(
			[{ role: "user", content: "Check state" }],
			[{ name: "get_state", description: "Get state", parameters: { type: "object", properties: {} } }],
		)) {
			events.push(event);
		}

		// Should have tool_call_delta events
		const deltas = events.filter((e) => e.type === "tool_call_delta");
		expect(deltas.length).toBeGreaterThanOrEqual(1);

		// Should have a completed tool_call event
		const toolCall = events.find((e) => e.type === "tool_call");
		expect(toolCall).toEqual({
			type: "tool_call",
			id: "call_abc",
			name: "get_state",
			arguments: { include: true },
		});

		// Should have a done event with usage
		const done = events.find((e) => e.type === "done" && "usage" in e && e.usage.inputTokens === 20);
		expect(done).toBeTruthy();
	});

	it("stream passes config options to API call", async () => {
		const provider = new OpenAIProvider({ apiKey: "test" });

		async function* emptyStream() {
			yield { choices: [{ delta: {}, finish_reason: "stop" }] };
			yield { choices: [], usage: { prompt_tokens: 0, completion_tokens: 0 } };
		}

		const mockClient = (OpenAI as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
		mockClient.chat.completions.create.mockResolvedValue(emptyStream());

		const events = [];
		for await (const event of provider.stream(
			[{ role: "user", content: "Hi" }],
			[],
			{ temperature: 0.5, maxOutputTokens: 1000, topP: 0.9, stopSequences: ["STOP"] },
		)) {
			events.push(event);
		}

		const createCall = mockClient.chat.completions.create.mock.calls[0][0];
		expect(createCall.temperature).toBe(0.5);
		expect(createCall.max_tokens).toBe(1000);
		expect(createCall.top_p).toBe(0.9);
		expect(createCall.stop).toEqual(["STOP"]);
	});

	it("stream merges default config with per-call config", async () => {
		const provider = new OpenAIProvider(
			{ apiKey: "test" },
			{ temperature: 0.7, maxOutputTokens: 500 },
		);

		async function* emptyStream() {
			yield { choices: [{ delta: {}, finish_reason: "stop" }] };
			yield { choices: [], usage: { prompt_tokens: 0, completion_tokens: 0 } };
		}

		const mockClient = (OpenAI as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
		mockClient.chat.completions.create.mockResolvedValue(emptyStream());

		const events = [];
		for await (const event of provider.stream(
			[{ role: "user", content: "Hi" }],
			[],
			{ temperature: 0.3 }, // Override temperature but keep maxOutputTokens from default
		)) {
			events.push(event);
		}

		const createCall = mockClient.chat.completions.create.mock.calls[0][0];
		expect(createCall.temperature).toBe(0.3);
		expect(createCall.max_tokens).toBe(500);
	});
});
