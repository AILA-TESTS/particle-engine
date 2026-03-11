// ============================================================
// @particle-engine/renderer-canvas — Public API
// ============================================================

// Main class
export { CanvasRenderer } from './canvas-renderer.js';

// Types
export type {
	RenderConfig,
	CanvasLike,
	CanvasContext2D,
	CanvasFactory,
	CanvasGradient,
	CanvasPattern,
	CanvasLineCap,
	CanvasLineJoin,
	CanvasTextAlign,
	CanvasTextBaseline,
} from './types.js';

// Drawing functions
export { drawParticle, drawGridDot } from './draw-particles.js';
export { drawConnection } from './draw-connections.js';

// Layout utilities
export { gridToPixel, computeCanvasSize, resolveConfig } from './layout.js';
export type { PixelCoord, CanvasSize } from './layout.js';
