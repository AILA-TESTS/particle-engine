import { describe, expect, it, beforeEach } from "vitest";
import { ToolExecutor } from "../src/tool-executor.js";

describe("Particle Tools", () => {
	let executor: ToolExecutor;

	beforeEach(() => {
		executor = new ToolExecutor({ rows: 100, cols: 100, spacing: 10 });
	});

	describe("set_particles", () => {
		it("should set a single particle with defaults", () => {
			const result = executor.execute("set_particles", {
				particles: [{ row: 0, col: 0 }],
			});
			expect(result.success).toBe(true);
			const data = result.data as { set: number };
			expect(data.set).toBe(1);

			// Verify the particle was set correctly
			const state = executor.execute("get_state", {});
			const stateData = state.data as {
				particles: Array<{
					row: number;
					col: number;
					color: string;
					size: number;
					opacity: number;
				}>;
			};
			expect(stateData.particles).toHaveLength(1);
			expect(stateData.particles[0].color).toBe("#FFFFFF");
			expect(stateData.particles[0].size).toBe(1);
			expect(stateData.particles[0].opacity).toBe(1);
		});

		it("should set multiple particles with custom properties", () => {
			const result = executor.execute("set_particles", {
				particles: [
					{ row: 0, col: 0, color: "#FF0000", size: 2, opacity: 0.5, group: "test" },
					{ row: 1, col: 1, color: "#00FF00" },
				],
			});
			expect(result.success).toBe(true);
			const data = result.data as { set: number };
			expect(data.set).toBe(2);
		});

		it("should reject out-of-bounds row", () => {
			const result = executor.execute("set_particles", {
				particles: [{ row: 150, col: 0 }],
			});
			expect(result.success).toBe(false);
			expect(result.error).toContain("Row 150 out of bounds [0, 99]");
		});

		it("should reject out-of-bounds col", () => {
			const result = executor.execute("set_particles", {
				particles: [{ row: 0, col: 200 }],
			});
			expect(result.success).toBe(false);
			expect(result.error).toContain("Col 200 out of bounds [0, 99]");
		});

		it("should reject invalid color format", () => {
			const result = executor.execute("set_particles", {
				particles: [{ row: 0, col: 0, color: "red" }],
			});
			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});

		it("should reject empty particles array", () => {
			const result = executor.execute("set_particles", {
				particles: [],
			});
			expect(result.success).toBe(false);
		});

		it("should modify existing particle", () => {
			executor.execute("set_particles", {
				particles: [{ row: 5, col: 5, color: "#FF0000" }],
			});
			executor.execute("set_particles", {
				particles: [{ row: 5, col: 5, color: "#00FF00" }],
			});
			const state = executor.execute("get_state", {});
			const data = state.data as {
				particles: Array<{ row: number; col: number; color: string }>;
			};
			expect(data.particles).toHaveLength(1);
			expect(data.particles[0].color).toBe("#00FF00");
		});
	});

	describe("clear_particles", () => {
		beforeEach(() => {
			executor.execute("set_particles", {
				particles: [
					{ row: 0, col: 0, group: "a" },
					{ row: 1, col: 1, group: "a" },
					{ row: 2, col: 2, group: "b" },
					{ row: 3, col: 3 },
				],
			});
		});

		it("should clear by coordinates", () => {
			const result = executor.execute("clear_particles", {
				coordinates: [[0, 0]],
			});
			expect(result.success).toBe(true);
			const data = result.data as { cleared: number };
			expect(data.cleared).toBe(1);
		});

		it("should clear by group", () => {
			const result = executor.execute("clear_particles", { group: "a" });
			expect(result.success).toBe(true);
			const data = result.data as { cleared: number };
			expect(data.cleared).toBe(2);
		});

		it("should clear all", () => {
			const result = executor.execute("clear_particles", { all: true });
			expect(result.success).toBe(true);
			const data = result.data as { cleared: number };
			expect(data.cleared).toBe(4);
		});

		it("should reject when no parameter provided", () => {
			const result = executor.execute("clear_particles", {});
			expect(result.success).toBe(false);
			expect(result.error).toContain("At least one of");
		});

		it("should reject out-of-bounds coordinates", () => {
			const result = executor.execute("clear_particles", {
				coordinates: [[150, 0]],
			});
			expect(result.success).toBe(false);
			expect(result.error).toContain("out of bounds");
		});
	});
});
