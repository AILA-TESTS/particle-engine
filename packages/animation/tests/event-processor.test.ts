import { describe, it, expect } from 'vitest';
import { findActiveEvents, processEvents } from '../src/engine/event-processor.js';
import type { DiscreteEvent } from '../src/types.js';

describe('findActiveEvents', () => {
  it('should find events at exact time', () => {
    const events: DiscreteEvent[] = [
      {
        time: 500,
        action: { type: 'addParticle', row: 1, col: 1 },
        transition: 'instant',
        transitionDuration: 0,
      },
    ];

    const active = findActiveEvents(events, 500);
    expect(active.length).toBe(1);
    expect(active[0].progress).toBe(1); // instant
  });

  it('should find events during transition', () => {
    const events: DiscreteEvent[] = [
      {
        time: 500,
        action: { type: 'addParticle', row: 1, col: 1 },
        transition: 'fadeIn',
        transitionDuration: 200,
      },
    ];

    const active = findActiveEvents(events, 600);
    expect(active.length).toBe(1);
    expect(active[0].progress).toBeCloseTo(0.5, 5);
  });

  it('should not find events before start time', () => {
    const events: DiscreteEvent[] = [
      {
        time: 500,
        action: { type: 'addParticle', row: 1, col: 1 },
        transition: 'fadeIn',
        transitionDuration: 200,
      },
    ];

    const active = findActiveEvents(events, 400);
    expect(active.length).toBe(0);
  });

  it('should not find events after end time', () => {
    const events: DiscreteEvent[] = [
      {
        time: 500,
        action: { type: 'addParticle', row: 1, col: 1 },
        transition: 'fadeIn',
        transitionDuration: 200,
      },
    ];

    const active = findActiveEvents(events, 800);
    expect(active.length).toBe(0);
  });
});

describe('processEvents', () => {
  it('should produce a particle for addParticle event', () => {
    const events: DiscreteEvent[] = [
      {
        time: 0,
        action: { type: 'addParticle', row: 3, col: 4, properties: { color: '#FF0000' } },
        transition: 'instant',
        transitionDuration: 0,
      },
    ];

    const active = findActiveEvents(events, 0);
    const result = processEvents(active, 0);
    expect(result.particles.length).toBe(1);
    expect(result.particles[0].row).toBe(3);
    expect(result.particles[0].col).toBe(4);
    expect(result.particles[0].colorR).toBe(255);
    expect(result.particles[0].opacity).toBe(1);
  });

  it('should fade in addParticle with fadeIn transition', () => {
    const events: DiscreteEvent[] = [
      {
        time: 0,
        action: { type: 'addParticle', row: 1, col: 1 },
        transition: 'fadeIn',
        transitionDuration: 100,
      },
    ];

    // At midpoint
    const active = findActiveEvents(events, 50);
    const result = processEvents(active, 50);
    expect(result.particles.length).toBe(1);
    expect(result.particles[0].opacity).toBeCloseTo(0.5, 1);
  });

  it('should grow addParticle with grow transition', () => {
    const events: DiscreteEvent[] = [
      {
        time: 0,
        action: { type: 'addParticle', row: 1, col: 1 },
        transition: 'grow',
        transitionDuration: 100,
      },
    ];

    // At start
    const active0 = findActiveEvents(events, 0);
    const result0 = processEvents(active0, 0);
    expect(result0.particles.length).toBe(1);
    expect(result0.particles[0].size).toBeCloseTo(0, 1);

    // At end
    const active1 = findActiveEvents(events, 100);
    const result1 = processEvents(active1, 100);
    expect(result1.particles.length).toBe(1);
    expect(result1.particles[0].size).toBeCloseTo(1, 1);
  });

  it('should add connection for addConnection event', () => {
    const events: DiscreteEvent[] = [
      {
        time: 0,
        action: { type: 'addConnection', from: [1, 1], to: [2, 2] },
        transition: 'instant',
        transitionDuration: 0,
      },
    ];

    const active = findActiveEvents(events, 0);
    const result = processEvents(active, 0);
    expect(result.connections.length).toBe(1);
    expect(result.connections[0].fromRow).toBe(1);
    expect(result.connections[0].toRow).toBe(2);
  });

  it('should handle removeParticle with fadeOut', () => {
    const events: DiscreteEvent[] = [
      {
        time: 0,
        action: { type: 'removeParticle', row: 5, col: 5 },
        transition: 'fadeOut',
        transitionDuration: 100,
      },
    ];

    // At midpoint, should still show fading particle
    const active = findActiveEvents(events, 50);
    const result = processEvents(active, 50);
    expect(result.particles.length).toBe(1);
    expect(result.particles[0].opacity).toBeCloseTo(0.5, 1);
  });
});
