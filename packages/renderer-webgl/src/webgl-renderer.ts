// ============================================================
// WebGLRenderer — GPU-accelerated renderer for large particle scenes
// ============================================================

import type { SpaceState, SerializedParticle, SerializedConnection } from '@particle-engine/core';
import type {
	WebGLRenderConfig,
	ResolvedWebGLRenderConfig,
	WebGLContextLike,
	ShaderProgramInfo,
	WebGLRenderState,
	ANGLEInstancedArrays,
	WebGL2InstancedMethods,
} from './types.js';
import {
	PARTICLE_VERTEX_SHADER,
	PARTICLE_FRAGMENT_SHADER,
	CONNECTION_VERTEX_SHADER,
	CONNECTION_FRAGMENT_SHADER,
} from './shaders.js';
import {
	createParticleBuffers,
	createConnectionBuffers,
	updateParticleBuffers,
	updateConnectionBuffers,
	deleteParticleBuffers,
	deleteConnectionBuffers,
	parseHexToRGB,
	createOrthographicMatrix,
	QUAD_VERTEX_COUNT,
} from './buffers.js';

/**
 * Resolve render config with defaults applied.
 */
export function resolveConfig(config: WebGLRenderConfig, spacing: number): ResolvedWebGLRenderConfig {
	return {
		width: config.width,
		height: config.height,
		backgroundColor: config.backgroundColor ?? '#000000',
		antialiasing: config.antialiasing ?? true,
		pixelRatio: config.pixelRatio ?? 1,
		padding: config.padding ?? 0,
		particleShape: config.particleShape ?? 'circle',
		defaultParticleRadius: config.defaultParticleRadius ?? spacing / 3,
	};
}

/**
 * Compile a shader from source.
 */
export function compileShader(
	gl: WebGLContextLike,
	type: number,
	source: string,
): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) {
		throw new Error('Failed to create shader');
	}
	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`Shader compilation failed: ${log}`);
	}

	return shader;
}

/**
 * Link a vertex and fragment shader into a program.
 */
export function linkProgram(
	gl: WebGLContextLike,
	vertexShader: WebGLShader,
	fragmentShader: WebGLShader,
): WebGLProgram {
	const program = gl.createProgram();
	if (!program) {
		throw new Error('Failed to create program');
	}
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(program);
		gl.deleteProgram(program);
		throw new Error(`Program linking failed: ${log}`);
	}

	return program;
}

/**
 * Create a shader program with attribute and uniform locations.
 */
export function createShaderProgram(
	gl: WebGLContextLike,
	vertexSource: string,
	fragmentSource: string,
	attributeNames: string[],
	uniformNames: string[],
): ShaderProgramInfo {
	const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
	const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
	const program = linkProgram(gl, vs, fs);

	// Clean up individual shaders (attached to program, no longer needed)
	gl.deleteShader(vs);
	gl.deleteShader(fs);

	const attributes: Record<string, number> = {};
	for (const name of attributeNames) {
		attributes[name] = gl.getAttribLocation(program, name);
	}

	const uniforms: Record<string, WebGLUniformLocation | null> = {};
	for (const name of uniformNames) {
		uniforms[name] = gl.getUniformLocation(program, name);
	}

	return { program, attributes, uniforms };
}

/**
 * Convert grid position to pixel position.
 */
function gridToPixel(
	row: number,
	col: number,
	spacing: number,
	padding: number,
): { x: number; y: number } {
	return {
		x: padding + col * spacing,
		y: padding + row * spacing,
	};
}

/**
 * GPU-accelerated WebGL renderer for large particle scenes (50K+ elements).
 *
 * Renders particles as instanced quads (circles via fragment shader SDF)
 * and connections as GL_LINES. Optimized with batched draw calls.
 *
 * Isomorphic — accepts an injected WebGL context, no DOM dependencies.
 */
export class WebGLRenderer {
	private state: WebGLRenderState | null = null;
	private gl: WebGLContextLike | null = null;
	private instancingWarned = false;

