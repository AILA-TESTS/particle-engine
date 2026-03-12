// ============================================================
// Tests — Frame Converter (FrameState → SpaceState)
// ============================================================

import { describe, it, expect } from 'vitest';
import { frameToSpaceState, rgbToHex } from '../src/frame-converter.js';
import type { FrameState, FrameParticle, FrameConnection } from '@particle-engine/animation';
import type { GridConfig } from '@particle-engine/core';

const defaultGrid: GridConfig = { rows: 10, cols: 10, spacing: 20 };

describe('rgbToHex', () => {
	it('converts black', () => {
		expect(rgbToHex(0, 0, 0)).toBe('#000000');
	});

	it('converts white', () => {
		expect(rgbToHex(255, 255, 255)).toBe('#FFFFFF');
	});

	it('converts red', () => {
		expect(rgbToHex(255, 0, 0)).toBe('#FF0000');
	});

	it('converts green', () => {
		expect(rgbToHex(0, 255, 0)).toBe('#00FF00');
	});

	it('converts blue', () => {
		expect(rgbToHex(0, 0, 255)).toBe('#0000FF');
	});

	it('pads single-digit hex values', () => {
		expect(rgbToHex(1, 2, 3)).toBe('#010203');
	});

	it('handles mid-range values', () => {
		expect(rgbToHex(128, 64, 192)).toBe('#8040C0');
	});

	it('clamps values above 255', () => {
		expect(rgbToHex(300, 0, 0)).toBe('#FF0000');
	});

	it('clamps negative values to 0', () => {
		expect(rgbToHex(-10, 0, 0)).toBe('#000000');
	});
});

describe('frameToSpaceState — particles', () => {
	it('converts a single particle', () => {
		const frame: FrameState = {
			timeMs: 0,
			frameIndex: 0,
			particles: [
				{ row: 2, col: 3, colorR: 255, colorG: 128, colorB: 0, opacity: 0.8, size: 1.5 },
			],
			connections: [],
		};

		const state = frameToSpaceState(frame, defaultGrid);

		expect(state.particles).toHaveLength(1);
		expect(state.particles[0]).toEqual({
			r: 2,
			c: 3,
			color: '#FF8000',
			opacity: 0.8,
			size: 1.5,
			layer: 0,
			group: '',
		});
	});

	it('converts multiple particles', () => {
		const frame: FrameState = {
			timeMs: 100,
			frameIndex: 3,
			particles: [
				{ row: 0, col: 0, colorR: 255, colorG: 0, colorB: 0, opacity: 1.0, size: 1.0 },
				{ row: 5, col: 7, colorR: 0, colorG: 255, colorB: 0, opacity: 0.5, size: 2.0 },
				{ row: 9, col: 9, colorR: 0, colorG: 0, colorB: 255, opacity: 0.3, size: 0.5 },
			],
			connections: [],
		};

		const state = frameToSpaceState(frame, defaultGrid);

		expect(state.particles).toHaveLength(3);
		expect(state.particles[0].r).toBe(0);
		expect(state.particles[0].c).toBe(0);
		expect(state.particles[0].color).toBe('#FF0000');
		expect(state.particles[1].r).toBe(5);
		expect(state.particles[1].c).toBe(7);
		expect(state.particles[1].color).toBe('#00FF00');
		expect(state.particles[2].r).toBe(9);
		expect(state.particles[2].c).toBe(9);
		expect(state.particles[2].color).toBe('#0000FF');
	});

	it('handles an empty frame', () => {
		const frame: FrameState = {
			timeMs: 0,
			frameIndex: 0,
			particles: [],
			connections: [],
		};

		const state = frameToSpaceState(frame, defaultGrid);

		expect(state.particles).toHaveLength(0);
		expect(state.connections).toHaveLength(0);
		expect(state.summary.active_count).toBe(0);
		expect(state.summary.connection_count).toBe(0);
		expect(state.summary.groups).toEqual([]);
	});
});

