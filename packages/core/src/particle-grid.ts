// ============================================================
// ParticleGrid — Main entry point for the core particle engine
// ============================================================

import type {
  GridConfig,
  ParticleProps,
  ParticleData,
  Connection,
  ConnectionProps,
  SpaceState,
  SpaceInfo,
  GetStateOptions,
  StateSnapshot,
  ParticleStore,
  ConnectionStore,
  SerializedParticle,
} from './types.js';
import { DEFAULT_PARTICLE_PROPS, DEFAULT_CONNECTION_PROPS } from './types.js';
import { validateGridConfig, isInBounds, assertInBounds } from './validation.js';
import {
  createParticleStore,
  toIndex as storeToIndex,
  toRowCol as storeToRowCol,
  parseHexColor,
  toHexColor,
  countActive,
} from './particle-store.js';
import {
  createConnectionStore,
  addConnection,
  removeConnection,
  getConnectionsForIndex,
} from './connection-store.js';
import { serializeState } from './serialization.js';
import { createSnapshot, restoreSnapshot } from './snapshot.js';
import { GroupManager } from './group-manager.js';

export class ParticleGrid {
  private readonly config: GridConfig;
  private readonly store: ParticleStore;
  private readonly connStore: ConnectionStore;
  private readonly groupManager: GroupManager;

  constructor(config: GridConfig) {
    validateGridConfig(config);
    this.config = { ...config };
    this.store = createParticleStore(this.config);
    this.connStore = createConnectionStore();
    this.groupManager = new GroupManager();
  }

  // ── Index helpers ──────────────────────────────────────────

  /** Convert (row, col) to flat array index. */
  toIndex(row: number, col: number): number {
    return storeToIndex(this.config, row, col);
  }

  /** Convert flat index to [row, col]. */
  toRowCol(index: number): [number, number] {
    return storeToRowCol(this.config, index);
  }

  /** Check if (row, col) is within the grid. */
  isInBounds(row: number, col: number): boolean {
    return isInBounds(this.config, row, col);
  }

  // ── Particle operations ────────────────────────────────────

  /** Set (activate) a particle at the given position with optional properties. */
  setParticle(row: number, col: number, props?: Partial<ParticleProps>): void {
    assertInBounds(this.config, row, col);
    const idx = this.toIndex(row, col);

    const wasActive = this.store.active[idx] === 1;
    this.store.active[idx] = 1;

    if (props?.color !== undefined) {
      const [r, g, b] = parseHexColor(props.color);
      this.store.colorR[idx] = r;
      this.store.colorG[idx] = g;
      this.store.colorB[idx] = b;
    } else if (!wasActive) {
      // First activation — set default color
      const [r, g, b] = parseHexColor(DEFAULT_PARTICLE_PROPS.color);
      this.store.colorR[idx] = r;
      this.store.colorG[idx] = g;
      this.store.colorB[idx] = b;
    }

    if (props?.opacity !== undefined) {
      this.store.opacity[idx] = props.opacity;
    } else if (!wasActive) {
      this.store.opacity[idx] = DEFAULT_PARTICLE_PROPS.opacity;
    }

    if (props?.size !== undefined) {
      this.store.size[idx] = props.size;
    } else if (!wasActive) {
      this.store.size[idx] = DEFAULT_PARTICLE_PROPS.size;
    }

    if (props?.layer !== undefined) {
      this.store.layer[idx] = props.layer;
    }

    if (props?.group !== undefined) {
      const gid = this.groupManager.getOrCreateId(props.group);
      this.store.group[idx] = gid;
    }
  }

  /** Set multiple particles at once. */
  setParticles(particles: Array<{ row: number; col: number } & Partial<ParticleProps>>): void {
    for (const p of particles) {
      const { row, col, ...props } = p;
      this.setParticle(row, col, props);
    }
  }

