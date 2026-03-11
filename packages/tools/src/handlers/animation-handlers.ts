import { createAnimationSchema, modifyAnimationSchema } from "../schemas/index.js";
import type { Animation, ToolResult } from "../types.js";
import { validateParams } from "../validation.js";

export function handleCreateAnimation(
	animations: Map<string, Animation>,
	nextId: { value: number },
	params: Record<string, unknown>,
): ToolResult {
	const validation = validateParams(createAnimationSchema, params);
	if (!validation.success) return validation.result;

	const data = validation.data;
	const id = `anim_${nextId.value++}`;

	const animation: Animation = {
		id,
		duration: data.duration,
		fps: data.fps,
		keyframes: data.keyframes,
		events: data.events ?? [],
		defaultEasing: data.defaultEasing ?? "linear",
	};

	animations.set(id, animation);

	return {
		success: true,
		data: { id, duration: animation.duration, fps: animation.fps, keyframeCount: animation.keyframes.length },
	};
}

export function handleModifyAnimation(
	animations: Map<string, Animation>,
	params: Record<string, unknown>,
): ToolResult {
	const validation = validateParams(modifyAnimationSchema, params);
	if (!validation.success) return validation.result;

	const data = validation.data;
	const animation = animations.get(data.id);

	if (!animation) {
		return { success: false, error: `Animation '${data.id}' not found` };
	}

	if (data.duration !== undefined) animation.duration = data.duration;
	if (data.fps !== undefined) animation.fps = data.fps;
	if (data.defaultEasing !== undefined) animation.defaultEasing = data.defaultEasing;
	if (data.events !== undefined) animation.events = data.events;

	if (data.keyframes) {
		for (const kf of data.keyframes) {
			const existingIndex = animation.keyframes.findIndex((k) => k.time === kf.time);
			if (existingIndex >= 0) {
				animation.keyframes[existingIndex] = kf;
			} else {
				animation.keyframes.push(kf);
			}
		}
		animation.keyframes.sort((a, b) => a.time - b.time);
	}

	return {
		success: true,
		data: {
			id: animation.id,
			duration: animation.duration,
			fps: animation.fps,
			keyframeCount: animation.keyframes.length,
		},
	};
}
