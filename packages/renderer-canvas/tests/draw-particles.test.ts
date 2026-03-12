import { describe, it, expect, beforeEach } from 'vitest';
import { drawParticle, drawGridDot } from '../src/draw-particles.js';
import { MockContext } from './mock-canvas.js';

describe('drawParticle', () => {
	let ctx: MockContext;

	beforeEach(() => {
		ctx = new MockContext();
	});

	it('draws a circle particle with arc', () => {
		drawParticle(ctx, 100, 200, 5, '#FF0000', 1.0, 'circle');

		expect(ctx.wasCalled('save')).toBe(true);
		expect(ctx.wasCalled('restore')).toBe(true);
		expect(ctx.wasCalled('beginPath')).toBe(true);
		expect(ctx.wasCalled('arc')).toBe(true);
		expect(ctx.wasCalled('fill')).toBe(true);

		const arcCall = ctx.getCalls('arc')[0];
		expect(arcCall.args[0]).toBe(100); // x
		expect(arcCall.args[1]).toBe(200); // y
		expect(arcCall.args[2]).toBe(5);   // radius
		expect(arcCall.args[3]).toBe(0);   // startAngle
		expect(arcCall.args[4]).toBeCloseTo(Math.PI * 2); // endAngle
	});

	it('draws a square particle with fillRect', () => {
		drawParticle(ctx, 50, 75, 10, '#00FF00', 0.8, 'square');

		expect(ctx.wasCalled('fillRect')).toBe(true);
		expect(ctx.wasCalled('arc')).toBe(false);

		const fillRectCall = ctx.getCalls('fillRect')[0];
		expect(fillRectCall.args[0]).toBe(40);  // x - radius
		expect(fillRectCall.args[1]).toBe(65);  // y - radius
		expect(fillRectCall.args[2]).toBe(20);  // radius * 2
		expect(fillRectCall.args[3]).toBe(20);  // radius * 2
	});

	it('sets globalAlpha for opacity', () => {
		drawParticle(ctx, 0, 0, 5, '#FFFFFF', 0.5, 'circle');

		const alphaCall = ctx.getCalls('set:globalAlpha').find(c => c.args[0] === 0.5);
		expect(alphaCall).toBeDefined();
	});

	it('sets fillStyle to the particle color', () => {
		drawParticle(ctx, 0, 0, 5, '#ABCDEF', 1.0, 'circle');

		const fillStyleCall = ctx.getCalls('set:fillStyle').find(c => c.args[0] === '#ABCDEF');
		expect(fillStyleCall).toBeDefined();
	});

	it('saves and restores context state', () => {
		drawParticle(ctx, 0, 0, 5, '#FFFFFF', 1.0, 'circle');

		const saveIndex = ctx.calls.findIndex(c => c.method === 'save');
		const restoreIndex = ctx.calls.findIndex(c => c.method === 'restore');
		expect(saveIndex).toBeLessThan(restoreIndex);
	});

	it('handles zero radius', () => {
		drawParticle(ctx, 10, 20, 0, '#FFFFFF', 1.0, 'circle');

		const arcCall = ctx.getCalls('arc')[0];
		expect(arcCall.args[2]).toBe(0); // radius = 0
	});

	it('handles zero opacity', () => {
		drawParticle(ctx, 10, 20, 5, '#FFFFFF', 0, 'circle');

		const alphaCall = ctx.getCalls('set:globalAlpha').find(c => c.args[0] === 0);
		expect(alphaCall).toBeDefined();
	});
});

describe('drawGridDot', () => {
	let ctx: MockContext;

	beforeEach(() => {
		ctx = new MockContext();
	});

	it('draws a grid dot as a filled circle', () => {
		drawGridDot(ctx, 50, 60, 1, '#333333');

		expect(ctx.wasCalled('save')).toBe(true);
		expect(ctx.wasCalled('restore')).toBe(true);
		expect(ctx.wasCalled('beginPath')).toBe(true);
		expect(ctx.wasCalled('arc')).toBe(true);
		expect(ctx.wasCalled('fill')).toBe(true);

		const arcCall = ctx.getCalls('arc')[0];
		expect(arcCall.args[0]).toBe(50);
		expect(arcCall.args[1]).toBe(60);
		expect(arcCall.args[2]).toBe(1);
	});

	it('sets globalAlpha to 1.0', () => {
		drawGridDot(ctx, 0, 0, 1, '#333333');

		const alphaCall = ctx.getCalls('set:globalAlpha').find(c => c.args[0] === 1.0);
		expect(alphaCall).toBeDefined();
	});

	it('sets fillStyle to the dot color', () => {
		drawGridDot(ctx, 0, 0, 2, '#444444');

		const fillStyleCall = ctx.getCalls('set:fillStyle').find(c => c.args[0] === '#444444');
		expect(fillStyleCall).toBeDefined();
	});
});
