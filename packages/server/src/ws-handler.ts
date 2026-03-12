// ============================================================
// WebSocket Handler — Real-time streaming for the particle engine
// ============================================================

import type { WebSocket } from 'ws';
import type { SessionManager } from './session-manager.js';
import type { LLMProvider, ProviderConfig, Message } from './types.js';
import { buildSystemPrompt } from './system-prompt.js';
import { runConversation } from './conversation-loop.js';
import type { ConversationEvent } from './conversation-loop.js';

// ── WebSocket message types ─────────────────────────────────

/** Messages the client can send to the server */
export type ClientMessage =
	| { type: 'join'; sessionId: string }
	| { type: 'prompt'; text: string };

/** Messages the server sends to the client */
export type ServerMessage =
	| { type: 'joined'; sessionId: string }
	| { type: 'text'; content: string }
	| { type: 'tool_call'; name: string; args: Record<string, unknown> }
	| { type: 'tool_result'; name: string; result: unknown }
	| { type: 'state_update'; state: unknown }
	| { type: 'done' }
	| { type: 'error'; message: string };

/**
 * Manages a single WebSocket connection, binding it to a session
 * and streaming conversation events in real-time.
 */
export class WSConnectionHandler {
	private sessionId: string | null = null;
	private busy = false;

	constructor(
		private ws: WebSocket,
		private sessionManager: SessionManager,
		private provider?: LLMProvider,
		private providerConfig?: ProviderConfig,
	) {
		this.handleConnection();
	}

	private handleConnection(): void {
		this.ws.on('message', (data: Buffer | string) => {
			try {
				const raw = typeof data === 'string' ? data : data.toString('utf-8');
				const msg = JSON.parse(raw) as ClientMessage;
				this.handleMessage(msg);
			} catch {
				this.send({ type: 'error', message: 'Invalid message format' });
			}
		});
	}

	private handleMessage(msg: ClientMessage): void {
		switch (msg.type) {
			case 'join':
				this.handleJoin(msg.sessionId);
				break;
			case 'prompt':
				this.handlePrompt(msg.text);
				break;
			default:
				this.send({ type: 'error', message: `Unknown message type: ${(msg as { type: string }).type}` });
		}
	}

	private handleJoin(sessionId: string): void {
		const data = this.sessionManager.getSession(sessionId);
		if (!data) {
			this.send({ type: 'error', message: 'Session not found' });
			return;
		}
		this.sessionId = sessionId;
		this.send({ type: 'joined', sessionId });
	}

	private handlePrompt(text: string): void {
		if (!this.sessionId) {
			this.send({ type: 'error', message: 'Not joined to a session. Send a "join" message first.' });
			return;
		}

		if (!text || !text.trim()) {
			this.send({ type: 'error', message: 'Empty prompt' });
			return;
		}

		if (!this.provider) {
			this.send({ type: 'error', message: 'No LLM provider configured' });
			return;
		}

		if (this.busy) {
			this.send({ type: 'error', message: 'A prompt is already being processed' });
			return;
		}

		// Run conversation asynchronously, streaming events back
		this.runPrompt(text).catch((err) => {
			this.send({
				type: 'error',
				message: err instanceof Error ? err.message : String(err),
			});
			this.busy = false;
		});
	}

	private async runPrompt(text: string): Promise<void> {
		this.busy = true;

		const data = this.sessionManager.getSession(this.sessionId!);
		if (!data) {
			this.send({ type: 'error', message: 'Session not found' });
			this.busy = false;
			return;
		}

		const spaceInfo = data.executor.getGrid().getSpaceInfo();
		const systemPrompt = buildSystemPrompt(spaceInfo);

		const existingMessages = this.sessionManager.getMessages(this.sessionId!);
		const historyWithoutSystem = existingMessages.length > 0 && existingMessages[0].role === 'system'
			? existingMessages.slice(1)
			: existingMessages;
		const messages: Message[] = [
			{ role: 'system', content: systemPrompt },
			...historyWithoutSystem,
			{ role: 'user', content: text },
		];

		const tools = data.executor.getToolDefinitions();

		const onEvent = (event: ConversationEvent): void => {
			switch (event.type) {
				case 'text':
					this.send({ type: 'text', content: event.content });
					break;

				case 'tool_call':
					this.send({
						type: 'tool_call',
						name: event.name,
						args: event.arguments,
					});
					break;

				case 'tool_result':
					this.send({
						type: 'tool_result',
						name: event.name,
						result: event.result,
					});
					// After each tool execution, send the updated grid state
					{
						const currentData = this.sessionManager.getSession(this.sessionId!);
						if (currentData) {
							const state = currentData.executor.getGrid().getState();
							this.send({ type: 'state_update', state });
						}
					}
					break;

				// 'done' from LLM round (not conversation done) — ignore
				case 'done':
					break;

				case 'error':
					this.send({
						type: 'error',
						message: event.error instanceof Error ? event.error.message : String(event.error),
					});
					break;
			}
		};

		try {
			const result = await runConversation(
				this.provider!,
				data.executor,
				messages,
				tools,
				this.providerConfig,
				onEvent,
			);

			this.sessionManager.updateMessages(this.sessionId!, result.messages);
			this.sessionManager.persistSession(this.sessionId!).catch(() => {});

			this.send({ type: 'done' });
		} finally {
			this.busy = false;
		}
	}

	private send(msg: ServerMessage): void {
		if (this.ws.readyState === 1 /* WebSocket.OPEN */) {
			this.ws.send(JSON.stringify(msg));
		}
	}
}

/**
 * Factory: creates a handler for each incoming WebSocket connection.
 * This is designed to work with the `ws` package's WebSocketServer.
 */
export function createWSHandler(
	sessionManager: SessionManager,
	provider?: LLMProvider,
	providerConfig?: ProviderConfig,
): (ws: WebSocket) => void {
	return (ws: WebSocket) => {
		new WSConnectionHandler(ws, sessionManager, provider, providerConfig);
	};
}
