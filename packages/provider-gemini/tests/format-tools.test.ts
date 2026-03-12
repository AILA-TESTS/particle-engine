import { describe, it, expect } from "vitest";
import { formatTools } from "../src/format-tools.js";
import type { ToolDefinition } from "@particle-engine/tools";

describe("formatTools", () => {
	it("converts a simple tool with string params to Gemini format", () => {
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
		expect(result[0].functionDeclarations).toHaveLength(1);
		const decl = result[0].functionDeclarations![0];
		expect(decl.name).toBe("test_tool");
		expect(decl.description).toBe("A test tool");
		expect(decl.parameters?.type).toBe("OBJECT");
		expect(decl.parameters?.properties.name).toEqual({
			type: "STRING",
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

		const result = formatTools(tools);
		const decl = result[0].functionDeclarations![0];
		const region = decl.parameters?.properties.region as Record<string, unknown>;
		expect(region.type).toBe("OBJECT");
		expect(region.description).toBe("A region");
		expect(region.required).toEqual(["rowStart", "colStart"]);
		const props = region.properties as Record<string, Record<string, unknown>>;
		expect(props.rowStart.type).toBe("NUMBER");
		expect(props.colStart.type).toBe("NUMBER");
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
		const decl = result[0].functionDeclarations![0];
		const items = decl.parameters?.properties.items as Record<string, unknown>;
		expect(items.type).toBe("ARRAY");
		expect(items.description).toBe("An array of strings");
		const arrayItems = items.items as Record<string, unknown>;
		expect(arrayItems.type).toBe("STRING");
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
		const decl = result[0].functionDeclarations![0];
		expect(decl.parameters?.required).toEqual(["a", "b"]);
		expect(decl.parameters?.properties.c).toEqual({ type: "BOOLEAN" });
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
		const decl = result[0].functionDeclarations![0];
		expect(decl.parameters?.required).toBeUndefined();
	});

	it("converts all 13 particle-engine tool definitions without error", () => {
		// Replicate all 13 tool definitions
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
		expect(result).toHaveLength(1);
		expect(result[0].functionDeclarations).toHaveLength(13);

		// Verify all names are present
		const names = result[0].functionDeclarations!.map((d) => d.name);
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
		const decl = result[0].functionDeclarations![0];
		const format = decl.parameters?.properties.format as Record<string, unknown>;
		expect(format.type).toBe("STRING");
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

		const result = formatTools(tools);
		const decl = result[0].functionDeclarations![0];
		const particles = decl.parameters?.properties.particles as Record<string, unknown>;
		expect(particles.type).toBe("ARRAY");
		const itemsSchema = particles.items as Record<string, unknown>;
		expect(itemsSchema.type).toBe("OBJECT");
		const itemProps = itemsSchema.properties as Record<string, Record<string, unknown>>;
		expect(itemProps.row.type).toBe("NUMBER");
		expect(itemProps.col.type).toBe("NUMBER");
		expect(itemProps.color.type).toBe("STRING");
		expect(itemsSchema.required).toEqual(["row", "col"]);
	});
});
