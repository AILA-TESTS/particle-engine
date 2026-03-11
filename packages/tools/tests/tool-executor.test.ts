import { describe, expect, it, beforeEach } from "vitest";
import { ToolExecutor } from "../src/tool-executor.js";

describe("ToolExecutor", () => {
	let executor: ToolExecutor;

	beforeEach(() => {
		executor = new ToolExecutor({ rows: 100, cols: 100, spacing: 10 });
	});

	it("should return 13 tool definitions", () => {
		const defs = executor.getToolDefinitions();
		expect(defs).toHaveLength(13);
	});

	it("should return valid tool definitions with required fields", () => {
		const defs = executor.getToolDefinitions();
		for (const def of defs) {
			expect(def).toHaveProperty("name");
			expect(def).toHaveProperty("description");
			expect(def).toHaveProperty("parameters");
			expect(def.parameters).toHaveProperty("type", "object");
			expect(def.parameters).toHaveProperty("properties");
			expect(typeof def.name).toBe("string");
			expect(typeof def.description).toBe("string");
		}
	});

	it("should return error for unknown tool", () => {
		const result = executor.execute("nonexistent", {});
		expect(result.success).toBe(false);
		expect(result.error).toContain("Unknown tool");
	});

	it("should expose the grid via getGrid()", () => {
		const grid = executor.getGrid();
		expect(grid).toBeDefined();
		const config = grid.getConfig();
		expect(config.rows).toBe(100);
		expect(config.cols).toBe(100);
		expect(config.spacing).toBe(10);
	});

	it("should have all 13 tool names", () => {
		const defs = executor.getToolDefinitions();
		const names = defs.map((d) => d.name);
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
});
