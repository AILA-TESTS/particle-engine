// ============================================================
// @particle-engine/renderer-webgl — Public API
// ============================================================

// Main class
export { WebGLRenderer, resolveConfig, compileShader, linkProgram, createShaderProgram } from './webgl-renderer.js';

// Types
export type {
	WebGLRenderConfig,
	ResolvedWebGLRenderConfig,
	WebGLContextLike,
	ShaderProgramInfo,
	WebGLRenderState,
	ParticleBuffers,
	ConnectionBuffers,
	ANGLEInstancedArrays,
	WebGL2InstancedMethods,
} from './types.js';

// Shaders
export {
	PARTICLE_VERTEX_SHADER,
	PARTICLE_FRAGMENT_SHADER,
	CONNECTION_VERTEX_SHADER,
	CONNECTION_FRAGMENT_SHADER,
} from './shaders.js';

// Buffer utilities
export {
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
} from './buffers.js';
