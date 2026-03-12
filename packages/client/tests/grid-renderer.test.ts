// ============================================================
// Tests — GridRenderer (mock canvas)
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GridRenderer } from '../src/grid-renderer.js';
import { CanvasRenderer } from '@particle-engine/renderer-canvas';
import type { SpaceState } from '@particle-engine/core';

// ── Mock canvas ─────────────────────────────────────────────

class MockCanvasContext {
	calls: Array<{ method: string; args: unknown[] }> = [];

	clearRect(x: number, y: number, w: number, h: number): void {
		this.calls.push({ method: 'clearRect', args: [x, y, w, h] });
	}

	// Provide all required CanvasContext2D properties as no-ops
	save(): void { this.calls.push({ method: 'save', args: [] }); }
	restore(): void { this.calls.push({ method: 'restore', args: [] }); }
	scale(): void {}
	beginPath(): void {}
	closePath(): void {}
	moveTo(): void {}
	lineTo(): void {}
	quadraticCurveTo(): void {}
	arc(): void {}
	fill(): void {}
	stroke(): void {}
	fillRect(): void {}
	setLineDash(): void {}
	fillText(): void {}

	fillStyle: unknown = '#000000';
	strokeStyle: unknown = '#000000';
	lineWidth = 1;
	lineCap = 'butt';
	lineJoin = 'miter';
	globalAlpha = 1;
	imageSmoothingEnabled = true;
	font = '10px sans-serif';
	textAlign = 'start';
	textBaseline = 'alphabetic';
}

function createMockCanvas(): { canvas: HTMLCanvasElement; ctx: MockCanvasContext } {
	const ctx = new MockCanvasContext();
	const canvas = {
		width: 0,
		height: 0,
		getContext: (type: string) => {
			if (type === '2d') return ctx;
			return null;
		},
	} as unknown as HTMLCanvasElement;
	return { canvas, ctx };
}

function makeState(overrides: Partial<SpaceState> = {}): SpaceState {
	return {
		grid: { rows: 10, cols: 10, spacing: 10 },
		summary: { active_count: 0, connection_count: 0, groups: [] },
		particles: [],
		connections: [],
		...overrides,
	};
}

// ── Tests ───────────────────────────────────────────────────

describe('GridRenderer', () => {
	let renderer: GridRenderer;
	let mockCtx: MockCanvasContext;
	let mockCanvas: HTMLCanvasElement;

	beforeEach(() => {
		const mock = createMockCanvas();
		mockCanvas = mock.canvas;
		mockCtx = mock.ctx;
		renderer = new GridRenderer(mockCanvas);
	});

	describe('constructor', () => {
		it('gets 2D context from canvas', () => {
			// If we got here without error, getContext('2d') succeeded
			expect(renderer).toBeDefined();
		});

		it('throws if 2D context is not available', () => {
			const badCanvas = {
				getContext: () => null,
			} as unknown as HTMLCanvasElement;

			expect(() => new GridRenderer(badCanvas)).toThrow(
				'Failed to get 2D rendering context from canvas',
			);
		});
	});

	describe('render', () => {
		it('calls CanvasRenderer.renderToCanvas with correct state and config', () => {
			const renderSpy = vi.spyOn(CanvasRenderer.prototype, 'renderToCanvas');

			const state = makeState({
				particles: [
					{ r: 1, c: 2, color: '#FF0000', opacity: 1, size: 1, layer: 0, group: '' },
				],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});

			renderer.render(state, {
				width: 800,
				height: 600,
				backgroundColor: '#111111',
				padding: 20,
			});

			expect(renderSpy).toHaveBeenCalledOnce();

			const [ctx, passedState, passedConfig] = renderSpy.mock.calls[0];
			expect(passedState).toEqual(state);
			expect(passedConfig).toEqual({
				width: 800,
				height: 600,
				backgroundColor: '#111111',
				padding: 20,
			});

			renderSpy.mockRestore();
		});

		it('passes the canvas 2D context to renderToCanvas', () => {
			const renderSpy = vi.spyOn(CanvasRenderer.prototype, 'renderToCanvas');

			renderer.render(makeState(), { width: 800, height: 600 });

			const [ctx] = renderSpy.mock.calls[0];
			// The context should be our mock context (which is compatible)
			expect(ctx).toBe(mockCtx);

			renderSpy.mockRestore();
		});
	});

	describe('clear', () => {
		it('clears the canvas with clearRect', () => {
			mockCanvas.width = 800;
			mockCanvas.height = 600;

			renderer.clear();

			const clearCall = mockCtx.calls.find(c => c.method === 'clearRect');
			expect(clearCall).toBeDefined();
			expect(clearCall!.args).toEqual([0, 0, 800, 600]);
		});
	});

	describe('resize', () => {
		it('updates canvas dimensions', () => {
			renderer.resize(1024, 768);

			expect(mockCanvas.width).toBe(1024);
			expect(mockCanvas.height).toBe(768);
		});

		it('updates from default dimensions', () => {
			expect(mockCanvas.width).toBe(0);
			expect(mockCanvas.height).toBe(0);

			renderer.resize(400, 300);

			expect(mockCanvas.width).toBe(400);
			expect(mockCanvas.height).toBe(300);
		});
	});
});
