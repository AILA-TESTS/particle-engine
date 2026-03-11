import { describe, it, expect, beforeEach } from 'vitest';
import { CanvasRenderer } from '../src/canvas-renderer.js';
import { MockContext, MockCanvasFactory } from './mock-canvas.js';
import type { SpaceState, SerializedParticle, SerializedConnection } from '@particle-engine/core';
import type { RenderConfig } from '../src/types.js';

function makeState(overrides: Partial<SpaceState> = {}): SpaceState {
	return {
		grid: { rows: 5, cols: 5, spacing: 16 },
		summary: { active_count: 0, connection_count: 0, groups: [] },
		particles: [],
		connections: [],
		...overrides,
	};
}

function makeParticle(overrides: Partial<SerializedParticle> = {}): SerializedParticle {
	return {
		r: 0,
		c: 0,
		color: '#FFFFFF',
		opacity: 1.0,
		size: 1.0,
		layer: 0,
		group: '',
		...overrides,
	};
}

function makeConnection(overrides: Partial<SerializedConnection> = {}): SerializedConnection {
	return {
		id: 'c1',
		from: [0, 0],
		to: [1, 1],
		color: '#FFFFFF',
		width: 1,
		opacity: 1.0,
		style: 'solid',
		curve: 0,
		directed: false,
		group: '',
		layer: 0,
		label: '',
		...overrides,
	};
}

const defaultConfig: RenderConfig = { width: 800, height: 600 };

