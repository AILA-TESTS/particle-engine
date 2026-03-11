// ============================================================
// SessionManager — Session store with optional file persistence
// ============================================================

import { ToolExecutor } from '@particle-engine/tools';
import type { SpaceState } from '@particle-engine/core';
import type { Session, SessionConfig, PersistenceConfig, PersistedSessionData, Message } from './types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/** Internal session data (session metadata + executor) */
export interface SessionData {
	session: Session;
	executor: ToolExecutor;
	messages: Message[];
}

/** Default grid dimensions */
const DEFAULT_ROWS = 100;
const DEFAULT_COLS = 100;
const DEFAULT_SPACING = 10;

/** Configuration for the session manager */
export interface SessionManagerConfig {
	rows?: number;
	cols?: number;
	spacing?: number;
	persistence?: PersistenceConfig;
}

/**
 * Manages sessions, each with its own grid and tool executor.
 * Optionally persists sessions to disk as JSON files.
 */
export class SessionManager {
	private sessions: Map<string, SessionData> = new Map();
	private defaultRows: number;
	private defaultCols: number;
	private defaultSpacing: number;
	private persistence: PersistenceConfig | undefined;
	private _initialized = false;
	private _initPromise: Promise<void> | null = null;

	constructor(defaults?: SessionManagerConfig | { rows?: number; cols?: number; spacing?: number }) {
		this.defaultRows = defaults?.rows ?? DEFAULT_ROWS;
		this.defaultCols = defaults?.cols ?? DEFAULT_COLS;
		this.defaultSpacing = defaults?.spacing ?? DEFAULT_SPACING;
		this.persistence = (defaults && 'persistence' in defaults) ? defaults.persistence : undefined;

		if (this.persistence?.enabled) {
			this._initPromise = this._initialize();
		} else {
			this._initialized = true;
		}
	}

	/**
	 * Initialize: create persistence directory and load existing sessions.
	 * Called automatically in constructor when persistence is enabled.
	 * Can be awaited to ensure sessions are loaded before use.
	 */
	async initialize(): Promise<void> {
		if (this._initPromise) {
			await this._initPromise;
		}
	}

	private async _initialize(): Promise<void> {
		if (!this.persistence?.enabled) return;

		try {
			await fs.mkdir(this.persistence.directory, { recursive: true });
			await this._loadAllSessions();
		} catch (err) {
			// Log but don't throw — degraded mode (in-memory only)
			console.error('[SessionManager] Failed to initialize persistence:', err);
		}

		this._initialized = true;
	}

