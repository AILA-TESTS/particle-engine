import { describe, it, expect } from 'vitest';
import { ParticleGrid } from '../src/particle-grid.js';

describe('ParticleGrid construction', () => {
  it('creates a grid with the given config', () => {
    const grid = new ParticleGrid({ rows: 10, cols: 20, spacing: 16 });
    const info = grid.getSpaceInfo();
    expect(info.rows).toBe(10);
    expect(info.cols).toBe(20);
    expect(info.spacing).toBe(16);
    expect(info.totalParticles).toBe(200);
    expect(info.activeCount).toBe(0);
  });

  it('rejects invalid config', () => {
    expect(() => new ParticleGrid({ rows: 0, cols: 10, spacing: 16 })).toThrow();
    expect(() => new ParticleGrid({ rows: 10, cols: 0, spacing: 16 })).toThrow();
    expect(() => new ParticleGrid({ rows: 10, cols: 10, spacing: 0 })).toThrow();
  });
});

describe('index helpers', () => {
  const grid = new ParticleGrid({ rows: 5, cols: 10, spacing: 8 });

  it('toIndex and toRowCol are inverses', () => {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 10; c++) {
        const idx = grid.toIndex(r, c);
        expect(grid.toRowCol(idx)).toEqual([r, c]);
      }
    }
  });

  it('isInBounds checks correctly', () => {
    expect(grid.isInBounds(0, 0)).toBe(true);
    expect(grid.isInBounds(4, 9)).toBe(true);
    expect(grid.isInBounds(5, 0)).toBe(false);
    expect(grid.isInBounds(0, 10)).toBe(false);
    expect(grid.isInBounds(-1, 0)).toBe(false);
  });
});

describe('particle operations', () => {
  it('setParticle activates a particle with defaults', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0);
    expect(grid.isActive(0, 0)).toBe(true);
    const p = grid.getParticle(0, 0);
    expect(p).not.toBeNull();
    expect(p!.active).toBe(true);
    expect(p!.color).toBe('#FFFFFF');
    expect(p!.opacity).toBe(1.0);
    expect(p!.size).toBe(1.0);
    expect(p!.layer).toBe(0);
    expect(p!.group).toBe('');
  });

  it('setParticle with custom properties', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(2, 3, {
      color: '#FF0000',
      opacity: 0.5,
      size: 2.0,
      layer: 5,
      group: 'test',
    });
    const p = grid.getParticle(2, 3);
    expect(p!.color).toBe('#FF0000');
    expect(p!.opacity).toBe(0.5);
    expect(p!.size).toBe(2.0);
    expect(p!.layer).toBe(5);
    expect(p!.group).toBe('test');
  });

  it('setParticle throws for out-of-bounds', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    expect(() => grid.setParticle(5, 0)).toThrow(RangeError);
    expect(() => grid.setParticle(0, 5)).toThrow(RangeError);
    expect(() => grid.setParticle(-1, 0)).toThrow(RangeError);
  });

  it('setParticles activates multiple particles', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticles([
      { row: 0, col: 0, color: '#FF0000' },
      { row: 1, col: 1, color: '#00FF00' },
      { row: 2, col: 2, color: '#0000FF' },
    ]);
    expect(grid.isActive(0, 0)).toBe(true);
    expect(grid.isActive(1, 1)).toBe(true);
    expect(grid.isActive(2, 2)).toBe(true);
    expect(grid.getParticle(0, 0)!.color).toBe('#FF0000');
  });

  it('clearParticle deactivates and resets a particle', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(1, 1, { color: '#FF0000' });
    grid.clearParticle(1, 1);
    expect(grid.isActive(1, 1)).toBe(false);
    expect(grid.getParticle(1, 1)).toBeNull();
  });

  it('clearParticle removes associated connections', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0);
    grid.setParticle(1, 1);
    const connId = grid.connect([0, 0], [1, 1]);
    grid.clearParticle(0, 0);
    expect(grid.getConnection(connId)).toBeNull();
  });

  it('clearParticles with coords', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0);
    grid.setParticle(1, 1);
    grid.setParticle(2, 2);
    grid.clearParticles([[0, 0], [2, 2]]);
    expect(grid.isActive(0, 0)).toBe(false);
    expect(grid.isActive(1, 1)).toBe(true);
    expect(grid.isActive(2, 2)).toBe(false);
  });

  it('clearParticles with group', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0, { group: 'a' });
    grid.setParticle(1, 1, { group: 'b' });
    grid.setParticle(2, 2, { group: 'a' });
    grid.clearParticles(undefined, 'a');
    expect(grid.isActive(0, 0)).toBe(false);
    expect(grid.isActive(1, 1)).toBe(true);
    expect(grid.isActive(2, 2)).toBe(false);
  });

  it('clearParticles with no args clears all', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0);
    grid.setParticle(1, 1);
    grid.clearParticles();
    expect(grid.getSpaceInfo().activeCount).toBe(0);
  });

  it('getParticle returns null for inactive particle', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    expect(grid.getParticle(0, 0)).toBeNull();
  });

  it('isActive returns false for out-of-bounds', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    expect(grid.isActive(10, 10)).toBe(false);
  });

  it('can update a particle in-place', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(1, 1, { color: '#FF0000', opacity: 0.5 });
    grid.setParticle(1, 1, { color: '#00FF00' });
    const p = grid.getParticle(1, 1);
    expect(p!.color).toBe('#00FF00');
    // opacity should be preserved since we didn't change it and it was already set
    expect(p!.opacity).toBe(0.5);
  });
});

