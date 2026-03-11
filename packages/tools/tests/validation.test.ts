import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateBounds, validateParams } from "../src/validation.js";

describe("Validation", () => {
	describe("validateParams", () => {
		const schema = z.object({
			name: z.string(),
			age: z.number().int().positive(),
		});

		it("should return success with valid data", () => {
			const result = validateParams(schema, { name: "test", age: 25 });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.name).toBe("test");
				expect(result.data.age).toBe(25);
			}
		});

		it("should return error with invalid data", () => {
			const result = validateParams(schema, { name: 123 });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.result.success).toBe(false);
				expect(result.result.error).toBeDefined();
			}
		});

		it("should return error with missing required fields", () => {
			const result = validateParams(schema, {});
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.result.error).toBeDefined();
			}
		});

		it("should include path in error messages", () => {
			const result = validateParams(schema, { name: "test", age: -5 });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.result.error).toContain("age");
			}
		});
	});

	describe("validateBounds", () => {
		it("should return null for valid coordinates", () => {
			expect(validateBounds(0, 0, 100, 100)).toBeNull();
			expect(validateBounds(99, 99, 100, 100)).toBeNull();
			expect(validateBounds(50, 50, 100, 100)).toBeNull();
		});

		it("should return error for negative row", () => {
			const error = validateBounds(-1, 0, 100, 100);
			expect(error).not.toBeNull();
			expect(error).toContain("Row -1 out of bounds");
		});

		it("should return error for row >= rows", () => {
			const error = validateBounds(100, 0, 100, 100);
			expect(error).not.toBeNull();
			expect(error).toContain("Row 100 out of bounds [0, 99]");
		});

		it("should return error for negative col", () => {
			const error = validateBounds(0, -1, 100, 100);
			expect(error).not.toBeNull();
			expect(error).toContain("Col -1 out of bounds");
		});

		it("should return error for col >= cols", () => {
			const error = validateBounds(0, 100, 100, 100);
			expect(error).not.toBeNull();
			expect(error).toContain("Col 100 out of bounds [0, 99]");
		});
	});
});
