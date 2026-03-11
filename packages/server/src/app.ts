// ============================================================
// App — Create and configure the Hono application
// ============================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SessionManager } from './session-manager.js';
import { createRoutes } from './routes.js';
import type { ServerConfig } from './types.js';

/**
 * Create a configured Hono app with all routes mounted.
 */
export function createApp(config?: ServerConfig): Hono {
	const app = new Hono();

	// Enable CORS for all origins (development mode)
	app.use('*', cors());

	// Create session manager with default grid dimensions
	const sessionManager = new SessionManager({
		rows: config?.defaultGridRows,
		cols: config?.defaultGridCols,
		spacing: config?.defaultGridSpacing,
	});

	// Create and mount routes
	const routes = createRoutes(
		sessionManager,
		config?.provider,
		config?.providerConfig,
	);

	app.route('/', routes);

	return app;
}
