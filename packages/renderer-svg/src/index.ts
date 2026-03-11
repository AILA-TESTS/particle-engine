// ============================================================
// @particle-engine/renderer-svg — Public API
// ============================================================

// Main class
export { SVGRenderer } from './svg-renderer.js';

// Types
export type {
	RenderConfig,
	SVGRenderResult,
	Renderer,
} from './types.js';

// Layout utilities
export {
	gridToPixel,
	computeViewBox,
	resolveConfig,
} from './layout.js';
export type { PixelCoord, ViewBox } from './layout.js';

// Element generation
export {
	renderParticle,
	renderConnection,
	renderGridDot,
	renderArrowMarker,
	escapeXml,
} from './elements.js';
