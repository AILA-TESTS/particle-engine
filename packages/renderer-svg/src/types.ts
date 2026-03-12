// ============================================================
// Types — All interfaces and type definitions for @particle-engine/renderer-svg
// ============================================================

import type { SpaceState } from '@particle-engine/core';

/** Configuration for SVG rendering */
export interface RenderConfig {
	/** Output width in pixels */
	width: number;
	/** Output height in pixels */
	height: number;
	/** Background color (hex), default '#000000' */
	backgroundColor?: string;
	/** Whether to use geometric precision rendering, default true */
	antialiasing?: boolean;
	/** Pixel ratio for viewBox scaling, default 1 */
	pixelRatio?: number;
	/** Padding in pixels around the grid, default 0 */
	padding?: number;
	/** Particle shape, default 'circle' */
	particleShape?: 'circle' | 'square';
	/** Base radius in pixels for particles, default spacing/3 */
	defaultParticleRadius?: number;
	/** Whether to render grid dots for inactive positions, default false */
	showGrid?: boolean;
	/** Color for inactive grid dots, default '#333333' */
	gridDotColor?: string;
	/** Radius for inactive grid dots, default 1 */
	gridDotRadius?: number;
}

/** Result of an SVG render operation */
export interface SVGRenderResult {
	/** Complete SVG markup string */
	svg: string;
	/** Output width in pixels */
	width: number;
	/** Output height in pixels */
	height: number;
}

/** Renderer interface */
export interface Renderer {
	render(state: SpaceState, config: RenderConfig): SVGRenderResult;
}