  /** Deactivate a particle and reset its data. */
  clearParticle(row: number, col: number): void {
    assertInBounds(this.config, row, col);
    const idx = this.toIndex(row, col);
    this.store.active[idx] = 0;
    this.store.colorR[idx] = 0;
    this.store.colorG[idx] = 0;
    this.store.colorB[idx] = 0;
    this.store.opacity[idx] = 0;
    this.store.size[idx] = 0;
    this.store.layer[idx] = 0;
    this.store.group[idx] = 0;

    // Also remove any connections involving this particle
    const connections = getConnectionsForIndex(this.connStore, idx);
    for (const conn of connections) {
      removeConnection(this.connStore, this.config, conn.id);
    }
  }

  /**
   * Clear multiple particles.
   * - If coords is provided, clear those specific coordinates.
   * - If group is provided, clear all particles in that group.
   * - If neither is provided, clear all particles.
   */
  clearParticles(coords?: [number, number][], group?: string): void {
    if (coords) {
      for (const [row, col] of coords) {
        this.clearParticle(row, col);
      }
      return;
    }

    if (group !== undefined) {
      const gid = this.groupManager.getId(group);
      if (gid === undefined) return; // group doesn't exist
      for (let i = 0; i < this.store.active.length; i++) {
        if (this.store.active[i] === 1 && this.store.group[i] === gid) {
          const [r, c] = this.toRowCol(i);
          this.clearParticle(r, c);
        }
      }
      return;
    }

    // Clear all
    for (let i = 0; i < this.store.active.length; i++) {
      if (this.store.active[i] === 1) {
        const [r, c] = this.toRowCol(i);
        this.clearParticle(r, c);
      }
    }
  }

  /** Get particle data at the given position, or null if not active. */
  getParticle(row: number, col: number): ParticleData | null {
    assertInBounds(this.config, row, col);
    const idx = this.toIndex(row, col);
    if (this.store.active[idx] !== 1) return null;

    return {
      row,
      col,
      active: true,
      color: toHexColor(this.store.colorR[idx], this.store.colorG[idx], this.store.colorB[idx]),
      opacity: this.store.opacity[idx],
      size: this.store.size[idx],
      layer: this.store.layer[idx],
      group: this.groupManager.getName(this.store.group[idx]),
    };
  }

  /** Check if a particle is active at the given position. */
  isActive(row: number, col: number): boolean {
    if (!this.isInBounds(row, col)) return false;
    return this.store.active[this.toIndex(row, col)] === 1;
  }

  // ── Connection operations ──────────────────────────────────

  /** Create a connection between two particles. Returns the connection ID. */
  connect(
    from: [number, number],
    to: [number, number],
    props?: Partial<ConnectionProps>
  ): string {
    assertInBounds(this.config, from[0], from[1]);
    assertInBounds(this.config, to[0], to[1]);
    const conn = addConnection(this.connStore, this.config, from, to, props);
    return conn.id;
  }

  /** Create multiple connections at once. Returns array of connection IDs. */
  connectBatch(
    connections: Array<{
      from: [number, number];
      to: [number, number];
    } & Partial<ConnectionProps>>
  ): string[] {
    const ids: string[] = [];
    for (const c of connections) {
      const { from, to, ...props } = c;
      ids.push(this.connect(from, to, props));
    }
    return ids;
  }

  /** Remove a connection by ID. */
  disconnect(id: string): void {
    removeConnection(this.connStore, this.config, id);
  }

  /**
   * Remove multiple connections.
   * - If ids are provided, remove those specific connections.
   * - If endpoints are provided, remove connections matching those endpoints.
   * - If group is provided, remove all connections in that group.
   */
  disconnectBatch(
    ids?: string[],
    endpoints?: Array<{ from: [number, number]; to: [number, number] }>,
    group?: string
  ): void {
    if (ids) {
      for (const id of ids) {
        this.disconnect(id);
      }
    }

    if (endpoints) {
      for (const ep of endpoints) {
        // Find connections matching these endpoints
        const toRemove: string[] = [];
        for (const [id, conn] of this.connStore.edges) {
          if (
            conn.from[0] === ep.from[0] &&
            conn.from[1] === ep.from[1] &&
            conn.to[0] === ep.to[0] &&
            conn.to[1] === ep.to[1]
          ) {
            toRemove.push(id);
          }
        }
        for (const id of toRemove) {
          this.disconnect(id);
        }
      }
    }

    if (group !== undefined) {
      const toRemove: string[] = [];
      for (const [id, conn] of this.connStore.edges) {
        if (conn.group === group) {
          toRemove.push(id);
        }
      }
      for (const id of toRemove) {
        this.disconnect(id);
      }
    }
  }

