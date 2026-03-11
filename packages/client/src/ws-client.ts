// ============================================================
// WebSocketClient — Real-time streaming client for the browser
// ============================================================

import type { SpaceState } from '@particle-engine/core';

// ── Message types (mirror server's ServerMessage/ClientMessage) ──

/** Messages the client can send */
export type ClientWSMessage =
	| { type: 'join'; sessionId: string }
	| { type: 'prompt'; text: string };

/** Messages the server sends */
export type ServerWSMessage =
	| { type: 'joined'; sessionId: string }
	| { type: 'text'; content: string }
	| { type: 'tool_call'; name: string; args: Record<string, unknown> }
	| { type: 'tool_result'; name: string; result: unknown }
	| { type: 'state_update'; state: SpaceState }
	| { type: 'done' }
	| { type: 'error'; message: string };

/** Callback map for WebSocket events */
export interface WSEventHandlers {
	onConnected?: () => void;
	onJoined?: (sessionId: string) => void;
	onText?: (content: string) => void;
	onToolCall?: (name: string, args: Record<string, unknown>) => void;
	onToolResult?: (name: string, result: unknown) => void;
	onStateUpdate?: (state: SpaceState) => void;
	onDone?: () => void;
	onError?: (message: string) => void;
	onDisconnected?: () => void;
}

/** Configuration for the WebSocket client */
export interface WSClientConfig {
	/** WebSocket URL, e.g., 'ws://localhost:3000/api/ws' */
	url: string;
	/** Auto-reconnect on disconnect (default true) */
	autoReconnect?: boolean;
	/** Reconnect delay in ms (default 2000) */
	reconnectDelay?: number;
	/** Maximum reconnect attempts (default 5) */
	maxReconnectAttempts?: number;
}

/**
 * WebSocket client that connects to the particle engine server
 * and streams LLM conversation events in real-time.
 */
export class WebSocketClient {
	private ws: WebSocket | null = null;
	private handlers: WSEventHandlers = {};
	private config: Required<WSClientConfig>;
	private reconnectAttempts = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private intentionalClose = false;
	private sessionId: string | null = null;

	constructor(config: WSClientConfig) {
		this.config = {
			url: config.url,
			autoReconnect: config.autoReconnect ?? true,
			reconnectDelay: config.reconnectDelay ?? 2000,
			maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
		};
	}

	/**
	 * Register event handlers.
	 */
	on(handlers: WSEventHandlers): void {
		this.handlers = { ...this.handlers, ...handlers };
	}

	/**
	 * Connect to the WebSocket server.
	 */
	connect(): void {
		this.intentionalClose = false;
		this.reconnectAttempts = 0;
		this.createConnection();
	}

	/**
	 * Disconnect from the WebSocket server.
	 */
	disconnect(): void {
		this.intentionalClose = true;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}

	/**
	 * Join a session by ID.
	 */
	join(sessionId: string): void {
		this.sessionId = sessionId;
		this.sendMessage({ type: 'join', sessionId });
	}

	/**
	 * Send a prompt to the LLM.
	 */
	sendPrompt(text: string): void {
		this.sendMessage({ type: 'prompt', text });
	}

	/**
	 * Whether the WebSocket is currently connected.
	 */
	get connected(): boolean {
		return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
	}

	private createConnection(): void {
		try {
			this.ws = new WebSocket(this.config.url);
		} catch {
			this.handlers.onError?.('Failed to create WebSocket connection');
			this.tryReconnect();
			return;
		}

		this.ws.onopen = () => {
			this.reconnectAttempts = 0;
			this.handlers.onConnected?.();

			// Re-join session if we had one (reconnection case)
			if (this.sessionId) {
				this.sendMessage({ type: 'join', sessionId: this.sessionId });
			}
		};

		this.ws.onmessage = (event: MessageEvent) => {
			try {
				const msg = JSON.parse(event.data as string) as ServerWSMessage;
				this.handleServerMessage(msg);
			} catch {
				this.handlers.onError?.('Failed to parse server message');
			}
		};

		this.ws.onclose = () => {
			this.ws = null;
			this.handlers.onDisconnected?.();

			if (!this.intentionalClose) {
				this.tryReconnect();
			}
		};

		this.ws.onerror = () => {
			// The close event will fire after this, which handles reconnection
		};
	}

	private handleServerMessage(msg: ServerWSMessage): void {
		switch (msg.type) {
			case 'joined':
				this.handlers.onJoined?.(msg.sessionId);
				break;
			case 'text':
				this.handlers.onText?.(msg.content);
				break;
			case 'tool_call':
				this.handlers.onToolCall?.(msg.name, msg.args);
				break;
			case 'tool_result':
				this.handlers.onToolResult?.(msg.name, msg.result);
				break;
			case 'state_update':
				this.handlers.onStateUpdate?.(msg.state);
				break;
			case 'done':
				this.handlers.onDone?.();
				break;
			case 'error':
				this.handlers.onError?.(msg.message);
				break;
		}
	}

	private sendMessage(msg: ClientWSMessage): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(msg));
		}
	}

	private tryReconnect(): void {
		if (!this.config.autoReconnect) return;
		if (this.reconnectAttempts >= this.config.maxReconnectAttempts) return;

		this.reconnectAttempts++;
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.createConnection();
		}, this.config.reconnectDelay);
	}
}
