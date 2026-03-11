// ============================================================
// Tests — WebSocket Handler
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { WSConnectionHandler, createWSHandler } from '../src/ws-handler.js';
import { SessionManager } from '../src/session-manager.js';
import type { LLMProvider, LLMEvent, Message, ToolCall, ProviderConfig } from '../src/types.js';
import type { ToolDefinition, ToolResult } from '@particle-engine/tools';
import type { ServerMessage } from '../src/ws-handler.js';

// ── Mock WebSocket ──────────────────────────────────────────

class MockWebSocket extends EventEmitter {
	readyState = 1; // WebSocket.OPEN
	sent: string[] = [];

	send(data: string): void {
		this.sent.push(data);
	}

	close(): void {
		this.readyState = 3; // WebSocket.CLOSED
	}

	/** Simulate receiving a message from the client */
	receiveMessage(msg: unknown): void {
		this.emit('message', JSON.stringify(msg));
	}

	/** Parse all sent messages as ServerMessage[] */
	getSentMessages(): ServerMessage[] {
		return this.sent.map((s) => JSON.parse(s) as ServerMessage);
	}

	/** Get the last sent message */
	getLastMessage(): ServerMessage {
		return JSON.parse(this.sent[this.sent.length - 1]) as ServerMessage;
	}
}

// ── Mock LLM Provider ──────────────────────────────────────

function createMockProvider(rounds: LLMEvent[][]): LLMProvider {
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

// ── Helper ──────────────────────────────────────────────────

function flush(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 10));
}

// ── Tests ───────────────────────────────────────────────────

