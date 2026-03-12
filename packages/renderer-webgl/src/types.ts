// ============================================================
// Types — All interfaces and type definitions for @particle-engine/renderer-webgl
// ============================================================

/** Configuration for WebGL rendering */
export interface WebGLRenderConfig {
	/** Output width in pixels */
	width: number;
	/** Output height in pixels */
	height: number;
	/** Background color (hex), default '#000000' */
	backgroundColor?: string;
	/** Whether to enable antialiasing, default true */
	antialiasing?: boolean;
	/** Pixel ratio for HiDPI displays, default 1 */
	pixelRatio?: number;
	/** Padding in pixels around the grid, default 0 */
	padding?: number;
	/** Particle shape, default 'circle' */
	particleShape?: 'circle' | 'square';
	/** Base radius in pixels for particles, default spacing/3 */
	defaultParticleRadius?: number;
}

/** Resolved config with all defaults applied */
export type ResolvedWebGLRenderConfig = Required<WebGLRenderConfig>;

/** A compiled WebGL shader program with attribute/uniform locations */
export interface ShaderProgramInfo {
	program: WebGLProgram;
	attributes: Record<string, number>;
	uniforms: Record<string, WebGLUniformLocation | null>;
}

/** Buffer set for instanced particle rendering */
export interface ParticleBuffers {
	/** Quad vertex buffer (2 floats per vertex, 6 vertices for 2 triangles) */
	quad: WebGLBuffer;
	/** Instance positions [x, y] interleaved */
	positions: WebGLBuffer;
	/** Instance colors [r, g, b, a] interleaved */
	colors: WebGLBuffer;
	/** Instance sizes [radius] */
	sizes: WebGLBuffer;
}

/** Buffer set for connection line rendering */
export interface ConnectionBuffers {
	/** Vertex positions [x, y] interleaved, 2 vertices per line */
	positions: WebGLBuffer;
	/** Vertex colors [r, g, b, a] interleaved, 2 vertices per line */
	colors: WebGLBuffer;
}

/** Internal render state tracking GPU resources */
export interface WebGLRenderState {
	particleProgram: ShaderProgramInfo;
	connectionProgram: ShaderProgramInfo;
	particleBuffers: ParticleBuffers;
	connectionBuffers: ConnectionBuffers;
	/** Extension for instanced rendering (WebGL 1 fallback) */
	instancedExt: ANGLEInstancedArrays | null;
	/** Whether using WebGL 2 */
	isWebGL2: boolean;
}

/** Minimal WebGL context interface for isomorphic support (WebGL 1) */
export interface WebGLContextLike {
	// Constants
	readonly ARRAY_BUFFER: number;
	readonly ELEMENT_ARRAY_BUFFER: number;
	readonly STATIC_DRAW: number;
	readonly DYNAMIC_DRAW: number;
	readonly FLOAT: number;
	readonly UNSIGNED_BYTE: number;
	readonly UNSIGNED_SHORT: number;
	readonly VERTEX_SHADER: number;
	readonly FRAGMENT_SHADER: number;
	readonly COMPILE_STATUS: number;
	readonly LINK_STATUS: number;
	readonly COLOR_BUFFER_BIT: number;
	readonly DEPTH_BUFFER_BIT: number;
	readonly BLEND: number;
	readonly SRC_ALPHA: number;
	readonly ONE_MINUS_SRC_ALPHA: number;
	readonly TRIANGLES: number;
	readonly LINES: number;
	readonly LINE_STRIP: number;

	// Viewport
	viewport(x: number, y: number, width: number, height: number): void;
	clearColor(r: number, g: number, b: number, a: number): void;
	clear(mask: number): void;

	// Blending
	enable(cap: number): void;
	disable(cap: number): void;
	blendFunc(sfactor: number, dfactor: number): void;
	lineWidth(width: number): void;

	// Shaders
	createShader(type: number): WebGLShader | null;
	shaderSource(shader: WebGLShader, source: string): void;
	compileShader(shader: WebGLShader): void;
	getShaderParameter(shader: WebGLShader, pname: number): unknown;
	getShaderInfoLog(shader: WebGLShader): string | null;
	deleteShader(shader: WebGLShader): void;

	// Programs
	createProgram(): WebGLProgram | null;
	attachShader(program: WebGLProgram, shader: WebGLShader): void;
	linkProgram(program: WebGLProgram): void;
	getProgramParameter(program: WebGLProgram, pname: number): unknown;
	getProgramInfoLog(program: WebGLProgram): string | null;
	useProgram(program: WebGLProgram | null): void;
	deleteProgram(program: WebGLProgram): void;

	// Attributes
	getAttribLocation(program: WebGLProgram, name: string): number;
	enableVertexAttribArray(index: number): void;
	disableVertexAttribArray(index: number): void;
	vertexAttribPointer(
		index: number,
		size: number,
		type: number,
		normalized: boolean,
		stride: number,
		offset: number,
	): void;

	// Uniforms
	getUniformLocation(program: WebGLProgram, name: string): WebGLUniformLocation | null;
	uniform1f(location: WebGLUniformLocation | null, x: number): void;
	uniform1i(location: WebGLUniformLocation | null, x: number): void;
	uniform2f(location: WebGLUniformLocation | null, x: number, y: number): void;
	uniform4f(location: WebGLUniformLocation | null, x: number, y: number, z: number, w: number): void;
	uniformMatrix4fv(
		location: WebGLUniformLocation | null,
		transpose: boolean,
		value: Float32Array | number[],
	): void;

	// Buffers
	createBuffer(): WebGLBuffer | null;
	bindBuffer(target: number, buffer: WebGLBuffer | null): void;
	bufferData(
		target: number,
		data: ArrayBuffer | ArrayBufferView | number,
		usage: number,
	): void;
	deleteBuffer(buffer: WebGLBuffer | null): void;

	// Drawing
	drawArrays(mode: number, first: number, count: number): void;
	drawElements(mode: number, count: number, type: number, offset: number): void;

	// Extensions
	getExtension(name: string): unknown;
}

/** ANGLE_instanced_arrays extension interface */
export interface ANGLEInstancedArrays {
	vertexAttribDivisorANGLE(index: number, divisor: number): void;
	drawArraysInstancedANGLE(mode: number, first: number, count: number, primcount: number): void;
}

/** WebGL 2 instanced rendering methods (subset) */
export interface WebGL2InstancedMethods {
	vertexAttribDivisor(index: number, divisor: number): void;
	drawArraysInstanced(mode: number, first: number, count: number, instanceCount: number): void;
}
