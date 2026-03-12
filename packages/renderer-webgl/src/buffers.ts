// ============================================================
// Buffers — WebGL buffer management for particle and connection data
// ============================================================

import type {
	WebGLContextLike,
	ParticleBuffers,
	ConnectionBuffers,
} from './types.js';

/**
 * Quad vertex data for a unit quad centered at origin.
 * Two triangles forming a [-1, -1] to [1, 1] square.
 * 6 vertices * 2 components = 12 floats.
 */
export const QUAD_VERTICES = new Float32Array([
	// Triangle 1
	-1, -1,
	 1, -1,
	 1,  1,
	// Triangle 2
	-1, -1,
	 1,  1,
	-1,  1,
]);

/** Number of vertices in the quad (2 triangles) */
export const QUAD_VERTEX_COUNT = 6;

/**
 * Create a WebGL buffer and optionally upload data.
 */
export function createBuffer(
	gl: WebGLContextLike,
	data?: ArrayBuffer | ArrayBufferView,
	usage?: number,
): WebGLBuffer {
	const buffer = gl.createBuffer();
	if (!buffer) {
		throw new Error('Failed to create WebGL buffer');
	}
	if (data) {
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, data, usage ?? gl.STATIC_DRAW);
	}
	return buffer;
}

/**
 * Update an existing buffer with new data.
 */
export function updateBuffer(
	gl: WebGLContextLike,
	buffer: WebGLBuffer,
	data: ArrayBuffer | ArrayBufferView,
	usage?: number,
): void {
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, data, usage ?? gl.DYNAMIC_DRAW);
}

/**
 * Create the full set of buffers for particle instanced rendering.
 */
export function createParticleBuffers(gl: WebGLContextLike): ParticleBuffers {
	return {
		quad: createBuffer(gl, QUAD_VERTICES, gl.STATIC_DRAW),
		positions: createBuffer(gl),
		colors: createBuffer(gl),
		sizes: createBuffer(gl),
	};
}

/**
 * Update particle instance buffers from typed arrays.
 */
export function updateParticleBuffers(
	gl: WebGLContextLike,
	buffers: ParticleBuffers,
	positions: Float32Array,
	colors: Float32Array,
	sizes: Float32Array,
): void {
	updateBuffer(gl, buffers.positions, positions, gl.DYNAMIC_DRAW);
	updateBuffer(gl, buffers.colors, colors, gl.DYNAMIC_DRAW);
	updateBuffer(gl, buffers.sizes, sizes, gl.DYNAMIC_DRAW);
}

/**
 * Create buffers for connection line rendering.
 */
export function createConnectionBuffers(gl: WebGLContextLike): ConnectionBuffers {
	return {
		positions: createBuffer(gl),
		colors: createBuffer(gl),
	};
}

/**
 * Update connection buffers from typed arrays.
 */
export function updateConnectionBuffers(
	gl: WebGLContextLike,
	buffers: ConnectionBuffers,
	positions: Float32Array,
	colors: Float32Array,
): void {
	updateBuffer(gl, buffers.positions, positions, gl.DYNAMIC_DRAW);
	updateBuffer(gl, buffers.colors, colors, gl.DYNAMIC_DRAW);
}

/**
 * Delete a buffer and release GPU memory.
 */
export function deleteBuffer(gl: WebGLContextLike, buffer: WebGLBuffer | null): void {
	if (buffer) {
		gl.deleteBuffer(buffer);
	}
}

/**
 * Delete all particle buffers.
 */
export function deleteParticleBuffers(gl: WebGLContextLike, buffers: ParticleBuffers): void {
	deleteBuffer(gl, buffers.quad);
	deleteBuffer(gl, buffers.positions);
	deleteBuffer(gl, buffers.colors);
	deleteBuffer(gl, buffers.sizes);
}

/**
 * Delete all connection buffers.
 */
export function deleteConnectionBuffers(gl: WebGLContextLike, buffers: ConnectionBuffers): void {
	deleteBuffer(gl, buffers.positions);
	deleteBuffer(gl, buffers.colors);
}

/**
 * Parse a hex color string to normalized [r, g, b] values.
 */
export function parseHexToRGB(hex: string): [number, number, number] {
	let clean = hex.startsWith('#') ? hex.slice(1) : hex;
	if (clean.length === 3) {
		clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
	}
	const r = parseInt(clean.substring(0, 2), 16) / 255;
	const g = parseInt(clean.substring(2, 4), 16) / 255;
	const b = parseInt(clean.substring(4, 6), 16) / 255;
	return [
		Number.isNaN(r) ? 0 : r,
		Number.isNaN(g) ? 0 : g,
		Number.isNaN(b) ? 0 : b,
	];
}

/**
 * Build an orthographic projection matrix for 2D rendering.
 * Maps pixel coordinates [0, width] x [0, height] to clip space [-1, 1].
 */
export function createOrthographicMatrix(
	width: number,
	height: number,
): Float32Array {
	// Column-major order for WebGL
	return new Float32Array([
		2 / width, 0, 0, 0,
		0, -2 / height, 0, 0,
		0, 0, -1, 0,
		-1, 1, 0, 1,
	]);
}
