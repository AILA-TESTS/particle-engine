import { describe, it, expect } from 'vitest';
import { gridToPixel, computeViewBox, resolveConfig } from '../src/layout.js';
import type { RenderConfig } from '../src/types.js';

describe('gridToPixel', () => {
	it('converts (0,0) with no padding to origin', () => {
		const result = gridToPixel(0, 0, 16, 0);
		expect(result).toEqual({ x: 0, y: 0 });
	});

	it('maps column to x and row to y', () => {
		const result = gridToPixel(3, 5, 16, 0);
		expect(result).toEqual({ x: 80, y: 48 }); // 5*16=80, 3*16=48
	});

	it('applies padding offset', () => {
		const result = gridToPixel(0, 0, 16, 10);
		expect(result).toEqual({ x: 10, y: 10 });
	});

	it('combines spacing and padding correctly', () => {
		const result = gridToPixel(2, 3, 20, 5);
		expect(result).toEqual({ x: 65, y: 45 }); // 5+3*20=65, 5+2*20=45
	});

	it('handles zero spacing', () => {
		const result = gridToPixel(5, 5, 0, 10);
		expect(result).toEqual({ x: 10, y: 10 });
	});

	it('handles large grid coordinates', () => {
		const result = gridToPixel(99, 99, 10, 0);
		expect(result).toEqual({ x: 990, y: 990 });
	});
});

describe('computeViewBox', () => {
	it('computes viewBox for a simple grid', () => {
		const result = computeViewBox(10, 20, 16, 0);
		expect(result).toEqual({ width: 304, height: 144 }); // (20-1)*16=304, (10-1)*16=144
	});

	it('includes padding on all sides', () => {
		const result = computeViewBox(10, 20, 16, 10);
		expect(result).toEqual({ width: 324, height: 164 }); // 304+20, 144+20
	});

	it('returns minimum of 1 for very small grids', () => {
		const result = computeViewBox(1, 1, 16, 0);
		expect(result).toEqual({ width: 1, height: 1 }); // (1-1)*16=0, clamped to 1
	});

	it('handles a 2x2 grid', () => {
		const result = computeViewBox(2, 2, 10, 0);
		expect(result).toEqual({ width: 10, height: 10 });
	});

	it('handles padding on a 1x1 grid', () => {
		const result = computeViewBox(1, 1, 16, 20);
		expect(result).toEqual({ width: 40, height: 40 }); // 0+40=40
	});
});

describe('resolveConfig', () => {
	it('applies all defaults', () => {
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
			width: 1920,
			height: 1080,
			backgroundColor: '#FF0000',
			antialiasing: false,
			pixelRatio: 2,
			padding: 20,
			particleShape: 'square',
			defaultParticleRadius: 8,
			showGrid: true,
			gridDotColor: '#555555',
			gridDotRadius: 2,
		};
		const resolved = resolveConfig(config, 16);

		expect(resolved.width).toBe(1920);
		expect(resolved.height).toBe(1080);
		expect(resolved.backgroundColor).toBe('#FF0000');
		expect(resolved.antialiasing).toBe(false);
		expect(resolved.pixelRatio).toBe(2);
		expect(resolved.padding).toBe(20);
		expect(resolved.particleShape).toBe('square');
		expect(resolved.defaultParticleRadius).toBe(8);
		expect(resolved.showGrid).toBe(true);
		expect(resolved.gridDotColor).toBe('#555555');
		expect(resolved.gridDotRadius).toBe(2);
	});

	it('computes default radius from spacing', () => {
		const config: RenderConfig = { width: 800, height: 600 };
		const resolved = resolveConfig(config, 30);
		expect(resolved.defaultParticleRadius).toBe(10);
	});
});
