import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolDefinition } from "@particle-engine/tools";

// Mock the Anthropic SDK before importing AnthropicProvider
vi.mock("@anthropic-ai/sdk", () => {
	const MockAnthropic = vi.fn().mockImplementation((config: Record<string, unknown>) => ({
		_config: config,
		messages: {
			stream: vi.fn(),
		},
	}));
	return { default: MockAnthropic };
});

import { AnthropicProvider } from "../src/anthropic-provider.js";
import Anthropic from "@anthropic-ai/sdk";

describe("AnthropicProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("has name 'anthropic'", () => {
		const provider = new AnthropicProvider({ apiKey: "test-key" });
		expect(provider.name).toBe("anthropic");
	});

	it("creates an Anthropic client with API key", () => {
		new AnthropicProvider({ apiKey: "sk-test-123" });

		expect(Anthropic).toHaveBeenCalledWith({
			apiKey: "sk-test-123",
		});
	});

	it("passes baseURL when provided", () => {
		new AnthropicProvider({
			apiKey: "sk-test-123",
			baseURL: "https://custom.endpoint.com",
		});

		expect(Anthropic).toHaveBeenCalledWith({
			apiKey: "sk-test-123",
			baseURL: "https://custom.endpoint.com",
		});
	});

	it("does not pass baseURL when not provided", () => {
		new AnthropicProvider({ apiKey: "sk-test-123" });

		expect(Anthropic).toHaveBeenCalledWith({
			apiKey: "sk-test-123",
		});
	});

	it("formatTools delegates to format-tools module", () => {
		const provider = new AnthropicProvider({ apiKey: "test" });
		const tools: ToolDefinition[] = [
			{
				name: "test",
				description: "Test",
				parameters: {
					type: "object",
					properties: { a: { type: "string" } },
				},
			},
		];

		const result = provider.formatTools(tools);

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("test");
		expect(result[0].description).toBe("Test");
		expect(result[0].input_schema.type).toBe("object");
		expect(result[0].input_schema.properties.a).toEqual({ type: "string" });
	});

	it("parseToolCall extracts id, name, and arguments from raw tool_use block", () => {
		const provider = new AnthropicProvider({ apiKey: "test" });

		const toolCall = provider.parseToolCall({
			id: "toolu_01ABC",
			name: "set_particles",
			input: { particles: [{ row: 1, col: 2 }] },
		});

		expect(toolCall.id).toBe("toolu_01ABC");
		expect(toolCall.name).toBe("set_particles");
		expect(toolCall.arguments).toEqual({ particles: [{ row: 1, col: 2 }] });
	});

	it("parseToolCall handles missing fields gracefully", () => {
		const provider = new AnthropicProvider({ apiKey: "test" });

		const toolCall = provider.parseToolCall({});

		expect(toolCall.id).toBe("");
		expect(toolCall.name).toBe("");
		expect(toolCall.arguments).toEqual({});
	});

	it("formatToolResult creates correct tool_result structure", () => {
		const provider = new AnthropicProvider({ apiKey: "test" });

		const result = provider.formatToolResult("toolu_01ABC", {
			success: true,
			data: { rows: 10, cols: 10 },
		});

		expect(result).toEqual({
			type: "tool_result",
			tool_use_id: "toolu_01ABC",
			content: JSON.stringify({ success: true, data: { rows: 10, cols: 10 } }),
		});
	});

	it("formatToolResult handles error results", () => {
		const provider = new AnthropicProvider({ apiKey: "test" });

		const result = provider.formatToolResult("toolu_01XYZ", {
			success: false,
			error: "Tool not found",
		});

		expect(result).toEqual({
			type: "tool_result",
			tool_use_id: "toolu_01XYZ",
			content: JSON.stringify({ success: false, error: "Tool not found" }),
		});
	});

	it("formatToolResult uses the toolCallId parameter as tool_use_id", () => {
		const provider = new AnthropicProvider({ apiKey: "test" });

		const result = provider.formatToolResult("toolu_custom_id", {
			success: true,
		}) as Record<string, unknown>;

		expect(result.tool_use_id).toBe("toolu_custom_id");
	});
});
