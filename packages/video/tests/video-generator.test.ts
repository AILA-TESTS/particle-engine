// ============================================================
// Tests — VideoGenerator (full pipeline with mocks)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoGenerator } from '../src/video-generator.js';
import type { VideoCanvasFactory, VideoCanvas, VideoGenerationOptions } from '../src/types.js';
import type { Animation } from '@particle-engine/animation';
import { EventEmitter } from 'node:events';
import type { Writable, Readable } from 'node:stream';

// ---- Mock FFmpeg module ----
vi.mock('../src/ffmpeg.js', async () => {
	const actual = await vi.importActual<typeof import('../src/ffmpeg.js')>('../src/ffmpeg.js');
	return {
		...actual,
		checkFFmpegAvailable: vi.fn().mockResolvedValue(true),
		spawnFFmpeg: vi.fn(),
	};
});

import { spawnFFmpeg, checkFFmpegAvailable } from '../src/ffmpeg.js';

// ---- Helpers ----

/** Create a minimal valid animation */
function createTestAnimation(overrides?: Partial<Animation>): Animation {
	return {
		id: 'test-anim',
		duration: 100,       // 100ms
		fps: 10,             // 10 fps → 1 frame (0ms only since 100/100=1 frame at index 0)
		defaultEasing: 'linear',
		keyframes: [
			{
				time: 0,
				easing: 'linear',
				particles: [
					{ row: 0, col: 0, color: '#FF0000', opacity: 1.0, size: 1.0 },
				],
				connections: [],
			},
			{
				time: 100,
				easing: 'linear',
				particles: [
					{ row: 0, col: 0, color: '#00FF00', opacity: 1.0, size: 1.0 },
				],
				connections: [],
			},
		],
		events: [],
		...overrides,
	};
}

/** Create a mock VideoCanvasFactory */
function createMockCanvasFactory(): VideoCanvasFactory & { buffers: Buffer[] } {
	const buffers: Buffer[] = [];

	return {
		buffers,
		createCanvas(width: number, height: number): VideoCanvas {
			const pixelCount = width * height;
			const buffer = Buffer.alloc(pixelCount * 4, 0); // RGBA
			buffers.push(buffer);

			const mockCtx = {
				save: vi.fn(),
				restore: vi.fn(),
				scale: vi.fn(),
				fillRect: vi.fn(),
				clearRect: vi.fn(),
				beginPath: vi.fn(),
				closePath: vi.fn(),
				moveTo: vi.fn(),
				lineTo: vi.fn(),
				quadraticCurveTo: vi.fn(),
				arc: vi.fn(),
				fill: vi.fn(),
				stroke: vi.fn(),
				setLineDash: vi.fn(),
				fillText: vi.fn(),
				fillStyle: '',
				strokeStyle: '',
				lineWidth: 1,
				lineCap: 'butt' as const,
				lineJoin: 'miter' as const,
				globalAlpha: 1,
				imageSmoothingEnabled: true,
				font: '',
				textAlign: 'start' as const,
				textBaseline: 'alphabetic' as const,
			};

			return {
				width,
				height,
				getContext: () => mockCtx,
				toBuffer: () => buffer,
			};
		},
	};
}

/** Create a mock FFmpeg process that immediately succeeds */
function createMockFFmpegProcess(exitCode = 0): EventEmitter & {
	stdin: EventEmitter & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
	stderr: EventEmitter;
	stdout: EventEmitter;
	kill: ReturnType<typeof vi.fn>;
} {
	const proc = new EventEmitter() as any;

	proc.stdin = new EventEmitter();
	proc.stdin.write = vi.fn().mockReturnValue(true);
	proc.stdin.end = vi.fn().mockImplementation(() => {
		// Simulate FFmpeg finishing after stdin ends
		process.nextTick(() => proc.emit('close', exitCode));
	});

	proc.stderr = new EventEmitter();
	proc.stdout = new EventEmitter();
	proc.kill = vi.fn();

	return proc;
}

// ---- Tests ----