describe('CanvasRenderer', () => {
	let renderer: CanvasRenderer;
	let ctx: MockContext;

	beforeEach(() => {
		renderer = new CanvasRenderer();
		ctx = new MockContext();
	});

	describe('renderToCanvas', () => {
		it('renders empty state with only background fillRect', () => {
			const state = makeState();
			renderer.renderToCanvas(ctx, state, defaultConfig);

			// Should have at least one fillRect for background
			const fillRectCalls = ctx.getCalls('fillRect');
			expect(fillRectCalls.length).toBeGreaterThanOrEqual(1);
			expect(fillRectCalls[0].args).toEqual([0, 0, 800, 600]);

			// Should not have arc calls (no particles)
			expect(ctx.wasCalled('arc')).toBe(false);
		});

		it('sets background color via fillStyle', () => {
			const state = makeState();
			renderer.renderToCanvas(ctx, state, { ...defaultConfig, backgroundColor: '#112233' });

			// Look for the fillStyle set to the background color
			const fillStyleCalls = ctx.getCalls('set:fillStyle');
			const bgSet = fillStyleCalls.find(c => c.args[0] === '#112233');
			expect(bgSet).toBeDefined();
		});

		it('renders a single particle as arc', () => {
			const state = makeState({
				particles: [makeParticle({ r: 2, c: 3 })],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, defaultConfig);

			const arcCalls = ctx.getCalls('arc');
			expect(arcCalls.length).toBe(1);

			// Position: col * spacing + padding = 3 * 16 + 0 = 48, row * spacing + padding = 2 * 16 + 0 = 32
			expect(arcCalls[0].args[0]).toBe(48); // x
			expect(arcCalls[0].args[1]).toBe(32); // y
		});

		it('renders multiple particles with correct number of arcs', () => {
			const state = makeState({
				particles: [
					makeParticle({ r: 0, c: 0 }),
					makeParticle({ r: 1, c: 1 }),
					makeParticle({ r: 2, c: 2 }),
				],
				summary: { active_count: 3, connection_count: 0, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, defaultConfig);

			const arcCalls = ctx.getCalls('arc');
			expect(arcCalls.length).toBe(3);
		});

		it('renders connections with moveTo and lineTo', () => {
			const state = makeState({
				connections: [makeConnection({ from: [0, 0], to: [4, 4] })],
				summary: { active_count: 0, connection_count: 1, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, defaultConfig);

			expect(ctx.wasCalled('moveTo')).toBe(true);
			expect(ctx.wasCalled('lineTo')).toBe(true);
			expect(ctx.wasCalled('stroke')).toBe(true);

			const moveToCall = ctx.getCalls('moveTo')[0];
			expect(moveToCall.args).toEqual([0, 0]); // col=0 * 16 + 0 = 0, row=0 * 16 + 0 = 0

			const lineToCall = ctx.getCalls('lineTo')[0];
			expect(lineToCall.args).toEqual([64, 64]); // col=4 * 16 = 64, row=4 * 16 = 64
		});

		it('renders dashed connections with setLineDash [8,4]', () => {
			const state = makeState({
				connections: [makeConnection({ style: 'dashed' })],
				summary: { active_count: 0, connection_count: 1, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, defaultConfig);

			const dashCalls = ctx.getCalls('setLineDash');
			const dashedCall = dashCalls.find(
				c => Array.isArray(c.args[0]) && c.args[0][0] === 8 && c.args[0][1] === 4,
			);
			expect(dashedCall).toBeDefined();
		});

		it('renders dotted connections with setLineDash [2,4]', () => {
			const state = makeState({
				connections: [makeConnection({ style: 'dotted' })],
				summary: { active_count: 0, connection_count: 1, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, defaultConfig);

			const dashCalls = ctx.getCalls('setLineDash');
			const dottedCall = dashCalls.find(
				c => Array.isArray(c.args[0]) && c.args[0][0] === 2 && c.args[0][1] === 4,
			);
			expect(dottedCall).toBeDefined();
		});

		it('renders curved connections with quadraticCurveTo', () => {
			const state = makeState({
				connections: [makeConnection({ from: [0, 0], to: [0, 4], curve: 20 })],
				summary: { active_count: 0, connection_count: 1, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, defaultConfig);

			expect(ctx.wasCalled('quadraticCurveTo')).toBe(true);
		});

		it('renders directed connections with arrowhead', () => {
			const state = makeState({
				connections: [makeConnection({ directed: true })],
				summary: { active_count: 0, connection_count: 1, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, defaultConfig);

			expect(ctx.wasCalled('closePath')).toBe(true);
			expect(ctx.callCount('fill')).toBeGreaterThanOrEqual(1);
		});

		it('sorts particles by layer (lower layer drawn first)', () => {
			const state = makeState({
				particles: [
					makeParticle({ r: 0, c: 0, layer: 2, color: '#0000FF' }),
					makeParticle({ r: 1, c: 1, layer: 0, color: '#FF0000' }),
					makeParticle({ r: 2, c: 2, layer: 1, color: '#00FF00' }),
				],
				summary: { active_count: 3, connection_count: 0, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, defaultConfig);

			// Track the order of fillStyle calls for particles
			// The particle fillStyle sets should be in layer order: #FF0000 (layer 0), #00FF00 (layer 1), #0000FF (layer 2)
			const fillStyleCalls = ctx.getCalls('set:fillStyle');
			// Skip the background fillStyle (#000000) — find the particle color sequence
			const particleColors = fillStyleCalls
				.map(c => c.args[0] as string)
				.filter(c => ['#FF0000', '#00FF00', '#0000FF'].includes(c));

			expect(particleColors).toEqual(['#FF0000', '#00FF00', '#0000FF']);
		});

		it('sorts connections by layer (lower layer drawn first)', () => {
			const state = makeState({
				connections: [
					makeConnection({ id: 'c1', from: [0, 0], to: [1, 1], layer: 2, color: '#0000FF' }),
					makeConnection({ id: 'c2', from: [2, 2], to: [3, 3], layer: 0, color: '#FF0000' }),
					makeConnection({ id: 'c3', from: [1, 0], to: [2, 1], layer: 1, color: '#00FF00' }),
				],
				summary: { active_count: 0, connection_count: 3, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, defaultConfig);

			const strokeStyleCalls = ctx.getCalls('set:strokeStyle');
			const connColors = strokeStyleCalls
				.map(c => c.args[0] as string)
				.filter(c => ['#FF0000', '#00FF00', '#0000FF'].includes(c));

			expect(connColors).toEqual(['#FF0000', '#00FF00', '#0000FF']);
		});

		it('draws connections before particles', () => {
			const state = makeState({
				particles: [makeParticle({ r: 0, c: 0 })],
				connections: [makeConnection({ from: [0, 0], to: [1, 1] })],
				summary: { active_count: 1, connection_count: 1, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, defaultConfig);

			// Find first stroke() (connection) and first arc() (particle)
			const strokeIndex = ctx.calls.findIndex(c => c.method === 'stroke');
			const arcIndex = ctx.calls.findIndex(c => c.method === 'arc');
			expect(strokeIndex).toBeLessThan(arcIndex);
		});

		it('applies HiDPI scaling with pixelRatio > 1', () => {
			const state = makeState();
			renderer.renderToCanvas(ctx, state, { ...defaultConfig, pixelRatio: 2 });

			expect(ctx.wasCalled('scale')).toBe(true);
			const scaleCall = ctx.getCalls('scale')[0];
			expect(scaleCall.args).toEqual([2, 2]);
		});

		it('does not call scale when pixelRatio is 1', () => {
			const state = makeState();
			renderer.renderToCanvas(ctx, state, { ...defaultConfig, pixelRatio: 1 });

			expect(ctx.wasCalled('scale')).toBe(false);
		});

		it('sets imageSmoothingEnabled from antialiasing config', () => {
			const state = makeState();
			renderer.renderToCanvas(ctx, state, { ...defaultConfig, antialiasing: false });

			const smoothingCall = ctx.getCalls('set:imageSmoothingEnabled')
				.find(c => c.args[0] === false);
			expect(smoothingCall).toBeDefined();
		});

		it('applies padding to particle positions', () => {
			const state = makeState({
				particles: [makeParticle({ r: 0, c: 0 })],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, { ...defaultConfig, padding: 20 });

			const arcCall = ctx.getCalls('arc')[0];
			expect(arcCall.args[0]).toBe(20); // x = padding + col * spacing = 20 + 0 = 20
			expect(arcCall.args[1]).toBe(20); // y = padding + row * spacing = 20 + 0 = 20
		});

		it('applies particle size multiplier to radius', () => {
			const state = makeState({
				particles: [makeParticle({ r: 0, c: 0, size: 2.0 })],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			// defaultParticleRadius = spacing/3 = 16/3 ≈ 5.333
			renderer.renderToCanvas(ctx, state, defaultConfig);

			const arcCall = ctx.getCalls('arc')[0];
			const expectedRadius = (16 / 3) * 2.0;
			expect(arcCall.args[2]).toBeCloseTo(expectedRadius);
		});

		it('renders square particles with fillRect', () => {
			const state = makeState({
				particles: [makeParticle({ r: 1, c: 1 })],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, { ...defaultConfig, particleShape: 'square' });

			// Should use fillRect for the particle (in addition to background fillRect)
			const fillRectCalls = ctx.getCalls('fillRect');
			expect(fillRectCalls.length).toBe(2); // 1 background + 1 particle
		});

		it('draws grid dots when showGrid is true', () => {
			const state = makeState({
				grid: { rows: 2, cols: 2, spacing: 16 },
				particles: [makeParticle({ r: 0, c: 0 })],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, { ...defaultConfig, showGrid: true });

			// Grid is 2x2 = 4 positions. 1 is active, so 3 grid dots drawn.
			// Each grid dot = 1 arc call. Plus 1 arc for the active particle = 4 arcs total.
			const arcCalls = ctx.getCalls('arc');
			expect(arcCalls.length).toBe(4); // 3 grid dots + 1 particle
		});

		it('does not draw grid dots when showGrid is false', () => {
			const state = makeState({
				grid: { rows: 2, cols: 2, spacing: 16 },
				particles: [],
				summary: { active_count: 0, connection_count: 0, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, { ...defaultConfig, showGrid: false });

			expect(ctx.wasCalled('arc')).toBe(false);
		});

		it('uses custom grid dot color and radius', () => {
			const state = makeState({
				grid: { rows: 1, cols: 1, spacing: 16 },
				particles: [],
				summary: { active_count: 0, connection_count: 0, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, {
				...defaultConfig,
				showGrid: true,
				gridDotColor: '#AAAAAA',
				gridDotRadius: 3,
			});

			const arcCalls = ctx.getCalls('arc');
			expect(arcCalls.length).toBe(1);
			expect(arcCalls[0].args[2]).toBe(3); // radius

			const fillStyleCalls = ctx.getCalls('set:fillStyle');
			const dotColor = fillStyleCalls.find(c => c.args[0] === '#AAAAAA');
			expect(dotColor).toBeDefined();
		});

		it('wraps rendering in save/restore', () => {
			const state = makeState();
			renderer.renderToCanvas(ctx, state, defaultConfig);

			// First call should be save, last should be restore
			expect(ctx.calls[0].method).toBe('save');
			expect(ctx.calls[ctx.calls.length - 1].method).toBe('restore');
		});

		it('handles custom defaultParticleRadius', () => {
			const state = makeState({
				particles: [makeParticle({ r: 0, c: 0, size: 1.0 })],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			renderer.renderToCanvas(ctx, state, { ...defaultConfig, defaultParticleRadius: 10 });

			const arcCall = ctx.getCalls('arc')[0];
			expect(arcCall.args[2]).toBe(10); // radius = 10 * 1.0
		});
	});

	describe('renderToBuffer', () => {
		it('creates a canvas via factory and renders onto it', () => {
			const state = makeState({
				particles: [makeParticle({ r: 0, c: 0 })],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			const factory = new MockCanvasFactory();
			const canvas = renderer.renderToBuffer(state, defaultConfig, factory);

			expect(factory.createdCanvases.length).toBe(1);
			expect(canvas.width).toBe(800);
			expect(canvas.height).toBe(600);
		});

		it('scales canvas dimensions by pixelRatio', () => {
			const state = makeState();
			const factory = new MockCanvasFactory();
			const canvas = renderer.renderToBuffer(state, { ...defaultConfig, pixelRatio: 2 }, factory);

			expect(canvas.width).toBe(1600);
			expect(canvas.height).toBe(1200);
		});

		it('renders state onto the created canvas', () => {
			const state = makeState({
				particles: [makeParticle({ r: 1, c: 2 })],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			const factory = new MockCanvasFactory();
			renderer.renderToBuffer(state, defaultConfig, factory);

			const mockCanvas = factory.createdCanvases[0];
			const mockCtx = mockCanvas.context;

			// Should have rendered the particle
			expect(mockCtx.wasCalled('arc')).toBe(true);
		});
	});
});
