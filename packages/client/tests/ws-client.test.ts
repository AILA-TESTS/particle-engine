// ============================================================
// Tests — WebSocketClient (mock WebSocket)
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketClient } from '../src/ws-client.js';
import type { WSEventHandlers, ServerWSMessage } from '../src/ws-client.js';

// ── Mock WebSocket ──────────────────────────────────────────

class MockWebSocket {
	static OPEN = 1;
	static CLOSED = 3;
	static CONNECTING = 0;

	readyState = MockWebSocket.CONNECTING;
	sent: string[] = [];
	url: string;

	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
	onmessage: ((event: { data: string }) => void) | null = null;
	onerror: (() => void) | null = null;

	constructor(url: string) {
		this.url = url;
		// Simulate async connection (will be triggered by test)
	}

	send(data: string): void {
		this.sent.push(data);
	}

	close(): void {
		this.readyState = MockWebSocket.CLOSED;
		if (this.onclose) this.onclose();
	}

	/** Test helper: simulate connection open */
	simulateOpen(): void {
		this.readyState = MockWebSocket.OPEN;
		if (this.onopen) this.onopen();
	}

	/** Test helper: simulate receiving a message from the server */
	simulateMessage(msg: ServerWSMessage): void {
		if (this.onmessage) {
			this.onmessage({ data: JSON.stringify(msg) });
		}
	}

	/** Test helper: simulate error */
	simulateError(): void {
		if (this.onerror) this.onerror();
	}

	/** Parse sent messages */
	getSentMessages(): unknown[] {
		return this.sent.map((s) => JSON.parse(s));
	}
}

// ── Global mock ─────────────────────────────────────────────

let lastCreatedWS: MockWebSocket | null = null;
let originalWebSocket: typeof globalThis.WebSocket;

function installMockWebSocket(): void {
	originalWebSocket = globalThis.WebSocket;
	(globalThis as any).WebSocket = class extends MockWebSocket {
		constructor(url: string) {
			super(url);
			lastCreatedWS = this;
		}

		static OPEN = 1;
		static CLOSED = 3;
		static CONNECTING = 0;
		static CLOSING = 2;
	};
}

function uninstallMockWebSocket(): void {
	globalThis.WebSocket = originalWebSocket;
	lastCreatedWS = null;
}

// ── Tests ───────────────────────────────────────────────────

