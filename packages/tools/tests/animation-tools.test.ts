import { describe, expect, it, beforeEach } from "vitest";
import { ToolExecutor } from "../src/tool-executor.js";

describe("Animation Tools", () => {
	let executor: ToolExecutor;

	beforeEach(() => {
		executor = new ToolExecutor({ rows: 50, cols: 50, spacing: 10 });
	});

	describe("create_animation", () => {
		it("should create an animation and return ID", () => {
			const result = executor.execute("create_animation", {
				duration: 1000,
				fps: 30,
				keyframes: [
					{
						time: 0,
						targets: [{ row: 0, col: 0, color: "#FF0000" }],
					},
					{
						time: 1000,
						targets: [{ row: 0, col: 0, color: "#00FF00" }],
					},
				],
			});
			expect(result.success).toBe(true);
			const data = result.data as { id: string; keyframeCount: number };
			expect(data.id).toMatch(/^anim_/);
			expect(data.keyframeCount).toBe(2);
		});

		it("should create sequential IDs", () => {
			const result1 = executor.execute("create_animation", {
				duration: 1000,
				fps: 30,
				keyframes: [{ time: 0, targets: [{ row: 0, col: 0 }] }],
			});
			const result2 = executor.execute("create_animation", {
				duration: 2000,
				fps: 60,
				keyframes: [{ time: 0, targets: [{ row: 1, col: 1 }] }],
			});
			const data1 = result1.data as { id: string };
			const data2 = result2.data as { id: string };
			expect(data1.id).toBe("anim_1");
			expect(data2.id).toBe("anim_2");
		});

		it("should reject negative duration", () => {
			const result = executor.execute("create_animation", {
				duration: -100,
				fps: 30,
				keyframes: [{ time: 0, targets: [{ row: 0, col: 0 }] }],
			});
			expect(result.success).toBe(false);
		});

		it("should reject FPS over 120", () => {
			const result = executor.execute("create_animation", {
				duration: 1000,
				fps: 200,
				keyframes: [{ time: 0, targets: [{ row: 0, col: 0 }] }],
			});
			expect(result.success).toBe(false);
		});

		it("should reject empty keyframes", () => {
			const result = executor.execute("create_animation", {
				duration: 1000,
				fps: 30,
				keyframes: [],
			});
			expect(result.success).toBe(false);
		});

		it("should accept optional events and defaultEasing", () => {
			const result = executor.execute("create_animation", {
				duration: 1000,
				fps: 30,
				keyframes: [{ time: 0, targets: [{ row: 0, col: 0 }] }],
				events: [{ time: 500, type: "flash" }],
				defaultEasing: "ease-in-out",
			});
			expect(result.success).toBe(true);
		});
	});

	describe("modify_animation", () => {
		let animId: string;

		beforeEach(() => {
			const result = executor.execute("create_animation", {
				duration: 1000,
				fps: 30,
				keyframes: [
					{ time: 0, targets: [{ row: 0, col: 0, color: "#FF0000" }] },
					{ time: 1000, targets: [{ row: 0, col: 0, color: "#00FF00" }] },
				],
			});
			animId = (result.data as { id: string }).id;
		});

		it("should add new keyframes", () => {
			const result = executor.execute("modify_animation", {
				id: animId,
				keyframes: [{ time: 500, targets: [{ row: 0, col: 0, color: "#0000FF" }] }],
			});
			expect(result.success).toBe(true);
			const data = result.data as { keyframeCount: number };
			expect(data.keyframeCount).toBe(3);
		});

		it("should update existing keyframes by time", () => {
			const result = executor.execute("modify_animation", {
				id: animId,
				keyframes: [{ time: 0, targets: [{ row: 0, col: 0, color: "#0000FF" }] }],
			});
			expect(result.success).toBe(true);
			const data = result.data as { keyframeCount: number };
			expect(data.keyframeCount).toBe(2); // same count, replaced
		});

		it("should update duration", () => {
			const result = executor.execute("modify_animation", {
				id: animId,
				duration: 2000,
			});
			expect(result.success).toBe(true);
			const data = result.data as { duration: number };
			expect(data.duration).toBe(2000);
		});

		it("should reject unknown animation ID", () => {
			const result = executor.execute("modify_animation", {
				id: "anim_999",
			});
			expect(result.success).toBe(false);
			expect(result.error).toContain("not found");
		});
	});

	describe("render_image", () => {
		it("should return placeholder message", () => {
			const result = executor.execute("render_image", {});
			expect(result.success).toBe(true);
			const data = result.data as { message: string };
			expect(data.message).toContain("Renderer not implemented yet");
		});
	});

	describe("render_video", () => {
		it("should return placeholder message", () => {
			const result = executor.execute("render_video", {});
			expect(result.success).toBe(true);
			const data = result.data as { message: string };
			expect(data.message).toContain("Renderer not implemented yet");
		});
	});
});
