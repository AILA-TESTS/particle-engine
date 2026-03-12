# @particle-engine/core

The zero-dependency particle grid engine. Manages a bounded 2D grid of particles and their connections using a Struct-of-Arrays (SoA) layout backed by typed arrays for cache-efficient batch operations.

## Installation

This package is part of the `particle-engine` monorepo. It has **no external dependencies** and runs in any JavaScript environment: Node.js, browsers, Deno, and edge runtimes.

```bash
pnpm add @particle-engine/core
```

## Basic Usage

```typescript
import { ParticleGrid } from '@particle-engine/core';

// Create a 100×100 grid with 10px spacing between positions
const grid = new ParticleGrid({ rows: 100, cols: 100, spacing: 10 });

// Activate particles at specific grid coordinates
grid.setParticle(10, 20, { color: '#FF6B6B', size: 1.5, opacity: 1.0 });
grid.setParticles([
  { row: 20, col: 30, color: '#4ECDC4' },
  { row: 20, col: 40, color: '#4ECDC4' },
  { row: 30, col: 35, color: '#FFE66D' },
]);

// Connect particles with lines
const connId = grid.connect([20, 30], [20, 40], {
  color: '#FFFFFF',
  width: 1,
  style: 'solid',
});

// Read serialized state (sparse JSON — only active particles)
const state = grid.getState();
// { grid: { rows, cols, spacing }, summary: {...}, particles: [...], connections: [...] }

// Undo/redo via snapshots
const snap = grid.snapshot();
grid.clearParticles();
grid.restore(snap); // particles are back
```

## API Overview

### `ParticleGrid`

The main entry point. All operations are synchronous.

#### Construction

```typescript
new ParticleGrid(config: GridConfig)
```

`GridConfig`:
- `rows: number` — grid height in cells
- `cols: number` — grid width in cells
- `spacing: number` — pixel distance between adjacent grid positions

#### Particle operations

| Method | Description |
|--------|-------------|
| `setParticle(row, col, props?)` | Activate or update a single particle |
| `setParticles(particles[])` | Batch activate/update particles |
| `clearParticle(row, col)` | Deactivate a single particle |
| `clearParticles(coords?, group?)` | Deactivate by coords, group name, or all |
| `getParticle(row, col)` | Read particle data (null if inactive) |
| `isActive(row, col)` | Check if a particle is active |
| `getNeighbors(row, col)` | Get active particles in the 8 adjacent cells |

`ParticleProps`:
- `color: string` — hex color, e.g. `'#FF0000'` (default: `'#FFFFFF'`)
- `opacity: number` — 0.0–1.0 (default: `1.0`)
- `size: number` — size multiplier (default: `1.0`)
- `layer: number` — z-index for rendering order (default: `0`)
- `group: string` — named group for bulk operations (default: `''`)

#### Connection operations

| Method | Description |
|--------|-------------|
| `connect(from, to, props?)` | Create a connection; returns connection ID |
| `connectBatch(connections[])` | Create multiple connections; returns IDs |
| `disconnect(id)` | Remove a connection by ID |
| `disconnectBatch(ids?, endpoints?, group?)` | Remove connections by IDs, endpoints, or group |
| `getConnection(id)` | Read a connection (null if not found) |
| `getConnectionsForParticle(row, col)` | All connections touching a particle |

`ConnectionProps`:
- `color: string` — hex color (default: `'#FFFFFF'`)
- `width: number` — line width in pixels (default: `1`)
- `opacity: number` — 0.0–1.0 (default: `1.0`)
- `style: 'solid' | 'dashed' | 'dotted'` (default: `'solid'`)
- `curve: number` — quadratic bezier curvature (default: `0`)
- `directed: boolean` — render arrowhead at destination (default: `false`)
- `group: string` — named group (default: `''`)
- `layer: number` — z-index (default: `0`)

#### State queries

| Method | Description |
|--------|-------------|
| `getState(options?)` | Serialized `SpaceState` — only active particles |
| `getSpaceInfo()` | Quick summary: dimensions, counts, group names |
| `getConfig()` | Copy of the `GridConfig` |
| `getGroups()` | Names of all groups that have active particles |
| `getGroupParticles(group)` | Serialized particles in a group |

`GetStateOptions`:
- `region?: { rowMin, rowMax, colMin, colMax }` — limit to a rectangular region
- `group?: string` — limit to a specific group

#### Snapshots

| Method | Description |
|--------|-------------|
| `snapshot()` | Deep-copy current state into a `StateSnapshot` |
| `restore(snap)` | Apply a `StateSnapshot`, replacing current state |

#### Advanced

| Method | Description |
|--------|-------------|
| `getParticleStore()` | Raw `ParticleStore` (SoA typed arrays) for renderers |
| `getConnectionStore()` | Raw `ConnectionStore` (edge map + adjacency map) |
| `toIndex(row, col)` | Convert `[row, col]` → flat array index |
| `toRowCol(index)` | Convert flat index → `[row, col]` |
| `isInBounds(row, col)` | Bounds check |

## Internal Data Layout

Particles are stored in Struct-of-Arrays typed arrays for 30% better cache performance in batch operations:

```typescript
interface ParticleStore {
  config: GridConfig;
  active: Uint8Array;    // 0 or 1
  colorR: Uint8Array;    // 0–255
  colorG: Uint8Array;    // 0–255
  colorB: Uint8Array;    // 0–255
  opacity: Float32Array; // 0.0–1.0
  size: Float32Array;    // multiplier
  layer: Int16Array;     // z-index
  group: Uint16Array;    // group ID (0 = ungrouped)
}
```

Connections are stored as an edge list (Map by ID) with an adjacency map (particle index → connection IDs) for O(1) neighbor queries.

## Scalability

| Grid size | Particles | RAM (typed arrays) | Recommended renderer |
|-----------|-----------|-------------------|---------------------|
| 100×100 | 10,000 | ~120 KB | SVG or Canvas |
| 200×200 | 40,000 | ~480 KB | Canvas |
| 500×500 | 250,000 | ~3 MB | WebGL |
| 1000×1000 | 1,000,000 | ~12 MB | WebGL / WebGPU |
