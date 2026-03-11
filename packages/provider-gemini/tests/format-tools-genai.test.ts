import { describe, it, expect } from "vitest";
import { formatToolsGenAI } from "../src/format-tools-genai.js";
import type { ToolDefinition } from "@particle-engine/tools";

describe("formatToolsGenAI", () => {
	it("converts a simple tool with string params to GenAI format", () => {
		const tools: ToolDefinition[] = [
			{
				name: "test_tool",
				description: "A test tool",
				parameters: {
					type: "object",
					properties: {
						name: { type: "string", description: "The name" },
					},
					required: ["name"],
				},
			},
		];

		const result = formatToolsGenAI(tools);

		expect(result).toHaveLength(1);
		expect(result[0].functionDeclarations).toHaveLength(1);
		const decl = result[0].functionDeclarations![0];
		expect(decl.name).toBe("test_tool");
		expect(decl.description).toBe("A test tool");
		// GenAI uses lowercase schema types
		expect(decl.parameters?.type).toBe("object");
		expect(decl.parameters?.properties.name).toEqual({
			type: "string",
			description: "The name",
		});
		expect(decl.parameters?.required).toEqual(["name"]);
	});

	it("converts a tool with nested objects", () => {
		const tools: ToolDefinition[] = [
			{
				name: "nested_tool",
				description: "Has nested objects",
				parameters: {
					type: "object",
					properties: {
						region: {
							type: "object",
							description: "A region",
							properties: {
								rowStart: { type: "number", description: "Start row" },
								colStart: { type: "number", description: "Start col" },
							},
							required: ["rowStart", "colStart"],
						},
					},
				},
			},
		];

		const result = formatToolsGenAI(tools);
		const decl = result[0].functionDeclarations![0];
		const region = decl.parameters?.properties.region as Record<string, unknown>;
		expect(region.type).toBe("object");
		expect(region.description).toBe("A region");
		expect(region.required).toEqual(["rowStart", "colStart"]);
		const props = region.properties as Record<string, Record<string, unknown>>;
		expect(props.rowStart.type).toBe("number");
		expect(props.colStart.type).toBe("number");
	});

	it("converts a tool with array params", () => {
		const tools: ToolDefinition[] = [
			{
				name: "array_tool",
				description: "Has arrays",
				parameters: {
					type: "object",
					properties: {
						items: {
							type: "array",
							description: "An array of strings",
							items: { type: "string" },
						},
					},
					required: ["items"],
				},
			},
		];

		const result = formatToolsGenAI(tools);
		const decl = result[0].functionDeclarations![0];
		const items = decl.parameters?.properties.items as Record<string, unknown>;
		expect(items.type).toBe("array");
		expect(items.description).toBe("An array of strings");
		const arrayItems = items.items as Record<string, unknown>;
		expect(arrayItems.type).toBe("string");
	});

	it("handles tools with required fields correctly", () => {
		const tools: ToolDefinition[] = [
			{
				name: "req_tool",
				description: "Has required",
				parameters: {
					type: "object",
					properties: {
						a: { type: "string" },
						b: { type: "number" },
						c: { type: "boolean" },
					},
					required: ["a", "b"],
				},
			},
		];

		const result = formatToolsGenAI(tools);
		const decl = result[0].functionDeclarations![0];
		expect(decl.parameters?.required).toEqual(["a", "b"]);
		expect(decl.parameters?.properties.c).toEqual({ type: "boolean" });
	});

	it("handles tools with no required fields", () => {
		const tools: ToolDefinition[] = [
			{
				name: "no_req",
				description: "No required",
				parameters: {
					type: "object",
					properties: {
						optional: { type: "string" },
					},
				},
			},
		];

		const result = formatToolsGenAI(tools);
		const decl = result[0].functionDeclarations![0];
		expect(decl.parameters?.required).toBeUndefined();
	});

	it("converts enum fields correctly", () => {
		const tools: ToolDefinition[] = [
			{
				name: "enum_tool",
				description: "Has enum",
				parameters: {
					type: "object",
					properties: {
						format: {
							type: "string",
							enum: ["png", "svg", "webp"],
							description: "Output format",
						},
					},
				},
			},
		];

		const result = formatToolsGenAI(tools);
		const decl = result[0].functionDeclarations![0];
		const format = decl.parameters?.properties.format as Record<string, unknown>;
		expect(format.type).toBe("string");
		expect(format.enum).toEqual(["png", "svg", "webp"]);
	});

	it("converts array of objects (deeply nested) correctly", () => {
		const tools: ToolDefinition[] = [
			{
				name: "deep_tool",
				description: "Deep nesting",
				parameters: {
					type: "object",
					properties: {
						particles: {
							type: "array",
							items: {
								type: "object",
								properties: {
									row: { type: "number" },
									col: { type: "number" },
									color: { type: "string" },
								},
								required: ["row", "col"],
							},
						},
					},
					required: ["particles"],
				},
			},
		];

		const result = formatToolsGenAI(tools);
		const decl = result[0].functionDeclarations![0];
		const particles = decl.parameters?.properties.particles as Record<string, unknown>;
		expect(particles.type).toBe("array");
		const itemsSchema = particles.items as Record<string, unknown>;
		expect(itemsSchema.type).toBe("object");
		const itemProps = itemsSchema.properties as Record<string, Record<string, unknown>>;
		expect(itemProps.row.type).toBe("number");
		expect(itemProps.col.type).toBe("number");
		expect(itemProps.color.type).toBe("string");
		expect(itemsSchema.required).toEqual(["row", "col"]);
	});

	it("uses lowercase type values (different from Vertex AI)", () => {
		const tools: ToolDefinition[] = [
			{
				name: "all_types",
				description: "All types",
				parameters: {
					type: "object",
					properties: {
						s: { type: "string" },
						n: { type: "number" },
						i: { type: "integer" },
						b: { type: "boolean" },
						a: { type: "array", items: { type: "string" } },
						o: { type: "object", properties: {} },
					},
				},
			},
		];

		const result = formatToolsGenAI(tools);
		const props = result[0].functionDeclarations![0].parameters?.properties as Record<string, Record<string, unknown>>;
		expect(props.s.type).toBe("string");
		expect(props.n.type).toBe("number");
		expect(props.i.type).toBe("integer");
		expect(props.b.type).toBe("boolean");
		expect(props.a.type).toBe("array");
		expect(props.o.type).toBe("object");
	});
});
