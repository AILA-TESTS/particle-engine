// ============================================================
// App — Create and configure the Hono application
// ============================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SessionManager } from './session-manager.js';
import { createRoutes } from './routes.js';
import { createWSHandler } from './ws-handler.js';
import type { ServerConfig } from './types.js';

/** Result of creating the app — includes both HTTP app and WS handler */
export interface AppWithWebSocket {
	/** The Hono HTTP application */
	app: Hono;
	/** The session manager (shared between HTTP and WS) */
	sessionManager: SessionManager;
	/** Factory function: call with a WebSocket to handle it */
	wsHandler: (ws: import('ws').WebSocket) => void;
}

/**
 * Create a configured Hono app with all routes mounted.
 */
export function createApp(config?: ServerConfig): Hono {
	const { app } = createAppWithWebSocket(config);
	return app;
}

/**
 * Create a configured Hono app + WebSocket handler.
 * Both share the same SessionManager so WS clients can interact
 * with the same sessions as HTTP clients.
 */
export function createAppWithWebSocket(config?: ServerConfig): AppWithWebSocket {
	const app = new Hono();

	// Enable CORS for all origins (development mode)
	app.use('*', cors());

	// Create session manager with default grid dimensions and optional persistence
	const sessionManager = new SessionManager({
		rows: config?.defaultGridRows,
		cols: config?.defaultGridCols,
		spacing: config?.defaultGridSpacing,
		persistence: config?.persistence,
	});

	// Create and mount HTTP routes
	const routes = createRoutes(
		sessionManager,
		config?.provider,
		config?.providerConfig,
	);

	app.route('/', routes);

	// Create WebSocket connection handler
	const wsHandler = createWSHandler(
		sessionManager,
		config?.provider,
		config?.providerConfig,
	);

	return { app, sessionManager, wsHandler };
}