	/**
	 * Initialize GPU resources. Must be called before render().
	 *
	 * @param gl - WebGL rendering context (WebGL 1 or 2)
	 */
	init(gl: WebGLContextLike): void {
		this.gl = gl;

		// Detect WebGL 2
		const isWebGL2 = typeof (gl as unknown as WebGL2InstancedMethods).drawArraysInstanced === 'function';

		// Get instanced rendering extension for WebGL 1
		let instancedExt: ANGLEInstancedArrays | null = null;
		if (!isWebGL2) {
			instancedExt = gl.getExtension('ANGLE_instanced_arrays') as ANGLEInstancedArrays | null;
		}

		// Create shader programs
		const particleProgram = createShaderProgram(
			gl,
			PARTICLE_VERTEX_SHADER,
			PARTICLE_FRAGMENT_SHADER,
			['a_quadVertex', 'a_position', 'a_color', 'a_size'],
			['u_projection', 'u_particleShape'],
		);

		const connectionProgram = createShaderProgram(
			gl,
			CONNECTION_VERTEX_SHADER,
			CONNECTION_FRAGMENT_SHADER,
			['a_position', 'a_color'],
			['u_projection'],
		);

		// Create buffers
		const particleBuffers = createParticleBuffers(gl);
		const connectionBuffers = createConnectionBuffers(gl);

		this.state = {
			particleProgram,
			connectionProgram,
			particleBuffers,
			connectionBuffers,
			instancedExt,
			isWebGL2,
		};
	}

