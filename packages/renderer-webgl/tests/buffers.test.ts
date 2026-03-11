import { describe, it, expect, beforeEach } from 'vitest';
import { MockWebGLContext } from './mock-webgl.js';
import {
	QUAD_VERTICES,
	QUAD_VERTEX_COUNT,
	createBuffer,
	updateBuffer,
	createParticleBuffers,
	updateParticleBuffers,
	createConnectionBuffers,
	updateConnectionBuffers,
	deleteBuffer,
	deleteParticleBuffers,
	deleteConnectionBuffers,
	parseHexToRGB,
	createOrthographicMatrix,
} from '../src/buffers.js';

describe('Buffers', () => {
	let gl: MockWebGLContext;

	beforeEach(() => {
		gl = new MockWebGLContext();
	});

	describe('QUAD_VERTICES', () => {
		it('has 12 float values (6 vertices * 2 components)', () => {
			expect(QUAD_VERTICES.length).toBe(12);
		});

		it('is a Float32Array', () => {
			expect(QUAD_VERTICES).toBeInstanceOf(Float32Array);
		});
	});

	describe('QUAD_VERTEX_COUNT', () => {
		it('is 6 (two triangles)', () => {
			expect(QUAD_VERTEX_COUNT).toBe(6);
		});
	});

	describe('createBuffer', () => {
		it('calls gl.createBuffer', () => {
			createBuffer(gl);
			expect(gl.wasCalled('createBuffer')).toBe(true);
		});

		it('uploads data when provided', () => {
			const data = new Float32Array([1, 2, 3]);
			createBuffer(gl, data, gl.STATIC_DRAW);

			expect(gl.wasCalled('bindBuffer')).toBe(true);
			expect(gl.wasCalled('bufferData')).toBe(true);

			const bufferDataCall = gl.getCalls('bufferData')[0];
			expect(bufferDataCall.args[2]).toBe(gl.STATIC_DRAW);
		});

		it('uses STATIC_DRAW as default usage', () => {
			const data = new Float32Array([1, 2]);
			createBuffer(gl, data);

			const bufferDataCall = gl.getCalls('bufferData')[0];
			expect(bufferDataCall.args[2]).toBe(gl.STATIC_DRAW);
		});

		it('does not bind or upload when no data provided', () => {
			createBuffer(gl);
			expect(gl.wasCalled('bindBuffer')).toBe(false);
			expect(gl.wasCalled('bufferData')).toBe(false);
		});
	});

	describe('updateBuffer', () => {
		it('binds buffer and uploads data', () => {
			const buffer = createBuffer(gl);
			gl.reset();

			const data = new Float32Array([4, 5, 6]);
			updateBuffer(gl, buffer, data);

			expect(gl.wasCalled('bindBuffer')).toBe(true);
			expect(gl.wasCalled('bufferData')).toBe(true);
		});

		it('uses DYNAMIC_DRAW as default usage', () => {
			const buffer = createBuffer(gl);
			gl.reset();

			updateBuffer(gl, buffer, new Float32Array([1]));

			const bufferDataCall = gl.getCalls('bufferData')[0];
			expect(bufferDataCall.args[2]).toBe(gl.DYNAMIC_DRAW);
		});

		it('accepts custom usage parameter', () => {
			const buffer = createBuffer(gl);
			gl.reset();

			updateBuffer(gl, buffer, new Float32Array([1]), gl.STATIC_DRAW);

			const bufferDataCall = gl.getCalls('bufferData')[0];
			expect(bufferDataCall.args[2]).toBe(gl.STATIC_DRAW);
		});
	});

	describe('createParticleBuffers', () => {
		it('creates 4 buffers (quad, positions, colors, sizes)', () => {
			const buffers = createParticleBuffers(gl);

			expect(buffers.quad).toBeDefined();
			expect(buffers.positions).toBeDefined();
			expect(buffers.colors).toBeDefined();
			expect(buffers.sizes).toBeDefined();

			// createBuffer is called 4 times
			expect(gl.callCount('createBuffer')).toBe(4);
		});

		it('uploads quad vertex data', () => {
			createParticleBuffers(gl);

			// The quad buffer should have data uploaded
			const bufferDataCalls = gl.getCalls('bufferData');
			expect(bufferDataCalls.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('updateParticleBuffers', () => {
		it('updates positions, colors, and sizes buffers', () => {
			const buffers = createParticleBuffers(gl);
			gl.reset();

			const positions = new Float32Array([10, 20]);
			const colors = new Float32Array([1, 0, 0, 1]);
			const sizes = new Float32Array([5]);

			updateParticleBuffers(gl, buffers, positions, colors, sizes);

			// Should bind and upload 3 times (one for each buffer)
			expect(gl.callCount('bindBuffer')).toBe(3);
			expect(gl.callCount('bufferData')).toBe(3);
		});
	});

	describe('createConnectionBuffers', () => {
		it('creates 2 buffers (positions, colors)', () => {
			const buffers = createConnectionBuffers(gl);

			expect(buffers.positions).toBeDefined();
			expect(buffers.colors).toBeDefined();

			expect(gl.callCount('createBuffer')).toBe(2);
		});
	});

	describe('updateConnectionBuffers', () => {
		it('updates positions and colors buffers', () => {
			const buffers = createConnectionBuffers(gl);
			gl.reset();

			const positions = new Float32Array([0, 0, 10, 10]);
			const colors = new Float32Array([1, 1, 1, 1, 1, 1, 1, 1]);

			updateConnectionBuffers(gl, buffers, positions, colors);

			expect(gl.callCount('bindBuffer')).toBe(2);
			expect(gl.callCount('bufferData')).toBe(2);
		});
	});

	describe('deleteBuffer', () => {
		it('calls gl.deleteBuffer', () => {
			const buffer = createBuffer(gl);
			gl.reset();

			deleteBuffer(gl, buffer);
			expect(gl.wasCalled('deleteBuffer')).toBe(true);
		});

		it('handles null buffer gracefully', () => {
			deleteBuffer(gl, null);
			expect(gl.wasCalled('deleteBuffer')).toBe(false);
		});
	});

	describe('deleteParticleBuffers', () => {
		it('deletes all 4 particle buffers', () => {
			const buffers = createParticleBuffers(gl);
			gl.reset();

			deleteParticleBuffers(gl, buffers);
			expect(gl.callCount('deleteBuffer')).toBe(4);
		});
	});

	describe('deleteConnectionBuffers', () => {
		it('deletes both connection buffers', () => {
			const buffers = createConnectionBuffers(gl);
			gl.reset();

			deleteConnectionBuffers(gl, buffers);
			expect(gl.callCount('deleteBuffer')).toBe(2);
		});
	});

	describe('parseHexToRGB', () => {
		it('parses white (#FFFFFF)', () => {
			const [r, g, b] = parseHexToRGB('#FFFFFF');
			expect(r).toBeCloseTo(1.0);
			expect(g).toBeCloseTo(1.0);
			expect(b).toBeCloseTo(1.0);
		});

		it('parses black (#000000)', () => {
			const [r, g, b] = parseHexToRGB('#000000');
			expect(r).toBeCloseTo(0.0);
			expect(g).toBeCloseTo(0.0);
			expect(b).toBeCloseTo(0.0);
		});

		it('parses red (#FF0000)', () => {
			const [r, g, b] = parseHexToRGB('#FF0000');
			expect(r).toBeCloseTo(1.0);
			expect(g).toBeCloseTo(0.0);
			expect(b).toBeCloseTo(0.0);
		});

		it('parses without hash prefix', () => {
			const [r, g, b] = parseHexToRGB('00FF00');
			expect(r).toBeCloseTo(0.0);
			expect(g).toBeCloseTo(1.0);
			expect(b).toBeCloseTo(0.0);
		});

		it('parses mid-range color (#808080)', () => {
			const [r, g, b] = parseHexToRGB('#808080');
			expect(r).toBeCloseTo(128 / 255);
			expect(g).toBeCloseTo(128 / 255);
			expect(b).toBeCloseTo(128 / 255);
		});
	});

	describe('createOrthographicMatrix', () => {
		it('returns a 16-element Float32Array', () => {
			const mat = createOrthographicMatrix(800, 600);
			expect(mat).toBeInstanceOf(Float32Array);
			expect(mat.length).toBe(16);
		});

		it('maps center of viewport correctly', () => {
			const mat = createOrthographicMatrix(800, 600);
			// The matrix should transform (400, 300) to approximately (0, 0) in clip space
			// mat[0] = 2/800, mat[5] = -2/600, mat[12] = -1, mat[13] = 1
			expect(mat[0]).toBeCloseTo(2 / 800);
			expect(mat[5]).toBeCloseTo(-2 / 600);
			expect(mat[12]).toBeCloseTo(-1);
			expect(mat[13]).toBeCloseTo(1);
		});

		it('has correct column-major structure', () => {
			const mat = createOrthographicMatrix(100, 100);
			// Elements [1],[2],[3],[4],[6],[7],[8],[9],[11] should be 0
			expect(mat[1]).toBe(0);
			expect(mat[2]).toBe(0);
			expect(mat[3]).toBe(0);
			expect(mat[4]).toBe(0);
			expect(mat[6]).toBe(0);
			expect(mat[7]).toBe(0);
			// mat[15] should be 1 (homogeneous coordinate)
			expect(mat[15]).toBe(1);
		});
	});
});
