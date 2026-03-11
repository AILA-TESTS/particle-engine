// ============================================================
// ApiClient — HTTP client for the particle engine server API
// ============================================================

import type {
	SessionResponse,
	SessionStateResponse,
	ToolResponse,
	PromptResponse,
} from './types.js';

/**
 * HTTP client for communicating with the particle engine server.
 *
 * All methods throw on non-2xx responses with the error message from
 * the response body.
 */
export class ApiClient {
	private baseUrl: string;

	constructor(baseUrl: string) {
		// Strip trailing slash
		this.baseUrl = baseUrl.replace(/\/+$/, '');
	}

	/**
	 * Create a new session.
	 */
	async createSession(
		config?: { rows?: number; cols?: number; spacing?: number },
	): Promise<SessionResponse> {
		const res = await fetch(`${this.baseUrl}/api/sessions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(config ?? {}),
		});
		await this.assertOk(res);
		return res.json();
	}

	/**
	 * Get a session with its current state.
	 */
	async getSession(id: string): Promise<SessionStateResponse> {
		const res = await fetch(`${this.baseUrl}/api/sessions/${id}`);
		await this.assertOk(res);
		return res.json();
	}

	/**
	 * List all sessions.
	 */
	async listSessions(): Promise<{ sessions: SessionResponse[] }> {
		const res = await fetch(`${this.baseUrl}/api/sessions`);
		await this.assertOk(res);
		return res.json();
	}

	/**
	 * Delete a session.
	 */
	async deleteSession(id: string): Promise<void> {
		const res = await fetch(`${this.baseUrl}/api/sessions/${id}`, {
			method: 'DELETE',
		});
		await this.assertOk(res);
	}

	/**
	 * Execute a tool on a session.
	 */
	async executeTool(
		sessionId: string,
		tool: string,
		params: Record<string, unknown>,
	): Promise<ToolResponse> {
		const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/tool`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tool, params }),
		});
		await this.assertOk(res);
		return res.json();
	}

	/**
	 * Send a prompt to the LLM via the server.
	 */
	async sendPrompt(sessionId: string, prompt: string): Promise<PromptResponse> {
		const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/prompt`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prompt }),
		});
		await this.assertOk(res);
		return res.json();
	}

	/**
	 * Render a session as SVG.
	 */
	async renderSvg(
		sessionId: string,
		options?: { width?: number; height?: number },
	): Promise<string> {
		const params = new URLSearchParams();
		if (options?.width) params.set('width', String(options.width));
		if (options?.height) params.set('height', String(options.height));

		const query = params.toString();
		const url = `${this.baseUrl}/api/sessions/${sessionId}/render${query ? `?${query}` : ''}`;
		const res = await fetch(url);
		await this.assertOk(res);
		return res.text();
	}

	/**
	 * Assert the response is OK (2xx), or throw with the error message.
	 */
	private async assertOk(res: Response): Promise<void> {
		if (!res.ok) {
			let message = `HTTP ${res.status}`;
			try {
				const body = await res.json();
				if (body && typeof body.error === 'string') {
					message = body.error;
				}
			} catch {
				// Ignore JSON parse errors — use status code message
			}
			throw new Error(message);
		}
	}
}