describe('WebSocketClient', () => {
	beforeEach(() => {
		installMockWebSocket();
	});

	afterEach(() => {
		uninstallMockWebSocket();
	});

	// ── Connection ──────────────────────────────────────────

	describe('connection', () => {
		it('creates a WebSocket connection to the configured URL', () => {
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});

			client.connect();

			expect(lastCreatedWS).not.toBeNull();
			expect(lastCreatedWS!.url).toBe('ws://localhost:3000/api/ws');
		});

		it('calls onConnected when WebSocket opens', () => {
			const onConnected = vi.fn();
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});
			client.on({ onConnected });

			client.connect();
			lastCreatedWS!.simulateOpen();

			expect(onConnected).toHaveBeenCalledOnce();
		});

		it('reports connected status when open', () => {
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});

			expect(client.connected).toBe(false);

			client.connect();
			lastCreatedWS!.simulateOpen();

			expect(client.connected).toBe(true);
		});

		it('calls onDisconnected when WebSocket closes', () => {
			const onDisconnected = vi.fn();
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});
			client.on({ onDisconnected });

			client.connect();
			lastCreatedWS!.simulateOpen();
			lastCreatedWS!.close();

			expect(onDisconnected).toHaveBeenCalledOnce();
		});
	});

	// ── Joining a session ───────────────────────────────────

	describe('join', () => {
		it('sends a join message with session ID', () => {
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});

			client.connect();
			lastCreatedWS!.simulateOpen();
			client.join('sess-123');

			const sent = lastCreatedWS!.getSentMessages();
			expect(sent).toHaveLength(1);
			expect(sent[0]).toEqual({ type: 'join', sessionId: 'sess-123' });
		});

		it('calls onJoined when server confirms', () => {
			const onJoined = vi.fn();
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});
			client.on({ onJoined });

			client.connect();
			lastCreatedWS!.simulateOpen();
			client.join('sess-123');

			lastCreatedWS!.simulateMessage({ type: 'joined', sessionId: 'sess-123' });

			expect(onJoined).toHaveBeenCalledWith('sess-123');
		});
	});

	// ── Sending a prompt ────────────────────────────────────

	describe('sendPrompt', () => {
		it('sends a prompt message', () => {
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});

			client.connect();
			lastCreatedWS!.simulateOpen();
			client.sendPrompt('Draw a circle');

			const sent = lastCreatedWS!.getSentMessages();
			expect(sent).toHaveLength(1);
			expect(sent[0]).toEqual({ type: 'prompt', text: 'Draw a circle' });
		});
	});

	// ── Receiving server messages ───────────────────────────

	describe('message handling', () => {
		it('calls onText for text messages', () => {
			const onText = vi.fn();
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});
			client.on({ onText });

			client.connect();
			lastCreatedWS!.simulateOpen();

			lastCreatedWS!.simulateMessage({ type: 'text', content: 'Hello world' });

			expect(onText).toHaveBeenCalledWith('Hello world');
		});

		it('calls onToolCall for tool_call messages', () => {
			const onToolCall = vi.fn();
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});
			client.on({ onToolCall });

			client.connect();
			lastCreatedWS!.simulateOpen();

			lastCreatedWS!.simulateMessage({
				type: 'tool_call',
				name: 'set_particles',
				args: { particles: [{ row: 0, col: 0 }] },
			});

			expect(onToolCall).toHaveBeenCalledWith(
				'set_particles',
				{ particles: [{ row: 0, col: 0 }] },
			);
		});

		it('calls onToolResult for tool_result messages', () => {
			const onToolResult = vi.fn();
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});
			client.on({ onToolResult });

			client.connect();
			lastCreatedWS!.simulateOpen();

			lastCreatedWS!.simulateMessage({
				type: 'tool_result',
				name: 'set_particles',
				result: { success: true },
			});

			expect(onToolResult).toHaveBeenCalledWith('set_particles', { success: true });
		});

		it('calls onStateUpdate for state_update messages', () => {
			const onStateUpdate = vi.fn();
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});
			client.on({ onStateUpdate });

			client.connect();
			lastCreatedWS!.simulateOpen();

			const mockState = {
				grid: { rows: 10, cols: 10, spacing: 10 },
				summary: { active_count: 1, connection_count: 0, groups: [] },
				particles: [{ r: 0, c: 0, color: '#FF0000', opacity: 1, size: 1, layer: 0, group: '' }],
				connections: [],
			};

			lastCreatedWS!.simulateMessage({ type: 'state_update', state: mockState as any });

			expect(onStateUpdate).toHaveBeenCalledWith(mockState);
		});

		it('calls onDone for done messages', () => {
			const onDone = vi.fn();
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});
			client.on({ onDone });

			client.connect();
			lastCreatedWS!.simulateOpen();

			lastCreatedWS!.simulateMessage({ type: 'done' });

			expect(onDone).toHaveBeenCalledOnce();
		});

		it('calls onError for error messages', () => {
			const onError = vi.fn();
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});
			client.on({ onError });

			client.connect();
			lastCreatedWS!.simulateOpen();

			lastCreatedWS!.simulateMessage({ type: 'error', message: 'Something went wrong' });

			expect(onError).toHaveBeenCalledWith('Something went wrong');
		});

		it('handles invalid JSON from server gracefully', () => {
			const onError = vi.fn();
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});
			client.on({ onError });

			client.connect();
			lastCreatedWS!.simulateOpen();

			// Directly fire onmessage with invalid JSON
			lastCreatedWS!.onmessage!({ data: 'not valid json{{{' });

			expect(onError).toHaveBeenCalledWith('Failed to parse server message');
		});
	});

	// ── Disconnection ───────────────────────────────────────

	describe('disconnect', () => {
		it('closes the WebSocket connection', () => {
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});

			client.connect();
			lastCreatedWS!.simulateOpen();
			expect(client.connected).toBe(true);

			client.disconnect();
			expect(client.connected).toBe(false);
		});
	});

	// ── Reconnection ────────────────────────────────────────

	describe('reconnection', () => {
		it('re-joins session on reconnection', async () => {
			vi.useFakeTimers();

			const onConnected = vi.fn();
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: true,
				reconnectDelay: 100,
				maxReconnectAttempts: 3,
			});
			client.on({ onConnected });

			// Initial connection
			client.connect();
			const ws1 = lastCreatedWS!;
			ws1.simulateOpen();
			client.join('sess-abc');

			// Simulate disconnection (not intentional)
			ws1.close();

			// Advance timer to trigger reconnect
			vi.advanceTimersByTime(100);

			// New WebSocket should have been created
			const ws2 = lastCreatedWS!;
			expect(ws2).not.toBe(ws1);

			// Simulate it connecting
			ws2.simulateOpen();

			// Should have re-joined automatically
			const sent = ws2.getSentMessages();
			expect(sent).toHaveLength(1);
			expect(sent[0]).toEqual({ type: 'join', sessionId: 'sess-abc' });

			vi.useRealTimers();
		});

		it('does not reconnect after intentional disconnect', async () => {
			vi.useFakeTimers();

			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: true,
				reconnectDelay: 100,
			});

			client.connect();
			const ws1 = lastCreatedWS!;
			ws1.simulateOpen();

			// Intentional disconnect
			client.disconnect();
			const afterDisconnect = lastCreatedWS;

			// Advance timer
			vi.advanceTimersByTime(200);

			// Should not have created a new WebSocket
			expect(lastCreatedWS).toBe(afterDisconnect);

			vi.useRealTimers();
		});

		it('stops reconnecting after max attempts', async () => {
			vi.useFakeTimers();

			const onDisconnected = vi.fn();
			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: true,
				reconnectDelay: 100,
				maxReconnectAttempts: 2,
			});
			client.on({ onDisconnected });

			// Initial connection
			client.connect();
			lastCreatedWS!.simulateOpen();

			// First disconnect
			lastCreatedWS!.close();
			vi.advanceTimersByTime(100);

			// Reconnect attempt 1 — but it fails immediately
			const ws2 = lastCreatedWS!;
			ws2.close(); // close again
			vi.advanceTimersByTime(100);

			// Reconnect attempt 2 — fails again
			const ws3 = lastCreatedWS!;
			ws3.close();
			vi.advanceTimersByTime(100);

			// No more reconnect attempts
			const ws4 = lastCreatedWS;
			expect(ws4).toBe(ws3); // No new WS was created

			vi.useRealTimers();
		});
	});

	// ── Handler registration ────────────────────────────────

	describe('on', () => {
		it('merges new handlers with existing ones', () => {
			const onText = vi.fn();
			const onDone = vi.fn();

			const client = new WebSocketClient({
				url: 'ws://localhost:3000/api/ws',
				autoReconnect: false,
			});

			client.on({ onText });
			client.on({ onDone });

			client.connect();
			lastCreatedWS!.simulateOpen();

			lastCreatedWS!.simulateMessage({ type: 'text', content: 'Hello' });
			lastCreatedWS!.simulateMessage({ type: 'done' });

			expect(onText).toHaveBeenCalledWith('Hello');
			expect(onDone).toHaveBeenCalledOnce();
		});
	});
});
