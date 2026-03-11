// ============================================================
// Mock WebGL Context — Records all GL calls for test verification
// ============================================================

import type {
	WebGLContextLike,
	ANGLEInstancedArrays,
} from '../src/types.js';

/** A recorded GL method call */
export interface RecordedCall {
	method: string;
	args: unknown[];
}

/** Mock shader object */
export class MockShader {
	readonly id: number;
	readonly type: number;
	source: string = '';
	compiled: boolean = false;

	constructor(id: number, type: number) {
		this.id = id;
		this.type = type;
	}
}

/** Mock program object */
export class MockProgram {
	readonly id: number;
	shaders: MockShader[] = [];
	linked: boolean = false;

	constructor(id: number) {
		this.id = id;
	}
}

/** Mock buffer object */
export class MockBuffer {
	readonly id: number;
	data: BufferSource | null = null;

	constructor(id: number) {
		this.id = id;
	}
}

/** Mock uniform location */
export class MockUniformLocation {
	readonly name: string;

	constructor(name: string) {
		this.name = name;
	}
}

/**
 * Mock WebGL context that records all method calls for test verification.
 * Simulates WebGL 1 or WebGL 2 depending on configuration.
 */
export class MockWebGLContext implements WebGLContextLike {
	calls: RecordedCall[] = [];

	// Internal counters
	private nextShaderId = 1;
	private nextProgramId = 1;
	private nextBufferId = 1;
	private shaders = new Map<number, MockShader>();
	private programs = new Map<number, MockProgram>();

	// Configuration
	simulateWebGL2: boolean;
	simulateCompileFailure: boolean = false;
	simulateLinkFailure: boolean = false;
	private extensionMap = new Map<string, unknown>();

	constructor(options?: { webgl2?: boolean }) {
		this.simulateWebGL2 = options?.webgl2 ?? false;

		// Dynamically add WebGL 2 methods only when simulating WebGL 2
		if (this.simulateWebGL2) {
			(this as Record<string, unknown>).vertexAttribDivisor = (index: number, divisor: number): void => {
				this.calls.push({ method: 'vertexAttribDivisor', args: [index, divisor] });
			};
			(this as Record<string, unknown>).drawArraysInstanced = (mode: number, first: number, count: number, instanceCount: number): void => {
				this.calls.push({ method: 'drawArraysInstanced', args: [mode, first, count, instanceCount] });
			};
		}
	}

	// ---- GL Constants ----
	readonly ARRAY_BUFFER = 0x8892;
	readonly ELEMENT_ARRAY_BUFFER = 0x8893;
	readonly STATIC_DRAW = 0x88E4;
	readonly DYNAMIC_DRAW = 0x88E8;
	readonly FLOAT = 0x1406;
	readonly UNSIGNED_BYTE = 0x1401;
	readonly UNSIGNED_SHORT = 0x1403;
	readonly VERTEX_SHADER = 0x8B31;
	readonly FRAGMENT_SHADER = 0x8B30;
	readonly COMPILE_STATUS = 0x8B81;
	readonly LINK_STATUS = 0x8B82;
	readonly COLOR_BUFFER_BIT = 0x4000;
	readonly DEPTH_BUFFER_BIT = 0x0100;
	readonly BLEND = 0x0BE2;
	readonly SRC_ALPHA = 0x0302;
	readonly ONE_MINUS_SRC_ALPHA = 0x0303;
	readonly TRIANGLES = 0x0004;
	readonly LINES = 0x0001;
	readonly LINE_STRIP = 0x0003;

	// ---- Viewport / Clear ----
	viewport(x: number, y: number, width: number, height: number): void {
		this.calls.push({ method: 'viewport', args: [x, y, width, height] });
	}

	clearColor(r: number, g: number, b: number, a: number): void {
		this.calls.push({ method: 'clearColor', args: [r, g, b, a] });
	}

	clear(mask: number): void {
		this.calls.push({ method: 'clear', args: [mask] });
	}