	/**
	 * Create a new session with an independent grid and tool executor.
	 */
	createSession(config?: SessionConfig): { id: string; session: Session } {
		const rows = config?.rows ?? this.defaultRows;
		const cols = config?.cols ?? this.defaultCols;
		const spacing = config?.spacing ?? this.defaultSpacing;

		const id = `s_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

		const session: Session = {
			id,
			createdAt: Date.now(),
			config: { rows, cols, spacing },
		};

		const executor = new ToolExecutor({ rows, cols, spacing });

		this.sessions.set(id, { session, executor, messages: [] });

		// Fire-and-forget persist
		this._persistSession(id);

		return { id, session };
	}

	/**
	 * Get session data by ID.
	 */
	getSession(id: string): SessionData | undefined {
		return this.sessions.get(id);
	}

	/**
	 * Delete a session by ID.
	 */
	deleteSession(id: string): boolean {
		const deleted = this.sessions.delete(id);
		if (deleted) {
			// Fire-and-forget delete file
			this._deleteSessionFile(id);
		}
		return deleted;
	}

	/**
	 * List all sessions (metadata only, no grid data).
	 */
	listSessions(): Session[] {
		const result: Session[] = [];
		for (const data of this.sessions.values()) {
			result.push(data.session);
		}
		return result;
	}

	/**
	 * Persist the current state of a session to disk.
	 * Call this after tool executions or state changes.
	 */
	async persistSession(id: string): Promise<void> {
		await this._persistSession(id);
	}

	/**
	 * Update conversation messages for a session and persist.
	 */
	updateMessages(id: string, messages: Message[]): void {
		const data = this.sessions.get(id);
		if (!data) return;
		data.messages = messages;
		// Fire-and-forget persist
		this._persistSession(id);
	}

	/**
	 * Get conversation messages for a session.
	 */
	getMessages(id: string): Message[] {
		const data = this.sessions.get(id);
		return data?.messages ?? [];
	}

	// ── Private persistence methods ──────────────────────────

	private async _persistSession(id: string): Promise<void> {
		if (!this.persistence?.enabled) return;

		// Wait for initialization to complete (directory creation)
		if (this._initPromise) {
			await this._initPromise;
		}

		const data = this.sessions.get(id);
		if (!data) return;

		const gridState = data.executor.getGrid().getState();

		const persisted: PersistedSessionData = {
			session: data.session,
			gridState,
			messages: data.messages,
		};

		const filePath = this._sessionFilePath(id);

		try {
			// Ensure directory exists (may have been deleted or not yet created)
			await fs.mkdir(this.persistence.directory, { recursive: true });

			// Write to temp file first, then rename for atomicity
			const tempPath = filePath + '.tmp';
			await fs.writeFile(tempPath, JSON.stringify(persisted, null, 2), 'utf-8');
			await fs.rename(tempPath, filePath);
		} catch (err) {
			// Silently ignore ENOENT from cleanup races in tests
			if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
				console.error(`[SessionManager] Failed to persist session ${id}:`, err);
			}
		}
	}

	private async _deleteSessionFile(id: string): Promise<void> {
		if (!this.persistence?.enabled) return;

		// Wait for initialization to complete
		if (this._initPromise) {
			await this._initPromise;
		}

		const filePath = this._sessionFilePath(id);

		try {
			await fs.unlink(filePath);
		} catch (err) {
			// File might not exist — that's fine
			if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
				console.error(`[SessionManager] Failed to delete session file ${id}:`, err);
			}
		}
	}

	private async _loadAllSessions(): Promise<void> {
		if (!this.persistence?.enabled) return;

		let entries: string[];
		try {
			entries = await fs.readdir(this.persistence.directory);
		} catch {
			return; // Directory doesn't exist or can't be read
		}

		const jsonFiles = entries.filter((f) => f.endsWith('.json'));

		for (const file of jsonFiles) {
			const filePath = path.join(this.persistence.directory, file);
			try {
				const raw = await fs.readFile(filePath, 'utf-8');
				const persisted = JSON.parse(raw) as PersistedSessionData;

				this._restoreSession(persisted);
			} catch (err) {
				console.error(`[SessionManager] Failed to load session from ${file}, skipping:`, err);
				// Skip corrupted files — don't crash
			}
		}
	}

	private _restoreSession(persisted: PersistedSessionData): void {
		const { session, gridState, messages } = persisted;

		// Validate the minimum required fields
		if (!session?.id || !session?.config) {
			throw new Error('Invalid persisted session: missing id or config');
		}

		const { rows, cols, spacing } = session.config;
		const executor = new ToolExecutor({ rows, cols, spacing });

		// Restore grid state by replaying particles and connections
		this._restoreGridState(executor, gridState);

		this.sessions.set(session.id, {
			session,
			executor,
			messages: messages ?? [],
		});
	}

	private _restoreGridState(executor: ToolExecutor, gridState: SpaceState): void {
		if (!gridState) return;

		const grid = executor.getGrid();

		// Restore particles
		if (gridState.particles && Array.isArray(gridState.particles)) {
			for (const p of gridState.particles) {
				try {
					grid.setParticle(p.r, p.c, {
						color: p.color,
						opacity: p.opacity,
						size: p.size,
						layer: p.layer,
						group: p.group || undefined,
					});
				} catch {
					// Skip invalid particles
				}
			}
		}

		// Restore connections
		if (gridState.connections && Array.isArray(gridState.connections)) {
			for (const c of gridState.connections) {
				try {
					grid.connect(c.from, c.to, {
						color: c.color,
						width: c.width,
						opacity: c.opacity,
						style: c.style,
						curve: c.curve,
						directed: c.directed,
						group: c.group || undefined,
						layer: c.layer,
						label: c.label || undefined,
					});
				} catch {
					// Skip invalid connections
				}
			}
		}
	}

	private _sessionFilePath(id: string): string {
		if (!this.persistence?.enabled) return '';
		// Sanitize the session ID for use as a filename
		const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
		return path.join(this.persistence.directory, `${safeId}.json`);
	}
}
