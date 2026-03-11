import { describe, expect, it, beforeEach } from "vitest";
import { ToolExecutor } from "../src/tool-executor.js";

describe("State Tools", () => {
	let executor: ToolExecutor;

	beforeEach(() => {
		executor = new ToolExecutor({ rows: 50, cols: 50, spacing: 10 });
	});

	describe("snapshot and restore", () => {
		it("should save and restore a named snapshot", () => {
			// Set up state
			executor.execute("set_particles", {
				particles: [
					{ row: 0, col: 0, color: "#FF0000" },
					{ row: 1, col: 1, color: "#00FF00" },
				],
			});

			// Save snapshot
			const snapResult = executor.execute("snapshot", { name: "checkpoint1" });
			expect(snapResult.success).toBe(true);
			const snapData = snapResult.data as { name: string; particleCount: number };
			expect(snapData.name).toBe("checkpoint1");
			expect(snapData.particleCount).toBe(2);

			// Modify state
			executor.execute("clear_particles", { all: true });
			let state = executor.execute("get_state", {});
			let stateData = state.data as { particles: unknown[] };
			expect(stateData.particles).toHaveLength(0);

			// Restore snapshot
			const restoreResult = executor.execute("restore", { name: "checkpoint1" });
			expect(restoreResult.success).toBe(true);

			// Verify state was restored
			state = executor.execute("get_state", {});
			stateData = state.data as { particles: unknown[] };
			expect(stateData.particles).toHaveLength(2);
		});

		it("should reject restoring non-existent snapshot", () => {
			const result = executor.execute("restore", { name: "nope" });
			expect(result.success).toBe(false);
			expect(result.error).toContain("not found");
		});

		it("should overwrite snapshot with same name", () => {
			executor.execute("set_particles", {
				particles: [{ row: 0, col: 0 }],
			});
			executor.execute("snapshot", { name: "s1" });

			executor.execute("set_particles", {
				particles: [{ row: 1, col: 1 }, { row: 2, col: 2 }],
			});
			executor.execute("snapshot", { name: "s1" });

			executor.execute("clear_particles", { all: true });
			executor.execute("restore", { name: "s1" });

			const state = executor.execute("get_state", {});
			const data = state.data as { particles: unknown[] };
			expect(data.particles).toHaveLength(3); // original + 2 new
		});
	});

	describe("undo", () => {
		it("should undo the last set_particles operation", () => {
			executor.execute("set_particles", {
				particles: [{ row: 0, col: 0 }],
			});

			// Verify particle exists
			let state = executor.execute("get_state", {});
			let data = state.data as { particles: unknown[] };
			expect(data.particles).toHaveLength(1);

			// Undo
			const undoResult = executor.execute("undo", {});
			expect(undoResult.success).toBe(true);

			// Verify particle removed
			state = executor.execute("get_state", {});
			data = state.data as { particles: unknown[] };
			expect(data.particles).toHaveLength(0);
		});

		it("should undo clear_particles", () => {
			executor.execute("set_particles", {
				particles: [{ row: 0, col: 0 }, { row: 1, col: 1 }],
			});
			executor.execute("clear_particles", { all: true });

			let state = executor.execute("get_state", {});
			let data = state.data as { particles: unknown[] };
			expect(data.particles).toHaveLength(0);

			executor.execute("undo", {});

			state = executor.execute("get_state", {});
			data = state.data as { particles: unknown[] };
			expect(data.particles).toHaveLength(2);
		});

		it("should support multiple undos", () => {
			executor.execute("set_particles", {
				particles: [{ row: 0, col: 0 }],
			});
			executor.execute("set_particles", {
				particles: [{ row: 1, col: 1 }],
			});

			let state = executor.execute("get_state", {});
			let data = state.data as { particles: unknown[] };
			expect(data.particles).toHaveLength(2);

			executor.execute("undo", {}); // undo second set
			state = executor.execute("get_state", {});
			data = state.data as { particles: unknown[] };
			expect(data.particles).toHaveLength(1);

			executor.execute("undo", {}); // undo first set
			state = executor.execute("get_state", {});
			data = state.data as { particles: unknown[] };
			expect(data.particles).toHaveLength(0);
		});

		it("should return error when nothing to undo", () => {
			const result = executor.execute("undo", {});
			expect(result.success).toBe(false);
			expect(result.error).toContain("Nothing to undo");
		});

		it("should not create undo snapshot for read-only tools", () => {
			// Read-only tools should not add to undo stack
			executor.execute("get_space_info", {});
			executor.execute("get_state", {});
			executor.execute("render_image", {});
			executor.execute("render_video", {});

			const result = executor.execute("undo", {});
			expect(result.success).toBe(false);
			expect(result.error).toContain("Nothing to undo");
		});
	});
});
