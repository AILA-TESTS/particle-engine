// ============================================================
// ConnectionStore — Edge list + adjacency map operations
// ============================================================

import type { Connection, ConnectionProps, ConnectionStore, GridConfig } from './types.js';
import { DEFAULT_CONNECTION_PROPS as DEFAULTS } from './types.js';
import { toIndex } from './particle-store.js';

/**
 * Create a new empty ConnectionStore.
 */
export function createConnectionStore(): ConnectionStore {
  return {
    edges: new Map(),
    adjacency: new Map(),
  };
}

/**
 * Generate a deterministic connection ID from endpoints.
 */
export function makeConnectionId(from: [number, number], to: [number, number]): string {
  return `c_${from[0]}_${from[1]}_${to[0]}_${to[1]}`;
}

/**
 * Generate a unique connection ID, appending a suffix if the base ID is taken.
 */
export function uniqueConnectionId(
  store: ConnectionStore,
  from: [number, number],
  to: [number, number]
): string {
  const base = makeConnectionId(from, to);
  if (!store.edges.has(base)) return base;
  // If duplicate, append a counter
  let counter = 2;
  while (store.edges.has(`${base}_${counter}`)) {
    counter++;
  }
  return `${base}_${counter}`;
}

/**
 * Add a connection to the store.
 */
export function addConnection(
  store: ConnectionStore,
  config: GridConfig,
  from: [number, number],
  to: [number, number],
  props?: Partial<ConnectionProps>
): Connection {
  const id = uniqueConnectionId(store, from, to);

  const connection: Connection = {
    id,
    from: [from[0], from[1]],
    to: [to[0], to[1]],
    color: props?.color ?? DEFAULTS.color,
    width: props?.width ?? DEFAULTS.width,
    opacity: props?.opacity ?? DEFAULTS.opacity,
    style: props?.style ?? DEFAULTS.style,
    curve: props?.curve ?? DEFAULTS.curve,
    directed: props?.directed ?? DEFAULTS.directed,
    group: props?.group ?? DEFAULTS.group,
    layer: props?.layer ?? DEFAULTS.layer,
    label: props?.label ?? DEFAULTS.label,
  };

  store.edges.set(id, connection);

  // Update adjacency for both endpoints
  const fromIdx = toIndex(config, from[0], from[1]);
  const toIdx = toIndex(config, to[0], to[1]);

  if (!store.adjacency.has(fromIdx)) {
    store.adjacency.set(fromIdx, new Set());
  }
  store.adjacency.get(fromIdx)!.add(id);

  if (!store.adjacency.has(toIdx)) {
    store.adjacency.set(toIdx, new Set());
  }
  store.adjacency.get(toIdx)!.add(id);

  return connection;
}

/**
 * Remove a connection by ID.
 */
export function removeConnection(
  store: ConnectionStore,
  config: GridConfig,
  id: string
): boolean {
  const conn = store.edges.get(id);
  if (!conn) return false;

  store.edges.delete(id);

  // Remove from adjacency
  const fromIdx = toIndex(config, conn.from[0], conn.from[1]);
  const toIdx = toIndex(config, conn.to[0], conn.to[1]);

  const fromSet = store.adjacency.get(fromIdx);
  if (fromSet) {
    fromSet.delete(id);
    if (fromSet.size === 0) store.adjacency.delete(fromIdx);
  }

  const toSet = store.adjacency.get(toIdx);
  if (toSet) {
    toSet.delete(id);
    if (toSet.size === 0) store.adjacency.delete(toIdx);
  }

  return true;
}

/**
 * Get all connections for a given particle (by index).
 */
export function getConnectionsForIndex(
  store: ConnectionStore,
  index: number
): Connection[] {
  const ids = store.adjacency.get(index);
  if (!ids) return [];

  const result: Connection[] = [];
  for (const id of ids) {
    const conn = store.edges.get(id);
    if (conn) result.push(conn);
  }
  return result;
}
