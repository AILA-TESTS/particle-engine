// ============================================================
// Tests — FFmpeg argument construction and utilities
// ============================================================

import { describe, it, expect } from 'vitest';
import { buildFFmpegArgs, qualityToCRF } from '../src/ffmpeg.js';

describe('qualityToCRF', () => {
	it('maps quality 100 to CRF 0 (best)', () => {
		expect(qualityToCRF(100)).toBe(0);
	});

	it('maps quality 1 to CRF 51 (worst)', () => {
		expect(qualityToCRF(1)).toBe(51);
	});

	it('maps quality 80 to a moderate CRF', () => {
		const crf = qualityToCRF(80);
		// quality 80 → (1 - 79/99) * 51 ≈ 10.3 → 10
		expect(crf).toBe(10);
	});

	it('maps quality 50 to mid-range CRF', () => {
		const crf = qualityToCRF(50);
		// quality 50 → (1 - 49/99) * 51 ≈ 25.8 → 26
		expect(crf).toBe(26);
	});

	it('clamps quality above 100', () => {
		expect(qualityToCRF(200)).toBe(0);
	});

	it('clamps quality below 1', () => {
		expect(qualityToCRF(-5)).toBe(51);
	});
});

describe('buildFFmpegArgs — input args', () => {
	it('includes overwrite flag', () => {
		const args = buildFFmpegArgs('mp4', 1920, 1080, 30, 'out.mp4');
		expect(args).toContain('-y');
	});

	it('includes rawvideo input format', () => {
		const args = buildFFmpegArgs('mp4', 1920, 1080, 30, 'out.mp4');
		const fIndex = args.indexOf('-f');
		expect(fIndex).toBeGreaterThanOrEqual(0);
		expect(args[fIndex + 1]).toBe('rawvideo');
	});

	it('includes RGBA pixel format for input', () => {
		const args = buildFFmpegArgs('mp4', 1920, 1080, 30, 'out.mp4');
		const pixFmtIndex = args.indexOf('-pix_fmt');
		expect(pixFmtIndex).toBeGreaterThanOrEqual(0);
		expect(args[pixFmtIndex + 1]).toBe('rgba');
	});

	it('includes correct frame dimensions', () => {
		const args = buildFFmpegArgs('mp4', 800, 600, 24, 'out.mp4');
		const sIndex = args.indexOf('-s');
		expect(sIndex).toBeGreaterThanOrEqual(0);
		expect(args[sIndex + 1]).toBe('800x600');
	});

	it('includes correct frame rate', () => {
		const args = buildFFmpegArgs('mp4', 1920, 1080, 60, 'out.mp4');
		const rIndex = args.indexOf('-r');
		expect(rIndex).toBeGreaterThanOrEqual(0);
		expect(args[rIndex + 1]).toBe('60');
	});

	it('reads input from stdin pipe', () => {
		const args = buildFFmpegArgs('mp4', 1920, 1080, 30, 'out.mp4');
		const iIndex = args.indexOf('-i');
		expect(iIndex).toBeGreaterThanOrEqual(0);
		expect(args[iIndex + 1]).toBe('pipe:0');
	});

	it('ends with the output path', () => {
		const args = buildFFmpegArgs('mp4', 1920, 1080, 30, '/tmp/video.mp4');
		expect(args[args.length - 1]).toBe('/tmp/video.mp4');
	});
});

