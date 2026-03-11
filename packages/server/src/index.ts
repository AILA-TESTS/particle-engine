// ============================================================
// @particle-engine/server — Public API
// ============================================================

// Main app factory
export { createApp, createAppWithWebSocket } from './app.js';
export type { AppWithWebSocket } from './app.js';

// Session management
export { SessionManager } from './session-manager.js';
export type { SessionData, SessionManagerConfig } from './session-manager.js';

// Conversation loop
export { runConversation } from './conversation-loop.js';
export type { ConversationResult, ConversationEvent } from './conversation-loop.js';

// WebSocket handler
export { WSConnectionHandler, createWSHandler } from './ws-handler.js';
export type { ClientMessage, ServerMessage } from './ws-handler.js';

// System prompt
export { buildSystemPrompt } from './system-prompt.js';

// Routes
export { createRoutes } from './routes.js';

// Types
export type {
	ServerConfig,
	SessionConfig,
	Session,
	PersistenceConfig,
	PersistedSessionData,
	LLMProvider,
	LLMEvent,
	Message,
	ToolCall,
	ToolCallResult,
	ProviderConfig,
} from './types.js';
