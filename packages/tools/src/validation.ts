import type { z } from "zod";
import type { ToolResult } from "./types.js";

/**
 * Validate params against a zod schema and return a ToolResult on failure.
 * Returns the parsed data on success, or a ToolResult error on failure.
 */
export function validateParams<T extends z.ZodType>(
	schema: T,
	params: unknown,
): { success: true; data: z.infer<T> } | { success: false; result: ToolResult } {
	const parsed = schema.safeParse(params);
	if (!parsed.success) {
		const issues = parsed.error.issues;
		const messages = issues.map((issue) => {
			const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
			return `${path}${issue.message}`;
		});
		return {
			success: false,
			result: {
				success: false,
				error: messages.join("; "),
			},
		};
	}
	return { success: true, data: parsed.data };
}

/**
 * Validate that coordinates are within grid bounds.
 */
export function validateBounds(
	row: number,
	col: number,
	rows: number,
	cols: number,
): string | null {
	if (row < 0 || row >= rows) {
		return `Row ${row} out of bounds [0, ${rows - 1}]`;
	}
	if (col < 0 || col >= cols) {
		return `Col ${col} out of bounds [0, ${cols - 1}]`;
	}
	return null;
}
