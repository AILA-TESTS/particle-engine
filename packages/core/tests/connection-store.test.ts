import { describe, it, expect } from 'vitest';
import {
  createConnectionStore,
  makeConnectionId,
  addConnection,
  removeConnection,
  getConnectionsForIndex,
} from '../src/connection-store.js';
import { toIndex } from '../src/particle-store.js';
import type { GridConfig } from '../src/types.js';

const config: GridConfig = { rows: 10, cols: 10, spacing: 16 };

describe('makeConnectionId', () => {
  it('creates deterministic IDs from endpoints', () => {
    expect(makeConnectionId([0, 0], [1, 1])).toBe('c_0_0_1_1');
    expect(makeConnectionId([5, 3], [8, 9])).toBe('c_5_3_8_9');
  });
});

describe('createConnectionStore', () => {
  it('creates empty maps', () => {
    const store = createConnectionStore();
    expect(store.edges.size).toBe(0);
    expect(store.adjacency.size).toBe(0);
  });
});

describe('addConnection', () => {
  it('adds a connection with default properties', () => {
    const store = createConnectionStore();
    const conn = addConnection(store, config, [0, 0], [1, 1]);
    expect(conn.id).toBe('c_0_0_1_1');
    expect(conn.from).toEqual([0, 0]);
    expect(conn.to).toEqual([1, 1]);
    expect(conn.color).toBe('#FFFFFF');
    expect(conn.width).toBe(1);
    expect(conn.opacity).toBe(1.0);
    expect(conn.style).toBe('solid');
    expect(conn.curve).toBe(0);
    expect(conn.directed).toBe(false);
    expect(conn.group).toBe('');
    expect(conn.layer).toBe(0);
    expect(conn.label).toBe('');
  });

  it('adds a connection with custom properties', () => {
    const store = createConnectionStore();
    const conn = addConnection(store, config, [2, 3], [4, 5], {
      color: '#FF0000',
      width: 3,
      style: 'dashed',
      directed: true,
      label: 'edge1',
    });
    expect(conn.color).toBe('#FF0000');
    expect(conn.width).toBe(3);
    expect(conn.style).toBe('dashed');
    expect(conn.directed).toBe(true);
    expect(conn.label).toBe('edge1');
  });

  it('updates adjacency for both endpoints', () => {
    const store = createConnectionStore();
    const conn = addConnection(store, config, [0, 0], [1, 1]);
    const fromIdx = toIndex(config, 0, 0);
    const toIdx = toIndex(config, 1, 1);
    expect(store.adjacency.get(fromIdx)?.has(conn.id)).toBe(true);
    expect(store.adjacency.get(toIdx)?.has(conn.id)).toBe(true);
  });

  it('generates unique IDs for duplicate endpoints', () => {
    const store = createConnectionStore();
    const conn1 = addConnection(store, config, [0, 0], [1, 1]);
    const conn2 = addConnection(store, config, [0, 0], [1, 1]);
    expect(conn1.id).not.toBe(conn2.id);
    expect(store.edges.size).toBe(2);
  });

  it('stores connection in edges map', () => {
    const store = createConnectionStore();
    const conn = addConnection(store, config, [3, 4], [5, 6]);
    expect(store.edges.get(conn.id)).toBe(conn);
  });
});

describe('removeConnection', () => {
  it('removes an existing connection', () => {
    const store = createConnectionStore();
    const conn = addConnection(store, config, [0, 0], [1, 1]);
    const result = removeConnection(store, config, conn.id);
    expect(result).toBe(true);
    expect(store.edges.size).toBe(0);
  });

  it('returns false for non-existent connection', () => {
    const store = createConnectionStore();
    expect(removeConnection(store, config, 'nonexistent')).toBe(false);
  });

  it('cleans up adjacency after removal', () => {
    const store = createConnectionStore();
    const conn = addConnection(store, config, [0, 0], [1, 1]);
    removeConnection(store, config, conn.id);
    const fromIdx = toIndex(config, 0, 0);
    const toIdx = toIndex(config, 1, 1);
    // Adjacency entries should be cleaned up when empty
    expect(store.adjacency.has(fromIdx)).toBe(false);
    expect(store.adjacency.has(toIdx)).toBe(false);
  });

  it('does not affect other connections sharing an endpoint', () => {
    const store = createConnectionStore();
    const conn1 = addConnection(store, config, [0, 0], [1, 1]);
    const conn2 = addConnection(store, config, [0, 0], [2, 2]);
    removeConnection(store, config, conn1.id);

    expect(store.edges.has(conn2.id)).toBe(true);
    const fromIdx = toIndex(config, 0, 0);
    expect(store.adjacency.get(fromIdx)?.has(conn2.id)).toBe(true);
  });
});

describe('getConnectionsForIndex', () => {
  it('returns empty array for particle with no connections', () => {
    const store = createConnectionStore();
    expect(getConnectionsForIndex(store, 0)).toEqual([]);
  });

  it('returns all connections for a particle', () => {
    const store = createConnectionStore();
    const conn1 = addConnection(store, config, [0, 0], [1, 1]);
    const conn2 = addConnection(store, config, [0, 0], [2, 2]);
    addConnection(store, config, [3, 3], [4, 4]); // unrelated

    const fromIdx = toIndex(config, 0, 0);
    const result = getConnectionsForIndex(store, fromIdx);
    expect(result.length).toBe(2);
    expect(result.map((c) => c.id)).toContain(conn1.id);
    expect(result.map((c) => c.id)).toContain(conn2.id);
  });
});