describe('VideoGenerator', () => {
	let generator: VideoGenerator;
	let factory: ReturnType<typeof createMockCanvasFactory>;
	let mockProcess: ReturnType<typeof createMockFFmpegProcess>;

	beforeEach(() => {
		factory = createMockCanvasFactory();
		generator = new VideoGenerator(factory);
		mockProcess = createMockFFmpegProcess();
		vi.mocked(spawnFFmpeg).mockReturnValue(mockProcess as any);
		vi.mocked(checkFFmpegAvailable).mockResolvedValue(true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('generates a video and returns VideoResult', async () => {
		const options: VideoGenerationOptions = {
			animation: createTestAnimation(),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/test.mp4',
			config: { width: 200, height: 200 },
		};

		const result = await generator.generate(options);

		expect(result.outputPath).toBe('/tmp/test.mp4');
		expect(result.format).toBe('mp4');
		expect(result.duration).toBe(100);
		expect(result.frames).toBeGreaterThan(0);
	});

	it('pipes the correct number of frame buffers to FFmpeg stdin', async () => {
		const animation = createTestAnimation({ fps: 10, duration: 100 });
		// 10 fps, 100ms → Math.round(100/(1000/10)) = 1 frame at index 0
		const options: VideoGenerationOptions = {
			animation,
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/test.mp4',
			config: { width: 100, height: 100 },
		};

		await generator.generate(options);

		// Each frame results in a stdin.write call
		expect(mockProcess.stdin.write).toHaveBeenCalled();
		const writeCount = mockProcess.stdin.write.mock.calls.length;
		expect(writeCount).toBeGreaterThan(0);
	});

	it('writes RGBA buffers of correct size', async () => {
		const width = 40;
		const height = 30;
		const options: VideoGenerationOptions = {
			animation: createTestAnimation(),
			gridConfig: { rows: 5, cols: 5, spacing: 10 },
			outputPath: '/tmp/test.mp4',
			config: { width, height },
		};

		await generator.generate(options);

		// Each frame buffer should be width * height * 4 bytes (RGBA)
		const expectedSize = width * height * 4;
		for (const call of mockProcess.stdin.write.mock.calls) {
			const buf = call[0] as Buffer;
			expect(buf.length).toBe(expectedSize);
		}
	});

	it('calls spawnFFmpeg with correct arguments', async () => {
		const options: VideoGenerationOptions = {
			animation: createTestAnimation({ fps: 24 }),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/output.mp4',
			config: { width: 640, height: 480 },
		};

		await generator.generate(options);

		expect(spawnFFmpeg).toHaveBeenCalledTimes(1);
		const [args, ffmpegPath] = vi.mocked(spawnFFmpeg).mock.calls[0];
		expect(args).toContain('-f');
		expect(args).toContain('rawvideo');
		expect(args).toContain('-pix_fmt');
		expect(args).toContain('rgba');
		expect(args).toContain('640x480');
		expect(args).toContain('24');
		expect(args[args.length - 1]).toBe('/tmp/output.mp4');
	});

	it('uses custom FFmpeg path', async () => {
		const options: VideoGenerationOptions = {
			animation: createTestAnimation(),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/test.mp4',
			config: { width: 200, height: 200, ffmpegPath: '/usr/local/bin/ffmpeg' },
		};

		await generator.generate(options);

		const [, ffmpegPath] = vi.mocked(spawnFFmpeg).mock.calls[0];
		expect(ffmpegPath).toBe('/usr/local/bin/ffmpeg');
	});

	it('ends FFmpeg stdin after all frames', async () => {
		const options: VideoGenerationOptions = {
			animation: createTestAnimation(),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/test.mp4',
			config: { width: 100, height: 100 },
		};

		await generator.generate(options);

		expect(mockProcess.stdin.end).toHaveBeenCalledTimes(1);
	});

	it('uses webm format when specified', async () => {
		const options: VideoGenerationOptions = {
			animation: createTestAnimation(),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/test.webm',
			config: { width: 200, height: 200, format: 'webm' },
		};

		const result = await generator.generate(options);

		expect(result.format).toBe('webm');
		const [args] = vi.mocked(spawnFFmpeg).mock.calls[0];
		expect(args).toContain('libvpx-vp9');
	});

	it('uses gif format when specified', async () => {
		const options: VideoGenerationOptions = {
			animation: createTestAnimation(),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/test.gif',
			config: { width: 200, height: 200, format: 'gif' },
		};

		const result = await generator.generate(options);

		expect(result.format).toBe('gif');
		const [args] = vi.mocked(spawnFFmpeg).mock.calls[0];
		expect(args).toContain('-filter_complex');
	});

	it('accounts for pixelRatio in frame dimensions', async () => {
		const options: VideoGenerationOptions = {
			animation: createTestAnimation(),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/test.mp4',
			config: { width: 200, height: 100, pixelRatio: 2 },
		};

		await generator.generate(options);

		const [args] = vi.mocked(spawnFFmpeg).mock.calls[0];
		// Actual dimensions should be 400x200
		expect(args).toContain('400x200');
	});
});

describe('VideoGenerator — error handling', () => {
	let generator: VideoGenerator;
	let factory: ReturnType<typeof createMockCanvasFactory>;

	beforeEach(() => {
		factory = createMockCanvasFactory();
		generator = new VideoGenerator(factory);
		vi.mocked(checkFFmpegAvailable).mockResolvedValue(true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('rejects when FFmpeg is not available', async () => {
		vi.mocked(checkFFmpegAvailable).mockResolvedValue(false);

		const options: VideoGenerationOptions = {
			animation: createTestAnimation(),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/test.mp4',
			config: { width: 200, height: 200 },
		};

		await expect(generator.generate(options)).rejects.toThrow('FFmpeg not found');
	});

	it('rejects when width is zero', async () => {
		const options: VideoGenerationOptions = {
			animation: createTestAnimation(),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/test.mp4',
			config: { width: 0, height: 200 },
		};

		await expect(generator.generate(options)).rejects.toThrow('width and height must be positive');
	});

	it('rejects when height is negative', async () => {
		const options: VideoGenerationOptions = {
			animation: createTestAnimation(),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/test.mp4',
			config: { width: 200, height: -100 },
		};

		await expect(generator.generate(options)).rejects.toThrow('width and height must be positive');
	});

	it('rejects when animation duration is zero', async () => {
		const options: VideoGenerationOptions = {
			animation: createTestAnimation({ duration: 0 }),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/test.mp4',
			config: { width: 200, height: 200 },
		};

		await expect(generator.generate(options)).rejects.toThrow('duration must be positive');
	});

	it('rejects when animation fps is zero', async () => {
		const options: VideoGenerationOptions = {
			animation: createTestAnimation({ fps: 0 }),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/test.mp4',
			config: { width: 200, height: 200 },
		};

		await expect(generator.generate(options)).rejects.toThrow('fps must be positive');
	});

	it('rejects when outputPath is empty', async () => {
		const options: VideoGenerationOptions = {
			animation: createTestAnimation(),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '',
			config: { width: 200, height: 200 },
		};

		await expect(generator.generate(options)).rejects.toThrow('Output path is required');
	});

	it('rejects when FFmpeg exits with non-zero code', async () => {
		const failProcess = createMockFFmpegProcess(1);
		vi.mocked(spawnFFmpeg).mockReturnValue(failProcess as any);

		const options: VideoGenerationOptions = {
			animation: createTestAnimation(),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/test.mp4',
			config: { width: 200, height: 200 },
		};

		await expect(generator.generate(options)).rejects.toThrow('FFmpeg exited with code 1');
	});

	it('rejects when FFmpeg process emits an error', async () => {
		const errorProcess = createMockFFmpegProcess();
		// Override stdin.end to not trigger close
		errorProcess.stdin.end = vi.fn();
		vi.mocked(spawnFFmpeg).mockReturnValue(errorProcess as any);

		const options: VideoGenerationOptions = {
			animation: createTestAnimation(),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/test.mp4',
			config: { width: 200, height: 200 },
		};

		const promise = generator.generate(options);

		// Emit error after a tick
		process.nextTick(() => {
			errorProcess.emit('error', new Error('spawn ENOENT'));
		});

		await expect(promise).rejects.toThrow('FFmpeg process error: spawn ENOENT');
	});

	it('includes stderr in error message when FFmpeg fails', async () => {
		const failProcess = createMockFFmpegProcess(1);
		// Override stdin.end to emit stderr before close
		failProcess.stdin.end = vi.fn().mockImplementation(() => {
			process.nextTick(() => {
				failProcess.stderr.emit('data', Buffer.from('Unknown encoder libx264'));
				process.nextTick(() => failProcess.emit('close', 1));
			});
		});
		vi.mocked(spawnFFmpeg).mockReturnValue(failProcess as any);

		const options: VideoGenerationOptions = {
			animation: createTestAnimation(),
			gridConfig: { rows: 10, cols: 10, spacing: 20 },
			outputPath: '/tmp/test.mp4',
			config: { width: 200, height: 200 },
		};

		await expect(generator.generate(options)).rejects.toThrow('Unknown encoder libx264');
	});
});
