// ============================================================
// Types — All interfaces and type definitions for @particle-engine/video
// ============================================================

/** Video output format */
export type VideoFormat = 'mp4' | 'webm' | 'gif';

/** Configuration for video encoding and rendering */
export interface VideoConfig {
	/** Output width in pixels */
	width: number;
	/** Output height in pixels */
	height: number;
	/** Output format, default 'mp4' */
	format?: VideoFormat;
	/** Video codec (auto-selected based on format if not specified) */
	codec?: string;
	/** Quality 1-100, default 80 */
	quality?: number;
	/** Pixel ratio for HiDPI, default 1 */
	pixelRatio?: number;
	/** Background color (hex), default '#000000' */
	backgroundColor?: string;
	/** Padding in pixels around the grid, default 0 */
	padding?: number;
	/** Particle shape, default 'circle' */
	particleShape?: 'circle' | 'square';
	/** Base radius for particles */
	defaultParticleRadius?: number;
	/** Path to FFmpeg binary, default 'ffmpeg' */
	ffmpegPath?: string;
	/** Whether to render grid dots, default false */
	showGrid?: boolean;
	/** Color for grid dots */
	gridDotColor?: string;
	/** Radius for grid dots */
	gridDotRadius?: number;
}

/** Options for generating a video */
export interface VideoGenerationOptions {
	/** The animation to render */
	animation: import('@particle-engine/animation').Animation;
	/** Grid configuration for the particle space */
	gridConfig: { rows: number; cols: number; spacing: number };
	/** File path for the output video */
	outputPath: string;
	/** Video configuration */
	config: VideoConfig;
}

/** Result of a video generation */
export interface VideoResult {
	/** Path to the generated video file */
	outputPath: string;
	/** Total number of frames rendered */
	frames: number;
	/** Total duration in milliseconds */
	duration: number;
	/** Output format used */
	format: string;
}

/** Factory to create canvas instances for server-side rendering */
export interface VideoCanvasFactory {
	createCanvas(width: number, height: number): VideoCanvas;
}

/** Canvas that can produce raw pixel buffers */
export interface VideoCanvas {
	width: number;
	height: number;
	getContext(type: '2d'): any;
	/** Returns raw RGBA pixel data (4 bytes per pixel, row-major) */
	toBuffer(format: 'raw'): Buffer;
}
