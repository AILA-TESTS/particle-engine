// ============================================================
// @particle-engine/video — Public API
// ============================================================

// Types
export type {
	VideoConfig,
	VideoFormat,
	VideoGenerationOptions,
	VideoResult,
	VideoCanvasFactory,
	VideoCanvas,
} from './types.js';

// Frame conversion
export { frameToSpaceState, rgbToHex } from './frame-converter.js';

// FFmpeg utilities
export { buildFFmpegArgs, spawnFFmpeg, checkFFmpegAvailable, qualityToCRF } from './ffmpeg.js';

// Video generator
export { VideoGenerator } from './video-generator.js';
