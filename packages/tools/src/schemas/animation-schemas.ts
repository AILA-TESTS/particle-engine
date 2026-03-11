import { z } from "zod";

const keyframeSchema = z.object({
	time: z.number().min(0),
	targets: z
		.array(
			z.object({
				row: z.number().int(),
				col: z.number().int(),
				color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
				opacity: z.number().min(0).max(1).optional(),
				size: z.number().positive().optional(),
			}),
		)
		.min(1),
	easing: z.string().optional(),
});

const eventSchema = z.object({
	time: z.number().min(0),
	type: z.string(),
	params: z.record(z.unknown()).optional(),
});

export const createAnimationSchema = z.object({
	duration: z.number().positive("Duration must be positive"),
	fps: z.number().int().positive().max(120, "FPS must be at most 120"),
	keyframes: z.array(keyframeSchema).min(1, "At least one keyframe required"),
	events: z.array(eventSchema).optional(),
	defaultEasing: z.string().optional(),
});

export const modifyAnimationSchema = z.object({
	id: z.string(),
	keyframes: z.array(keyframeSchema).optional(),
	duration: z.number().positive().optional(),
	fps: z.number().int().positive().max(120).optional(),
	events: z.array(eventSchema).optional(),
	defaultEasing: z.string().optional(),
});
