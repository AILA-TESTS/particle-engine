// ============================================================
// VideoGenerator — Main class for generating video from animations
// ============================================================

import { AnimationEngine } from '@particle-engine/animation';
import { CanvasRenderer } from '@particle-engine/renderer-canvas';
import type { RenderConfig } from '@particle-engine/renderer-canvas';
import type { VideoCanvasFactory, VideoGenerationOptions, VideoResult, VideoFormat } from './types.js';
import { frameToSpaceState } from './frame-converter.js';
import { buildFFmpegArgs, spawnFFmpeg, checkFFmpegAvailable } from './ffmpeg.js';

/**
 * Generates video files from particle animations by piping canvas-rendered
 * frames to FFmpeg.
 *
 * Pipeline:
 * Animation → AnimationEngine → FrameState → SpaceState → Canvas → RGBA buffer → FFmpeg → Video
 */
export class VideoGenerator {
	private readonly canvasFactory: VideoCanvasFactory;

	constructor(canvasFactory: VideoCanvasFactory) {
		this.canvasFactory = canvasFactory;
	}

	/**
	 * Generate a video file from an animation.
	 *
	 * @param options - Video generation options
	 * @returns Promise resolving to a VideoResult on success
	 */
	async generate(options: VideoGenerationOptions): Promise<VideoResult> {
		const { animation, gridConfig, outputPath, config } = options;
		const format: VideoFormat = config.format ?? 'mp4';
		const pixelRatio = config.pixelRatio ?? 1;
		const width = config.width;
		const height = config.height;

		// Validate options
		if (width <= 0 || height <= 0) {
			throw new Error('Video width and height must be positive');
		}
		if (animation.duration <= 0) {
			throw new Error('Animation duration must be positive');
		}
		if (animation.fps <= 0) {
			throw new Error('Animation fps must be positive');
		}
		if (!outputPath) {
			throw new Error('Output path is required');
		}

		// Check FFmpeg availability
		const ffmpegAvailable = await checkFFmpegAvailable(config.ffmpegPath);
		if (!ffmpegAvailable) {
			throw new Error(
				`FFmpeg not found at "${config.ffmpegPath ?? 'ffmpeg'}". ` +
				'Please install FFmpeg or provide a valid ffmpegPath in config.',
			);
		}

		// Prepare animation
		const engine = new AnimationEngine();
		const prepared = engine.prepare(animation);

		// Build render config for the canvas renderer
		const renderConfig: RenderConfig = {
			width,
			height,
			backgroundColor: config.backgroundColor ?? '#000000',
			pixelRatio,
			padding: config.padding ?? 0,
			particleShape: config.particleShape ?? 'circle',
			defaultParticleRadius: config.defaultParticleRadius,
			showGrid: config.showGrid ?? false,
			gridDotColor: config.gridDotColor,
			gridDotRadius: config.gridDotRadius,
		};

		// Actual pixel dimensions (accounting for pixel ratio)
		const actualWidth = width * pixelRatio;
		const actualHeight = height * pixelRatio;

		// Build FFmpeg args and spawn process
		const ffmpegArgs = buildFFmpegArgs(
			format,
			actualWidth,
			actualHeight,
			animation.fps,
			outputPath,
			config.codec,
			config.quality,
		);

		const ffmpegProcess = spawnFFmpeg(ffmpegArgs, config.ffmpegPath);

		// Collect stderr for error reporting
		let stderrData = '';
		ffmpegProcess.stderr?.on('data', (chunk: Buffer) => {
			stderrData += chunk.toString();
		});

		// Generate and pipe frames
		const renderer = new CanvasRenderer();
		let frameCount = 0;

		return new Promise<VideoResult>((resolve, reject) => {
			// Handle FFmpeg process errors
			ffmpegProcess.on('error', (err) => {
				reject(new Error(`FFmpeg process error: ${err.message}`));
			});

			// Handle FFmpeg exit
			ffmpegProcess.on('close', (code) => {
				if (code === 0) {
					resolve({
						outputPath,
						frames: frameCount,
						duration: animation.duration,
						format,
					});
				} else {
					reject(new Error(
						`FFmpeg exited with code ${code}.\nStderr: ${stderrData}`,
					));
				}
			});

			// Handle stdin errors (e.g., broken pipe)
			ffmpegProcess.stdin?.on('error', (err) => {
				// Ignore EPIPE — FFmpeg may close stdin early on error
				if ((err as NodeJS.ErrnoException).code !== 'EPIPE') {
					reject(new Error(`FFmpeg stdin error: ${err.message}`));
				}
			});

			try {
				// Generate frames and pipe to FFmpeg
				for (const frame of engine.generateFrames(prepared)) {
					// Convert FrameState → SpaceState
					const spaceState = frameToSpaceState(frame, gridConfig);

					// Render to canvas
					const canvas = renderer.renderToBuffer(
						spaceState,
						renderConfig,
						this.canvasFactory,
					);

					// Extract raw RGBA buffer and write to FFmpeg
					const videoCanvas = canvas as import('./types.js').VideoCanvas;
					const buffer = videoCanvas.toBuffer('raw');
					ffmpegProcess.stdin?.write(buffer);
					frameCount++;
				}

				// Signal end of input
				ffmpegProcess.stdin?.end();
			} catch (err) {
				ffmpegProcess.kill();
				reject(err);
			}
		});
	}
}
