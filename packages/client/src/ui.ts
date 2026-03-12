// ============================================================
// UI — DOM manipulation and UI management
// ============================================================

/**
 * Manages the DOM elements for the client UI.
 *
 * Provides methods for adding log entries, updating status, and
 * wiring up user interactions (prompt submission).
 */
export class UI {
	private logEl: HTMLElement;
	private promptInput: HTMLInputElement;
	private sendBtn: HTMLButtonElement;
	private sessionInfo: HTMLElement;
	private statusParticles: HTMLElement;
	private statusConnections: HTMLElement;
	private statusServer: HTMLElement;

	constructor() {
		this.logEl = document.getElementById('log')!;
		this.promptInput = document.getElementById('prompt-input') as HTMLInputElement;
		this.sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
		this.sessionInfo = document.getElementById('session-info')!;
		this.statusParticles = document.getElementById('status-particles')!;
		this.statusConnections = document.getElementById('status-connections')!;
		this.statusServer = document.getElementById('status-server')!;
	}

	/**
	 * Wire up the send button and Enter key to trigger prompt submission.
	 */
	onSend(callback: (prompt: string) => void): void {
		const submit = () => {
			const prompt = this.promptInput.value.trim();
			if (!prompt) return;
			this.promptInput.value = '';
			callback(prompt);
		};

		this.sendBtn.addEventListener('click', submit);
		this.promptInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				submit();
			}
		});
	}

	/**
	 * Add a log entry to the sidebar log.
	 */
	addLogEntry(
		type: 'user' | 'assistant' | 'tool' | 'error' | 'status',
		content: string,
	): void {
		const entry = document.createElement('div');
		entry.className = `log-entry log-${type}`;
		entry.textContent = content;
		this.logEl.appendChild(entry);
		this.scrollLogToBottom();
	}

	/**
	 * Update the status bar counts and server status.
	 */
	updateStatus(particles: number, connections: number, serverStatus: string): void {
		this.statusParticles.textContent = `Particles: ${particles}`;
		this.statusConnections.textContent = `Connections: ${connections}`;
		this.statusServer.textContent = `Server: ${serverStatus}`;
	}

	/**
	 * Update the session info displayed in the header.
	 */
	updateSessionInfo(id: string, config: { rows: number; cols: number }): void {
		this.sessionInfo.textContent = `Session: ${id.slice(0, 8)}... (${config.rows}x${config.cols})`;
	}

	/**
	 * Enable or disable the prompt input and send button.
	 */
	setLoading(loading: boolean): void {
		this.promptInput.disabled = loading;
		this.sendBtn.disabled = loading;
		this.sendBtn.textContent = loading ? 'Sending...' : 'Send';
	}

	/**
	 * Scroll the log container to the bottom.
	 */
	scrollLogToBottom(): void {
		this.logEl.scrollTop = this.logEl.scrollHeight;
	}
}
