import { describe, it, expect } from 'vitest';
import { gridToPixel, computeCanvasSize, resolveConfig } from '../src/layout.js';
import type { RenderConfig } from '../src/types.js';

describe('gridToPixel', () => {
	it('converts origin (0,0) with no padding', () => {
		const pos = gridToPixel(0, 0, 16, 0);
		expect(pos).toEqual({ x: 0, y: 0 });
	});

	it('converts origin (0,0) with padding', () => {
		const pos = gridToPixel(0, 0, 16, 10);
		expect(pos).toEqual({ x: 10, y: 10 });
	});

	it('maps column to x and row to y', () => {
		const pos = gridToPixel(3, 5, 16, 0);
		expect(pos).toEqual({ x: 80, y: 48 });
	});

	it('applies spacing correctly', () => {
		const pos = gridToPixel(1, 1, 32, 0);
		expect(pos).toEqual({ x: 32, y: 32 });
	});

	it('applies both spacing and padding', () => {
		const pos = gridToPixel(2, 3, 10, 5);
		expect(pos).toEqual({ x: 35, y: 25 });
	});

	it('handles zero spacing', () => {
		const pos = gridToPixel(5, 5, 0, 10);
		expect(pos).toEqual({ x: 10, y: 10 });
	});
});

describe('computeCanvasSize', () => {
	it('computes size for a basic grid', () => {
		const size = computeCanvasSize(10, 20, 16, 0);
		expect(size).toEqual({ width: 304, height: 144 });
	});

	it('adds padding on both sides', () => {
		const size = computeCanvasSize(10, 20, 16, 10);
		expect(size).toEqual({ width: 324, height: 164 });
	});

	it('returns minimum of 1 for single-cell grid', () => {
		const size = computeCanvasSize(1, 1, 16, 0);
		expect(size).toEqual({ width: 1, height: 1 });
	});

	it('handles 1x1 grid with padding', () => {
		const size = computeCanvasSize(1, 1, 16, 10);
		expect(size).toEqual({ width: 20, height: 20 });
	});

	it('handles 2x2 grid', () => {
		const size = computeCanvasSize(2, 2, 10, 0);
		expect(size).toEqual({ width: 10, height: 10 });
	});
});

describe('resolveConfig', () => {
	it('fills in all defaults', () => {
		const config: RenderConfig = { width: 800, height: 600 };
		const resolved = resolveConfig(config, 16);

		expect(resolved.width).toBe(800);
		expect(resolved.height).toBe(600);
		expect(resolved.backgroundColor).toBe('#000000');
		expect(resolved.antialiasing).toBe(true);
		expect(resolved.pixelRatio).toBe(1);
		expect(resolved.padding).toBe(0);
		expect(resolved.particleShape).toBe('circle');
		expect(resolved.defaultParticleRadius).toBeCloseTo(16 / 3);
		expect(resolved.showGrid).toBe(false);
		expect(resolved.gridDotColor).toBe('#333333');
		expect(resolved.gridDotRadius).toBe(1);
	});

	it('preserves explicitly set values', () => {
		const config: RenderConfig = {
			width: 1024,
			height: 768,
			backgroundColor: '#112233',
			antialiasing: false,
			pixelRatio: 2,
			padding: 20,
			particleShape: 'square',
			defaultParticleRadius: 8,
			showGrid: true,
			gridDotColor: '#666666',
			gridDotRadius: 3,
		};
		const resolved = resolveConfig(config, 16);

		expect(resolved.backgroundColor).toBe('#112233');
		expect(resolved.antialiasing).toBe(false);
		expect(resolved.pixelRatio).toBe(2);
		expect(resolved.padding).toBe(20);
		expect(resolved.particleShape).toBe('square');
		expect(resolved.defaultParticleRadius).toBe(8);
		expect(resolved.showGrid).toBe(true);
		expect(resolved.gridDotColor).toBe('#666666');
		expect(resolved.gridDotRadius).toBe(3);
	});

	it('computes defaultParticleRadius from spacing', () => {
		const config: RenderConfig = { width: 800, height: 600 };
		const resolved = resolveConfig(config, 30);
		expect(resolved.defaultParticleRadius).toBe(10);
	});
});
