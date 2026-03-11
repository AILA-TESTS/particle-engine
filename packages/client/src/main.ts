// ============================================================
// Main — Entry point, wires everything together
// ============================================================

import { ApiClient } from './api-client.js';
import { GridRenderer } from './grid-renderer.js';
import { UI } from './ui.js';
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
		renderer.render(state, {
			width: config.canvasWidth!,
			height: config.canvasHeight!,
			backgroundColor: config.backgroundColor,
			padding: config.padding,
		});

		// Handle prompt submission
		ui.onSend(async (prompt) => {
			ui.setLoading(true);
			ui.addLogEntry('user', prompt);

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
				renderer.render(newState, {
					width: config.canvasWidth!,
					height: config.canvasHeight!,
					backgroundColor: config.backgroundColor,
					padding: config.padding,
				});

				// Update status bar
				ui.updateStatus(
					newState.summary.active_count,
					newState.summary.connection_count,
					'connected',
				);

				ui.addLogEntry(
					'status',
					`${result.toolCallCount} tool calls, ${result.usage.inputTokens + result.usage.outputTokens} tokens`,
				);
			} catch (err) {
				ui.addLogEntry('error', err instanceof Error ? err.message : String(err));
			}

			ui.setLoading(false);
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
