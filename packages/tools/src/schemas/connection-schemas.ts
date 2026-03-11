import { z } from "zod";

const coordinateTuple = z.tuple([z.number().int(), z.number().int()]);

export const connectSchema = z.object({
	connections: z
		.array(
			z.object({
				from: coordinateTuple,
				to: coordinateTuple,
				color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
				width: z.number().positive().optional(),
				opacity: z.number().min(0).max(1).optional(),
				style: z.enum(["solid", "dashed", "dotted"]).optional(),
				curve: z.number().optional(),
				directed: z.boolean().optional(),
				group: z.string().optional(),
				label: z.string().optional(),
			}),
		)
		.min(1, "At least one connection required"),
});

export const disconnectSchema = z
	.object({
		ids: z.array(z.string()).optional(),
		endpoints: z.array(z.tuple([coordinateTuple, coordinateTuple])).optional(),
		group: z.string().optional(),
	})
	.refine((data) => data.ids || data.endpoints || data.group, {
		message: "At least one of ids, endpoints, or group must be provided",
	});