describe('connection operations', () => {
  it('connect creates a connection and returns ID', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0);
    grid.setParticle(1, 1);
    const id = grid.connect([0, 0], [1, 1]);
    expect(id).toBe('c_0_0_1_1');
    const conn = grid.getConnection(id);
    expect(conn).not.toBeNull();
    expect(conn!.from).toEqual([0, 0]);
    expect(conn!.to).toEqual([1, 1]);
  });

  it('connect with custom properties', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    const id = grid.connect([0, 0], [1, 1], {
      color: '#FF0000',
      width: 3,
      style: 'dashed',
      directed: true,
      label: 'test',
    });
    const conn = grid.getConnection(id);
    expect(conn!.color).toBe('#FF0000');
    expect(conn!.width).toBe(3);
    expect(conn!.style).toBe('dashed');
    expect(conn!.directed).toBe(true);
    expect(conn!.label).toBe('test');
  });

  it('connect throws for out-of-bounds endpoints', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    expect(() => grid.connect([10, 0], [1, 1])).toThrow(RangeError);
    expect(() => grid.connect([0, 0], [10, 10])).toThrow(RangeError);
  });

  it('connectBatch creates multiple connections', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    const ids = grid.connectBatch([
      { from: [0, 0], to: [1, 1] },
      { from: [2, 2], to: [3, 3], color: '#FF0000' },
    ]);
    expect(ids.length).toBe(2);
    expect(grid.getConnection(ids[0])).not.toBeNull();
    expect(grid.getConnection(ids[1])).not.toBeNull();
  });

  it('disconnect removes a connection', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    const id = grid.connect([0, 0], [1, 1]);
    grid.disconnect(id);
    expect(grid.getConnection(id)).toBeNull();
  });

  it('disconnectBatch by IDs', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    const id1 = grid.connect([0, 0], [1, 1]);
    const id2 = grid.connect([2, 2], [3, 3]);
    grid.disconnectBatch([id1, id2]);
    expect(grid.getConnection(id1)).toBeNull();
    expect(grid.getConnection(id2)).toBeNull();
  });

  it('disconnectBatch by endpoints', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.connect([0, 0], [1, 1]);
    grid.disconnectBatch(undefined, [{ from: [0, 0], to: [1, 1] }]);
    expect(grid.getSpaceInfo().connectionCount).toBe(0);
  });

  it('disconnectBatch by group', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.connect([0, 0], [1, 1], { group: 'edges' });
    grid.connect([2, 2], [3, 3], { group: 'other' });
    grid.disconnectBatch(undefined, undefined, 'edges');
    expect(grid.getSpaceInfo().connectionCount).toBe(1);
  });

  it('getConnectionsForParticle returns connections', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.connect([0, 0], [1, 1]);
    grid.connect([0, 0], [2, 2]);
    const conns = grid.getConnectionsForParticle(0, 0);
    expect(conns.length).toBe(2);
  });

  it('getConnection returns null for non-existent ID', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    expect(grid.getConnection('nonexistent')).toBeNull();
  });
});