  /** Get a connection by ID, or null if not found. */
  getConnection(id: string): Connection | null {
    return this.connStore.edges.get(id) ?? null;
  }

  /** Get all connections that involve a given particle. */
  getConnectionsForParticle(row: number, col: number): Connection[] {
    assertInBounds(this.config, row, col);
    const idx = this.toIndex(row, col);
    return getConnectionsForIndex(this.connStore, idx);
  }

  // ── State queries ──────────────────────────────────────────

  /** Get the serialized state (sparse JSON for LLM). */
  getState(options?: GetStateOptions): SpaceState {
    return serializeState(this.store, this.connStore, this.groupManager, options);
  }

  /** Get quick summary info about the space. */
  getSpaceInfo(): SpaceInfo {
    const activeCount = countActive(this.store);
    const groupSet = new Set<string>();
    for (let i = 0; i < this.store.active.length; i++) {
      if (this.store.active[i] === 1) {
        const name = this.groupManager.getName(this.store.group[i]);
        if (name !== '') groupSet.add(name);
      }
    }

    return {
      rows: this.config.rows,
      cols: this.config.cols,
      spacing: this.config.spacing,
      totalParticles: this.config.rows * this.config.cols,
      activeCount,
      connectionCount: this.connStore.edges.size,
      groups: Array.from(groupSet).sort(),
    };
  }

  /** Get all active neighbor particles (up, down, left, right, and diagonals). */
  getNeighbors(row: number, col: number): ParticleData[] {
    assertInBounds(this.config, row, col);
    const neighbors: ParticleData[] = [];
    const offsets = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1],
    ];

    for (const [dr, dc] of offsets) {
      const nr = row + dr;
      const nc = col + dc;
      if (this.isInBounds(nr, nc)) {
        const p = this.getParticle(nr, nc);
        if (p) neighbors.push(p);
      }
    }

    return neighbors;
  }

  // ── Group operations ───────────────────────────────────────

  /** Get all registered group names (excluding ungrouped). */
  getGroups(): string[] {
    // Return groups that actually have active particles
    const groupSet = new Set<string>();
    for (let i = 0; i < this.store.active.length; i++) {
      if (this.store.active[i] === 1) {
        const name = this.groupManager.getName(this.store.group[i]);
        if (name !== '') groupSet.add(name);
      }
    }
    // Also include connection groups
    for (const [, conn] of this.connStore.edges) {
      if (conn.group !== '') groupSet.add(conn.group);
    }
    return Array.from(groupSet).sort();
  }

  /** Get all active particles in a given group, serialized. */
  getGroupParticles(group: string): SerializedParticle[] {
    const gid = this.groupManager.getId(group);
    if (gid === undefined) return [];

    const result: SerializedParticle[] = [];
    for (let i = 0; i < this.store.active.length; i++) {
      if (this.store.active[i] === 1 && this.store.group[i] === gid) {
        const [row, col] = this.toRowCol(i);
        result.push({
          r: row,
          c: col,
          color: toHexColor(this.store.colorR[i], this.store.colorG[i], this.store.colorB[i]),
          opacity: this.store.opacity[i],
          size: this.store.size[i],
          layer: this.store.layer[i],
          group,
        });
      }
    }
    return result;
  }

  // ── Snapshot / Restore ─────────────────────────────────────

  /** Create a full state snapshot (deep copy). */
  snapshot(): StateSnapshot {
    return createSnapshot(this.store, this.connStore, this.groupManager);
  }

  /** Restore state from a snapshot. */
  restore(snap: StateSnapshot): void {
    restoreSnapshot(this.store, this.connStore, this.groupManager, snap);
  }

  // ── Raw store access ───────────────────────────────────────

  /** Get the underlying particle store (for advanced usage / renderers). */
  getParticleStore(): ParticleStore {
    return this.store;
  }

  /** Get the underlying connection store (for advanced usage / renderers). */
  getConnectionStore(): ConnectionStore {
    return this.connStore;
  }
}
