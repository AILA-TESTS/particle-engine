import { describe, it, expect } from 'vitest';
import { createApp, createAppWithWebSocket } from '../src/app.js';
import type { LLMProvider, LLMEvent, Message, ToolCall, ProviderConfig } from '../src/types.js';
import type { ToolDefinition, ToolResult } from '@particle-engine/tools';

// ── Helper: make a mock LLM provider ───────────────────────

function createMockProvider(rounds: LLMEvent[][], onStream?: (messages: Message[]) => void): LLMProvider {
	let roundIndex = 0;

	return {
		name: 'mock',

		formatTools(tools: ToolDefinition[]): unknown {
			return tools;
		},

		stream(
			_messages: Message[],
			_tools: ToolDefinition[],
			_config?: ProviderConfig,
		): AsyncIterable<LLMEvent> {
			if (onStream) onStream(_messages);
			const events = rounds[roundIndex] ?? [];
			roundIndex++;

			return {
				[Symbol.asyncIterator]() {
					let i = 0;
					return {
						async next() {
							if (i < events.length) {
								return { value: events[i++], done: false };
							}
							return { value: undefined as unknown as LLMEvent, done: true };
						},
					};
				},
			};
		},

		parseToolCall(raw: unknown): ToolCall {
			return raw as ToolCall;
		},

		formatToolResult(_name: string, result: ToolResult): unknown {
			return result;
		},
	};
}

// ── Helper: capturing mock provider (records messages passed to stream) ──

function createCapturingProvider(onStream: (messages: Message[]) => void): LLMProvider {
	return createMockProvider([
		[
			{ type: 'text', content: 'ok' },
			{ type: 'done', usage: { inputTokens: 1, outputTokens: 1 } },
		],
	], (msgs) => onStream([...msgs]));
}

// ── Helper: JSON request ────────────────────────────────────

function jsonRequest(method: string, path: string, body?: unknown): Request {
	const init: RequestInit = {
		method,
		headers: { 'Content-Type': 'application/json' },
	};
	if (body !== undefined) {
		init.body = JSON.stringify(body);
	}
	return new Request(`http://localhost${path}`, init);
}

