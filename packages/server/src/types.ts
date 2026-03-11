// ============================================================
// Types — All interfaces and type definitions for @particle-engine/server
// ============================================================

import type { ToolDefinition, ToolResult } from '@particle-engine/tools';

// ── LLM Provider types ─────────────────────────────────────
// Re-exported from @particle-engine/tools for convenience

export type {
	LLMProvider,
	LLMEvent,
	Message,
	ToolCall,
	ToolCallResult,
	ProviderConfig,
} from '@particle-engine/tools';

// ── Session types ───────────────────────────────────────────

/** Configuration for creating a new session */
export interface SessionConfig {
	rows?: number;      // default 100
	cols?: number;      // default 100
	spacing?: number;   // default 10
}

/** Session metadata (no grid data) */
export interface Session {
	id: string;
	createdAt: number;
	config: Required<SessionConfig>;
}

// ── Server configuration ────────────────────────────────────

/** Configuration for the server */
export interface ServerConfig {
	port?: number;            // default 3000
	provider?: import('@particle-engine/tools').LLMProvider;
	defaultGridRows?: number;
	defaultGridCols?: number;
	defaultGridSpacing?: number;
	providerConfig?: import('@particle-engine/tools').ProviderConfig;
}
