// ============================================================
// FFmpeg — Process management and argument construction
// ============================================================

import { spawn, execFile } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { VideoFormat } from './types.js';

/**
 * Map quality (1-100) to CRF value for libx264/libvpx-vp9.
 * CRF is inversely proportional to quality:
 *   quality 100 → CRF 0 (lossless)
 *   quality 1   → CRF 51 (worst quality)
 *   quality 80  → CRF ~10
 */
export function qualityToCRF(quality: number): number {
	const clamped = Math.max(1, Math.min(100, quality));
	return Math.round(51 * (1 - (clamped - 1) / 99));
}

/**
 * Build FFmpeg command-line arguments for encoding raw RGBA frames to video.
 */
export function buildFFmpegArgs(
	format: VideoFormat,
	width: number,
	height: number,
	fps: number,
	outputPath: string,
	codec?: string,
	quality?: number,
): string[] {
	const crf = qualityToCRF(quality ?? 80);

	// Input arguments — raw RGBA frames from stdin
	const inputArgs: string[] = [
		'-y',                              // overwrite output
		'-f', 'rawvideo',                  // input format: raw video
		'-pix_fmt', 'rgba',                // pixel format: RGBA
		'-s', `${width}x${height}`,        // frame size
		'-r', String(fps),                 // input frame rate
		'-i', 'pipe:0',                    // read from stdin
	];

	// Output arguments — depend on format
	let outputArgs: string[];

	switch (format) {
		case 'mp4': {
			const selectedCodec = codec ?? 'libx264';
			outputArgs = [
				'-c:v', selectedCodec,
				'-pix_fmt', 'yuv420p',
				'-crf', String(crf),
				'-preset', 'medium',
				'-movflags', '+faststart',
			];
			break;
		}
		case 'webm': {
			const selectedCodec = codec ?? 'libvpx-vp9';
			outputArgs = [
				'-c:v', selectedCodec,
				'-pix_fmt', 'yuv420p',
				'-crf', String(crf),
				'-b:v', '0',
			];
			break;
		}
		case 'gif': {
			// GIF: two-pass with palette generation via filter_complex
			outputArgs = [
				'-filter_complex',
				'[0:v] split [a][b]; [a] palettegen [pal]; [b][pal] paletteuse',
			];
			break;
		}
		default:
			throw new Error(`Unsupported video format: ${format}`);
	}

	return [...inputArgs, ...outputArgs, outputPath];
}

/**
 * Spawn an FFmpeg child process with the given arguments.
 */
export function spawnFFmpeg(args: string[], ffmpegPath?: string): ChildProcess {
	const bin = ffmpegPath ?? 'ffmpeg';
	return spawn(bin, args, {
		stdio: ['pipe', 'pipe', 'pipe'],
	});
}

/**
 * Check whether FFmpeg is available at the given path.
 * Resolves to true if FFmpeg is found and can report its version.
 */
export function checkFFmpegAvailable(ffmpegPath?: string): Promise<boolean> {
	const bin = ffmpegPath ?? 'ffmpeg';
	return new Promise((resolve) => {
		try {
			const proc = execFile(bin, ['-version'], (error) => {
				resolve(!error);
			});
			proc.on('error', () => resolve(false));
		} catch {
			resolve(false);
		}
	});
}