describe('Routes', () => {
	// ── POST /api/sessions ──────────────────────────────────

	describe('POST /api/sessions', () => {
		it('creates a session with defaults', async () => {
			const app = createApp();
			const res = await app.request(jsonRequest('POST', '/api/sessions', {}));

			expect(res.status).toBe(201);
			const data = await res.json();
			expect(data.id).toMatch(/^s_\d+_[0-9a-f]+$/);
			expect(data.config).toEqual({ rows: 100, cols: 100, spacing: 10 });
			expect(data.createdAt).toBeGreaterThan(0);
		});

		it('creates a session with custom config', async () => {
			const app = createApp();
			const res = await app.request(
				jsonRequest('POST', '/api/sessions', { rows: 50, cols: 50, spacing: 5 }),
			);

			expect(res.status).toBe(201);
			const data = await res.json();
			expect(data.config).toEqual({ rows: 50, cols: 50, spacing: 5 });
		});

		it('uses server default config', async () => {
			const app = createApp({
				defaultGridRows: 20,
				defaultGridCols: 30,
				defaultGridSpacing: 8,
			});
			const res = await app.request(jsonRequest('POST', '/api/sessions', {}));

			expect(res.status).toBe(201);
			const data = await res.json();
			expect(data.config).toEqual({ rows: 20, cols: 30, spacing: 8 });
		});
	});

	// ── GET /api/sessions ───────────────────────────────────

	describe('GET /api/sessions', () => {
		it('returns empty list initially', async () => {
			const app = createApp();
			const res = await app.request(new Request('http://localhost/api/sessions'));

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.sessions).toEqual([]);
		});

		it('returns all created sessions', async () => {
			const app = createApp();
			await app.request(jsonRequest('POST', '/api/sessions', {}));
			await app.request(jsonRequest('POST', '/api/sessions', { rows: 50 }));

			const res = await app.request(new Request('http://localhost/api/sessions'));
			const data = await res.json();

			expect(data.sessions).toHaveLength(2);
		});
	});

	// ── GET /api/sessions/:id ───────────────────────────────

	describe('GET /api/sessions/:id', () => {
		it('returns session with state', async () => {
			const app = createApp();
			const createRes = await app.request(jsonRequest('POST', '/api/sessions', { rows: 10, cols: 10, spacing: 10 }));
			const { id } = await createRes.json();

			const res = await app.request(new Request(`http://localhost/api/sessions/${id}`));

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.session.id).toBe(id);
			expect(data.state).toBeDefined();
			expect(data.state.grid).toEqual({ rows: 10, cols: 10, spacing: 10 });
		});

		it('returns 404 for non-existent session', async () => {
			const app = createApp();
			const res = await app.request(new Request('http://localhost/api/sessions/s_nonexistent'));

			expect(res.status).toBe(404);
			const data = await res.json();
			expect(data.error).toBe('Session not found');
		});
	});

	// ── DELETE /api/sessions/:id ────────────────────────────

	describe('DELETE /api/sessions/:id', () => {
		it('deletes an existing session', async () => {
			const app = createApp();
			const createRes = await app.request(jsonRequest('POST', '/api/sessions', {}));
			const { id } = await createRes.json();

			const res = await app.request(
				new Request(`http://localhost/api/sessions/${id}`, { method: 'DELETE' }),
			);

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.success).toBe(true);

			// Verify it's gone
			const getRes = await app.request(new Request(`http://localhost/api/sessions/${id}`));
			expect(getRes.status).toBe(404);
		});

		it('returns 404 for non-existent session', async () => {
			const app = createApp();
			const res = await app.request(
				new Request('http://localhost/api/sessions/s_nonexistent', { method: 'DELETE' }),
			);

			expect(res.status).toBe(404);
		});
	});

	// ── POST /api/sessions/:id/tool ─────────────────────────

	describe('POST /api/sessions/:id/tool', () => {
		it('executes a tool and returns result', async () => {
			const app = createApp();
			const createRes = await app.request(jsonRequest('POST', '/api/sessions', { rows: 10, cols: 10, spacing: 10 }));
			const { id } = await createRes.json();

			const res = await app.request(
				jsonRequest('POST', `/api/sessions/${id}/tool`, {
					tool: 'get_space_info',
					params: {},
				}),
			);

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.result.success).toBe(true);
			expect(data.result.data.rows).toBe(10);
		});

		it('executes set_particles tool', async () => {
			const app = createApp();
			const createRes = await app.request(jsonRequest('POST', '/api/sessions', { rows: 10, cols: 10, spacing: 10 }));
			const { id } = await createRes.json();

			const res = await app.request(
				jsonRequest('POST', `/api/sessions/${id}/tool`, {
					tool: 'set_particles',
					params: {
						particles: [
							{ row: 0, col: 0, color: '#FF0000' },
							{ row: 1, col: 1, color: '#00FF00' },
						],
					},
				}),
			);

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.result.success).toBe(true);

			// Verify state
			const stateRes = await app.request(
				jsonRequest('POST', `/api/sessions/${id}/tool`, {
					tool: 'get_space_info',
					params: {},
				}),
			);
			const stateData = await stateRes.json();
			expect(stateData.result.data.activeCount).toBe(2);
		});

		it('returns error result for invalid tool', async () => {
			const app = createApp();
			const createRes = await app.request(jsonRequest('POST', '/api/sessions', { rows: 10, cols: 10, spacing: 10 }));
			const { id } = await createRes.json();

			const res = await app.request(
				jsonRequest('POST', `/api/sessions/${id}/tool`, {
					tool: 'nonexistent_tool',
					params: {},
				}),
			);

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.result.success).toBe(false);
			expect(data.result.error).toContain('Unknown tool');
		});

		it('returns 404 for non-existent session', async () => {
			const app = createApp();
			const res = await app.request(
				jsonRequest('POST', '/api/sessions/s_nonexistent/tool', {
					tool: 'get_space_info',
					params: {},
				}),
			);

			expect(res.status).toBe(404);
		});

		it('returns 400 for missing tool field', async () => {
			const app = createApp();
			const createRes = await app.request(jsonRequest('POST', '/api/sessions', { rows: 10, cols: 10, spacing: 10 }));
			const { id } = await createRes.json();

			const res = await app.request(
				jsonRequest('POST', `/api/sessions/${id}/tool`, { params: {} }),
			);

			expect(res.status).toBe(400);
		});
	});

	// ── POST /api/sessions/:id/prompt ───────────────────────

	describe('POST /api/sessions/:id/prompt', () => {
		it('returns 503 when no provider configured', async () => {
			const app = createApp();
			const createRes = await app.request(jsonRequest('POST', '/api/sessions', { rows: 10, cols: 10, spacing: 10 }));
			const { id } = await createRes.json();

			const res = await app.request(
				jsonRequest('POST', `/api/sessions/${id}/prompt`, {
					prompt: 'Draw a circle',
				}),
			);

			expect(res.status).toBe(503);
			const data = await res.json();
			expect(data.error).toBe('No LLM provider configured');
		});

		it('runs conversation with mock provider', async () => {
			const provider = createMockProvider([
				[
					{
						type: 'tool_call', id: 'tc1', name: 'set_particles',
						arguments: { particles: [{ row: 0, col: 0, color: '#FF0000' }] },
					},
					{ type: 'done', usage: { inputTokens: 20, outputTokens: 10 } },
				],
				[
					{ type: 'text', content: 'Done!' },
					{ type: 'done', usage: { inputTokens: 30, outputTokens: 5 } },
				],
			]);

			const app = createApp({ provider });
			const createRes = await app.request(jsonRequest('POST', '/api/sessions', { rows: 10, cols: 10, spacing: 10 }));
			const { id } = await createRes.json();

			const res = await app.request(
				jsonRequest('POST', `/api/sessions/${id}/prompt`, {
					prompt: 'Place a red dot',
				}),
			);

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.toolCallCount).toBe(1);
			expect(data.usage.inputTokens).toBe(50);
			expect(data.usage.outputTokens).toBe(15);
			expect(data.messages.length).toBeGreaterThan(2);
		});

		it('returns 404 for non-existent session', async () => {
			const provider = createMockProvider([]);
			const app = createApp({ provider });

			const res = await app.request(
				jsonRequest('POST', '/api/sessions/s_nonexistent/prompt', {
					prompt: 'Hi',
				}),
			);

			expect(res.status).toBe(404);
		});

		it('returns 400 for missing prompt', async () => {
			const provider = createMockProvider([]);
			const app = createApp({ provider });
			const createRes = await app.request(jsonRequest('POST', '/api/sessions', { rows: 10, cols: 10, spacing: 10 }));
			const { id } = await createRes.json();

			const res = await app.request(
				jsonRequest('POST', `/api/sessions/${id}/prompt`, {}),
			);

			expect(res.status).toBe(400);
		});

		it('does not drop first message when history has no leading system message', async () => {
			let capturedMessages: Message[] = [];
			const provider = createCapturingProvider((msgs) => { capturedMessages = msgs; });

			const { app, sessionManager } = createAppWithWebSocket({ provider });
			const createRes = await app.request(jsonRequest('POST', '/api/sessions', { rows: 10, cols: 10, spacing: 10 }));
			const { id } = await createRes.json();

			// Seed messages WITHOUT a leading system message (simulates a provider that doesn't return it)
			sessionManager.updateMessages(id, [
				{ role: 'user', content: 'first user message' },
				{ role: 'assistant', content: 'first response' },
			]);

			await app.request(
				jsonRequest('POST', `/api/sessions/${id}/prompt`, { prompt: 'second question' }),
			);

			// The first message should be system (freshly built)
			expect(capturedMessages[0].role).toBe('system');
			// The seeded user message must NOT be dropped
			expect(capturedMessages[1]).toEqual({ role: 'user', content: 'first user message' });
			expect(capturedMessages[2]).toEqual({ role: 'assistant', content: 'first response' });
			// The new prompt is last
			expect(capturedMessages[capturedMessages.length - 1]).toEqual({ role: 'user', content: 'second question' });
		});

		it('correctly strips leading system message from history', async () => {
			let capturedMessages: Message[] = [];
			const provider = createCapturingProvider((msgs) => { capturedMessages = msgs; });

			const { app, sessionManager } = createAppWithWebSocket({ provider });
			const createRes = await app.request(jsonRequest('POST', '/api/sessions', { rows: 10, cols: 10, spacing: 10 }));
			const { id } = await createRes.json();

			// Seed messages WITH a leading system message (normal case)
			sessionManager.updateMessages(id, [
				{ role: 'system', content: 'old system prompt' },
				{ role: 'user', content: 'first user message' },
				{ role: 'assistant', content: 'first response' },
			]);

			await app.request(
				jsonRequest('POST', `/api/sessions/${id}/prompt`, { prompt: 'second question' }),
			);

			// The old system prompt should be replaced, not duplicated
			expect(capturedMessages[0].role).toBe('system');
			expect(capturedMessages[0].content).not.toBe('old system prompt');
			// History should follow
			expect(capturedMessages[1]).toEqual({ role: 'user', content: 'first user message' });
			expect(capturedMessages[2]).toEqual({ role: 'assistant', content: 'first response' });
			expect(capturedMessages[capturedMessages.length - 1]).toEqual({ role: 'user', content: 'second question' });
			// No duplicate system messages
			const systemMessages = capturedMessages.filter((m) => m.role === 'system');
			expect(systemMessages).toHaveLength(1);
		});
	});

	// ── GET /api/sessions/:id/render ────────────────────────

	describe('GET /api/sessions/:id/render', () => {
		it('renders SVG for empty grid', async () => {
			const app = createApp();
			const createRes = await app.request(jsonRequest('POST', '/api/sessions', { rows: 10, cols: 10, spacing: 10 }));
			const { id } = await createRes.json();

			const res = await app.request(
				new Request(`http://localhost/api/sessions/${id}/render`),
			);

			expect(res.status).toBe(200);
			expect(res.headers.get('Content-Type')).toContain('image/svg+xml');
			const svg = await res.text();
			expect(svg).toContain('<svg');
			expect(svg).toContain('</svg>');
		});

		it('renders SVG with custom dimensions', async () => {
			const app = createApp();
			const createRes = await app.request(jsonRequest('POST', '/api/sessions', { rows: 10, cols: 10, spacing: 10 }));
			const { id } = await createRes.json();

			const res = await app.request(
				new Request(`http://localhost/api/sessions/${id}/render?width=400&height=300`),
			);

			expect(res.status).toBe(200);
			const svg = await res.text();
			expect(svg).toContain('width="400"');
			expect(svg).toContain('height="300"');
		});

		it('renders SVG with particles', async () => {
			const app = createApp();
			const createRes = await app.request(jsonRequest('POST', '/api/sessions', { rows: 10, cols: 10, spacing: 10 }));
			const { id } = await createRes.json();

			// Add a particle
			await app.request(
				jsonRequest('POST', `/api/sessions/${id}/tool`, {
					tool: 'set_particles',
					params: { particles: [{ row: 0, col: 0, color: '#FF0000' }] },
				}),
			);

			const res = await app.request(
				new Request(`http://localhost/api/sessions/${id}/render`),
			);

			expect(res.status).toBe(200);
			const svg = await res.text();
			expect(svg).toContain('<svg');
			// Should contain a circle element for the particle
			expect(svg).toContain('<circle');
		});

		it('returns 404 for non-existent session', async () => {
			const app = createApp();
			const res = await app.request(
				new Request('http://localhost/api/sessions/s_nonexistent/render'),
			);

			expect(res.status).toBe(404);
		});
	});

	// ── CORS ────────────────────────────────────────────────

	describe('CORS', () => {
		it('includes CORS headers', async () => {
			const app = createApp();
			const res = await app.request(
				new Request('http://localhost/api/sessions', {
					method: 'OPTIONS',
					headers: {
						'Origin': 'http://example.com',
						'Access-Control-Request-Method': 'POST',
					},
				}),
			);

			// Hono CORS middleware should set these
			expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
		});
	});
});