	/**
	 * Render a particle grid state.
	 *
	 * @param gl - WebGL rendering context
	 * @param spaceState - The particle grid state to render
	 * @param config - Render configuration
	 */
	render(gl: WebGLContextLike, spaceState: SpaceState, config: WebGLRenderConfig): void {
		if (!this.state) {
			this.init(gl);
		}

		// Guard against mismatched GL contexts: shaders are compiled for a specific
		// context and cannot be used across contexts. Call dispose() before switching.
		if (this.state && this.gl !== gl) {
			throw new Error(
				'WebGLRenderer: render() called with a different WebGL context than init(). Call dispose() first.',
			);
		}

		const state = this.state!;
		const resolved = resolveConfig(config, spaceState.grid.spacing);
		const effectiveWidth = resolved.width * resolved.pixelRatio;
		const effectiveHeight = resolved.height * resolved.pixelRatio;

		// Set viewport
		gl.viewport(0, 0, effectiveWidth, effectiveHeight);

		// Clear with background color
		const [bgR, bgG, bgB] = parseHexToRGB(resolved.backgroundColor);
		gl.clearColor(bgR, bgG, bgB, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		// Enable alpha blending
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		// Create projection matrix (maps pixel coords to clip space)
		const projectionMatrix = createOrthographicMatrix(resolved.width, resolved.height);

		// Sort by layer for proper z-ordering
		const sortedConnections = [...spaceState.connections].sort((a, b) => a.layer - b.layer);
		const sortedParticles = [...spaceState.particles].sort((a, b) => a.layer - b.layer);

		// Draw connections first (below particles)
		if (sortedConnections.length > 0) {
			this.renderConnections(gl, state, sortedConnections, spaceState.grid.spacing, resolved, projectionMatrix);
		}

		// Draw particles on top
		if (sortedParticles.length > 0) {
			this.renderParticles(gl, state, sortedParticles, spaceState.grid.spacing, resolved, projectionMatrix);
		}
	}

	/**
	 * Render all particles in a single instanced draw call.
	 */
	private renderParticles(
		gl: WebGLContextLike,
		state: WebGLRenderState,
		particles: SerializedParticle[],
		spacing: number,
		config: ResolvedWebGLRenderConfig,
		projectionMatrix: Float32Array,
	): void {
		const count = particles.length;

		// Build typed arrays for instance data
		const positions = new Float32Array(count * 2);
		const colors = new Float32Array(count * 4);
		const sizes = new Float32Array(count);

		for (let i = 0; i < count; i++) {
			const p = particles[i];
			const pos = gridToPixel(p.r, p.c, spacing, config.padding);

			positions[i * 2] = pos.x;
			positions[i * 2 + 1] = pos.y;

			const [r, g, b] = parseHexToRGB(p.color);
			colors[i * 4] = r;
			colors[i * 4 + 1] = g;
			colors[i * 4 + 2] = b;
			colors[i * 4 + 3] = p.opacity;

			sizes[i] = config.defaultParticleRadius * p.size;
		}

		// Upload instance data
		updateParticleBuffers(gl, state.particleBuffers, positions, colors, sizes);

		// Use particle shader program
		const prog = state.particleProgram;
		gl.useProgram(prog.program);

		// Set uniforms
		gl.uniformMatrix4fv(prog.uniforms['u_projection'], false, projectionMatrix);
		gl.uniform1f(prog.uniforms['u_particleShape'], config.particleShape === 'square' ? 1.0 : 0.0);

		// Bind quad vertex buffer (per-vertex, divisor=0)
		gl.bindBuffer(gl.ARRAY_BUFFER, state.particleBuffers.quad);
		gl.enableVertexAttribArray(prog.attributes['a_quadVertex']);
		gl.vertexAttribPointer(prog.attributes['a_quadVertex'], 2, gl.FLOAT, false, 0, 0);
		this.setAttribDivisor(gl, state, prog.attributes['a_quadVertex'], 0);

		// Bind instance position buffer (per-instance, divisor=1)
		gl.bindBuffer(gl.ARRAY_BUFFER, state.particleBuffers.positions);
		gl.enableVertexAttribArray(prog.attributes['a_position']);
		gl.vertexAttribPointer(prog.attributes['a_position'], 2, gl.FLOAT, false, 0, 0);
		this.setAttribDivisor(gl, state, prog.attributes['a_position'], 1);

		// Bind instance color buffer (per-instance, divisor=1)
		gl.bindBuffer(gl.ARRAY_BUFFER, state.particleBuffers.colors);
		gl.enableVertexAttribArray(prog.attributes['a_color']);
		gl.vertexAttribPointer(prog.attributes['a_color'], 4, gl.FLOAT, false, 0, 0);
		this.setAttribDivisor(gl, state, prog.attributes['a_color'], 1);

		// Bind instance size buffer (per-instance, divisor=1)
		gl.bindBuffer(gl.ARRAY_BUFFER, state.particleBuffers.sizes);
		gl.enableVertexAttribArray(prog.attributes['a_size']);
		gl.vertexAttribPointer(prog.attributes['a_size'], 1, gl.FLOAT, false, 0, 0);
		this.setAttribDivisor(gl, state, prog.attributes['a_size'], 1);

		// Draw instanced
		this.drawArraysInstanced(gl, state, gl.TRIANGLES, 0, QUAD_VERTEX_COUNT, count);

		// Clean up attribute state
		gl.disableVertexAttribArray(prog.attributes['a_quadVertex']);
		gl.disableVertexAttribArray(prog.attributes['a_position']);
		gl.disableVertexAttribArray(prog.attributes['a_color']);
		gl.disableVertexAttribArray(prog.attributes['a_size']);
	}

	/**
	 * Render all connections using GL_LINES, batched by line width.
	 *
	 * Connections are grouped by their width value and each group gets its own
	 * draw call preceded by gl.lineWidth(). This ensures every connection is
	 * rendered at its intended width rather than all connections sharing the
	 * first connection's width.
	 *
	 * Note: gl.lineWidth() is unreliable across browsers — many implementations
	 * silently clamp the value to 1.0 (per the WebGL spec, only width=1 is
	 * guaranteed). The batching is still correct; the browser may just ignore
	 * widths other than 1.
	 */
	private renderConnections(
		gl: WebGLContextLike,
		state: WebGLRenderState,
		connections: SerializedConnection[],
		spacing: number,
		config: ResolvedWebGLRenderConfig,
		projectionMatrix: Float32Array,
	): void {
		// Use connection shader program
		const prog = state.connectionProgram;
		gl.useProgram(prog.program);

		// Set uniforms (shared across all batches)
		gl.uniformMatrix4fv(prog.uniforms['u_projection'], false, projectionMatrix);

		// Group connections by width to issue a separate draw call per unique width.
		// Using a Map preserves insertion order so layer-sorted order is maintained
		// within each batch.
		const batches = new Map<number, SerializedConnection[]>();
		for (const conn of connections) {
			const existing = batches.get(conn.width);
			if (existing) {
				existing.push(conn);
			} else {
				batches.set(conn.width, [conn]);
			}
		}

		for (const [width, batch] of batches) {
			const count = batch.length;

			// Build typed arrays: 2 vertices per line segment
			const positions = new Float32Array(count * 4); // 2 verts * 2 components
			const colors = new Float32Array(count * 8);    // 2 verts * 4 components

			for (let i = 0; i < count; i++) {
				const conn = batch[i];
				const from = gridToPixel(conn.from[0], conn.from[1], spacing, config.padding);
				const to = gridToPixel(conn.to[0], conn.to[1], spacing, config.padding);

				// Vertex 1 (from)
				positions[i * 4] = from.x;
				positions[i * 4 + 1] = from.y;
				// Vertex 2 (to)
				positions[i * 4 + 2] = to.x;
				positions[i * 4 + 3] = to.y;

				const [r, g, b] = parseHexToRGB(conn.color);
				// Color for vertex 1
				colors[i * 8] = r;
				colors[i * 8 + 1] = g;
				colors[i * 8 + 2] = b;
				colors[i * 8 + 3] = conn.opacity;
				// Color for vertex 2 (same)
				colors[i * 8 + 4] = r;
				colors[i * 8 + 5] = g;
				colors[i * 8 + 6] = b;
				colors[i * 8 + 7] = conn.opacity;
			}

			// Upload data for this batch
			updateConnectionBuffers(gl, state.connectionBuffers, positions, colors);

			// Bind position buffer
			gl.bindBuffer(gl.ARRAY_BUFFER, state.connectionBuffers.positions);
			gl.enableVertexAttribArray(prog.attributes['a_position']);
			gl.vertexAttribPointer(prog.attributes['a_position'], 2, gl.FLOAT, false, 0, 0);

			// Bind color buffer
			gl.bindBuffer(gl.ARRAY_BUFFER, state.connectionBuffers.colors);
			gl.enableVertexAttribArray(prog.attributes['a_color']);
			gl.vertexAttribPointer(prog.attributes['a_color'], 4, gl.FLOAT, false, 0, 0);

			// Set line width for this batch.
			// Many browsers clamp this to 1.0, but we set it for correctness.
			gl.lineWidth(width);

			// Draw all lines in this batch
			gl.drawArrays(gl.LINES, 0, count * 2);

			// Clean up attribute state for this batch
			gl.disableVertexAttribArray(prog.attributes['a_position']);
			gl.disableVertexAttribArray(prog.attributes['a_color']);
		}
	}

	/**
	 * Set vertex attribute divisor (handles WebGL 1 vs 2).
	 */
	private setAttribDivisor(
		gl: WebGLContextLike,
		state: WebGLRenderState,
		index: number,
		divisor: number,
	): void {
		if (state.isWebGL2) {
			(gl as unknown as WebGL2InstancedMethods).vertexAttribDivisor(index, divisor);
		} else if (state.instancedExt) {
			state.instancedExt.vertexAttribDivisorANGLE(index, divisor);
		}
	}

	/**
	 * Draw arrays instanced (handles WebGL 1 vs 2).
	 */
	private drawArraysInstanced(
		gl: WebGLContextLike,
		state: WebGLRenderState,
		mode: number,
		first: number,
		count: number,
		instanceCount: number,
	): void {
		if (state.isWebGL2) {
			(gl as unknown as WebGL2InstancedMethods).drawArraysInstanced(mode, first, count, instanceCount);
		} else if (state.instancedExt) {
			state.instancedExt.drawArraysInstancedANGLE(mode, first, count, instanceCount);
		} else {
			// No instancing support — attribute divisors were never set, so all
			// per-instance attributes (position, color, size) advance per vertex
			// instead of per instance, producing completely corrupt output.
			// Skip the draw call and warn instead of rendering garbage.
			if (!this.instancingWarned) {
				console.warn(
					'WebGLRenderer: instanced rendering unavailable (no WebGL 2 or ANGLE_instanced_arrays). ' +
					'Particle rendering disabled.',
				);
				this.instancingWarned = true;
			}
		}
	}

	/**
	 * Release all GPU resources.
	 */
	dispose(): void {
		if (!this.state || !this.gl) {
			return;
		}

		const gl = this.gl;
		const state = this.state;

		// Delete buffers
		deleteParticleBuffers(gl, state.particleBuffers);
		deleteConnectionBuffers(gl, state.connectionBuffers);

		// Delete programs
		gl.deleteProgram(state.particleProgram.program);
		gl.deleteProgram(state.connectionProgram.program);

		this.state = null;
		this.gl = null;
	}

	/**
	 * Check whether the renderer has been initialized.
	 */
	isInitialized(): boolean {
		return this.state !== null;
	}
}