	// ---- Blending ----
	enable(cap: number): void {
		this.calls.push({ method: 'enable', args: [cap] });
	}

	disable(cap: number): void {
		this.calls.push({ method: 'disable', args: [cap] });
	}

	blendFunc(sfactor: number, dfactor: number): void {
		this.calls.push({ method: 'blendFunc', args: [sfactor, dfactor] });
	}

	lineWidth(width: number): void {
		this.calls.push({ method: 'lineWidth', args: [width] });
	}

	// ---- Shaders ----
	createShader(type: number): MockShader | null {
		this.calls.push({ method: 'createShader', args: [type] });
		const shader = new MockShader(this.nextShaderId++, type);
		this.shaders.set(shader.id, shader);
		return shader as unknown as WebGLShader;
	}

	shaderSource(shader: WebGLShader, source: string): void {
		this.calls.push({ method: 'shaderSource', args: [shader, source] });
		(shader as unknown as MockShader).source = source;
	}

	compileShader(shader: WebGLShader): void {
		this.calls.push({ method: 'compileShader', args: [shader] });
		if (!this.simulateCompileFailure) {
			(shader as unknown as MockShader).compiled = true;
		}
	}

	getShaderParameter(shader: WebGLShader, pname: number): unknown {
		this.calls.push({ method: 'getShaderParameter', args: [shader, pname] });
		if (pname === this.COMPILE_STATUS) {
			return (shader as unknown as MockShader).compiled;
		}
		return null;
	}

	getShaderInfoLog(shader: WebGLShader): string | null {
		this.calls.push({ method: 'getShaderInfoLog', args: [shader] });
		if (!(shader as unknown as MockShader).compiled) {
			return 'Mock compilation error';
		}
		return '';
	}

	deleteShader(shader: WebGLShader): void {
		this.calls.push({ method: 'deleteShader', args: [shader] });
	}

	// ---- Programs ----
	createProgram(): MockProgram | null {
		this.calls.push({ method: 'createProgram', args: [] });
		const program = new MockProgram(this.nextProgramId++);
		this.programs.set(program.id, program);
		return program as unknown as WebGLProgram;
	}

	attachShader(program: WebGLProgram, shader: WebGLShader): void {
		this.calls.push({ method: 'attachShader', args: [program, shader] });
		(program as unknown as MockProgram).shaders.push(shader as unknown as MockShader);
	}

	linkProgram(program: WebGLProgram): void {
		this.calls.push({ method: 'linkProgram', args: [program] });
		if (!this.simulateLinkFailure) {
			(program as unknown as MockProgram).linked = true;
		}
	}

	getProgramParameter(program: WebGLProgram, pname: number): unknown {
		this.calls.push({ method: 'getProgramParameter', args: [program, pname] });
		if (pname === this.LINK_STATUS) {
			return (program as unknown as MockProgram).linked;
		}
		return null;
	}

	getProgramInfoLog(program: WebGLProgram): string | null {
		this.calls.push({ method: 'getProgramInfoLog', args: [program] });
		if (!(program as unknown as MockProgram).linked) {
			return 'Mock link error';
		}
		return '';
	}

	useProgram(program: WebGLProgram | null): void {
		this.calls.push({ method: 'useProgram', args: [program] });
	}

	deleteProgram(program: WebGLProgram): void {
		this.calls.push({ method: 'deleteProgram', args: [program] });
	}

	// ---- Attributes ----
	private attribCounter = 0;

	getAttribLocation(program: WebGLProgram, name: string): number {
		this.calls.push({ method: 'getAttribLocation', args: [program, name] });
		return this.attribCounter++;
	}

	enableVertexAttribArray(index: number): void {
		this.calls.push({ method: 'enableVertexAttribArray', args: [index] });
	}

	disableVertexAttribArray(index: number): void {
		this.calls.push({ method: 'disableVertexAttribArray', args: [index] });
	}

