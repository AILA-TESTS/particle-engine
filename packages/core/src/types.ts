// ============================================================
// Types — All interfaces and type definitions for @particle-engine/core
// ============================================================

/** Grid configuration */
export interface GridConfig {
  rows: number;
  cols: number;
  spacing: number;
}

/** Properties that can be set on a particle */
export interface ParticleProps {
  color: string;       // hex "#RRGGBB"
  opacity: number;     // 0.0–1.0
  size: number;        // multiplier (1.0 = default)
  layer: number;       // z-index
  group: string;       // group name ("" = ungrouped)
}

/** Full particle data returned by queries */
export interface ParticleData {
  row: number;
  col: number;
  active: boolean;
  color: string;
  opacity: number;
  size: number;
  layer: number;
  group: string;
}

/** A connection between two particles */
export interface Connection {
  id: string;
  from: [number, number];    // [row, col]
  to: [number, number];      // [row, col]
  color: string;             // hex "#RRGGBB"
  width: number;
  opacity: number;
  style: 'solid' | 'dashed' | 'dotted';
  curve: number;
  directed: boolean;
  group: string;
  layer: number;
  label: string;
}

/** Properties that can be set on a connection */
export interface ConnectionProps {
  color: string;
  width: number;
  opacity: number;
  style: 'solid' | 'dashed' | 'dotted';
  curve: number;
  directed: boolean;
  group: string;
  layer: number;
  label: string;
}

/** Serialized particle for LLM consumption (short keys for token efficiency) */
export interface SerializedParticle {
  r: number;           // row
  c: number;           // col
  color: string;
  opacity: number;
  size: number;
  layer: number;
  group: string;
}

/** Serialized connection for LLM consumption */
export interface SerializedConnection {
  id: string;
  from: [number, number];
  to: [number, number];
  color: string;
  width: number;
  opacity: number;
  style: 'solid' | 'dashed' | 'dotted';
  curve: number;
  directed: boolean;
  group: string;
  layer: number;
  label: string;
}

/** Sparse state representation for LLM */
export interface SpaceState {
  grid: { rows: number; cols: number; spacing: number };
  summary: { active_count: number; connection_count: number; groups: string[] };
  particles: SerializedParticle[];
  connections: SerializedConnection[];
}

/** Space info (quick summary without full data) */
export interface SpaceInfo {
  rows: number;
  cols: number;
  spacing: number;
  totalParticles: number;
  activeCount: number;
  connectionCount: number;
  groups: string[];
}

/** Options for getState() */
export interface GetStateOptions {
  region?: {
    rowStart: number;
    rowEnd: number;
    colStart: number;
    colEnd: number;
  };
  group?: string;
  includeInactive?: boolean;
}

/** Particle store — SoA typed arrays */
export interface ParticleStore {
  config: GridConfig;
  active: Uint8Array;
  colorR: Uint8Array;
  colorG: Uint8Array;
  colorB: Uint8Array;
  opacity: Float32Array;
  size: Float32Array;
  layer: Int16Array;
  group: Uint16Array;
}

/** Connection store — edge list + adjacency map */
export interface ConnectionStore {
  edges: Map<string, Connection>;
  adjacency: Map<number, Set<string>>;
}

/** Full state snapshot for undo/restore */
export interface StateSnapshot {
  particles: {
    active: Uint8Array;
    colorR: Uint8Array;
    colorG: Uint8Array;
    colorB: Uint8Array;
    opacity: Float32Array;
    size: Float32Array;
    layer: Int16Array;
    group: Uint16Array;
  };
  edges: Map<string, Connection>;
  adjacency: Map<number, Set<string>>;
  groupNames: Map<number, string>;
  groupIds: Map<string, number>;
  nextGroupId: number;
}

/** Default particle property values */
export const DEFAULT_PARTICLE_PROPS: ParticleProps = {
  color: '#FFFFFF',
  opacity: 1.0,
  size: 1.0,
  layer: 0,
  group: '',
};

/** Default connection property values */
export const DEFAULT_CONNECTION_PROPS: ConnectionProps = {
  color: '#FFFFFF',
  width: 1,
  opacity: 1.0,
  style: 'solid',
  curve: 0,
  directed: false,
  group: '',
  layer: 0,
  label: '',
};
