// ============================================================
// Serialization — State serialization to SpaceState for LLM consumption
// ============================================================

import type {
  ParticleStore,
  ConnectionStore,
  GridConfig,
  SpaceState,
  SerializedParticle,
  SerializedConnection,
  GetStateOptions,
} from './types.js';
import { toRowCol, toHexColor } from './particle-store.js';
import { GroupManager } from './group-manager.js';

/**
 * Serialize the current state to a SpaceState object.
 * Only active particles are included by default (sparse serialization).
 */
export function serializeState(
  store: ParticleStore,
  connectionStore: ConnectionStore,
  groupManager: GroupManager,
  options?: GetStateOptions
): SpaceState {
  const { config } = store;
  const particles: SerializedParticle[] = [];
  const connections: SerializedConnection[] = [];

  // Determine iteration bounds
  const rowStart = options?.region?.rowStart ?? 0;
  const rowEnd = options?.region?.rowEnd ?? config.rows - 1;
  const colStart = options?.region?.colStart ?? 0;
  const colEnd = options?.region?.colEnd ?? config.cols - 1;

  // Resolve group filter to a uint16 ID
  let groupFilterId: number | undefined;
  if (options?.group !== undefined) {
    const gid = groupManager.getId(options.group);
    if (gid === undefined) {
      // Group doesn't exist — return empty result
      groupFilterId = -1 as number; // will match nothing
    } else {
      groupFilterId = gid;
    }
  }

  const includeInactive = options?.includeInactive ?? false;

  // Iterate over the relevant region
  for (let row = rowStart; row <= rowEnd; row++) {
    for (let col = colStart; col <= colEnd; col++) {
      const idx = row * config.cols + col;
      const isActive = store.active[idx] === 1;

      if (!isActive && !includeInactive) continue;

      // Group filter
      if (groupFilterId !== undefined && store.group[idx] !== groupFilterId) continue;

      particles.push({
        r: row,
        c: col,
        color: toHexColor(store.colorR[idx], store.colorG[idx], store.colorB[idx]),
        opacity: store.opacity[idx],
        size: store.size[idx],
        layer: store.layer[idx],
        group: groupManager.getName(store.group[idx]),
      });
    }
  }

  // Serialize connections
  for (const [, conn] of connectionStore.edges) {
    // Region filter: include connection if at least one endpoint is in the region
    if (options?.region) {
      const fromInRegion =
        conn.from[0] >= rowStart &&
        conn.from[0] <= rowEnd &&
        conn.from[1] >= colStart &&
        conn.from[1] <= colEnd;
      const toInRegion =
        conn.to[0] >= rowStart &&
        conn.to[0] <= rowEnd &&
        conn.to[1] >= colStart &&
        conn.to[1] <= colEnd;
      if (!fromInRegion && !toInRegion) continue;
    }

    // Group filter for connections
    if (options?.group !== undefined && conn.group !== options.group) continue;

    connections.push({
      id: conn.id,
      from: [conn.from[0], conn.from[1]],
      to: [conn.to[0], conn.to[1]],
      color: conn.color,
      width: conn.width,
      opacity: conn.opacity,
      style: conn.style,
      curve: conn.curve,
      directed: conn.directed,
      group: conn.group,
      layer: conn.layer,
      label: conn.label,
    });
  }

  // Compute groups list from active particles
  const groupSet = new Set<string>();
  for (let i = 0; i < store.active.length; i++) {
    if (store.active[i] === 1) {
      const name = groupManager.getName(store.group[i]);
      if (name !== '') groupSet.add(name);
    }
  }
  // Also include connection groups
  for (const [, conn] of connectionStore.edges) {
    if (conn.group !== '') groupSet.add(conn.group);
  }

  const activeCount = particles.filter((_, idx) => {
    // If includeInactive, we need to count only active
    // But we can compute this separately for the summary
    return true;
  }).length;

  // Recount active for summary (not filtered)
  let totalActive = 0;
  for (let i = 0; i < store.active.length; i++) {
    if (store.active[i] === 1) totalActive++;
  }

  return {
    grid: {
      rows: config.rows,
      cols: config.cols,
      spacing: config.spacing,
    },
    summary: {
      active_count: totalActive,
      connection_count: connectionStore.edges.size,
      groups: Array.from(groupSet).sort(),
    },
    particles,
    connections,
  };
}
