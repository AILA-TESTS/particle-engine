import { describe, it, expect } from 'vitest';
import { SessionManager } from '../src/session-manager.js';

describe('SessionManager', () => {
	// ── Creation ────────────────────────────────────────────

	it('creates a session with default config', () => {
		const manager = new SessionManager();
		const { id, session } = manager.createSession();

		expect(id).toMatch(/^s_\d+_[0-9a-f]+$/);
		expect(session.id).toBe(id);
		expect(session.config).toEqual({ rows: 100, cols: 100, spacing: 10 });
		expect(session.createdAt).toBeGreaterThan(0);
	});

	it('creates a session with custom config', () => {
		const manager = new SessionManager();
		const { session } = manager.createSession({ rows: 50, cols: 50, spacing: 5 });

		expect(session.config).toEqual({ rows: 50, cols: 50, spacing: 5 });
	});

	it('creates a session with partial custom config', () => {
		const manager = new SessionManager();
		const { session } = manager.createSession({ rows: 30 });

		expect(session.config).toEqual({ rows: 30, cols: 100, spacing: 10 });
	});

	it('uses custom defaults from constructor', () => {
		const manager = new SessionManager({ rows: 20, cols: 20, spacing: 5 });
		const { session } = manager.createSession();

		expect(session.config).toEqual({ rows: 20, cols: 20, spacing: 5 });
	});

	it('generates unique session IDs', () => {
		const manager = new SessionManager();
		const ids = new Set<string>();

		for (let i = 0; i < 20; i++) {
			const { id } = manager.createSession();
			ids.add(id);
		}

		expect(ids.size).toBe(20);
	});

	// ── Retrieval ───────────────────────────────────────────

	it('gets an existing session', () => {
		const manager = new SessionManager();
		const { id } = manager.createSession();

		const data = manager.getSession(id);

		expect(data).toBeDefined();
		expect(data!.session.id).toBe(id);
		expect(data!.executor).toBeDefined();
	});

	it('returns undefined for non-existent session', () => {
		const manager = new SessionManager();

		const data = manager.getSession('s_nonexistent');

		expect(data).toBeUndefined();
	});

	// ── Deletion ────────────────────────────────────────────

	it('deletes an existing session', () => {
		const manager = new SessionManager();
		const { id } = manager.createSession();

		const deleted = manager.deleteSession(id);

		expect(deleted).toBe(true);
		expect(manager.getSession(id)).toBeUndefined();
	});

	it('returns false when deleting non-existent session', () => {
		const manager = new SessionManager();

		const deleted = manager.deleteSession('s_nonexistent');

		expect(deleted).toBe(false);
	});

	// ── Listing ─────────────────────────────────────────────

	it('lists all sessions', () => {
		const manager = new SessionManager();
		manager.createSession();
		manager.createSession({ rows: 50, cols: 50, spacing: 5 });
		manager.createSession({ rows: 30, cols: 30, spacing: 3 });

		const sessions = manager.listSessions();

		expect(sessions).toHaveLength(3);
		expect(sessions[0].config.rows).toBe(100);
		expect(sessions[1].config.rows).toBe(50);
		expect(sessions[2].config.rows).toBe(30);
	});

	it('returns empty list when no sessions', () => {
		const manager = new SessionManager();

		const sessions = manager.listSessions();

		expect(sessions).toHaveLength(0);
	});

	// ── Independence ────────────────────────────────────────

	it('each session has an independent grid state', () => {
		const manager = new SessionManager();
		const { id: id1 } = manager.createSession({ rows: 10, cols: 10, spacing: 10 });
		const { id: id2 } = manager.createSession({ rows: 10, cols: 10, spacing: 10 });

		// Modify session 1's grid via tool executor
		const data1 = manager.getSession(id1)!;
		data1.executor.execute('set_particles', {
			particles: [{ row: 0, col: 0, color: '#FF0000' }],
		});

		// Session 2's grid should be unaffected
		const data2 = manager.getSession(id2)!;
		const info1 = data1.executor.getGrid().getSpaceInfo();
		const info2 = data2.executor.getGrid().getSpaceInfo();

		expect(info1.activeCount).toBe(1);
		expect(info2.activeCount).toBe(0);
	});

	it('each session has its own tool executor', () => {
		const manager = new SessionManager();
		const { id: id1 } = manager.createSession({ rows: 10, cols: 10, spacing: 10 });
		const { id: id2 } = manager.createSession({ rows: 20, cols: 20, spacing: 5 });

		const data1 = manager.getSession(id1)!;
		const data2 = manager.getSession(id2)!;

		expect(data1.executor).not.toBe(data2.executor);

		const config1 = data1.executor.getGrid().getConfig();
		const config2 = data2.executor.getGrid().getConfig();

		expect(config1.rows).toBe(10);
		expect(config2.rows).toBe(20);
	});
});
