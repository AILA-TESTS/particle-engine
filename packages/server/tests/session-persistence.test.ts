// ============================================================
// Tests — Session Persistence (file-based JSON)
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../src/session-manager.js';
import type { PersistedSessionData } from '../src/types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

// ── Helpers ────────────────────────────────────────────────

let tempDir: string;

async function createTempDir(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), 'pe-server-test-'));
}

async function cleanupDir(dir: string): Promise<void> {
	try {
		await fs.rm(dir, { recursive: true, force: true });
	} catch {
		// ignore
	}
}

async function listJsonFiles(dir: string): Promise<string[]> {
	try {
		const entries = await fs.readdir(dir);
		return entries.filter((f) => f.endsWith('.json'));
	} catch {
		return [];
	}
}

async function readSessionFile(dir: string, id: string): Promise<PersistedSessionData> {
	const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
	const filePath = path.join(dir, `${safeId}.json`);
	const raw = await fs.readFile(filePath, 'utf-8');
	return JSON.parse(raw);
}

// Small delay for fire-and-forget writes to complete
function waitForIO(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 50));
}

// ── Tests ──────────────────────────────────────────────────

describe('Session Persistence', () => {
	beforeEach(async () => {
		tempDir = await createTempDir();
	});

	afterEach(async () => {
		await cleanupDir(tempDir);
	});

	// ── Backward compatibility ─────────────────────────────

	describe('backward compatibility', () => {
		it('works without persistence config (pure in-memory)', () => {
			const manager = new SessionManager();
			const { id, session } = manager.createSession();

			expect(id).toMatch(/^s_\d+_[0-9a-f]+$/);
			expect(session.config).toEqual({ rows: 100, cols: 100, spacing: 10 });
		});

		it('works with old-style constructor (rows/cols/spacing only)', () => {
			const manager = new SessionManager({ rows: 50, cols: 50, spacing: 5 });
			const { session } = manager.createSession();

			expect(session.config).toEqual({ rows: 50, cols: 50, spacing: 5 });
		});

		it('no files are created when persistence is not configured', async () => {
			const manager = new SessionManager();
			manager.createSession();
			await waitForIO();

			// No session files should exist anywhere
			const files = await listJsonFiles(tempDir);
			expect(files).toHaveLength(0);
		});

		it('no files are created when persistence is explicitly disabled', async () => {
			const manager = new SessionManager({
				persistence: { enabled: false, directory: tempDir },
			});
			manager.createSession();
			await waitForIO();

			const files = await listJsonFiles(tempDir);
			expect(files).toHaveLength(0);
		});
	});

	// ── File creation ──────────────────────────────────────

	describe('file creation', () => {
		it('creates a JSON file on session creation', async () => {
			const manager = new SessionManager({
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			manager.createSession({ rows: 10, cols: 10, spacing: 10 });
			await waitForIO();

			const files = await listJsonFiles(tempDir);
			expect(files).toHaveLength(1);
		});

		it('creates separate files for each session', async () => {
			const manager = new SessionManager({
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			manager.createSession();
			manager.createSession();
			manager.createSession();
			await waitForIO();

			const files = await listJsonFiles(tempDir);
			expect(files).toHaveLength(3);
		});

		it('persisted file contains valid JSON with correct structure', async () => {
			const manager = new SessionManager({
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			const { id, session } = manager.createSession({ rows: 10, cols: 10, spacing: 10 });
			await waitForIO();

			const data = await readSessionFile(tempDir, id);
			expect(data.session.id).toBe(id);
			expect(data.session.config).toEqual({ rows: 10, cols: 10, spacing: 10 });
			expect(data.session.createdAt).toBe(session.createdAt);
			expect(data.gridState).toBeDefined();
			expect(data.gridState.grid).toEqual({ rows: 10, cols: 10, spacing: 10 });
			expect(data.gridState.particles).toEqual([]);
			expect(data.gridState.connections).toEqual([]);
			expect(data.messages).toEqual([]);
		});

		it('auto-creates the persistence directory if it does not exist', async () => {
			const nestedDir = path.join(tempDir, 'nested', 'deep', 'sessions');
			const manager = new SessionManager({
				persistence: { enabled: true, directory: nestedDir },
			});
			await manager.initialize();

			manager.createSession();
			await waitForIO();

			const files = await listJsonFiles(nestedDir);
			expect(files).toHaveLength(1);
		});
	});

	// ── State persistence after tool execution ─────────────

	describe('state persistence after tool execution', () => {
		it('persists particle state after tool execution', async () => {
			const manager = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			const { id } = manager.createSession();
			const data = manager.getSession(id)!;

			// Execute a tool to set particles
			data.executor.execute('set_particles', {
				particles: [
					{ row: 0, col: 0, color: '#FF0000' },
					{ row: 5, col: 5, color: '#00FF00', opacity: 0.5 },
				],
			});

			// Trigger persist
			await manager.persistSession(id);

			const persisted = await readSessionFile(tempDir, id);
			expect(persisted.gridState.particles).toHaveLength(2);
			expect(persisted.gridState.summary.active_count).toBe(2);

			// Verify particle details
			const p1 = persisted.gridState.particles.find((p) => p.r === 0 && p.c === 0);
			expect(p1).toBeDefined();
			expect(p1!.color).toBe('#FF0000');

			const p2 = persisted.gridState.particles.find((p) => p.r === 5 && p.c === 5);
			expect(p2).toBeDefined();
			expect(p2!.color).toBe('#00FF00');
			expect(p2!.opacity).toBeCloseTo(0.5);
		});

		it('persists connection state', async () => {
			const manager = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			const { id } = manager.createSession();
			const data = manager.getSession(id)!;

			// Create particles and connect them
			data.executor.execute('set_particles', {
				particles: [
					{ row: 0, col: 0 },
					{ row: 9, col: 9 },
				],
			});
			data.executor.execute('connect', {
				connections: [
					{ from: [0, 0], to: [9, 9], color: '#0000FF', width: 2 },
				],
			});

			await manager.persistSession(id);

			const persisted = await readSessionFile(tempDir, id);
			expect(persisted.gridState.connections).toHaveLength(1);
			expect(persisted.gridState.connections[0].color).toBe('#0000FF');
			expect(persisted.gridState.connections[0].width).toBe(2);
			expect(persisted.gridState.connections[0].from).toEqual([0, 0]);
			expect(persisted.gridState.connections[0].to).toEqual([9, 9]);
		});

		it('persists conversation messages', async () => {
			const manager = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			const { id } = manager.createSession();

			const messages = [
				{ role: 'system' as const, content: 'You are a test assistant.' },
				{ role: 'user' as const, content: 'Draw a circle' },
				{ role: 'assistant' as const, content: 'Done!' },
			];
			manager.updateMessages(id, messages);
			await waitForIO();

			const persisted = await readSessionFile(tempDir, id);
			expect(persisted.messages).toHaveLength(3);
			expect(persisted.messages[0].role).toBe('system');
			expect(persisted.messages[1].role).toBe('user');
			expect(persisted.messages[2].role).toBe('assistant');
		});
	});

	// ── Session recovery (load on startup) ─────────────────

	describe('session recovery', () => {
		it('restores sessions from disk on initialization', async () => {
			// Create a manager and populate it
			const manager1 = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager1.initialize();

			const { id: id1 } = manager1.createSession();
			const { id: id2 } = manager1.createSession({ rows: 20, cols: 20, spacing: 5 });

			// Add some state to session 1
			const data1 = manager1.getSession(id1)!;
			data1.executor.execute('set_particles', {
				particles: [{ row: 0, col: 0, color: '#FF0000' }],
			});
			await manager1.persistSession(id1);
			await manager1.persistSession(id2);

			// Create a NEW manager pointing to the same directory (simulates restart)
			const manager2 = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager2.initialize();

			// Both sessions should be loaded
			const sessions = manager2.listSessions();
			expect(sessions).toHaveLength(2);

			// Verify session 1 has its particle
			const recovered1 = manager2.getSession(id1);
			expect(recovered1).toBeDefined();
			const info1 = recovered1!.executor.getGrid().getSpaceInfo();
			expect(info1.activeCount).toBe(1);
			expect(info1.rows).toBe(10);

			// Verify session 2 has its config
			const recovered2 = manager2.getSession(id2);
			expect(recovered2).toBeDefined();
			expect(recovered2!.session.config).toEqual({ rows: 20, cols: 20, spacing: 5 });
			const info2 = recovered2!.executor.getGrid().getSpaceInfo();
			expect(info2.activeCount).toBe(0);
		});

		it('restores particle properties (color, opacity, size, group)', async () => {
			const manager1 = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager1.initialize();

			const { id } = manager1.createSession();
			const data = manager1.getSession(id)!;
			data.executor.execute('set_particles', {
				particles: [
					{ row: 3, col: 7, color: '#AABBCC', opacity: 0.75, size: 2.5, group: 'stars' },
				],
			});
			await manager1.persistSession(id);

			// Restart
			const manager2 = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager2.initialize();

			const recovered = manager2.getSession(id)!;
			const particle = recovered.executor.getGrid().getParticle(3, 7);
			expect(particle).not.toBeNull();
			expect(particle!.color).toBe('#AABBCC');
			expect(particle!.opacity).toBeCloseTo(0.75);
			expect(particle!.size).toBeCloseTo(2.5);
			expect(particle!.group).toBe('stars');
		});

		it('restores connections', async () => {
			const manager1 = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager1.initialize();

			const { id } = manager1.createSession();
			const data = manager1.getSession(id)!;
			data.executor.execute('set_particles', {
				particles: [{ row: 0, col: 0 }, { row: 9, col: 9 }],
			});
			data.executor.execute('connect', {
				connections: [{ from: [0, 0], to: [9, 9], color: '#FF0000', width: 3 }],
			});
			await manager1.persistSession(id);

			// Restart
			const manager2 = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager2.initialize();

			const recovered = manager2.getSession(id)!;
			const info = recovered.executor.getGrid().getSpaceInfo();
			expect(info.connectionCount).toBe(1);
			expect(info.activeCount).toBe(2);
		});

		it('restores conversation messages', async () => {
			const manager1 = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager1.initialize();

			const { id } = manager1.createSession();
			manager1.updateMessages(id, [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi there!' },
			]);
			await waitForIO();

			// Restart
			const manager2 = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager2.initialize();

			const messages = manager2.getMessages(id);
			expect(messages).toHaveLength(2);
			expect(messages[0]).toEqual({ role: 'user', content: 'Hello' });
			expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
		});
	});

	// ── Session deletion ───────────────────────────────────

	describe('file cleanup on deletion', () => {
		it('removes the file when a session is deleted', async () => {
			const manager = new SessionManager({
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			const { id } = manager.createSession();
			await waitForIO();

			// File should exist
			let files = await listJsonFiles(tempDir);
			expect(files).toHaveLength(1);

			// Delete session
			const deleted = manager.deleteSession(id);
			expect(deleted).toBe(true);
			await waitForIO();

			// File should be gone
			files = await listJsonFiles(tempDir);
			expect(files).toHaveLength(0);
		});

		it('handles deletion of non-existent session gracefully', async () => {
			const manager = new SessionManager({
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			const deleted = manager.deleteSession('s_nonexistent');
			expect(deleted).toBe(false);
			// Should not throw
		});
	});

	// ── Edge cases ─────────────────────────────────────────

	describe('edge cases', () => {
		it('handles corrupted JSON files gracefully (skips them)', async () => {
			// Write a corrupted file
			const corruptedPath = path.join(tempDir, 's_corrupted.json');
			await fs.writeFile(corruptedPath, 'this is not valid json{{{', 'utf-8');

			// Also write a valid session file
			const validData: PersistedSessionData = {
				session: {
					id: 's_valid_123',
					createdAt: Date.now(),
					config: { rows: 10, cols: 10, spacing: 10 },
				},
				gridState: {
					grid: { rows: 10, cols: 10, spacing: 10 },
					summary: { active_count: 0, connection_count: 0, groups: [] },
					particles: [],
					connections: [],
				},
				messages: [],
			};
			await fs.writeFile(
				path.join(tempDir, 's_valid_123.json'),
				JSON.stringify(validData),
				'utf-8',
			);

			const manager = new SessionManager({
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			// Should have loaded only the valid session
			const sessions = manager.listSessions();
			expect(sessions).toHaveLength(1);
			expect(sessions[0].id).toBe('s_valid_123');
		});

		it('handles empty persistence directory', async () => {
			const manager = new SessionManager({
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			const sessions = manager.listSessions();
			expect(sessions).toHaveLength(0);
		});

		it('ignores non-JSON files in the directory', async () => {
			// Write some non-JSON files
			await fs.writeFile(path.join(tempDir, 'README.md'), '# Notes', 'utf-8');
			await fs.writeFile(path.join(tempDir, 'data.txt'), 'hello', 'utf-8');

			const manager = new SessionManager({
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			const sessions = manager.listSessions();
			expect(sessions).toHaveLength(0);
		});

		it('handles file with missing required fields', async () => {
			// Write a file with incomplete data
			await fs.writeFile(
				path.join(tempDir, 's_incomplete.json'),
				JSON.stringify({ session: { id: null } }),
				'utf-8',
			);

			const manager = new SessionManager({
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			// Should have skipped the invalid file
			const sessions = manager.listSessions();
			expect(sessions).toHaveLength(0);
		});

		it('updates file on re-persist (overwrites old state)', async () => {
			const manager = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			const { id } = manager.createSession();
			const data = manager.getSession(id)!;

			// Set one particle
			data.executor.execute('set_particles', {
				particles: [{ row: 0, col: 0, color: '#FF0000' }],
			});
			await manager.persistSession(id);

			let persisted = await readSessionFile(tempDir, id);
			expect(persisted.gridState.particles).toHaveLength(1);

			// Add another particle
			data.executor.execute('set_particles', {
				particles: [{ row: 1, col: 1, color: '#00FF00' }],
			});
			await manager.persistSession(id);

			persisted = await readSessionFile(tempDir, id);
			expect(persisted.gridState.particles).toHaveLength(2);
		});

		it('session created after initialization works correctly', async () => {
			const manager = new SessionManager({
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			// Create session after init
			const { id } = manager.createSession({ rows: 15, cols: 15, spacing: 8 });
			await waitForIO();

			// Verify file exists
			const files = await listJsonFiles(tempDir);
			expect(files).toHaveLength(1);

			// Verify contents
			const persisted = await readSessionFile(tempDir, id);
			expect(persisted.session.config).toEqual({ rows: 15, cols: 15, spacing: 8 });
		});
	});

	// ── Full round-trip test ───────────────────────────────

	describe('full round-trip', () => {
		it('survives a simulated server restart with complex state', async () => {
			// === STEP 1: First "server" instance ===
			const manager1 = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager1.initialize();

			const { id } = manager1.createSession();
			const data = manager1.getSession(id)!;

			// Build up complex state
			data.executor.execute('set_particles', {
				particles: [
					{ row: 0, col: 0, color: '#FF0000', size: 2.0, group: 'corners' },
					{ row: 0, col: 9, color: '#00FF00', size: 1.5, group: 'corners' },
					{ row: 9, col: 0, color: '#0000FF', opacity: 0.5, group: 'corners' },
					{ row: 9, col: 9, color: '#FFFF00', group: 'corners' },
					{ row: 5, col: 5, color: '#FF00FF', group: 'center' },
				],
			});

			data.executor.execute('connect', {
				connections: [
					{ from: [0, 0], to: [0, 9], color: '#FFFFFF' },
					{ from: [0, 9], to: [9, 9], color: '#CCCCCC', width: 2 },
					{ from: [9, 9], to: [9, 0], color: '#888888' },
					{ from: [9, 0], to: [0, 0], color: '#444444' },
					{ from: [5, 5], to: [0, 0], color: '#FF00FF', style: 'dashed' },
				],
			});

			// Add conversation history
			manager1.updateMessages(id, [
				{ role: 'user', content: 'Draw a box with a center dot' },
				{ role: 'assistant', content: 'I created a box connecting the four corners with a center particle.' },
			]);

			await manager1.persistSession(id);

			// === STEP 2: "Restart" — new manager, same directory ===
			const manager2 = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager2.initialize();

			// Verify sessions are restored
			const sessions = manager2.listSessions();
			expect(sessions).toHaveLength(1);
			expect(sessions[0].id).toBe(id);

			const recovered = manager2.getSession(id)!;
			const grid = recovered.executor.getGrid();
			const info = grid.getSpaceInfo();

			// Verify particle count
			expect(info.activeCount).toBe(5);

			// Verify connection count
			expect(info.connectionCount).toBe(5);

			// Verify specific particle
			const centerParticle = grid.getParticle(5, 5);
			expect(centerParticle).not.toBeNull();
			expect(centerParticle!.color).toBe('#FF00FF');
			expect(centerParticle!.group).toBe('center');

			const cornerParticle = grid.getParticle(0, 0);
			expect(cornerParticle).not.toBeNull();
			expect(cornerParticle!.color).toBe('#FF0000');
			expect(cornerParticle!.size).toBeCloseTo(2.0);
			expect(cornerParticle!.group).toBe('corners');

			// Verify groups
			expect(info.groups).toContain('corners');
			expect(info.groups).toContain('center');

			// Verify conversation messages
			const messages = manager2.getMessages(id);
			expect(messages).toHaveLength(2);
			expect(messages[0].content).toBe('Draw a box with a center dot');

			// === STEP 3: Modify state in second manager and persist ===
			recovered.executor.execute('set_particles', {
				particles: [{ row: 2, col: 2, color: '#ABCDEF' }],
			});
			await manager2.persistSession(id);

			// === STEP 4: Third "restart" ===
			const manager3 = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager3.initialize();

			const final = manager3.getSession(id)!;
			const finalInfo = final.executor.getGrid().getSpaceInfo();
			expect(finalInfo.activeCount).toBe(6); // 5 original + 1 new
		});
	});

	// ── persistSession / updateMessages API ────────────────

	describe('API methods', () => {
		it('persistSession is a no-op when persistence is disabled', async () => {
			const manager = new SessionManager();
			const { id } = manager.createSession();

			// Should not throw
			await manager.persistSession(id);
		});

		it('persistSession for non-existent session is a no-op', async () => {
			const manager = new SessionManager({
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			// Should not throw
			await manager.persistSession('s_nonexistent');
		});

		it('updateMessages updates in-memory and persists', async () => {
			const manager = new SessionManager({
				rows: 10, cols: 10, spacing: 10,
				persistence: { enabled: true, directory: tempDir },
			});
			await manager.initialize();

			const { id } = manager.createSession();
			manager.updateMessages(id, [{ role: 'user', content: 'test' }]);
			await waitForIO();

			// In-memory check
			expect(manager.getMessages(id)).toHaveLength(1);

			// On-disk check
			const persisted = await readSessionFile(tempDir, id);
			expect(persisted.messages).toHaveLength(1);
		});

		it('getMessages returns empty array for non-existent session', () => {
			const manager = new SessionManager();
			expect(manager.getMessages('s_nonexistent')).toEqual([]);
		});
	});
});
