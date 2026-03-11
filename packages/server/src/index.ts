// ============================================================
// @particle-engine/server — Public API
// ============================================================

// Main app factory
export { createApp } from './app.js';

// Session management
export { SessionManager } from './session-manager.js';
export type { SessionData } from './session-manager.js';

// Conversation loop
export { runConversation } from './conversation-loop.js';
export type { ConversationResult, ConversationEvent } from './conversation-loop.js';

// System prompt
export { buildSystemPrompt } from './system-prompt.js';

// Routes
export { createRoutes } from './routes.js';

// Types
export type {
	ServerConfig,
	SessionConfig,
	Session,
	LLMProvider,
	LLMEvent,
	Message,
	ToolCall,
	ToolCallResult,
	ProviderConfig,
} from './types.js';
