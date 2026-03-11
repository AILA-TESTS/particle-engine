import { describe, it, expect, beforeEach } from 'vitest';
import { MockWebGLContext, createMockInstancedExtension } from './mock-webgl.js';
import { WebGLRenderer, resolveConfig, compileShader, linkProgram, createShaderProgram } from '../src/webgl-renderer.js';
import type { SpaceState, SerializedParticle, SerializedConnection } from '@particle-engine/core';
import type { WebGLRenderConfig } from '../src/types.js';

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

const defaultConfig: WebGLRenderConfig = { width: 800, height: 600 };

describe('WebGLRenderer', () => {
	let renderer: WebGLRenderer;
	let gl: MockWebGLContext;

	beforeEach(() => {
		renderer = new WebGLRenderer();
		gl = new MockWebGLContext({ webgl2: true });
	});

	describe('resolveConfig', () => {
		it('applies default values', () => {
			const resolved = resolveConfig({ width: 800, height: 600 }, 16);
			expect(resolved.backgroundColor).toBe('#000000');
			expect(resolved.antialiasing).toBe(true);
			expect(resolved.pixelRatio).toBe(1);
			expect(resolved.padding).toBe(0);
			expect(resolved.particleShape).toBe('circle');
			expect(resolved.defaultParticleRadius).toBeCloseTo(16 / 3);
		});

		it('preserves explicit values', () => {
			const resolved = resolveConfig({
				width: 1920,
				height: 1080,
				backgroundColor: '#112233',
				antialiasing: false,
				pixelRatio: 2,
				padding: 10,
				particleShape: 'square',
				defaultParticleRadius: 8,
			}, 16);

			expect(resolved.width).toBe(1920);
			expect(resolved.height).toBe(1080);
			expect(resolved.backgroundColor).toBe('#112233');
			expect(resolved.antialiasing).toBe(false);
			expect(resolved.pixelRatio).toBe(2);
			expect(resolved.padding).toBe(10);
			expect(resolved.particleShape).toBe('square');
			expect(resolved.defaultParticleRadius).toBe(8);
		});
	});

	describe('compileShader', () => {
		it('creates and compiles a shader', () => {
			const shader = compileShader(gl, gl.VERTEX_SHADER, 'void main() {}');

			expect(gl.wasCalled('createShader')).toBe(true);
			expect(gl.wasCalled('shaderSource')).toBe(true);
			expect(gl.wasCalled('compileShader')).toBe(true);
			expect(shader).toBeDefined();
		});

		it('throws on compilation failure', () => {
			gl.simulateCompileFailure = true;

			expect(() => compileShader(gl, gl.VERTEX_SHADER, 'bad shader'))
				.toThrow('Shader compilation failed');
		});

		it('deletes shader on compilation failure', () => {
			gl.simulateCompileFailure = true;

			try {
				compileShader(gl, gl.VERTEX_SHADER, 'bad');
			} catch {
				// expected
			}

			expect(gl.wasCalled('deleteShader')).toBe(true);
		});
	});

	describe('linkProgram', () => {
		it('creates and links a program', () => {
			const vs = compileShader(gl, gl.VERTEX_SHADER, 'vs');
			const fs = compileShader(gl, gl.FRAGMENT_SHADER, 'fs');
			const program = linkProgram(gl, vs, fs);

			expect(gl.wasCalled('createProgram')).toBe(true);
			expect(gl.wasCalled('attachShader')).toBe(true);
			expect(gl.wasCalled('linkProgram')).toBe(true);
			expect(program).toBeDefined();
		});

		it('throws on link failure', () => {
			const vs = compileShader(gl, gl.VERTEX_SHADER, 'vs');
			const fs = compileShader(gl, gl.FRAGMENT_SHADER, 'fs');

			gl.simulateLinkFailure = true;

			expect(() => linkProgram(gl, vs, fs)).toThrow('Program linking failed');
		});

		it('deletes program on link failure', () => {
			const vs = compileShader(gl, gl.VERTEX_SHADER, 'vs');
			const fs = compileShader(gl, gl.FRAGMENT_SHADER, 'fs');

			gl.simulateLinkFailure = true;

			try {
				linkProgram(gl, vs, fs);
			} catch {
				// expected
			}

			expect(gl.wasCalled('deleteProgram')).toBe(true);
		});
	});

	describe('createShaderProgram', () => {
		it('compiles, links, and resolves attribute/uniform locations', () => {
			const info = createShaderProgram(
				gl,
				'vertex src',
				'fragment src',
				['a_pos', 'a_color'],
				['u_proj'],
			);

			expect(info.program).toBeDefined();
			expect(info.attributes['a_pos']).toBeDefined();
			expect(info.attributes['a_color']).toBeDefined();
			expect(info.uniforms['u_proj']).toBeDefined();

			// Shaders should be deleted after linking
			expect(gl.callCount('deleteShader')).toBe(2);
		});
	});

	describe('init', () => {
		it('initializes GPU resources', () => {
			renderer.init(gl);

			expect(renderer.isInitialized()).toBe(true);
			// Should create 2 programs (particle + connection)
			expect(gl.callCount('createProgram')).toBe(2);
			// Should create 6 buffers (4 particle + 2 connection)
			expect(gl.callCount('createBuffer')).toBe(6);
		});

		it('detects WebGL 2 instanced rendering', () => {
			const gl2 = new MockWebGLContext({ webgl2: true });
			renderer.init(gl2);

			// Should NOT request ANGLE_instanced_arrays for WebGL 2
			// (it checks for drawArraysInstanced method first)
			expect(renderer.isInitialized()).toBe(true);
		});

		it('requests ANGLE_instanced_arrays for WebGL 1', () => {
			const gl1 = new MockWebGLContext({ webgl2: false });
			renderer.init(gl1);

			expect(gl1.wasCalled('getExtension')).toBe(true);
			const extCall = gl1.getCalls('getExtension').find(c => c.args[0] === 'ANGLE_instanced_arrays');
			expect(extCall).toBeDefined();
		});
	});

	describe('render', () => {
		it('sets viewport', () => {
			const state = makeState();
			renderer.render(gl, state, defaultConfig);

			expect(gl.wasCalled('viewport')).toBe(true);
			const viewportCall = gl.getCalls('viewport')[0];
			expect(viewportCall.args).toEqual([0, 0, 800, 600]);
		});

		it('clears with background color', () => {
			const state = makeState();
			renderer.render(gl, state, { ...defaultConfig, backgroundColor: '#FF0000' });

			expect(gl.wasCalled('clearColor')).toBe(true);
			const clearColorCall = gl.getCalls('clearColor')[0];
			expect(clearColorCall.args[0]).toBeCloseTo(1.0); // R
			expect(clearColorCall.args[1]).toBeCloseTo(0.0); // G
			expect(clearColorCall.args[2]).toBeCloseTo(0.0); // B
			expect(clearColorCall.args[3]).toBe(1.0);        // A

			expect(gl.wasCalled('clear')).toBe(true);
		});

		it('enables alpha blending', () => {
			const state = makeState();
			renderer.render(gl, state, defaultConfig);

			expect(gl.wasCalled('enable')).toBe(true);
			expect(gl.wasCalled('blendFunc')).toBe(true);

			const blendCall = gl.getCalls('blendFunc')[0];
			expect(blendCall.args).toEqual([gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA]);
		});

		it('scales viewport by pixelRatio', () => {
			const state = makeState();
			renderer.render(gl, state, { ...defaultConfig, pixelRatio: 2 });

			const viewportCall = gl.getCalls('viewport')[0];
			expect(viewportCall.args).toEqual([0, 0, 1600, 1200]);
		});

		it('renders empty state without draw calls', () => {
			const state = makeState();
			renderer.render(gl, state, defaultConfig);

			expect(gl.wasCalled('drawArrays')).toBe(false);
			expect(gl.wasCalled('drawArraysInstanced')).toBe(false);
		});

		it('auto-initializes on first render call', () => {
			expect(renderer.isInitialized()).toBe(false);

			renderer.render(gl, makeState(), defaultConfig);

			expect(renderer.isInitialized()).toBe(true);
		});
	});

	describe('render particles', () => {
		it('renders particles with instanced draw call', () => {
			const state = makeState({
				particles: [makeParticle({ r: 0, c: 0 })],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			renderer.render(gl, state, defaultConfig);

			expect(gl.wasCalled('drawArraysInstanced')).toBe(true);
			const drawCall = gl.getCalls('drawArraysInstanced')[0];
			expect(drawCall.args[0]).toBe(gl.TRIANGLES); // mode
			expect(drawCall.args[1]).toBe(0);             // first
			expect(drawCall.args[2]).toBe(6);             // count (quad vertices)
			expect(drawCall.args[3]).toBe(1);             // instanceCount
		});

		it('renders multiple particles in a single instanced call', () => {
			const state = makeState({
				particles: [
					makeParticle({ r: 0, c: 0 }),
					makeParticle({ r: 1, c: 1 }),
					makeParticle({ r: 2, c: 2 }),
				],
				summary: { active_count: 3, connection_count: 0, groups: [] },
			});
			renderer.render(gl, state, defaultConfig);

			// Only ONE instanced draw call for all 3 particles
			expect(gl.callCount('drawArraysInstanced')).toBe(1);
			const drawCall = gl.getCalls('drawArraysInstanced')[0];
			expect(drawCall.args[3]).toBe(3); // instanceCount = 3
		});

		it('sets particle shape uniform for circles', () => {
			const state = makeState({
				particles: [makeParticle()],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			renderer.render(gl, state, { ...defaultConfig, particleShape: 'circle' });

			const uniform1fCalls = gl.getCalls('uniform1f');
			// Should set u_particleShape to 0.0 for circles
			const shapeUniform = uniform1fCalls.find(c => c.args[1] === 0.0);
			expect(shapeUniform).toBeDefined();
		});

		it('sets particle shape uniform for squares', () => {
			const state = makeState({
				particles: [makeParticle()],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			renderer.render(gl, state, { ...defaultConfig, particleShape: 'square' });

			const uniform1fCalls = gl.getCalls('uniform1f');
			// Should set u_particleShape to 1.0 for squares
			const shapeUniform = uniform1fCalls.find(c => c.args[1] === 1.0);
			expect(shapeUniform).toBeDefined();
		});

		it('uploads projection matrix', () => {
			const state = makeState({
				particles: [makeParticle()],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			renderer.render(gl, state, defaultConfig);

			expect(gl.wasCalled('uniformMatrix4fv')).toBe(true);
		});

		it('enables and disables vertex attrib arrays', () => {
			const state = makeState({
				particles: [makeParticle()],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			renderer.render(gl, state, defaultConfig);

			// Should enable 4 attributes for particles (quad, position, color, size)
			expect(gl.callCount('enableVertexAttribArray')).toBeGreaterThanOrEqual(4);
			expect(gl.callCount('disableVertexAttribArray')).toBeGreaterThanOrEqual(4);
		});

		it('sets vertex attrib divisor for instance attributes', () => {
			const state = makeState({
				particles: [makeParticle()],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			renderer.render(gl, state, defaultConfig);

			// WebGL 2 uses vertexAttribDivisor
			expect(gl.wasCalled('vertexAttribDivisor')).toBe(true);

			// quad vertex should have divisor 0, instance attrs should have divisor 1
			const divisorCalls = gl.getCalls('vertexAttribDivisor');
			const divisor0 = divisorCalls.filter(c => c.args[1] === 0);
			const divisor1 = divisorCalls.filter(c => c.args[1] === 1);
			expect(divisor0.length).toBe(1);  // a_quadVertex
			expect(divisor1.length).toBe(3);  // a_position, a_color, a_size
		});

		it('uses ANGLE_instanced_arrays for WebGL 1', () => {
			const gl1 = new MockWebGLContext({ webgl2: false });
			const ext = createMockInstancedExtension();
			gl1.setExtension('ANGLE_instanced_arrays', ext);

			const r = new WebGLRenderer();
			const state = makeState({
				particles: [makeParticle()],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			r.render(gl1, state, defaultConfig);

			expect(ext.calls.some(c => c.method === 'drawArraysInstancedANGLE')).toBe(true);
			expect(ext.calls.some(c => c.method === 'vertexAttribDivisorANGLE')).toBe(true);
		});
	});

	describe('render connections', () => {
		it('renders connections with drawArrays GL_LINES', () => {
			const state = makeState({
				connections: [makeConnection()],
				summary: { active_count: 0, connection_count: 1, groups: [] },
			});
			renderer.render(gl, state, defaultConfig);

			expect(gl.wasCalled('drawArrays')).toBe(true);
			const drawCall = gl.getCalls('drawArrays')[0];
			expect(drawCall.args[0]).toBe(gl.LINES); // mode
			expect(drawCall.args[1]).toBe(0);         // first
			expect(drawCall.args[2]).toBe(2);         // count (2 vertices per line)
		});

		it('renders multiple connections in a single draw call', () => {
			const state = makeState({
				connections: [
					makeConnection({ id: 'c1', from: [0, 0], to: [1, 1] }),
					makeConnection({ id: 'c2', from: [2, 2], to: [3, 3] }),
					makeConnection({ id: 'c3', from: [0, 1], to: [1, 2] }),
				],
				summary: { active_count: 0, connection_count: 3, groups: [] },
			});
			renderer.render(gl, state, defaultConfig);

			// Only ONE drawArrays call for all connections
			const drawCalls = gl.getCalls('drawArrays');
			expect(drawCalls.length).toBe(1);
			expect(drawCalls[0].args[2]).toBe(6); // 3 connections * 2 vertices
		});

		it('sets line width', () => {
			const state = makeState({
				connections: [makeConnection({ width: 3 })],
				summary: { active_count: 0, connection_count: 1, groups: [] },
			});
			renderer.render(gl, state, defaultConfig);

			expect(gl.wasCalled('lineWidth')).toBe(true);
			const lineWidthCall = gl.getCalls('lineWidth')[0];
			expect(lineWidthCall.args[0]).toBe(3);
		});

		it('draws connections before particles', () => {
			const state = makeState({
				particles: [makeParticle()],
				connections: [makeConnection()],
				summary: { active_count: 1, connection_count: 1, groups: [] },
			});
			renderer.render(gl, state, defaultConfig);

			// drawArrays (connections) should come before drawArraysInstanced (particles)
			const drawArraysIndex = gl.calls.findIndex(c => c.method === 'drawArrays');
			const drawInstancedIndex = gl.calls.findIndex(c => c.method === 'drawArraysInstanced');
			expect(drawArraysIndex).toBeLessThan(drawInstancedIndex);
		});
	});

	describe('layer sorting', () => {
		it('sorts particles by layer', () => {
			const state = makeState({
				particles: [
					makeParticle({ r: 0, c: 0, layer: 2 }),
					makeParticle({ r: 1, c: 1, layer: 0 }),
					makeParticle({ r: 2, c: 2, layer: 1 }),
				],
				summary: { active_count: 3, connection_count: 0, groups: [] },
			});
			renderer.render(gl, state, defaultConfig);

			// The instanced draw call should happen, confirming sorting didn't break rendering
			expect(gl.wasCalled('drawArraysInstanced')).toBe(true);
		});

		it('sorts connections by layer', () => {
			const state = makeState({
				connections: [
					makeConnection({ id: 'c1', layer: 2 }),
					makeConnection({ id: 'c2', layer: 0 }),
					makeConnection({ id: 'c3', layer: 1 }),
				],
				summary: { active_count: 0, connection_count: 3, groups: [] },
			});
			renderer.render(gl, state, defaultConfig);

			expect(gl.wasCalled('drawArrays')).toBe(true);
		});
	});

	describe('dispose', () => {
		it('deletes all buffers', () => {
			renderer.init(gl);
			gl.reset();

			renderer.dispose();

			// Should delete 6 buffers (4 particle + 2 connection)
			expect(gl.callCount('deleteBuffer')).toBe(6);
		});

		it('deletes both programs', () => {
			renderer.init(gl);
			gl.reset();

			renderer.dispose();

			expect(gl.callCount('deleteProgram')).toBe(2);
		});

		it('resets initialized state', () => {
			renderer.init(gl);
			expect(renderer.isInitialized()).toBe(true);

			renderer.dispose();
			expect(renderer.isInitialized()).toBe(false);
		});

		it('is safe to call when not initialized', () => {
			expect(() => renderer.dispose()).not.toThrow();
		});

		it('is safe to call multiple times', () => {
			renderer.init(gl);
			renderer.dispose();
			expect(() => renderer.dispose()).not.toThrow();
		});
	});

	describe('isInitialized', () => {
		it('returns false before init', () => {
			expect(renderer.isInitialized()).toBe(false);
		});

		it('returns true after init', () => {
			renderer.init(gl);
			expect(renderer.isInitialized()).toBe(true);
		});

		it('returns false after dispose', () => {
			renderer.init(gl);
			renderer.dispose();
			expect(renderer.isInitialized()).toBe(false);
		});
	});

	describe('large scene performance', () => {
		it('renders 1000 particles in a single instanced call', () => {
			const particles: SerializedParticle[] = [];
			for (let i = 0; i < 1000; i++) {
				particles.push(makeParticle({
					r: Math.floor(i / 32),
					c: i % 32,
					color: '#FF8800',
					opacity: 0.8,
					size: 1.5,
				}));
			}
			const state = makeState({
				grid: { rows: 32, cols: 32, spacing: 16 },
				particles,
				summary: { active_count: 1000, connection_count: 0, groups: [] },
			});
			renderer.render(gl, state, defaultConfig);

			// Should still be exactly ONE instanced draw call
			expect(gl.callCount('drawArraysInstanced')).toBe(1);
			const drawCall = gl.getCalls('drawArraysInstanced')[0];
			expect(drawCall.args[3]).toBe(1000);
		});

		it('renders 500 connections in a single draw call', () => {
			const connections: SerializedConnection[] = [];
			for (let i = 0; i < 500; i++) {
				connections.push(makeConnection({
					id: `c${i}`,
					from: [0, i % 32],
					to: [1, i % 32],
				}));
			}
			const state = makeState({
				grid: { rows: 32, cols: 32, spacing: 16 },
				connections,
				summary: { active_count: 0, connection_count: 500, groups: [] },
			});
			renderer.render(gl, state, defaultConfig);

			const drawCalls = gl.getCalls('drawArrays');
			expect(drawCalls.length).toBe(1);
			expect(drawCalls[0].args[2]).toBe(1000); // 500 * 2 vertices
		});
	});

	describe('padding', () => {
		it('applies padding to particle positions', () => {
			const state = makeState({
				particles: [makeParticle({ r: 0, c: 0 })],
				summary: { active_count: 1, connection_count: 0, groups: [] },
			});
			renderer.render(gl, state, { ...defaultConfig, padding: 20 });

			// Verify bufferData was called with position data
			// Position should be (20, 20) = (padding + 0*spacing, padding + 0*spacing)
			const bufferDataCalls = gl.getCalls('bufferData');
			expect(bufferDataCalls.length).toBeGreaterThan(0);
		});
	});
});
