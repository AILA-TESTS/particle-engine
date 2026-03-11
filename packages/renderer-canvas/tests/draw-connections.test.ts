import { describe, it, expect, beforeEach } from 'vitest';
import { drawConnection } from '../src/draw-connections.js';
import { MockContext } from './mock-canvas.js';
import type { SerializedConnection } from '@particle-engine/core';

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

describe('drawConnection', () => {
	let ctx: MockContext;

	beforeEach(() => {
		ctx = new MockContext();
	});

	it('draws a solid straight connection', () => {
		const conn = makeConnection();
		drawConnection(ctx, 0, 0, 100, 100, conn);

		expect(ctx.wasCalled('save')).toBe(true);
		expect(ctx.wasCalled('restore')).toBe(true);
		expect(ctx.wasCalled('beginPath')).toBe(true);
		expect(ctx.wasCalled('moveTo')).toBe(true);
		expect(ctx.wasCalled('lineTo')).toBe(true);
		expect(ctx.wasCalled('stroke')).toBe(true);

		const moveToCall = ctx.getCalls('moveTo')[0];
		expect(moveToCall.args).toEqual([0, 0]);

		const lineToCall = ctx.getCalls('lineTo')[0];
		expect(lineToCall.args).toEqual([100, 100]);
	});

	it('sets solid line dash to empty array', () => {
		const conn = makeConnection({ style: 'solid' });
		drawConnection(ctx, 0, 0, 100, 100, conn);

		const dashCalls = ctx.getCalls('setLineDash');
		// First setLineDash should be the style (empty for solid)
		expect(dashCalls[0].args[0]).toEqual([]);
	});

	it('sets dashed line dash to [8, 4]', () => {
		const conn = makeConnection({ style: 'dashed' });
		drawConnection(ctx, 0, 0, 100, 100, conn);

		const dashCalls = ctx.getCalls('setLineDash');
		expect(dashCalls[0].args[0]).toEqual([8, 4]);
	});

	it('sets dotted line dash to [2, 4]', () => {
		const conn = makeConnection({ style: 'dotted' });
		drawConnection(ctx, 0, 0, 100, 100, conn);

		const dashCalls = ctx.getCalls('setLineDash');
		expect(dashCalls[0].args[0]).toEqual([2, 4]);
	});

	it('draws a curved connection with quadraticCurveTo', () => {
		const conn = makeConnection({ curve: 20 });
		drawConnection(ctx, 0, 0, 100, 0, conn);

		expect(ctx.wasCalled('quadraticCurveTo')).toBe(true);
		expect(ctx.wasCalled('lineTo')).toBe(false); // Should not also lineTo in the main path
	});

	it('falls back to lineTo for curved connection when from === to', () => {
		const conn = makeConnection({ curve: 20 });
		drawConnection(ctx, 50, 50, 50, 50, conn);

		// When from === to, length is 0, should fall back to lineTo
		expect(ctx.wasCalled('lineTo')).toBe(true);
	});

	it('draws arrowhead for directed connection', () => {
		const conn = makeConnection({ directed: true });
		drawConnection(ctx, 0, 0, 100, 0, conn);

		// Arrowhead: moveTo, lineTo, lineTo, closePath, fill
		expect(ctx.wasCalled('closePath')).toBe(true);
		// Should have multiple fill() calls (one for arrowhead)
		expect(ctx.callCount('fill')).toBeGreaterThanOrEqual(1);
	});

	it('does not draw arrowhead for non-directed connection', () => {
		const conn = makeConnection({ directed: false });
		drawConnection(ctx, 0, 0, 100, 0, conn);

		expect(ctx.wasCalled('closePath')).toBe(false);
	});

	it('draws label text at midpoint', () => {
		const conn = makeConnection({ label: 'test label' });
		drawConnection(ctx, 0, 0, 100, 100, conn);

		expect(ctx.wasCalled('fillText')).toBe(true);
		const fillTextCall = ctx.getCalls('fillText')[0];
		expect(fillTextCall.args[0]).toBe('test label');
		expect(fillTextCall.args[1]).toBe(50); // midX
		expect(fillTextCall.args[2]).toBe(50); // midY
	});

	it('does not draw label when label is empty', () => {
		const conn = makeConnection({ label: '' });
		drawConnection(ctx, 0, 0, 100, 100, conn);

		expect(ctx.wasCalled('fillText')).toBe(false);
	});

	it('sets stroke color from connection color', () => {
		const conn = makeConnection({ color: '#FF0000' });
		drawConnection(ctx, 0, 0, 100, 100, conn);

		const strokeCall = ctx.getCalls('set:strokeStyle').find(c => c.args[0] === '#FF0000');
		expect(strokeCall).toBeDefined();
	});

	it('sets lineWidth from connection width', () => {
		const conn = makeConnection({ width: 3 });
		drawConnection(ctx, 0, 0, 100, 100, conn);

		const widthCall = ctx.getCalls('set:lineWidth').find(c => c.args[0] === 3);
		expect(widthCall).toBeDefined();
	});

	it('sets globalAlpha from connection opacity', () => {
		const conn = makeConnection({ opacity: 0.7 });
		drawConnection(ctx, 0, 0, 100, 100, conn);

		const alphaCall = ctx.getCalls('set:globalAlpha').find(c => c.args[0] === 0.7);
		expect(alphaCall).toBeDefined();
	});

	it('sets lineCap and lineJoin to round', () => {
		const conn = makeConnection();
		drawConnection(ctx, 0, 0, 100, 100, conn);

		const capCall = ctx.getCalls('set:lineCap').find(c => c.args[0] === 'round');
		expect(capCall).toBeDefined();
		const joinCall = ctx.getCalls('set:lineJoin').find(c => c.args[0] === 'round');
		expect(joinCall).toBeDefined();
	});

	it('draws arrowhead with curved connection', () => {
		const conn = makeConnection({ directed: true, curve: 30 });
		drawConnection(ctx, 0, 0, 100, 0, conn);

		expect(ctx.wasCalled('closePath')).toBe(true);
		expect(ctx.callCount('fill')).toBeGreaterThanOrEqual(1);
	});

	it('resets line dash before drawing arrowhead', () => {
		const conn = makeConnection({ directed: true, style: 'dashed' });
		drawConnection(ctx, 0, 0, 100, 100, conn);

		const dashCalls = ctx.getCalls('setLineDash');
		// First call sets [8, 4], second call resets to []
		expect(dashCalls.length).toBeGreaterThanOrEqual(2);
		expect(dashCalls[0].args[0]).toEqual([8, 4]);
		expect(dashCalls[1].args[0]).toEqual([]);
	});
});
