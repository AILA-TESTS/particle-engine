// ============================================================
// Types — All interfaces and type definitions for @particle-engine/renderer-canvas
// ============================================================

/** Configuration for Canvas 2D rendering */
export interface RenderConfig {
	/** Output width in pixels */
	width: number;
	/** Output height in pixels */
	height: number;
	/** Background color (hex), default '#000000' */
	backgroundColor?: string;
	/** Whether to enable image smoothing, default true */
	antialiasing?: boolean;
	/** Pixel ratio for HiDPI displays, default 1 */
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

/** Minimal canvas interface for isomorphic support */
export interface CanvasLike {
	width: number;
	height: number;
	getContext(type: '2d'): CanvasContext2D | null;
}

/** Minimal 2D context interface — subset of CanvasRenderingContext2D */
export interface CanvasContext2D {
	// State
	save(): void;
	restore(): void;

	// Transform
	scale(x: number, y: number): void;

	// Style
	fillStyle: string | CanvasGradient | CanvasPattern;
	strokeStyle: string | CanvasGradient | CanvasPattern;
	lineWidth: number;
	lineCap: CanvasLineCap;
	lineJoin: CanvasLineJoin;
	globalAlpha: number;
	imageSmoothingEnabled: boolean;

	// Path
	beginPath(): void;
	closePath(): void;
	moveTo(x: number, y: number): void;
	lineTo(x: number, y: number): void;
	quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
	arc(
		x: number,
		y: number,
		radius: number,
		startAngle: number,
		endAngle: number,
		counterclockwise?: boolean,
	): void;

	// Drawing
	fill(): void;
	stroke(): void;
	fillRect(x: number, y: number, w: number, h: number): void;
	clearRect(x: number, y: number, w: number, h: number): void;

	// Dash
	setLineDash(segments: number[]): void;

	// Text
	fillText(text: string, x: number, y: number): void;
	font: string;
	textAlign: CanvasTextAlign;
	textBaseline: CanvasTextBaseline;
}

/** Opaque gradient type for canvas compatibility */
export type CanvasGradient = object;

/** Opaque pattern type for canvas compatibility */
export type CanvasPattern = object;

/** Line cap style */
export type CanvasLineCap = 'butt' | 'round' | 'square';

/** Line join style */
export type CanvasLineJoin = 'bevel' | 'miter' | 'round';

/** Text alignment */
export type CanvasTextAlign = 'center' | 'end' | 'left' | 'right' | 'start';

/** Text baseline */
export type CanvasTextBaseline =
	| 'alphabetic'
	| 'bottom'
	| 'hanging'
	| 'ideographic'
	| 'middle'
	| 'top';

/** Factory to create canvas instances (for buffer rendering) */
export interface CanvasFactory {
	createCanvas(width: number, height: number): CanvasLike;
}
