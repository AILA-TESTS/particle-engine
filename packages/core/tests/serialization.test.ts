import { describe, it, expect } from 'vitest';
import { ParticleGrid } from '../src/particle-grid.js';

describe('serializeState (via ParticleGrid.getState)', () => {
  it('returns empty state for a fresh grid', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    const state = grid.getState();
    expect(state.grid).toEqual({ rows: 5, cols: 5, spacing: 10 });
    expect(state.summary.active_count).toBe(0);
    expect(state.summary.connection_count).toBe(0);
    expect(state.summary.groups).toEqual([]);
    expect(state.particles).toEqual([]);
    expect(state.connections).toEqual([]);
  });

  it('serializes only active particles', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0, { color: '#FF0000' });
    grid.setParticle(2, 3, { color: '#00FF00' });

    const state = grid.getState();
    expect(state.particles.length).toBe(2);
    expect(state.summary.active_count).toBe(2);

    const p0 = state.particles.find((p) => p.r === 0 && p.c === 0);
    expect(p0).toBeDefined();
    expect(p0!.color).toBe('#FF0000');

    const p1 = state.particles.find((p) => p.r === 2 && p.c === 3);
    expect(p1).toBeDefined();
    expect(p1!.color).toBe('#00FF00');
  });

  it('serializes connections', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0);
    grid.setParticle(1, 1);
    grid.connect([0, 0], [1, 1], { color: '#0000FF', width: 2 });

    const state = grid.getState();
    expect(state.connections.length).toBe(1);
    expect(state.connections[0].color).toBe('#0000FF');
    expect(state.connections[0].width).toBe(2);
    expect(state.summary.connection_count).toBe(1);
  });

  it('includes groups in summary', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0, { group: 'stars' });
    grid.setParticle(1, 1, { group: 'planets' });

    const state = grid.getState();
    expect(state.summary.groups).toEqual(['planets', 'stars']);
  });

  it('filters by region', () => {
    const grid = new ParticleGrid({ rows: 10, cols: 10, spacing: 10 });
    grid.setParticle(1, 1);
    grid.setParticle(5, 5);
    grid.setParticle(8, 8);

    const state = grid.getState({
      region: { rowStart: 0, rowEnd: 3, colStart: 0, colEnd: 3 },
    });
    expect(state.particles.length).toBe(1);
    expect(state.particles[0].r).toBe(1);
    expect(state.particles[0].c).toBe(1);
  });

  it('filters by group', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0, { group: 'alpha' });
    grid.setParticle(1, 1, { group: 'beta' });
    grid.setParticle(2, 2, { group: 'alpha' });

    const state = grid.getState({ group: 'alpha' });
    expect(state.particles.length).toBe(2);
    expect(state.particles.every((p) => p.group === 'alpha')).toBe(true);
  });

  it('returns empty for non-existent group filter', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(0, 0, { group: 'alpha' });

    const state = grid.getState({ group: 'nonexistent' });
    expect(state.particles.length).toBe(0);
  });

  it('uses short keys (r, c) for token efficiency', () => {
    const grid = new ParticleGrid({ rows: 5, cols: 5, spacing: 10 });
    grid.setParticle(3, 4);

    const state = grid.getState();
    const p = state.particles[0];
    expect('r' in p).toBe(true);
    expect('c' in p).toBe(true);
    expect(p.r).toBe(3);
    expect(p.c).toBe(4);
  });
});
