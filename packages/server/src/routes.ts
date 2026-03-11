// ============================================================
// Routes — Hono route definitions for the particle engine API
// ============================================================

import { Hono } from 'hono';
import { SVGRenderer } from '@particle-engine/renderer-svg';
import type { SessionManager } from './session-manager.js';
import type { LLMProvider, ProviderConfig, Message } from './types.js';
import { buildSystemPrompt } from './system-prompt.js';
import { runConversation } from './conversation-loop.js';

/**
 * Create all API routes.
 */
export function createRoutes(
	sessionManager: SessionManager,
	provider?: LLMProvider,
	providerConfig?: ProviderConfig,
): Hono {
	const api = new Hono();
	const svgRenderer = new SVGRenderer();

	// ── POST /api/sessions — Create a new session ──────────
	api.post('/api/sessions', async (c) => {
		let body: Record<string, unknown> = {};
		try {
			body = await c.req.json();
		} catch {
			// empty body is fine — use defaults
		}

		const { id, session } = sessionManager.createSession({
			rows: typeof body.rows === 'number' ? body.rows : undefined,
			cols: typeof body.cols === 'number' ? body.cols : undefined,
			spacing: typeof body.spacing === 'number' ? body.spacing : undefined,
		});

		return c.json({ id, config: session.config, createdAt: session.createdAt }, 201);
	});

	// ── GET /api/sessions — List all sessions ──────────────
	api.get('/api/sessions', (c) => {
		const sessions = sessionManager.listSessions();
		return c.json({ sessions });
	});

	// ── GET /api/sessions/:id — Get session with state ─────
	api.get('/api/sessions/:id', (c) => {
		const id = c.req.param('id');
		const data = sessionManager.getSession(id);
		if (!data) {
			return c.json({ error: 'Session not found' }, 404);
		}

		const state = data.executor.getGrid().getState();
		return c.json({ session: data.session, state });
	});

	// ── DELETE /api/sessions/:id — Delete a session ────────
	api.delete('/api/sessions/:id', (c) => {
		const id = c.req.param('id');
		const deleted = sessionManager.deleteSession(id);
		if (!deleted) {
			return c.json({ error: 'Session not found' }, 404);
		}
		return c.json({ success: true });
	});

	// ── POST /api/sessions/:id/tool — Execute a tool ───────
	api.post('/api/sessions/:id/tool', async (c) => {
		const id = c.req.param('id');
		const data = sessionManager.getSession(id);
		if (!data) {
			return c.json({ error: 'Session not found' }, 404);
		}

		let body: Record<string, unknown>;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: 'Invalid JSON body' }, 400);
		}

		const toolName = body.tool;
		const params = body.params;

		if (typeof toolName !== 'string') {
			return c.json({ error: 'Missing or invalid "tool" field' }, 400);
		}

		const result = data.executor.execute(
			toolName,
			(params && typeof params === 'object' && !Array.isArray(params))
				? params as Record<string, unknown>
				: {},
		);

		return c.json({ result });
	});

	// ── POST /api/sessions/:id/prompt — LLM conversation ───
	api.post('/api/sessions/:id/prompt', async (c) => {
		const id = c.req.param('id');
		const data = sessionManager.getSession(id);
		if (!data) {
			return c.json({ error: 'Session not found' }, 404);
		}

		if (!provider) {
			return c.json({ error: 'No LLM provider configured' }, 503);
		}

		let body: Record<string, unknown>;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: 'Invalid JSON body' }, 400);
		}

		const prompt = body.prompt;
		if (typeof prompt !== 'string' || !prompt.trim()) {
			return c.json({ error: 'Missing or empty "prompt" field' }, 400);
		}

		const config = (body.config && typeof body.config === 'object')
			? body.config as ProviderConfig
			: providerConfig;

		// Build messages
		const spaceInfo = data.executor.getGrid().getSpaceInfo();
		const systemPrompt = buildSystemPrompt(spaceInfo);

		const messages: Message[] = [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: prompt },
		];

		const tools = data.executor.getToolDefinitions();

		const result = await runConversation(
			provider,
			data.executor,
			messages,
			tools,
			config,
		);

		return c.json({
			messages: result.messages,
			toolCallCount: result.toolCallCount,
			usage: result.usage,
		});
	});

	// ── GET /api/sessions/:id/render — Render as SVG ───────
	api.get('/api/sessions/:id/render', (c) => {
		const id = c.req.param('id');
		const data = sessionManager.getSession(id);
		if (!data) {
			return c.json({ error: 'Session not found' }, 404);
		}

		const query = c.req.query();

		const width = query.width ? parseInt(query.width, 10) : 800;
		const height = query.height ? parseInt(query.height, 10) : 800;
		const backgroundColor = query.backgroundColor || '#000000';
		const padding = query.padding ? parseInt(query.padding, 10) : 20;

		const state = data.executor.getGrid().getState();
		const result = svgRenderer.render(state, {
			width,
			height,
			backgroundColor,
			padding,
		});

		return c.body(result.svg, 200, {
			'Content-Type': 'image/svg+xml',
		});
	});

	return api;
}
