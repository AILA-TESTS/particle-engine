// ============================================================
// @particle-engine/core — Public API
// ============================================================

// Main class
export { ParticleGrid } from './particle-grid.js';

// Types
export type {
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
  SerializedConnection,
} from './types.js';

export { DEFAULT_PARTICLE_PROPS, DEFAULT_CONNECTION_PROPS } from './types.js';

// Particle store utilities
export {
  createParticleStore,
  toIndex,
  toRowCol,
  parseHexColor,
  toHexColor,
  countActive,
} from './particle-store.js';

// Connection store utilities
export {
  createConnectionStore,
  makeConnectionId,
  addConnection,
  removeConnection,
  getConnectionsForIndex,
} from './connection-store.js';

// Serialization
export { serializeState } from './serialization.js';

// Snapshot
export { createSnapshot, restoreSnapshot } from './snapshot.js';

// Group manager
export { GroupManager } from './group-manager.js';

// Validation
export { isInBounds, assertInBounds, validateGridConfig } from './validation.js';
