import { describe, it, expect } from 'vitest';
import {
	PARTICLE_VERTEX_SHADER,
	PARTICLE_FRAGMENT_SHADER,
	CONNECTION_VERTEX_SHADER,
	CONNECTION_FRAGMENT_SHADER,
} from '../src/shaders.js';

describe('Shaders', () => {
	describe('PARTICLE_VERTEX_SHADER', () => {
		it('is a non-empty string', () => {
			expect(typeof PARTICLE_VERTEX_SHADER).toBe('string');
			expect(PARTICLE_VERTEX_SHADER.length).toBeGreaterThan(0);
		});

		it('contains required attribute declarations', () => {
			expect(PARTICLE_VERTEX_SHADER).toContain('attribute vec2 a_quadVertex');
			expect(PARTICLE_VERTEX_SHADER).toContain('attribute vec2 a_position');
			expect(PARTICLE_VERTEX_SHADER).toContain('attribute vec4 a_color');
			expect(PARTICLE_VERTEX_SHADER).toContain('attribute float a_size');
		});

		it('contains projection uniform', () => {
			expect(PARTICLE_VERTEX_SHADER).toContain('uniform mat4 u_projection');
		});

		it('contains main function', () => {
			expect(PARTICLE_VERTEX_SHADER).toContain('void main()');
			expect(PARTICLE_VERTEX_SHADER).toContain('gl_Position');
		});

		it('passes color to fragment shader via varying', () => {
			expect(PARTICLE_VERTEX_SHADER).toContain('varying vec4 v_color');
		});
	});

	describe('PARTICLE_FRAGMENT_SHADER', () => {
		it('is a non-empty string', () => {
			expect(typeof PARTICLE_FRAGMENT_SHADER).toBe('string');
			expect(PARTICLE_FRAGMENT_SHADER.length).toBeGreaterThan(0);
		});

		it('has precision declaration', () => {
			expect(PARTICLE_FRAGMENT_SHADER).toContain('precision mediump float');
		});

		it('uses SDF for circle rendering', () => {
			expect(PARTICLE_FRAGMENT_SHADER).toContain('discard');
			expect(PARTICLE_FRAGMENT_SHADER).toContain('smoothstep');
		});

		it('supports both circle and square via u_particleShape', () => {
			expect(PARTICLE_FRAGMENT_SHADER).toContain('u_particleShape');
		});

		it('writes to gl_FragColor', () => {
			expect(PARTICLE_FRAGMENT_SHADER).toContain('gl_FragColor');
		});
	});

	describe('CONNECTION_VERTEX_SHADER', () => {
		it('is a non-empty string', () => {
			expect(typeof CONNECTION_VERTEX_SHADER).toBe('string');
			expect(CONNECTION_VERTEX_SHADER.length).toBeGreaterThan(0);
		});

		it('contains position and color attributes', () => {
			expect(CONNECTION_VERTEX_SHADER).toContain('attribute vec2 a_position');
			expect(CONNECTION_VERTEX_SHADER).toContain('attribute vec4 a_color');
		});

		it('contains projection uniform', () => {
			expect(CONNECTION_VERTEX_SHADER).toContain('uniform mat4 u_projection');
		});
	});

	describe('CONNECTION_FRAGMENT_SHADER', () => {
		it('is a non-empty string', () => {
			expect(typeof CONNECTION_FRAGMENT_SHADER).toBe('string');
			expect(CONNECTION_FRAGMENT_SHADER.length).toBeGreaterThan(0);
		});

		it('writes to gl_FragColor', () => {
			expect(CONNECTION_FRAGMENT_SHADER).toContain('gl_FragColor');
		});
	});
});
