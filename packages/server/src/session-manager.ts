// ============================================================
// SessionManager — In-memory session store
// ============================================================

import { ToolExecutor } from '@particle-engine/tools';
import type { Session, SessionConfig } from './types.js';

/** Internal session data (session metadata + executor) */
export interface SessionData {
	session: Session;
	executor: ToolExecutor;
}

/** Default grid dimensions */
const DEFAULT_ROWS = 100;
const DEFAULT_COLS = 100;
const DEFAULT_SPACING = 10;

/**
 * Manages in-memory sessions, each with its own grid and tool executor.
 */
export class SessionManager {
	private sessions: Map<string, SessionData> = new Map();
	private defaultRows: number;
	private defaultCols: number;
	private defaultSpacing: number;

	constructor(defaults?: { rows?: number; cols?: number; spacing?: number }) {
		this.defaultRows = defaults?.rows ?? DEFAULT_ROWS;
		this.defaultCols = defaults?.cols ?? DEFAULT_COLS;
		this.defaultSpacing = defaults?.spacing ?? DEFAULT_SPACING;
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

		this.sessions.set(id, { session, executor });

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
		return this.sessions.delete(id);
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
}