	vertexAttribPointer(
		index: number,
		size: number,
		type: number,
		normalized: boolean,
		stride: number,
		offset: number,
	): void {
		this.calls.push({ method: 'vertexAttribPointer', args: [index, size, type, normalized, stride, offset] });
	}

	// ---- Uniforms ----
	getUniformLocation(program: WebGLProgram, name: string): MockUniformLocation | null {
		this.calls.push({ method: 'getUniformLocation', args: [program, name] });
		return new MockUniformLocation(name) as unknown as WebGLUniformLocation;
	}

	uniform1f(location: WebGLUniformLocation | null, x: number): void {
		this.calls.push({ method: 'uniform1f', args: [location, x] });
	}

	uniform1i(location: WebGLUniformLocation | null, x: number): void {
		this.calls.push({ method: 'uniform1i', args: [location, x] });
	}

	uniform2f(location: WebGLUniformLocation | null, x: number, y: number): void {
		this.calls.push({ method: 'uniform2f', args: [location, x, y] });
	}

	uniform4f(location: WebGLUniformLocation | null, x: number, y: number, z: number, w: number): void {
		this.calls.push({ method: 'uniform4f', args: [location, x, y, z, w] });
	}

	uniformMatrix4fv(
		location: WebGLUniformLocation | null,
		transpose: boolean,
		value: Float32Array | number[],
	): void {
		this.calls.push({ method: 'uniformMatrix4fv', args: [location, transpose, value] });
	}

	// ---- Buffers ----
	createBuffer(): MockBuffer | null {
		this.calls.push({ method: 'createBuffer', args: [] });
		return new MockBuffer(this.nextBufferId++) as unknown as WebGLBuffer;
	}

	bindBuffer(target: number, buffer: WebGLBuffer | null): void {
		this.calls.push({ method: 'bindBuffer', args: [target, buffer] });
	}

	bufferData(target: number, data: BufferSource | number, usage: number): void {
		this.calls.push({ method: 'bufferData', args: [target, data, usage] });
	}

	deleteBuffer(buffer: WebGLBuffer | null): void {
		this.calls.push({ method: 'deleteBuffer', args: [buffer] });
	}

	// ---- Drawing ----
	drawArrays(mode: number, first: number, count: number): void {
		this.calls.push({ method: 'drawArrays', args: [mode, first, count] });
	}

	drawElements(mode: number, count: number, type: number, offset: number): void {
		this.calls.push({ method: 'drawElements', args: [mode, count, type, offset] });
	}

	// ---- Extensions ----
	setExtension(name: string, ext: unknown): void {
		this.extensionMap.set(name, ext);
	}

	getExtension(name: string): unknown {
		this.calls.push({ method: 'getExtension', args: [name] });
		return this.extensionMap.get(name) ?? null;
	}

	// ---- Test Utilities ----

	/** Get all calls of a specific method */
	getCalls(method: string): RecordedCall[] {
		return this.calls.filter(c => c.method === method);
	}

	/** Check if a method was called */
	wasCalled(method: string): boolean {
		return this.calls.some(c => c.method === method);
	}

	/** Get the number of times a method was called */
	callCount(method: string): number {
		return this.calls.filter(c => c.method === method).length;
	}

	/** Reset recorded calls */
	reset(): void {
		this.calls = [];
	}
}

/**
 * Create a mock ANGLE_instanced_arrays extension.
 */
export function createMockInstancedExtension(): ANGLEInstancedArrays & { calls: RecordedCall[] } {
	const calls: RecordedCall[] = [];

	return {
		calls,
		vertexAttribDivisorANGLE(index: number, divisor: number): void {
			calls.push({ method: 'vertexAttribDivisorANGLE', args: [index, divisor] });
		},
		drawArraysInstancedANGLE(mode: number, first: number, count: number, primcount: number): void {
			calls.push({ method: 'drawArraysInstancedANGLE', args: [mode, first, count, primcount] });
		},
	};
}
