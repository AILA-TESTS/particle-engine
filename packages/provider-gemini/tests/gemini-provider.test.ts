import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolDefinition } from "@particle-engine/tools";
import { resetToolCallCounter } from "../src/parse-response.js";

// Mock the VertexAI SDK before importing GeminiProvider
vi.mock("@google-cloud/vertexai", () => {
	return {
		VertexAI: vi.fn().mockImplementation(() => ({
			getGenerativeModel: vi.fn().mockReturnValue({
				startChat: vi.fn().mockReturnValue({
					sendMessageStream: vi.fn(),
				}),
			}),
		})),
		SchemaType: {
			STRING: "STRING",
			NUMBER: "NUMBER",
			INTEGER: "INTEGER",
			BOOLEAN: "BOOLEAN",
			ARRAY: "ARRAY",
			OBJECT: "OBJECT",
		},
	};
});

import { GeminiProvider } from "../src/gemini-provider.js";
import { VertexAI } from "@google-cloud/vertexai";

describe("GeminiProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetToolCallCounter();
	});

	it("has name 'gemini'", () => {
		const provider = new GeminiProvider({ projectId: "test-project" });
		expect(provider.name).toBe("gemini");
	});

	it("creates a VertexAI instance with correct config", () => {
		new GeminiProvider({
			projectId: "my-project",
			location: "europe-west1",
		});

		expect(VertexAI).toHaveBeenCalledWith({
			project: "my-project",
			location: "europe-west1",
		});
	});

	it("uses default location when not specified", () => {
		new GeminiProvider({ projectId: "my-project" });

		expect(VertexAI).toHaveBeenCalledWith({
			project: "my-project",
			location: "us-central1",
		});
	});

	it("formatTools delegates to format-tools module", () => {
		const provider = new GeminiProvider({ projectId: "test" });
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
		expect(result[0].functionDeclarations).toHaveLength(1);
		expect(result[0].functionDeclarations![0].name).toBe("test");
	});

	it("parseToolCall extracts name and arguments from raw function call", () => {
		const provider = new GeminiProvider({ projectId: "test" });

		const toolCall = provider.parseToolCall({
			name: "set_particles",
			args: { particles: [{ row: 1, col: 2 }] },
		});

		expect(toolCall.name).toBe("set_particles");
		expect(toolCall.arguments).toEqual({ particles: [{ row: 1, col: 2 }] });
		expect(toolCall.id).toMatch(/^tc_\d+_\d+$/);
	});

	it("parseToolCall handles missing fields gracefully", () => {
		const provider = new GeminiProvider({ projectId: "test" });

		const toolCall = provider.parseToolCall({});

		expect(toolCall.name).toBe("");
		expect(toolCall.arguments).toEqual({});
	});

	it("formatToolResult creates correct functionResponse structure", () => {
		const provider = new GeminiProvider({ projectId: "test" });

		const result = provider.formatToolResult("get_space_info", {
			success: true,
			data: { rows: 10, cols: 10 },
		});

		expect(result).toEqual({
			functionResponse: {
				name: "get_space_info",
				response: {
					success: true,
					data: { rows: 10, cols: 10 },
				},
			},
		});
	});

	it("formatToolResult handles error results", () => {
		const provider = new GeminiProvider({ projectId: "test" });

		const result = provider.formatToolResult("unknown_tool", {
			success: false,
			error: "Tool not found",
		});

		expect(result).toEqual({
			functionResponse: {
				name: "unknown_tool",
				response: {
					success: false,
					error: "Tool not found",
				},
			},
		});
	});
});
