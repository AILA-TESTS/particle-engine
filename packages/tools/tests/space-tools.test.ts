import { describe, expect, it, beforeEach } from "vitest";
import { ToolExecutor } from "../src/tool-executor.js";

describe("Space Tools", () => {
	let executor: ToolExecutor;

	beforeEach(() => {
		executor = new ToolExecutor({ rows: 50, cols: 50, spacing: 10 });
	});

	describe("get_space_info", () => {
		it("should return grid dimensions and stats for empty grid", () => {
			const result = executor.execute("get_space_info", {});
			expect(result.success).toBe(true);
			const data = result.data as {
				rows: number;
				cols: number;
				spacing: number;
				totalParticles: number;
				activeCount: number;
				connectionCount: number;
				groups: string[];
			};
			expect(data.rows).toBe(50);
			expect(data.cols).toBe(50);
			expect(data.spacing).toBe(10);
			expect(data.totalParticles).toBe(2500);
			expect(data.activeCount).toBe(0);
			expect(data.connectionCount).toBe(0);
			expect(data.groups).toEqual([]);
		});

		it("should reflect active particles and groups", () => {
			executor.execute("set_particles", {
				particles: [
					{ row: 0, col: 0, group: "stars" },
					{ row: 1, col: 1, group: "planets" },
				],
			});
			const result = executor.execute("get_space_info", {});
			expect(result.success).toBe(true);
			const data = result.data as {
				activeCount: number;
				groups: string[];
			};
			expect(data.activeCount).toBe(2);
			expect(data.groups).toContain("stars");
			expect(data.groups).toContain("planets");
		});
	});

	describe("get_state", () => {
		it("should return empty state for empty grid", () => {
			const result = executor.execute("get_state", {});
			expect(result.success).toBe(true);
			const data = result.data as { particles: unknown[]; connections: unknown[] };
			expect(data.particles).toEqual([]);
			expect(data.connections).toEqual([]);
		});

		it("should return active particles", () => {
			executor.execute("set_particles", {
				particles: [{ row: 5, col: 5, color: "#FF0000" }],
			});
			const result = executor.execute("get_state", {});
			expect(result.success).toBe(true);
			const data = result.data as {
				particles: Array<{ row: number; col: number; color: string }>;
			};
			expect(data.particles).toHaveLength(1);
			expect(data.particles[0].row).toBe(5);
			expect(data.particles[0].col).toBe(5);
			expect(data.particles[0].color).toBe("#FF0000");
		});

		it("should filter by region", () => {
			executor.execute("set_particles", {
				particles: [
					{ row: 0, col: 0 },
					{ row: 10, col: 10 },
					{ row: 20, col: 20 },
				],
			});
			const result = executor.execute("get_state", {
				region: { rowStart: 0, rowEnd: 15, colStart: 0, colEnd: 15 },
			});
			expect(result.success).toBe(true);
			const data = result.data as { particles: unknown[] };
			expect(data.particles).toHaveLength(2);
		});

		it("should filter by group", () => {
			executor.execute("set_particles", {
				particles: [
					{ row: 0, col: 0, group: "a" },
					{ row: 1, col: 1, group: "b" },
					{ row: 2, col: 2, group: "a" },
				],
			});
			const result = executor.execute("get_state", { group: "a" });
			expect(result.success).toBe(true);
			const data = result.data as { particles: unknown[] };
			expect(data.particles).toHaveLength(2);
		});
	});
});
