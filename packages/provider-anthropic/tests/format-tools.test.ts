import { describe, it, expect } from "vitest";
import { formatTools } from "../src/format-tools.js";
import type { ToolDefinition } from "@particle-engine/tools";

describe("formatTools", () => {
	it("converts a simple tool with string params to Anthropic format", () => {
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

		const result = formatTools(tools);

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("test_tool");
		expect(result[0].description).toBe("A test tool");
		expect(result[0].input_schema.type).toBe("object");
		expect(result[0].input_schema.properties.name).toEqual({
			type: "string",
			description: "The name",
		});
		expect(result[0].input_schema.required).toEqual(["name"]);
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

		const result = formatTools(tools);

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("nested_tool");
		const region = result[0].input_schema.properties.region as Record<string, unknown>;
		expect(region.type).toBe("object");
		expect(region.description).toBe("A region");
		expect(region.required).toEqual(["rowStart", "colStart"]);
		const props = region.properties as Record<string, Record<string, unknown>>;
		expect(props.rowStart).toEqual({ type: "number", description: "Start row" });
		expect(props.colStart).toEqual({ type: "number", description: "Start col" });
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

		const result = formatTools(tools);

		expect(result).toHaveLength(1);
		const items = result[0].input_schema.properties.items as Record<string, unknown>;
		expect(items.type).toBe("array");
		expect(items.description).toBe("An array of strings");
		expect(items.items).toEqual({ type: "string" });
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

		const result = formatTools(tools);

		expect(result[0].input_schema.required).toEqual(["a", "b"]);
		expect(result[0].input_schema.properties.c).toEqual({ type: "boolean" });
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

		const result = formatTools(tools);

		expect(result[0].input_schema.required).toBeUndefined();
	});

	it("input_schema matches our parameters directly (JSON Schema passthrough)", () => {
		const tools: ToolDefinition[] = [
			{
				name: "passthrough",
				description: "Tests passthrough",
				parameters: {
					type: "object",
					properties: {
						name: { type: "string", description: "Name" },
						count: { type: "integer", description: "Count" },
					},
					required: ["name"],
				},
			},
		];

		const result = formatTools(tools);

		// Anthropic uses standard JSON Schema — our properties pass through directly
		expect(result[0].input_schema.properties).toEqual(tools[0].parameters.properties);
		expect(result[0].input_schema.required).toEqual(tools[0].parameters.required);
	});

	it("converts all 13 particle-engine tool definitions without error", () => {
		const allTools: ToolDefinition[] = [
			{
				name: "get_space_info",
				description: "Get grid dimensions",
				parameters: { type: "object", properties: {} },
			},
			{
				name: "get_state",
				description: "Get active particles",
				parameters: {
					type: "object",
					properties: {
						region: {
							type: "object",
							description: "Filter region",
							properties: {
								rowStart: { type: "number" },
								rowEnd: { type: "number" },
								colStart: { type: "number" },
								colEnd: { type: "number" },
							},
							required: ["rowStart", "rowEnd", "colStart", "colEnd"],
						},
						group: { type: "string" },
						includeInactive: { type: "boolean" },
					},
				},
			},
			{
				name: "set_particles",
				description: "Set particles",
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
			{
				name: "clear_particles",
				description: "Clear particles",
				parameters: {
					type: "object",
					properties: {
						coordinates: { type: "array", items: { type: "array", items: { type: "number" } } },
						group: { type: "string" },
						all: { type: "boolean" },
					},
				},
			},
			{
				name: "connect",
				description: "Create connections",
				parameters: {
					type: "object",
					properties: {
						connections: {
							type: "array",
							items: {
								type: "object",
								properties: {
									from: { type: "array", items: { type: "number" } },
									to: { type: "array", items: { type: "number" } },
									color: { type: "string" },
								},
								required: ["from", "to"],
							},
						},
					},
					required: ["connections"],
				},
			},
			{
				name: "disconnect",
				description: "Remove connections",
				parameters: {
					type: "object",
					properties: {
						ids: { type: "array", items: { type: "string" } },
						group: { type: "string" },
					},
				},
			},
			{
				name: "create_animation",
				description: "Create animation",
				parameters: {
					type: "object",
					properties: {
						duration: { type: "number" },
						fps: { type: "number" },
						keyframes: { type: "array", items: { type: "object", properties: {} } },
					},
					required: ["duration", "fps", "keyframes"],
				},
			},
			{
				name: "modify_animation",
				description: "Modify animation",
				parameters: {
					type: "object",
					properties: { id: { type: "string" } },
					required: ["id"],
				},
			},
			{
				name: "render_image",
				description: "Render image",
				parameters: {
					type: "object",
					properties: {
						format: { type: "string", enum: ["png", "svg", "webp"] },
						width: { type: "number" },
						height: { type: "number" },
					},
				},
			},
			{
				name: "render_video",
				description: "Render video",
				parameters: {
					type: "object",
					properties: {
						animationId: { type: "string" },
						format: { type: "string", enum: ["mp4", "webm", "gif"] },
					},
				},
			},
			{
				name: "snapshot",
				description: "Save snapshot",
				parameters: {
					type: "object",
					properties: { name: { type: "string" } },
					required: ["name"],
				},
			},
			{
				name: "restore",
				description: "Restore snapshot",
				parameters: {
					type: "object",
					properties: { name: { type: "string" } },
					required: ["name"],
				},
			},
			{
				name: "undo",
				description: "Undo last operation",
				parameters: { type: "object", properties: {} },
			},
		];

		const result = formatTools(allTools);

		expect(result).toHaveLength(13);

		// Verify all names are present
		const names = result.map((t) => t.name);
		expect(names).toContain("get_space_info");
		expect(names).toContain("get_state");
		expect(names).toContain("set_particles");
		expect(names).toContain("clear_particles");
		expect(names).toContain("connect");
		expect(names).toContain("disconnect");
		expect(names).toContain("create_animation");
		expect(names).toContain("modify_animation");
		expect(names).toContain("render_image");
		expect(names).toContain("render_video");
		expect(names).toContain("snapshot");
		expect(names).toContain("restore");
		expect(names).toContain("undo");

		// All should have input_schema with type "object"
		for (const tool of result) {
			expect(tool.input_schema.type).toBe("object");
		}
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

		const result = formatTools(tools);

		const format = result[0].input_schema.properties.format as Record<string, unknown>;
		expect(format.type).toBe("string");
		expect(format.enum).toEqual(["png", "svg", "webp"]);
		expect(format.description).toBe("Output format");
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

		const result = formatTools(tools);

		const particles = result[0].input_schema.properties.particles as Record<string, unknown>;
		expect(particles.type).toBe("array");
		const itemsSchema = particles.items as Record<string, unknown>;
		expect(itemsSchema.type).toBe("object");
		const itemProps = itemsSchema.properties as Record<string, Record<string, unknown>>;
		expect(itemProps.row).toEqual({ type: "number" });
		expect(itemProps.col).toEqual({ type: "number" });
		expect(itemProps.color).toEqual({ type: "string" });
		expect(itemsSchema.required).toEqual(["row", "col"]);
	});
});
