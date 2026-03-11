// ============================================================
// Types — Client-specific interfaces for @particle-engine/client
// ============================================================

import type { SpaceState } from '@particle-engine/core';

/** Configuration for the client application */
export interface ClientConfig {
	/** Server base URL, default 'http://localhost:3000' */
	serverUrl: string;
	/** Canvas width in pixels, default 800 */
	canvasWidth?: number;
	/** Canvas height in pixels, default 800 */
	canvasHeight?: number;
	/** Grid rows, default 100 */
	gridRows?: number;
	/** Grid columns, default 100 */
	gridCols?: number;
	/** Grid spacing, default 10 */
	gridSpacing?: number;
	/** Background color, default '#000000' */
	backgroundColor?: string;
	/** Padding in pixels around the grid, default 20 */
	padding?: number;
}

// ── Server API response types ──────────────────────────────

/** Response from POST /api/sessions and list items */
export interface SessionResponse {
	id: string;
	createdAt: number;
	config: { rows: number; cols: number; spacing: number };
}

/** Response from GET /api/sessions/:id */
export interface SessionStateResponse {
	session: SessionResponse;
	state: SpaceState;
}

/** Response from POST /api/sessions/:id/tool */
export interface ToolResponse {
	success: boolean;
	data?: unknown;
	error?: string;
}

/** A tool call within a prompt response */
export interface PromptToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

/** A tool result within a prompt response */
export interface PromptToolResult {
	toolCallId: string;
	name: string;
	result: ToolResponse;
}

/** A message within a prompt response */
export interface PromptMessage {
	role: string;
	content?: string;
	toolCalls?: PromptToolCall[];
	toolResults?: PromptToolResult[];
}

/** Response from POST /api/sessions/:id/prompt */
export interface PromptResponse {
	messages: PromptMessage[];
	toolCallCount: number;
	usage: { inputTokens: number; outputTokens: number };
}
