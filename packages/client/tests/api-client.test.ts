// ============================================================
// Tests — ApiClient (mock fetch)
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiClient } from '../src/api-client.js';

// ── Helpers ─────────────────────────────────────────────────

function mockFetchResponse(body: unknown, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(body),
		text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
	} as Response;
}

describe('ApiClient', () => {
	let client: ApiClient;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		client = new ApiClient('http://localhost:3000');
		originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	// ── createSession ───────────────────────────────────────

	describe('createSession', () => {
		it('sends POST /api/sessions with config body', async () => {
			const sessionData = {
				id: 'sess-1',
				createdAt: 1000,
				config: { rows: 50, cols: 50, spacing: 10 },
			};
			vi.mocked(globalThis.fetch).mockResolvedValue(
				mockFetchResponse(sessionData, 201),
			);

			const result = await client.createSession({ rows: 50, cols: 50, spacing: 10 });

			expect(globalThis.fetch).toHaveBeenCalledWith(
				'http://localhost:3000/api/sessions',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ rows: 50, cols: 50, spacing: 10 }),
				},
			);
			expect(result).toEqual(sessionData);
		});

		it('sends empty object when no config provided', async () => {
			const sessionData = {
				id: 'sess-2',
				createdAt: 1000,
				config: { rows: 100, cols: 100, spacing: 10 },
			};
			vi.mocked(globalThis.fetch).mockResolvedValue(
				mockFetchResponse(sessionData, 201),
			);

			await client.createSession();

			expect(globalThis.fetch).toHaveBeenCalledWith(
				'http://localhost:3000/api/sessions',
				expect.objectContaining({
					body: JSON.stringify({}),
				}),
			);
		});
	});

	// ── getSession ──────────────────────────────────────────

	describe('getSession', () => {
		it('sends GET /api/sessions/:id', async () => {
			const data = {
				session: { id: 'sess-1', createdAt: 1000, config: { rows: 100, cols: 100, spacing: 10 } },
				state: {
					grid: { rows: 100, cols: 100, spacing: 10 },
					summary: { active_count: 0, connection_count: 0, groups: [] },
					particles: [],
					connections: [],
				},
			};
			vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse(data));

			const result = await client.getSession('sess-1');

			expect(globalThis.fetch).toHaveBeenCalledWith(
				'http://localhost:3000/api/sessions/sess-1',
			);
			expect(result).toEqual(data);
		});
	});

	// ── listSessions ────────────────────────────────────────

	describe('listSessions', () => {
		it('sends GET /api/sessions', async () => {
			const data = { sessions: [] };
			vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse(data));

			const result = await client.listSessions();

			expect(globalThis.fetch).toHaveBeenCalledWith(
				'http://localhost:3000/api/sessions',
			);
			expect(result).toEqual(data);
		});
	});

	// ── deleteSession ───────────────────────────────────────

	describe('deleteSession', () => {
		it('sends DELETE /api/sessions/:id', async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(
				mockFetchResponse({ success: true }),
			);

			await client.deleteSession('sess-1');

			expect(globalThis.fetch).toHaveBeenCalledWith(
				'http://localhost:3000/api/sessions/sess-1',
				{ method: 'DELETE' },
			);
		});
	});

	// ── executeTool ─────────────────────────────────────────

	describe('executeTool', () => {
		it('sends POST /api/sessions/:id/tool with tool name and params', async () => {
			const toolResult = { success: true, data: { count: 5 } };
			vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse(toolResult));

			const result = await client.executeTool('sess-1', 'add_particles', {
				positions: [[0, 0], [1, 1]],
			});

			expect(globalThis.fetch).toHaveBeenCalledWith(
				'http://localhost:3000/api/sessions/sess-1/tool',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						tool: 'add_particles',
						params: { positions: [[0, 0], [1, 1]] },
					}),
				},
			);
			expect(result).toEqual(toolResult);
		});
	});

	// ── sendPrompt ──────────────────────────────────────────

	describe('sendPrompt', () => {
		it('sends POST /api/sessions/:id/prompt with prompt string', async () => {
			const promptResult = {
				messages: [{ role: 'assistant', content: 'Done!' }],
				toolCallCount: 2,
				usage: { inputTokens: 100, outputTokens: 50 },
			};
			vi.mocked(globalThis.fetch).mockResolvedValue(
				mockFetchResponse(promptResult),
			);

			const result = await client.sendPrompt('sess-1', 'Draw a circle');

			expect(globalThis.fetch).toHaveBeenCalledWith(
				'http://localhost:3000/api/sessions/sess-1/prompt',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ prompt: 'Draw a circle' }),
				},
			);
			expect(result).toEqual(promptResult);
		});
	});

	// ── renderSvg ───────────────────────────────────────────

	describe('renderSvg', () => {
		it('sends GET /api/sessions/:id/render and returns SVG string', async () => {
			const svgString = '<svg></svg>';
			vi.mocked(globalThis.fetch).mockResolvedValue(
				mockFetchResponse(svgString),
			);

			const result = await client.renderSvg('sess-1');

			expect(globalThis.fetch).toHaveBeenCalledWith(
				'http://localhost:3000/api/sessions/sess-1/render',
			);
			expect(result).toBe(svgString);
		});

		it('includes width and height as query parameters', async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(
				mockFetchResponse('<svg></svg>'),
			);

			await client.renderSvg('sess-1', { width: 1024, height: 768 });

			const call = vi.mocked(globalThis.fetch).mock.calls[0];
			const url = call[0] as string;
			expect(url).toContain('width=1024');
			expect(url).toContain('height=768');
		});
	});

	// ── Error handling ──────────────────────────────────────

	describe('error handling', () => {
		it('throws with error message from JSON body on non-2xx', async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(
				mockFetchResponse({ error: 'Session not found' }, 404),
			);

			await expect(client.getSession('bad-id')).rejects.toThrow('Session not found');
		});

		it('throws with HTTP status when body has no error field', async () => {
			const res = {
				ok: false,
				status: 500,
				json: () => Promise.resolve({}),
				text: () => Promise.resolve(''),
			} as Response;
			vi.mocked(globalThis.fetch).mockResolvedValue(res);

			await expect(client.listSessions()).rejects.toThrow('HTTP 500');
		});

		it('throws with HTTP status when body is not valid JSON', async () => {
			const res = {
				ok: false,
				status: 502,
				json: () => Promise.reject(new Error('Invalid JSON')),
				text: () => Promise.resolve('Bad Gateway'),
			} as Response;
			vi.mocked(globalThis.fetch).mockResolvedValue(res);

			await expect(client.listSessions()).rejects.toThrow('HTTP 502');
		});
	});

	// ── Base URL handling ───────────────────────────────────

	describe('base URL', () => {
		it('strips trailing slash from base URL', async () => {
			const clientTrailing = new ApiClient('http://localhost:3000/');
			vi.mocked(globalThis.fetch).mockResolvedValue(
				mockFetchResponse({ sessions: [] }),
			);

			await clientTrailing.listSessions();

			expect(globalThis.fetch).toHaveBeenCalledWith(
				'http://localhost:3000/api/sessions',
			);
		});
	});
});
