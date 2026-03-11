import { describe, it, expect } from 'vitest';
import { ParticleGrid } from '../src/particle-grid.js';

describe('snapshot and restore', () => {
  it('creates a snapshot and restores it', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0, { color: '#FF0000', group: 'stars' });
    grid.setParticle(2, 3, { color: '#00FF00' });
    grid.connect([0, 0], [2, 3], { color: '#0000FF' });

    const snap = grid.snapshot();

    // Mutate the grid
    grid.clearParticle(0, 0);
    grid.setParticle(4, 4, { color: '#AABBCC' });

    // Verify mutation
    expect(grid.isActive(0, 0)).toBe(false);
    expect(grid.isActive(4, 4)).toBe(true);

    // Restore
    grid.restore(snap);

    // Verify restoration
    expect(grid.isActive(0, 0)).toBe(true);
    expect(grid.isActive(4, 4)).toBe(false);
    const p = grid.getParticle(0, 0);
    expect(p!.color).toBe('#FF0000');
    expect(p!.group).toBe('stars');
  });

  it('snapshot is a deep copy (mutations do not affect it)', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(1, 1, { color: '#FF0000' });
    const snap = grid.snapshot();

    // Change the particle
    grid.setParticle(1, 1, { color: '#00FF00' });

    // Restore
    grid.restore(snap);
    const p = grid.getParticle(1, 1);
    expect(p!.color).toBe('#FF0000');
  });

  it('restores connections correctly', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0);
    grid.setParticle(1, 1);
    const connId = grid.connect([0, 0], [1, 1], { color: '#FF0000' });
    const snap = grid.snapshot();

    grid.disconnect(connId);
    expect(grid.getConnection(connId)).toBeNull();

    grid.restore(snap);
    const conn = grid.getConnection(connId);
    expect(conn).not.toBeNull();
    expect(conn!.color).toBe('#FF0000');
  });

  it('restores group names correctly', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0, { group: 'alpha' });
    grid.setParticle(1, 1, { group: 'beta' });
    const snap = grid.snapshot();

    grid.clearParticles();
    expect(grid.getGroups()).toEqual([]);

    grid.restore(snap);
    expect(grid.getGroups()).toContain('alpha');
    expect(grid.getGroups()).toContain('beta');
  });
});
