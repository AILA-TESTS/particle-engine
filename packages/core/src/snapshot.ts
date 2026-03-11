// ============================================================
// Snapshot — Full state snapshot and restore logic
// ============================================================

import type {
  ParticleStore,
  ConnectionStore,
  Connection,
  StateSnapshot,
} from './types.js';
import { GroupManager } from './group-manager.js';

/**
 * Create a deep copy snapshot of the entire engine state.
 */
export function createSnapshot(
  store: ParticleStore,
  connectionStore: ConnectionStore,
  groupManager: GroupManager
): StateSnapshot {
  // Deep copy typed arrays
  const particles = {
    active: new Uint8Array(store.active),
    colorR: new Uint8Array(store.colorR),
    colorG: new Uint8Array(store.colorG),
    colorB: new Uint8Array(store.colorB),
    opacity: new Float32Array(store.opacity),
    size: new Float32Array(store.size),
    layer: new Int16Array(store.layer),
    group: new Uint16Array(store.group),
  };

  // Deep copy edges
  const edges = new Map<string, Connection>();
  for (const [id, conn] of connectionStore.edges) {
    edges.set(id, {
      ...conn,
      from: [conn.from[0], conn.from[1]],
      to: [conn.to[0], conn.to[1]],
    });
  }

  // Deep copy adjacency
  const adjacency = new Map<number, Set<string>>();
  for (const [idx, ids] of connectionStore.adjacency) {
    adjacency.set(idx, new Set(ids));
  }

  // Deep copy group manager state
  const gmSnap = groupManager.snapshot();

  return {
    particles,
    edges,
    adjacency,
    groupNames: gmSnap.idToName,
    groupIds: gmSnap.nameToId,
    nextGroupId: gmSnap.nextId,
  };
}

/**
 * Restore engine state from a snapshot.
 */
export function restoreSnapshot(
  store: ParticleStore,
  connectionStore: ConnectionStore,
  groupManager: GroupManager,
  snapshot: StateSnapshot
): void {
  // Restore typed arrays
  store.active.set(snapshot.particles.active);
  store.colorR.set(snapshot.particles.colorR);
  store.colorG.set(snapshot.particles.colorG);
  store.colorB.set(snapshot.particles.colorB);
  store.opacity.set(snapshot.particles.opacity);
  store.size.set(snapshot.particles.size);
  store.layer.set(snapshot.particles.layer);
  store.group.set(snapshot.particles.group);

  // Restore edges
  connectionStore.edges.clear();
  for (const [id, conn] of snapshot.edges) {
    connectionStore.edges.set(id, {
      ...conn,
      from: [conn.from[0], conn.from[1]],
      to: [conn.to[0], conn.to[1]],
    });
  }

  // Restore adjacency
  connectionStore.adjacency.clear();
  for (const [idx, ids] of snapshot.adjacency) {
    connectionStore.adjacency.set(idx, new Set(ids));
  }

  // Restore group manager
  groupManager.restore({
    nameToId: new Map(snapshot.groupIds),
    idToName: new Map(snapshot.groupNames),
    nextId: snapshot.nextGroupId,
  });
}
