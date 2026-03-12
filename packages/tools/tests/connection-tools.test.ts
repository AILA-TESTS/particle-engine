import { describe, expect, it, beforeEach } from "vitest";
import { ToolExecutor } from "../src/tool-executor.js";

describe("Connection Tools", () => {
	let executor: ToolExecutor;

	beforeEach(() => {
		executor = new ToolExecutor({ rows: 50, cols: 50, spacing: 10 });
		// Set up some active particles
		executor.execute("set_particles", {
			particles: [
				{ row: 0, col: 0 },
				{ row: 1, col: 1 },
				{ row: 2, col: 2 },
				{ row: 3, col: 3 },
			],
		});
	});

	describe("connect", () => {
		it("should create a connection between active particles", () => {
			const result = executor.execute("connect", {
				connections: [{ from: [0, 0], to: [1, 1] }],
			});
			expect(result.success).toBe(true);
			const data = result.data as {
				created: number;
				connections: Array<{ id: string }>;
			};
			expect(data.created).toBe(1);
			expect(data.connections[0].id).toMatch(/^c_/);
		});

		it("should create connections with custom properties", () => {
			const result = executor.execute("connect", {
				connections: [
					{
						from: [0, 0],
						to: [1, 1],
						color: "#FF0000",
						width: 2,
						style: "dashed",
						directed: true,
						group: "edges",
						label: "test",
					},
				],
			});
			expect(result.success).toBe(true);
		});

		it("should create multiple connections", () => {
			const result = executor.execute("connect", {
				connections: [
					{ from: [0, 0], to: [1, 1] },
					{ from: [2, 2], to: [3, 3] },
				],
			});
			expect(result.success).toBe(true);
			const data = result.data as { created: number };
			expect(data.created).toBe(2);
		});

		it("should reject connection to inactive particle", () => {
			const result = executor.execute("connect", {
				connections: [{ from: [0, 0], to: [10, 10] }],
			});
			expect(result.success).toBe(false);
			expect(result.error).toContain("not active");
		});

		it("should reject out-of-bounds coordinates", () => {
			const result = executor.execute("connect", {
				connections: [{ from: [0, 0], to: [100, 100] }],
			});
			expect(result.success).toBe(false);
			expect(result.error).toContain("out of bounds");
		});

		it("should reject empty connections array", () => {
			const result = executor.execute("connect", { connections: [] });
			expect(result.success).toBe(false);
		});
	});

	describe("disconnect", () => {
		let connId: string;

		beforeEach(() => {
			const result = executor.execute("connect", {
				connections: [
					{ from: [0, 0], to: [1, 1], group: "g1" },
					{ from: [2, 2], to: [3, 3], group: "g2" },
				],
			});
			const data = result.data as {
				connections: Array<{ id: string }>;
			};
			connId = data.connections[0].id;
		});

		it("should disconnect by ID", () => {
			const result = executor.execute("disconnect", { ids: [connId] });
			expect(result.success).toBe(true);
			const data = result.data as { removed: number };
			expect(data.removed).toBe(1);
		});

		it("should disconnect by endpoints", () => {
			const result = executor.execute("disconnect", {
				endpoints: [[[0, 0], [1, 1]]],
			});
			expect(result.success).toBe(true);
			const data = result.data as { removed: number };
			expect(data.removed).toBe(1);
		});

		it("should disconnect by group", () => {
			const result = executor.execute("disconnect", { group: "g1" });
			expect(result.success).toBe(true);
			const data = result.data as { removed: number };
			expect(data.removed).toBe(1);
		});

		it("should reject when no parameter provided", () => {
			const result = executor.execute("disconnect", {});
			expect(result.success).toBe(false);
			expect(result.error).toContain("At least one of");
		});
	});
});