describe('getNeighbors', () => {
  it('returns active neighbors (8 directions)', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    // Set all 8 neighbors of (2,2)
    grid.setParticle(1, 1);
    grid.setParticle(1, 2);
    grid.setParticle(1, 3);
    grid.setParticle(2, 1);
    grid.setParticle(2, 3);
    grid.setParticle(3, 1);
    grid.setParticle(3, 2);
    grid.setParticle(3, 3);

    const neighbors = grid.getNeighbors(2, 2);
    expect(neighbors.length).toBe(8);
  });

  it('returns only active neighbors', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(1, 2); // above
    grid.setParticle(3, 2); // below
    const neighbors = grid.getNeighbors(2, 2);
    expect(neighbors.length).toBe(2);
  });

  it('handles corner cells correctly', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 1);
    grid.setParticle(1, 0);
    grid.setParticle(1, 1);
    const neighbors = grid.getNeighbors(0, 0);
    expect(neighbors.length).toBe(3);
  });

  it('handles edge cells correctly', () => {
    const grid = new ParticleGrid({ rows: 3, cols: 3, spacing: 10 });
    // Set all cells active
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        grid.setParticle(r, c);
      }
    }
    // Edge cell (0, 1) has 5 neighbors
    const neighbors = grid.getNeighbors(0, 1);
    expect(neighbors.length).toBe(5);
  });
});

describe('group operations', () => {
  it('getGroups returns active group names', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0, { group: 'alpha' });
    grid.setParticle(1, 1, { group: 'beta' });
    const groups = grid.getGroups();
    expect(groups).toContain('alpha');
    expect(groups).toContain('beta');
    expect(groups.length).toBe(2);
  });

  it('getGroupParticles returns particles in a group', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0, { group: 'alpha', color: '#FF0000' });
    grid.setParticle(1, 1, { group: 'alpha', color: '#00FF00' });
    grid.setParticle(2, 2, { group: 'beta' });

    const particles = grid.getGroupParticles('alpha');
    expect(particles.length).toBe(2);
    expect(particles.every((p) => p.group === 'alpha')).toBe(true);
  });

  it('getGroupParticles returns empty for unknown group', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    expect(grid.getGroupParticles('nonexistent')).toEqual([]);
  });
});

describe('getSpaceInfo', () => {
  it('returns accurate counts', () => {
    const grid = new ParticleGrid({ rows: 10, cols: 10, spacing: 10 });
    grid.setParticle(0, 0, { group: 'x' });
    grid.setParticle(1, 1, { group: 'y' });
    grid.setParticle(2, 2);
    grid.connect([0, 0], [1, 1]);

    const info = grid.getSpaceInfo();
    expect(info.rows).toBe(10);
    expect(info.cols).toBe(10);
    expect(info.spacing).toBe(10);
    expect(info.totalParticles).toBe(100);
    expect(info.activeCount).toBe(3);
    expect(info.connectionCount).toBe(1);
    expect(info.groups).toEqual(['x', 'y']);
  });
});

describe('raw store access', () => {
  it('getParticleStore returns the underlying store', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    const store = grid.getParticleStore();
    expect(store.active).toBeInstanceOf(Uint8Array);
    expect(store.active.length).toBe(25);
  });

  it('getConnectionStore returns the underlying store', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    const store = grid.getConnectionStore();
    expect(store.edges).toBeInstanceOf(Map);
    expect(store.adjacency).toBeInstanceOf(Map);
  });
});
