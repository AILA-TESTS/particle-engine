import { describe, it, expect } from 'vitest';
import { SVGRenderer } from '../src/svg-renderer.js';
import type { SpaceState, SerializedParticle, SerializedConnection } from '@particle-engine/core';
import type { RenderConfig } from '../src/types.js';

function makeState(overrides: Partial<SpaceState> = {}): SpaceState {
	return {
		grid: { rows: 10, cols: 10, spacing: 16 },
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
		id: 'conn-1',
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

describe('SVGRenderer', () => {
	const renderer = new SVGRenderer();

	describe('basic SVG structure', () => {
		it('renders an empty state with SVG wrapper and background', () => {
			const state = makeState();
			const result = renderer.render(state, defaultConfig);

			expect(result.width).toBe(800);
			expect(result.height).toBe(600);
			expect(result.svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
			expect(result.svg).toContain('width="800"');
			expect(result.svg).toContain('height="600"');
			expect(result.svg).toContain('fill="#000000"');
			expect(result.svg).toContain('</svg>');
		});

		it('includes viewBox based on grid dimensions', () => {
			const state = makeState({ grid: { rows: 5, cols: 5, spacing: 20 } });
			const result = renderer.render(state, defaultConfig);

			// (5-1)*20 = 80
			expect(result.svg).toContain('viewBox="0 0 80 80"');
		});

		it('uses geometric precision by default', () => {
			const state = makeState();
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('shape-rendering="geometricPrecision"');
		});

		it('uses crispEdges when antialiasing is false', () => {
			const state = makeState();
			const result = renderer.render(state, { ...defaultConfig, antialiasing: false });

			expect(result.svg).toContain('shape-rendering="crispEdges"');
		});

		it('applies custom background color', () => {
			const state = makeState();
			const result = renderer.render(state, { ...defaultConfig, backgroundColor: '#112233' });

			expect(result.svg).toContain('fill="#112233"');
		});

		it('applies pixel ratio to viewBox', () => {
			const state = makeState({ grid: { rows: 5, cols: 5, spacing: 20 } });
			const result = renderer.render(state, { ...defaultConfig, pixelRatio: 2 });

			// 80/2 = 40
			expect(result.svg).toContain('viewBox="0 0 40 40"');
		});
	});

	describe('particle rendering', () => {
		it('renders a single particle as a circle', () => {
			const state = makeState({
				particles: [makeParticle({ r: 2, c: 3, color: '#FF0000' })],
			});
			const result = renderer.render(state, defaultConfig);

			// position: col*spacing=3*16=48, row*spacing=2*16=32
			expect(result.svg).toContain('<circle');
			expect(result.svg).toContain('cx="48"');
			expect(result.svg).toContain('cy="32"');
			expect(result.svg).toContain('fill="#FF0000"');
		});

		it('renders particles as squares when configured', () => {
			const state = makeState({
				particles: [makeParticle({ r: 0, c: 0 })],
			});
			const result = renderer.render(state, { ...defaultConfig, particleShape: 'square' });

			expect(result.svg).toContain('<rect');
			expect(result.svg).not.toContain('<circle cx="0"');
		});

		it('renders multiple particles', () => {
			const state = makeState({
				particles: [
					makeParticle({ r: 0, c: 0, color: '#FF0000' }),
					makeParticle({ r: 1, c: 1, color: '#00FF00' }),
					makeParticle({ r: 2, c: 2, color: '#0000FF' }),
				],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('fill="#FF0000"');
			expect(result.svg).toContain('fill="#00FF00"');
			expect(result.svg).toContain('fill="#0000FF"');
		});

		it('respects padding for particle positions', () => {
			const state = makeState({
				particles: [makeParticle({ r: 0, c: 0 })],
			});
			const result = renderer.render(state, { ...defaultConfig, padding: 20 });

			expect(result.svg).toContain('cx="20"');
			expect(result.svg).toContain('cy="20"');
		});

		it('includes particle opacity', () => {
			const state = makeState({
				particles: [makeParticle({ opacity: 0.5 })],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('opacity="0.5"');
		});

		it('applies particle size to radius', () => {
			const state = makeState({
				grid: { rows: 10, cols: 10, spacing: 30 },
				particles: [makeParticle({ size: 2.0 })],
			});
			// default radius = 30/3 = 10, effective = 10*2.0 = 20
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('r="20"');
		});

		it('uses custom default particle radius', () => {
			const state = makeState({
				particles: [makeParticle({ size: 1.0 })],
			});
			const result = renderer.render(state, { ...defaultConfig, defaultParticleRadius: 7 });

			expect(result.svg).toContain('r="7"');
		});
	});

	describe('connection rendering', () => {
		it('renders a straight connection as a line', () => {
			const state = makeState({
				connections: [makeConnection({
					from: [0, 0], to: [1, 1], color: '#AABBCC',
				})],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('<line');
			expect(result.svg).toContain('x1="0"');
			expect(result.svg).toContain('y1="0"');
			expect(result.svg).toContain('x2="16"');
			expect(result.svg).toContain('y2="16"');
			expect(result.svg).toContain('stroke="#AABBCC"');
		});

		it('renders dashed connections', () => {
			const state = makeState({
				connections: [makeConnection({ style: 'dashed' })],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('stroke-dasharray="8,4"');
		});

		it('renders dotted connections', () => {
			const state = makeState({
				connections: [makeConnection({ style: 'dotted' })],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('stroke-dasharray="2,4"');
		});

		it('renders curved connections as paths', () => {
			const state = makeState({
				connections: [makeConnection({ curve: 0.5 })],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('<path');
			expect(result.svg).toContain('d="M');
			expect(result.svg).toContain('Q');
		});

		it('renders directed connections with arrowhead markers', () => {
			const state = makeState({
				connections: [makeConnection({ directed: true, id: 'c1' })],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('<defs>');
			expect(result.svg).toContain('<marker');
			expect(result.svg).toContain('id="arrowhead-c1"');
			expect(result.svg).toContain('marker-end="url(#arrowhead-c1)"');
		});

		it('renders connection labels', () => {
			const state = makeState({
				connections: [makeConnection({ label: 'edge A' })],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('<text');
			expect(result.svg).toContain('edge A');
		});

		it('renders connection with opacity', () => {
			const state = makeState({
				connections: [makeConnection({ opacity: 0.3 })],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('stroke-opacity="0.3"');
		});

		it('applies connection width', () => {
			const state = makeState({
				connections: [makeConnection({ width: 4 })],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('stroke-width="4"');
		});
	});

	describe('layer ordering', () => {
		it('renders lower layers before higher layers', () => {
			const state = makeState({
				particles: [
					makeParticle({ r: 0, c: 0, color: '#FF0000', layer: 2 }),
					makeParticle({ r: 1, c: 1, color: '#00FF00', layer: 0 }),
					makeParticle({ r: 2, c: 2, color: '#0000FF', layer: 1 }),
				],
			});
			const result = renderer.render(state, defaultConfig);

			const greenIdx = result.svg.indexOf('fill="#00FF00"');
			const blueIdx = result.svg.indexOf('fill="#0000FF"');
			const redIdx = result.svg.indexOf('fill="#FF0000"');

			expect(greenIdx).toBeLessThan(blueIdx);
			expect(blueIdx).toBeLessThan(redIdx);
		});

		it('renders connections before particles on the same layer', () => {
			const state = makeState({
				particles: [makeParticle({ r: 0, c: 0, layer: 0 })],
				connections: [makeConnection({ layer: 0 })],
			});
			const result = renderer.render(state, defaultConfig);

			const lineIdx = result.svg.indexOf('<line') !== -1
				? result.svg.indexOf('<line')
				: result.svg.indexOf('<path');
			const circleIdx = result.svg.indexOf('<circle');

			expect(lineIdx).toBeLessThan(circleIdx);
		});

		it('renders a connection on layer 0 before a particle on layer 1', () => {
			const state = makeState({
				particles: [makeParticle({ r: 0, c: 0, layer: 1 })],
				connections: [makeConnection({ layer: 0 })],
			});
			const result = renderer.render(state, defaultConfig);

			const lineIdx = result.svg.indexOf('<line');
			const circleIdx = result.svg.indexOf('<circle');

			expect(lineIdx).toBeLessThan(circleIdx);
		});

		it('renders a particle on layer 0 before a connection on layer 1', () => {
			const state = makeState({
				particles: [makeParticle({ r: 0, c: 0, layer: 0, color: '#FF0000' })],
				connections: [makeConnection({ layer: 1, color: '#00FF00' })],
			});
			const result = renderer.render(state, defaultConfig);

			const circleIdx = result.svg.indexOf('<circle');
			const lineIdx = result.svg.indexOf('<line');

			expect(circleIdx).toBeLessThan(lineIdx);
		});
	});

	describe('grid dots', () => {
		it('does not render grid dots by default', () => {
			const state = makeState({ grid: { rows: 3, cols: 3, spacing: 16 } });
			const result = renderer.render(state, defaultConfig);

			// Count circles - should be 0 (no particles, no grid dots)
			const circleCount = (result.svg.match(/<circle/g) || []).length;
			expect(circleCount).toBe(0);
		});

		it('renders grid dots for inactive positions when showGrid is true', () => {
			const state = makeState({
				grid: { rows: 3, cols: 3, spacing: 16 },
				particles: [makeParticle({ r: 1, c: 1 })],
			});
			const result = renderer.render(state, {
				...defaultConfig,
				showGrid: true,
				gridDotColor: '#444444',
				gridDotRadius: 2,
			});

			// 3x3 = 9 positions, 1 active, 8 grid dots + 1 particle circle = 9 circles
			const circleCount = (result.svg.match(/<circle/g) || []).length;
			expect(circleCount).toBe(9);
			expect(result.svg).toContain('fill="#444444"');
		});

		it('does not render grid dots at active particle positions', () => {
			const state = makeState({
				grid: { rows: 2, cols: 2, spacing: 16 },
				particles: [
					makeParticle({ r: 0, c: 0 }),
					makeParticle({ r: 0, c: 1 }),
					makeParticle({ r: 1, c: 0 }),
					makeParticle({ r: 1, c: 1 }),
				],
			});
			const result = renderer.render(state, { ...defaultConfig, showGrid: true });

			// All positions active -> 0 grid dots, 4 particle circles
			const circleCount = (result.svg.match(/<circle/g) || []).length;
			expect(circleCount).toBe(4);
		});
	});

	describe('combined rendering', () => {
		it('renders particles and connections together', () => {
			const state = makeState({
				particles: [
					makeParticle({ r: 0, c: 0, color: '#FF0000' }),
					makeParticle({ r: 2, c: 3, color: '#00FF00' }),
				],
				connections: [
					makeConnection({
						from: [0, 0],
						to: [2, 3],
						color: '#0000FF',
						width: 2,
					}),
				],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('fill="#FF0000"');
			expect(result.svg).toContain('fill="#00FF00"');
			expect(result.svg).toContain('stroke="#0000FF"');
		});

		it('produces valid self-contained SVG', () => {
			const state = makeState({
				particles: [makeParticle({ r: 0, c: 0 })],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
			expect(result.svg).toMatch(/<\/svg>$/);
		});

		it('handles multiple directed connections with unique marker ids', () => {
			const state = makeState({
				connections: [
					makeConnection({ id: 'c1', directed: true, from: [0, 0], to: [1, 1] }),
					makeConnection({ id: 'c2', directed: true, from: [2, 2], to: [3, 3] }),
				],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('id="arrowhead-c1"');
			expect(result.svg).toContain('id="arrowhead-c2"');
			expect(result.svg).toContain('marker-end="url(#arrowhead-c1)"');
			expect(result.svg).toContain('marker-end="url(#arrowhead-c2)"');
		});

		it('does not render defs when no directed connections', () => {
			const state = makeState({
				connections: [makeConnection({ directed: false })],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).not.toContain('<defs>');
		});

		it('renders curved directed connections', () => {
			const state = makeState({
				connections: [makeConnection({ directed: true, curve: 0.3, id: 'c1' })],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('<path');
			expect(result.svg).toContain('marker-end="url(#arrowhead-c1)"');
		});
	});

	describe('edge cases', () => {
		it('handles a 1x1 grid', () => {
			const state = makeState({
				grid: { rows: 1, cols: 1, spacing: 16 },
				particles: [makeParticle({ r: 0, c: 0 })],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('<circle');
			expect(result.svg).toContain('cx="0"');
			expect(result.svg).toContain('cy="0"');
		});

		it('handles empty particles and connections arrays', () => {
			const state = makeState();
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('<svg');
			expect(result.svg).toContain('</svg>');
			// Should only have background rect, no circles or lines
			expect(result.svg).not.toContain('<circle');
			expect(result.svg).not.toContain('<line');
			expect(result.svg).not.toContain('<path');
		});

		it('returns correct width and height in result', () => {
			const state = makeState();
			const result = renderer.render(state, { width: 1920, height: 1080 });

			expect(result.width).toBe(1920);
			expect(result.height).toBe(1080);
		});

		it('handles connection with label containing special characters', () => {
			const state = makeState({
				connections: [makeConnection({ label: 'x < y & z > w' })],
			});
			const result = renderer.render(state, defaultConfig);

			expect(result.svg).toContain('x &lt; y &amp; z &gt; w');
		});

		it('renders with large padding', () => {
			const state = makeState({
				grid: { rows: 3, cols: 3, spacing: 10 },
				particles: [makeParticle({ r: 1, c: 1 })],
			});
			const result = renderer.render(state, { ...defaultConfig, padding: 50 });

			// Position should be padding + col*spacing = 50 + 1*10 = 60
			expect(result.svg).toContain('cx="60"');
			expect(result.svg).toContain('cy="60"');
		});
	});
});
