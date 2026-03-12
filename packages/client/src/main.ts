// ============================================================
// Main — Entry point, wires everything together
// ============================================================

import { ApiClient } from './api-client.js';
import { GridRenderer } from './grid-renderer.js';
import { UI } from './ui.js';
import { WebSocketClient } from './ws-client.js';
import type { ClientConfig } from './types.js';

async function init() {
	// Read config from URL params or use defaults
	const params = new URLSearchParams(window.location.search);

	const config: ClientConfig = {
		serverUrl: params.get('server') || 'http://localhost:3000',
		canvasWidth: 800,
		canvasHeight: 800,
		gridRows: 100,
		gridCols: 100,
		gridSpacing: 10,
		backgroundColor: '#000000',
		padding: 20,
	};

	const api = new ApiClient(config.serverUrl);
	const canvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
	const renderer = new GridRenderer(canvas);
	const ui = new UI();

	// Helper: render a state to the canvas
	const renderState = (state: import('@particle-engine/core').SpaceState) => {
		renderer.render(state, {
			width: config.canvasWidth!,
			height: config.canvasHeight!,
			backgroundColor: config.backgroundColor,
			padding: config.padding,
		});
		ui.updateStatus(
			state.summary.active_count,
			state.summary.connection_count,
			'connected',
		);
	};

	// Create a session and wire everything up
	try {
		const session = await api.createSession({
			rows: config.gridRows,
			cols: config.gridCols,
			spacing: config.gridSpacing,
		});
		ui.updateSessionInfo(session.id, session.config);
		ui.updateStatus(0, 0, 'connected');
		ui.addLogEntry('status', `Session created: ${session.id}`);

		// Initial render
		renderer.resize(config.canvasWidth!, config.canvasHeight!);
		const { state } = await api.getSession(session.id);
		renderState(state);

		// Try WebSocket connection, fall back to HTTP
		const wsUrl = config.serverUrl.replace(/^http/, 'ws') + '/api/ws';
		const wsClient = new WebSocketClient({ url: wsUrl });
		let useWebSocket = false;

		// Set up WebSocket event handlers
		wsClient.on({
			onConnected: () => {
				useWebSocket = true;
				wsClient.join(session.id);
				ui.addLogEntry('status', 'WebSocket connected');
			},
			onJoined: () => {
				ui.addLogEntry('status', 'WebSocket joined session');
			},
			onText: (content) => {
				ui.addLogEntry('assistant', content);
			},
			onToolCall: (name, args) => {
				ui.addLogEntry(
					'tool',
					`${name}(${JSON.stringify(args).slice(0, 100)}...)`,
				);
			},
			onToolResult: (_name, _result) => {
				// Tool results are followed by state_update, so no need to log separately
			},
			onStateUpdate: (newState) => {
				renderState(newState);
			},
			onDone: () => {
				ui.setLoading(false);
				ui.addLogEntry('status', 'Done');
			},
			onError: (message) => {
				ui.addLogEntry('error', message);
				ui.setLoading(false);
			},
			onDisconnected: () => {
				useWebSocket = false;
				ui.addLogEntry('status', 'WebSocket disconnected, falling back to HTTP');
				ui.setLoading(false);
			},
		});

		// Attempt WebSocket connection
		wsClient.connect();

		// Handle prompt submission — use WebSocket if available, else HTTP
		ui.onSend(async (prompt) => {
			ui.setLoading(true);
			ui.addLogEntry('user', prompt);

			if (useWebSocket && wsClient.connected) {
				// Stream via WebSocket — events will arrive via callbacks above
				wsClient.sendPrompt(prompt);
			} else {
				// Fallback to HTTP polling
				try {
					const result = await api.sendPrompt(session.id, prompt);

					// Log tool calls and responses
					for (const msg of result.messages) {
						if (msg.role === 'assistant' && msg.content) {
							ui.addLogEntry('assistant', msg.content);
						}
						if (msg.toolCalls) {
							for (const tc of msg.toolCalls) {
								ui.addLogEntry(
									'tool',
									`${tc.name}(${JSON.stringify(tc.arguments).slice(0, 100)}...)`,
								);
							}
						}
					}

					// Refresh canvas with updated state
					const { state: newState } = await api.getSession(session.id);
					renderState(newState);

					ui.addLogEntry(
						'status',
						`${result.toolCallCount} tool calls, ${result.usage.inputTokens + result.usage.outputTokens} tokens`,
					);
				} catch (err) {
					ui.addLogEntry('error', err instanceof Error ? err.message : String(err));
				}

				ui.setLoading(false);
			}
		});
	} catch (err) {
		ui.updateStatus(0, 0, 'disconnected');
		ui.addLogEntry(
			'error',
			`Failed to connect: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

init();