describe('WSConnectionHandler', () => {
	let sessionManager: SessionManager;
	let ws: MockWebSocket;

	beforeEach(() => {
		sessionManager = new SessionManager({ rows: 10, cols: 10, spacing: 10 });
		ws = new MockWebSocket();
	});

	// ── join message ────────────────────────────────────────

	describe('join', () => {
		it('successfully joins an existing session', async () => {
			const { id } = sessionManager.createSession();
			new WSConnectionHandler(
				ws as any,
				sessionManager,
			);

			ws.receiveMessage({ type: 'join', sessionId: id });
			await flush();

			const msgs = ws.getSentMessages();
			expect(msgs).toHaveLength(1);
			expect(msgs[0]).toEqual({ type: 'joined', sessionId: id });
		});

		it('sends error for non-existent session', async () => {
			new WSConnectionHandler(
				ws as any,
				sessionManager,
			);

			ws.receiveMessage({ type: 'join', sessionId: 's_nonexistent' });
			await flush();

			const msgs = ws.getSentMessages();
			expect(msgs).toHaveLength(1);
			expect(msgs[0].type).toBe('error');
			expect((msgs[0] as { type: 'error'; message: string }).message).toBe('Session not found');
		});
	});

	// ── prompt message ──────────────────────────────────────

	describe('prompt', () => {
		it('sends error if not joined to a session', async () => {
			new WSConnectionHandler(
				ws as any,
				sessionManager,
			);

			ws.receiveMessage({ type: 'prompt', text: 'Hello' });
			await flush();

			const msgs = ws.getSentMessages();
			expect(msgs).toHaveLength(1);
			expect(msgs[0].type).toBe('error');
			expect((msgs[0] as { type: 'error'; message: string }).message).toContain('Not joined');
		});

		it('sends error for empty prompt', async () => {
			const { id } = sessionManager.createSession();
			new WSConnectionHandler(
				ws as any,
				sessionManager,
			);

			ws.receiveMessage({ type: 'join', sessionId: id });
			await flush();
			ws.sent = []; // Clear the 'joined' message

			ws.receiveMessage({ type: 'prompt', text: '' });
			await flush();

			const msgs = ws.getSentMessages();
			expect(msgs).toHaveLength(1);
			expect(msgs[0].type).toBe('error');
			expect((msgs[0] as { type: 'error'; message: string }).message).toBe('Empty prompt');
		});

		it('sends error when no LLM provider is configured', async () => {
			const { id } = sessionManager.createSession();
			new WSConnectionHandler(
				ws as any,
				sessionManager,
				undefined, // no provider
			);

			ws.receiveMessage({ type: 'join', sessionId: id });
			await flush();
			ws.sent = [];

			ws.receiveMessage({ type: 'prompt', text: 'Hello' });
			await flush();

			const msgs = ws.getSentMessages();
			expect(msgs).toHaveLength(1);
			expect(msgs[0].type).toBe('error');
			expect((msgs[0] as { type: 'error'; message: string }).message).toBe('No LLM provider configured');
		});

		it('streams text events from LLM', async () => {
			const provider = createMockProvider([
				[
					{ type: 'text', content: 'Hello ' },
					{ type: 'text', content: 'world!' },
					{ type: 'done', usage: { inputTokens: 10, outputTokens: 5 } },
				],
			]);

			const { id } = sessionManager.createSession();
			new WSConnectionHandler(
				ws as any,
				sessionManager,
				provider,
			);

			ws.receiveMessage({ type: 'join', sessionId: id });
			await flush();
			ws.sent = [];

			ws.receiveMessage({ type: 'prompt', text: 'Say hello' });
			await flush();

			const msgs = ws.getSentMessages();
			const textMsgs = msgs.filter((m) => m.type === 'text');
			expect(textMsgs).toHaveLength(2);
			expect((textMsgs[0] as { type: 'text'; content: string }).content).toBe('Hello ');
			expect((textMsgs[1] as { type: 'text'; content: string }).content).toBe('world!');

			// Should end with done
			const lastMsg = msgs[msgs.length - 1];
			expect(lastMsg.type).toBe('done');
		});

		it('streams tool_call and tool_result events', async () => {
			const provider = createMockProvider([
				// Round 1: tool call
				[
					{
						type: 'tool_call', id: 'tc1', name: 'set_particles',
						arguments: { particles: [{ row: 0, col: 0, color: '#FF0000' }] },
					},
					{ type: 'done', usage: { inputTokens: 20, outputTokens: 10 } },
				],
				// Round 2: text response
				[
					{ type: 'text', content: 'Done!' },
					{ type: 'done', usage: { inputTokens: 30, outputTokens: 5 } },
				],
			]);

			const { id } = sessionManager.createSession();
			new WSConnectionHandler(
				ws as any,
				sessionManager,
				provider,
			);

			ws.receiveMessage({ type: 'join', sessionId: id });
			await flush();
			ws.sent = [];

			ws.receiveMessage({ type: 'prompt', text: 'Place a red dot' });
			await flush();

			const msgs = ws.getSentMessages();

			// Should have: tool_call, tool_result, state_update, text, done
			const types = msgs.map((m) => m.type);
			expect(types).toContain('tool_call');
			expect(types).toContain('tool_result');
			expect(types).toContain('state_update');
			expect(types).toContain('text');
			expect(types[types.length - 1]).toBe('done');

			// Verify tool_call message
			const toolCallMsg = msgs.find((m) => m.type === 'tool_call') as {
				type: 'tool_call'; name: string; args: Record<string, unknown>;
			};
			expect(toolCallMsg.name).toBe('set_particles');
			expect(toolCallMsg.args).toEqual({ particles: [{ row: 0, col: 0, color: '#FF0000' }] });

			// Verify state_update has grid data
			const stateMsg = msgs.find((m) => m.type === 'state_update') as {
				type: 'state_update'; state: unknown;
			};
			expect(stateMsg.state).toBeDefined();
		});

		it('prevents concurrent prompts', async () => {
			// Create a provider that takes time to respond
			let resolveStream: (() => void) | null = null;
			const provider: LLMProvider = {
				name: 'slow-mock',
				formatTools: (t) => t,
				stream: () => ({
					[Symbol.asyncIterator]() {
						return {
							async next() {
								// Wait for resolve signal
								await new Promise<void>((r) => { resolveStream = r; });
								return {
									value: { type: 'text' as const, content: 'Hello' },
									done: false,
								};
							},
						};
					},
				}),
				parseToolCall: (r) => r as ToolCall,
				formatToolResult: (_, r) => r,
			};

			const { id } = sessionManager.createSession();
			new WSConnectionHandler(
				ws as any,
				sessionManager,
				provider,
			);

			ws.receiveMessage({ type: 'join', sessionId: id });
			await flush();
			ws.sent = [];

			// Send first prompt (will be processing)
			ws.receiveMessage({ type: 'prompt', text: 'Hello' });
			await flush();

			// Send second prompt while first is still running
			ws.receiveMessage({ type: 'prompt', text: 'Another one' });
			await flush();

			const msgs = ws.getSentMessages();
			const errorMsgs = msgs.filter((m) => m.type === 'error');
			expect(errorMsgs).toHaveLength(1);
			expect((errorMsgs[0] as { type: 'error'; message: string }).message).toContain('already being processed');

			// Clean up: resolve the pending stream to avoid dangling promises
			if (resolveStream) resolveStream();
		});
	});

	// ── Invalid messages ────────────────────────────────────

	describe('invalid messages', () => {
		it('handles invalid JSON', async () => {
			new WSConnectionHandler(
				ws as any,
				sessionManager,
			);

			ws.emit('message', 'not valid json{{{');
			await flush();

			const msgs = ws.getSentMessages();
			expect(msgs).toHaveLength(1);
			expect(msgs[0].type).toBe('error');
			expect((msgs[0] as { type: 'error'; message: string }).message).toBe('Invalid message format');
		});

		it('handles unknown message type', async () => {
			new WSConnectionHandler(
				ws as any,
				sessionManager,
			);

			ws.receiveMessage({ type: 'unknown_type' });
			await flush();

			const msgs = ws.getSentMessages();
			expect(msgs).toHaveLength(1);
			expect(msgs[0].type).toBe('error');
			expect((msgs[0] as { type: 'error'; message: string }).message).toContain('Unknown message type');
		});
	});

	// ── Closed connection ───────────────────────────────────

	describe('closed connection', () => {
		it('does not send messages to closed WebSocket', async () => {
			const provider = createMockProvider([
				[
					{ type: 'text', content: 'Hello' },
					{ type: 'done', usage: { inputTokens: 10, outputTokens: 5 } },
				],
			]);

			const { id } = sessionManager.createSession();
			new WSConnectionHandler(
				ws as any,
				sessionManager,
				provider,
			);

			ws.receiveMessage({ type: 'join', sessionId: id });
			await flush();

			// Close the connection
			ws.close();
			ws.sent = [];

			ws.receiveMessage({ type: 'prompt', text: 'Hello' });
			await flush();

			// No messages should have been sent since the WS is closed
			expect(ws.sent).toHaveLength(0);
		});
	});
});

// ── createWSHandler factory ─────────────────────────────────

describe('createWSHandler', () => {
	it('returns a function that creates WSConnectionHandler instances', () => {
		const sessionManager = new SessionManager();
		const handler = createWSHandler(sessionManager);

		expect(typeof handler).toBe('function');
	});

	it('handler creates a new connection handler for each WebSocket', async () => {
		const sessionManager = new SessionManager();
		const { id } = sessionManager.createSession();
		const handler = createWSHandler(sessionManager);

		const ws1 = new MockWebSocket();
		const ws2 = new MockWebSocket();

		handler(ws1 as any);
		handler(ws2 as any);

		// Both should respond independently
		ws1.receiveMessage({ type: 'join', sessionId: id });
		ws2.receiveMessage({ type: 'join', sessionId: id });
		await new Promise((r) => setTimeout(r, 10));

		expect(ws1.getSentMessages()).toHaveLength(1);
		expect(ws2.getSentMessages()).toHaveLength(1);
		expect(ws1.getLastMessage()).toEqual({ type: 'joined', sessionId: id });
		expect(ws2.getLastMessage()).toEqual({ type: 'joined', sessionId: id });
	});
});
