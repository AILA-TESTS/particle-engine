// ============================================================
// System Prompt — Build the LLM system prompt from grid info
// ============================================================

import type { SpaceInfo } from '@particle-engine/core';

/**
 * Build the system prompt that contextualises the LLM with grid state.
 */
export function buildSystemPrompt(gridInfo: SpaceInfo): string {
	return `You are a visual creation assistant. You have access to a 2D particle grid space with ${gridInfo.rows} rows and ${gridInfo.cols} columns of evenly-spaced dots.

You can:
- Activate particles at specific grid coordinates (row, col)
- Connect particles with lines
- Create animations with keyframes
- Render images and videos

The grid uses 0-indexed integer coordinates. Row 0 is the top, row ${gridInfo.rows - 1} is the bottom. Column 0 is the left, column ${gridInfo.cols - 1} is the right.

Current state: ${gridInfo.activeCount} active particles, ${gridInfo.connectionCount} connections.

To create any visual, you place individual particles at exact grid positions using set_particles, then connect them with lines using connect. You have full control over every particle and every connection — there are no pre-built shape primitives.`;
}
