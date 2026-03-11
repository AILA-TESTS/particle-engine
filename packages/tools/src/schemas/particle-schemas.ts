import { z } from "zod";

export const setParticlesSchema = z.object({
	particles: z
		.array(
			z.object({
				row: z.number().int(),
				col: z.number().int(),
				color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
				size: z.number().positive().optional(),
				opacity: z.number().min(0).max(1).optional(),
				group: z.string().optional(),
				label: z.string().optional(),
				layer: z.number().int().optional(),
			}),
		)
		.min(1, "At least one particle required"),
});

export const clearParticlesSchema = z
	.object({
		coordinates: z.array(z.tuple([z.number().int(), z.number().int()])).optional(),
		group: z.string().optional(),
		all: z.boolean().optional(),
	})
	.refine((data) => data.coordinates || data.group || data.all, {
		message: "At least one of coordinates, group, or all must be provided",
	});