describe('frameToSpaceState — connections', () => {
	it('converts a single connection', () => {
		const frame: FrameState = {
			timeMs: 0,
			frameIndex: 0,
			particles: [],
			connections: [
				{
					fromRow: 1, fromCol: 2,
					toRow: 3, toCol: 4,
					colorR: 255, colorG: 255, colorB: 0,
					opacity: 0.9,
					width: 2,
					style: 'dashed',
					curve: 0.5,
					directed: true,
				},
			],
		};

		const state = frameToSpaceState(frame, defaultGrid);

		expect(state.connections).toHaveLength(1);
		const conn = state.connections[0];
		expect(conn.id).toBe('conn_0');
		expect(conn.from).toEqual([1, 2]);
		expect(conn.to).toEqual([3, 4]);
		expect(conn.color).toBe('#FFFF00');
		expect(conn.opacity).toBe(0.9);
		expect(conn.width).toBe(2);
		expect(conn.style).toBe('dashed');
		expect(conn.curve).toBe(0.5);
		expect(conn.directed).toBe(true);
		expect(conn.group).toBe('');
		expect(conn.layer).toBe(0);
		expect(conn.label).toBe('');
	});

	it('assigns sequential connection IDs', () => {
		const frame: FrameState = {
			timeMs: 0,
			frameIndex: 0,
			particles: [],
			connections: [
				{
					fromRow: 0, fromCol: 0, toRow: 1, toCol: 1,
					colorR: 255, colorG: 0, colorB: 0,
					opacity: 1, width: 1, style: 'solid', curve: 0, directed: false,
				},
				{
					fromRow: 2, fromCol: 2, toRow: 3, toCol: 3,
					colorR: 0, colorG: 255, colorB: 0,
					opacity: 1, width: 1, style: 'solid', curve: 0, directed: false,
				},
			],
		};

		const state = frameToSpaceState(frame, defaultGrid);

		expect(state.connections[0].id).toBe('conn_0');
		expect(state.connections[1].id).toBe('conn_1');
	});

	it('preserves connection style properties', () => {
		const frame: FrameState = {
			timeMs: 0,
			frameIndex: 0,
			particles: [],
			connections: [
				{
					fromRow: 0, fromCol: 0, toRow: 1, toCol: 1,
					colorR: 100, colorG: 200, colorB: 150,
					opacity: 0.7, width: 3.5, style: 'dotted', curve: -0.3, directed: false,
				},
			],
		};

		const state = frameToSpaceState(frame, defaultGrid);
		const conn = state.connections[0];

		expect(conn.opacity).toBe(0.7);
		expect(conn.width).toBe(3.5);
		expect(conn.style).toBe('dotted');
		expect(conn.curve).toBe(-0.3);
		expect(conn.directed).toBe(false);
	});
});

describe('frameToSpaceState — grid and summary', () => {
	it('populates grid config from input', () => {
		const grid: GridConfig = { rows: 20, cols: 30, spacing: 15 };
		const frame: FrameState = {
			timeMs: 0,
			frameIndex: 0,
			particles: [],
			connections: [],
		};

		const state = frameToSpaceState(frame, grid);

		expect(state.grid).toEqual({ rows: 20, cols: 30, spacing: 15 });
	});

	it('computes summary active_count from particles', () => {
		const frame: FrameState = {
			timeMs: 0,
			frameIndex: 0,
			particles: [
				{ row: 0, col: 0, colorR: 0, colorG: 0, colorB: 0, opacity: 1, size: 1 },
				{ row: 1, col: 1, colorR: 0, colorG: 0, colorB: 0, opacity: 1, size: 1 },
				{ row: 2, col: 2, colorR: 0, colorG: 0, colorB: 0, opacity: 1, size: 1 },
			],
			connections: [],
		};

		const state = frameToSpaceState(frame, defaultGrid);

		expect(state.summary.active_count).toBe(3);
	});

	it('computes summary connection_count from connections', () => {
		const frame: FrameState = {
			timeMs: 0,
			frameIndex: 0,
			particles: [],
			connections: [
				{
					fromRow: 0, fromCol: 0, toRow: 1, toCol: 1,
					colorR: 0, colorG: 0, colorB: 0,
					opacity: 1, width: 1, style: 'solid', curve: 0, directed: false,
				},
				{
					fromRow: 2, fromCol: 2, toRow: 3, toCol: 3,
					colorR: 0, colorG: 0, colorB: 0,
					opacity: 1, width: 1, style: 'solid', curve: 0, directed: false,
				},
			],
		};

		const state = frameToSpaceState(frame, defaultGrid);

		expect(state.summary.connection_count).toBe(2);
	});

	it('computes groups as empty when no groups assigned', () => {
		const frame: FrameState = {
			timeMs: 0,
			frameIndex: 0,
			particles: [
				{ row: 0, col: 0, colorR: 0, colorG: 0, colorB: 0, opacity: 1, size: 1 },
			],
			connections: [],
		};

		const state = frameToSpaceState(frame, defaultGrid);

		// FrameParticle has no group field; converter defaults to ''
		expect(state.summary.groups).toEqual([]);
	});
});
