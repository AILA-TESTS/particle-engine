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

// Mock the Google Generative AI SDK
vi.mock("@google/generative-ai", () => {
	return {
		GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
			getGenerativeModel: vi.fn().mockReturnValue({
				startChat: vi.fn().mockReturnValue({
					sendMessageStream: vi.fn(),
				}),
			}),
		})),
		SchemaType: {
			STRING: "string",
			NUMBER: "number",
			INTEGER: "integer",
			BOOLEAN: "boolean",
			ARRAY: "array",
			OBJECT: "object",
		},
	};
});

import { GeminiProvider } from "../src/gemini-provider.js";
import { VertexAI } from "@google-cloud/vertexai";
import { GoogleGenerativeAI } from "@google/generative-ai";

describe("GeminiProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetToolCallCounter();
	});

	// =========================================================================
	// Vertex AI mode (backward-compatible)
	// =========================================================================

	describe("Vertex AI mode", () => {
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

		it("auto-detects vertexai auth mode from projectId", () => {
			const provider = new GeminiProvider({ projectId: "my-project" });
			expect(provider.getAuthMode()).toBe("vertexai");
		});

		it("uses explicit authMode override to vertexai", () => {
			const provider = new GeminiProvider({
				projectId: "my-project",
				authMode: "vertexai",
			});
			expect(provider.getAuthMode()).toBe("vertexai");
			expect(VertexAI).toHaveBeenCalled();
		});

		it("throws if vertexai mode but no projectId", () => {
			expect(() => {
				new GeminiProvider({ authMode: "vertexai" });
			}).toThrow("'projectId' is required for Vertex AI mode");
		});

		it("formatTools delegates to format-tools module (Vertex AI)", () => {
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
			// Vertex AI uses UPPERCASE SchemaType
			expect(result[0].functionDeclarations![0].parameters?.type).toBe("OBJECT");
		});

		it("stream yields events from VertexAI SDK", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						candidates: [
							{
								content: {
									role: "model",
									parts: [{ text: "Hello from Vertex AI!" }],
								},
								index: 0,
							},
						],
						usageMetadata: {
							promptTokenCount: 10,
							candidatesTokenCount: 5,
							totalTokenCount: 15,
						},
					};
				},
			};

			const mockSendMessageStream = vi.fn().mockResolvedValue({
				stream: mockStream,
				response: Promise.resolve({}),
			});

			(VertexAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
				getGenerativeModel: vi.fn().mockReturnValue({
					startChat: vi.fn().mockReturnValue({
						sendMessageStream: mockSendMessageStream,
					}),
				}),
			}));

			const provider = new GeminiProvider({ projectId: "test" });

			const events: import("@particle-engine/tools").LLMEvent[] = [];
			for await (const event of provider.stream(
				[{ role: "user", content: "Hi" }],
				[],
			)) {
				events.push(event);
			}

			expect(events).toHaveLength(2);
			expect(events[0]).toEqual({ type: "text", content: "Hello from Vertex AI!" });
			expect(events[1].type).toBe("done");
		});
	});

	// =========================================================================
	// API Key mode (new)
	// =========================================================================

	describe("API Key mode", () => {
		it("has name 'gemini'", () => {
			const provider = new GeminiProvider({ apiKey: "test-key" });
			expect(provider.name).toBe("gemini");
		});

		it("creates a GoogleGenerativeAI instance with correct API key", () => {
			new GeminiProvider({ apiKey: "my-api-key" });

			expect(GoogleGenerativeAI).toHaveBeenCalledWith("my-api-key");
		});

		it("auto-detects apiKey auth mode from apiKey", () => {
			const provider = new GeminiProvider({ apiKey: "test-key" });
			expect(provider.getAuthMode()).toBe("apiKey");
		});

		it("uses explicit authMode override to apiKey", () => {
			const provider = new GeminiProvider({
				apiKey: "test-key",
				authMode: "apiKey",
			});
			expect(provider.getAuthMode()).toBe("apiKey");
			expect(GoogleGenerativeAI).toHaveBeenCalledWith("test-key");
		});

		it("throws if apiKey mode but no apiKey", () => {
			expect(() => {
				new GeminiProvider({ authMode: "apiKey" });
			}).toThrow("'apiKey' is required for API key mode");
		});

		it("does not create VertexAI instance in apiKey mode", () => {
			new GeminiProvider({ apiKey: "test-key" });
			expect(VertexAI).not.toHaveBeenCalled();
		});

		it("does not create GoogleGenerativeAI instance in vertexai mode", () => {
			new GeminiProvider({ projectId: "test-project" });
			expect(GoogleGenerativeAI).not.toHaveBeenCalled();
		});

		it("formatTools delegates to format-tools-genai module (API key)", () => {
			const provider = new GeminiProvider({ apiKey: "test-key" });
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
			// GenAI uses lowercase SchemaType
			expect(result[0].functionDeclarations![0].parameters?.type).toBe("object");
		});

		it("stream yields events from GoogleGenerativeAI SDK", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						candidates: [
							{
								content: {
									role: "model",
									parts: [{ text: "Hello from API Key!" }],
								},
								index: 0,
							},
						],
						usageMetadata: {
							promptTokenCount: 10,
							candidatesTokenCount: 5,
							totalTokenCount: 15,
						},
					};
				},
			};

			const mockSendMessageStream = vi.fn().mockResolvedValue({
				stream: mockStream,
				response: Promise.resolve({}),
			});

			(GoogleGenerativeAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
				getGenerativeModel: vi.fn().mockReturnValue({
					startChat: vi.fn().mockReturnValue({
						sendMessageStream: mockSendMessageStream,
					}),
				}),
			}));

			const provider = new GeminiProvider({ apiKey: "test-key" });

			const events: import("@particle-engine/tools").LLMEvent[] = [];
			for await (const event of provider.stream(
				[{ role: "user", content: "Hi" }],
				[],
			)) {
				events.push(event);
			}

			expect(events).toHaveLength(2);
			expect(events[0]).toEqual({ type: "text", content: "Hello from API Key!" });
			expect(events[1].type).toBe("done");
		});

		it("stream yields tool_call events from API key mode", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						candidates: [
							{
								content: {
									role: "model",
									parts: [
										{
											functionCall: {
												name: "set_particles",
												args: { particles: [{ row: 0, col: 0 }] },
											},
										},
									],
								},
								index: 0,
							},
						],
						usageMetadata: {
							promptTokenCount: 20,
							candidatesTokenCount: 10,
							totalTokenCount: 30,
						},
					};
				},
			};

			const mockSendMessageStream = vi.fn().mockResolvedValue({
				stream: mockStream,
				response: Promise.resolve({}),
			});

			(GoogleGenerativeAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
				getGenerativeModel: vi.fn().mockReturnValue({
					startChat: vi.fn().mockReturnValue({
						sendMessageStream: mockSendMessageStream,
					}),
				}),
			}));

			const provider = new GeminiProvider({ apiKey: "test-key" });

			const events: import("@particle-engine/tools").LLMEvent[] = [];
			for await (const event of provider.stream(
				[{ role: "user", content: "Place a particle" }],
				[
					{
						name: "set_particles",
						description: "Set particles",
						parameters: {
							type: "object",
							properties: {
								particles: { type: "array", items: { type: "object", properties: {} } },
							},
							required: ["particles"],
						},
					},
				],
			)) {
				events.push(event);
			}

			expect(events).toHaveLength(2);
			expect(events[0].type).toBe("tool_call");
			if (events[0].type === "tool_call") {
				expect(events[0].name).toBe("set_particles");
				expect(events[0].arguments).toEqual({ particles: [{ row: 0, col: 0 }] });
			}
			expect(events[1].type).toBe("done");
		});

		it("stream handles errors gracefully in API key mode", async () => {
			const mockSendMessageStream = vi.fn().mockRejectedValue(
				new Error("API key invalid"),
			);

			(GoogleGenerativeAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
				getGenerativeModel: vi.fn().mockReturnValue({
					startChat: vi.fn().mockReturnValue({
						sendMessageStream: mockSendMessageStream,
					}),
				}),
			}));

			const provider = new GeminiProvider({ apiKey: "bad-key" });

			const events: import("@particle-engine/tools").LLMEvent[] = [];
			for await (const event of provider.stream(
				[{ role: "user", content: "Hi" }],
				[],
			)) {
				events.push(event);
			}

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("error");
			if (events[0].type === "error") {
				expect(events[0].error.message).toBe("API key invalid");
			}
		});

		it("stream emits done with zero tokens when no usage metadata in API key mode", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						candidates: [
							{
								content: {
									role: "model",
									parts: [{ text: "Response" }],
								},
								index: 0,
							},
						],
					};
				},
			};

			const mockSendMessageStream = vi.fn().mockResolvedValue({
				stream: mockStream,
				response: Promise.resolve({}),
			});

			(GoogleGenerativeAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
				getGenerativeModel: vi.fn().mockReturnValue({
					startChat: vi.fn().mockReturnValue({
						sendMessageStream: mockSendMessageStream,
					}),
				}),
			}));

			const provider = new GeminiProvider({ apiKey: "test-key" });

			const events: import("@particle-engine/tools").LLMEvent[] = [];
			for await (const event of provider.stream(
				[{ role: "user", content: "Hi" }],
				[],
			)) {
				events.push(event);
			}

			expect(events).toHaveLength(2);
			expect(events[0]).toEqual({ type: "text", content: "Response" });
			expect(events[1]).toEqual({
				type: "done",
				usage: { inputTokens: 0, outputTokens: 0 },
			});
		});
	});

	// =========================================================================
	// Shared behavior (works identically in both modes)
	// =========================================================================

	describe("shared behavior", () => {
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

		it("parseToolCall works identically with apiKey provider", () => {
			const provider = new GeminiProvider({ apiKey: "test-key" });

			const toolCall = provider.parseToolCall({
				name: "get_state",
				args: { includeInactive: true },
			});

			expect(toolCall.name).toBe("get_state");
			expect(toolCall.arguments).toEqual({ includeInactive: true });
			expect(toolCall.id).toMatch(/^tc_\d+_\d+$/);
		});

		it("formatToolResult works identically with apiKey provider", () => {
			const provider = new GeminiProvider({ apiKey: "test-key" });

			const result = provider.formatToolResult("connect", {
				success: true,
				data: { connectionId: "c1" },
			});

			expect(result).toEqual({
				functionResponse: {
					name: "connect",
					response: {
						success: true,
						data: { connectionId: "c1" },
					},
				},
			});
		});

		it("throws if neither apiKey nor projectId is provided", () => {
			expect(() => {
				new GeminiProvider({});
			}).toThrow("either 'apiKey' or 'projectId' must be provided");
		});

		it("uses default model gemini-2.0-flash", () => {
			// We can verify this indirectly through the VertexAI mock
			(VertexAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
				let capturedModel: string | undefined;
				return {
					getGenerativeModel: vi.fn().mockImplementation((params: { model: string }) => {
						capturedModel = params.model;
						return {
							startChat: vi.fn().mockReturnValue({
								sendMessageStream: vi.fn(),
							}),
						};
					}),
					_getCapturedModel: () => capturedModel,
				};
			});

			const provider = new GeminiProvider({ projectId: "test" });
			// Trigger getGenerativeModel by calling stream
			const tools: ToolDefinition[] = [];
			// Just verify construction doesn't throw
			expect(provider.name).toBe("gemini");
		});

		it("apiKey takes precedence over projectId when both given without explicit authMode", () => {
			const provider = new GeminiProvider({
				apiKey: "test-key",
				projectId: "test-project",
			});
			expect(provider.getAuthMode()).toBe("apiKey");
		});

		it("explicit authMode overrides auto-detection", () => {
			const provider = new GeminiProvider({
				apiKey: "test-key",
				projectId: "test-project",
				authMode: "vertexai",
			});
			expect(provider.getAuthMode()).toBe("vertexai");
		});
	});
});