describe('buildFFmpegArgs — MP4 format', () => {
	it('uses libx264 codec by default', () => {
		const args = buildFFmpegArgs('mp4', 1920, 1080, 30, 'out.mp4');
		const codecIndex = args.indexOf('-c:v');
		expect(codecIndex).toBeGreaterThanOrEqual(0);
		expect(args[codecIndex + 1]).toBe('libx264');
	});

	it('uses custom codec when specified', () => {
		const args = buildFFmpegArgs('mp4', 1920, 1080, 30, 'out.mp4', 'libx265');
		const codecIndex = args.indexOf('-c:v');
		expect(args[codecIndex + 1]).toBe('libx265');
	});

	it('sets output pixel format to yuv420p', () => {
		const args = buildFFmpegArgs('mp4', 1920, 1080, 30, 'out.mp4');
		// There are two -pix_fmt flags: input (rgba) and output (yuv420p)
		const allPixFmt: string[] = [];
		for (let i = 0; i < args.length; i++) {
			if (args[i] === '-pix_fmt') allPixFmt.push(args[i + 1]);
		}
		expect(allPixFmt).toContain('yuv420p');
	});

	it('includes CRF based on quality', () => {
		const args = buildFFmpegArgs('mp4', 1920, 1080, 30, 'out.mp4', undefined, 90);
		const crfIndex = args.indexOf('-crf');
		expect(crfIndex).toBeGreaterThanOrEqual(0);
		const crfValue = parseInt(args[crfIndex + 1], 10);
		expect(crfValue).toBe(qualityToCRF(90));
	});

	it('includes faststart movflags', () => {
		const args = buildFFmpegArgs('mp4', 1920, 1080, 30, 'out.mp4');
		expect(args).toContain('-movflags');
		expect(args).toContain('+faststart');
	});

	it('includes medium preset', () => {
		const args = buildFFmpegArgs('mp4', 1920, 1080, 30, 'out.mp4');
		const presetIndex = args.indexOf('-preset');
		expect(presetIndex).toBeGreaterThanOrEqual(0);
		expect(args[presetIndex + 1]).toBe('medium');
	});
});

describe('buildFFmpegArgs — WebM format', () => {
	it('uses libvpx-vp9 codec by default', () => {
		const args = buildFFmpegArgs('webm', 1920, 1080, 30, 'out.webm');
		const codecIndex = args.indexOf('-c:v');
		expect(codecIndex).toBeGreaterThanOrEqual(0);
		expect(args[codecIndex + 1]).toBe('libvpx-vp9');
	});

	it('includes zero bitrate for CRF-only mode', () => {
		const args = buildFFmpegArgs('webm', 1920, 1080, 30, 'out.webm');
		const bvIndex = args.indexOf('-b:v');
		expect(bvIndex).toBeGreaterThanOrEqual(0);
		expect(args[bvIndex + 1]).toBe('0');
	});

	it('includes CRF', () => {
		const args = buildFFmpegArgs('webm', 1920, 1080, 30, 'out.webm');
		expect(args).toContain('-crf');
	});
});

describe('buildFFmpegArgs — GIF format', () => {
	it('uses filter_complex for palette generation', () => {
		const args = buildFFmpegArgs('gif', 400, 300, 15, 'out.gif');
		expect(args).toContain('-filter_complex');
		const fcIndex = args.indexOf('-filter_complex');
		expect(args[fcIndex + 1]).toContain('palettegen');
		expect(args[fcIndex + 1]).toContain('paletteuse');
	});

	it('does not include codec flag for GIF', () => {
		const args = buildFFmpegArgs('gif', 400, 300, 15, 'out.gif');
		expect(args).not.toContain('-c:v');
	});
});

describe('buildFFmpegArgs — custom quality', () => {
	it('uses default quality 80 when not specified', () => {
		const argsDefault = buildFFmpegArgs('mp4', 1920, 1080, 30, 'out.mp4');
		const crfIndex = argsDefault.indexOf('-crf');
		const crfValue = parseInt(argsDefault[crfIndex + 1], 10);
		expect(crfValue).toBe(qualityToCRF(80));
	});

	it('maps quality 100 to CRF 0', () => {
		const args = buildFFmpegArgs('mp4', 1920, 1080, 30, 'out.mp4', undefined, 100);
		const crfIndex = args.indexOf('-crf');
		expect(args[crfIndex + 1]).toBe('0');
	});
});
