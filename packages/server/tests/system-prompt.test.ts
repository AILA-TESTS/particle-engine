import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../src/system-prompt.js';
import type { SpaceInfo } from '@particle-engine/core';

describe('buildSystemPrompt', () => {
	function makeInfo(overrides?: Partial<SpaceInfo>): SpaceInfo {
		return {
			rows: 100,
			cols: 100,
			spacing: 10,
			totalParticles: 10000,
			activeCount: 0,
			connectionCount: 0,
			groups: [],
			...overrides,
		};
	}

	it('contains grid dimensions', () => {
		const prompt = buildSystemPrompt(makeInfo({ rows: 50, cols: 75 }));

		expect(prompt).toContain('50 rows');
		expect(prompt).toContain('75 columns');
	});

	it('contains row boundary indices', () => {
		const prompt = buildSystemPrompt(makeInfo({ rows: 50, cols: 75 }));

		expect(prompt).toContain('row 49');  // rows - 1
		expect(prompt).toContain('column 74');  // cols - 1
	});

	it('contains current particle count', () => {
		const prompt = buildSystemPrompt(makeInfo({ activeCount: 42 }));

		expect(prompt).toContain('42 active particles');
	});

	it('contains connection count', () => {
		const prompt = buildSystemPrompt(makeInfo({ connectionCount: 15 }));

		expect(prompt).toContain('15 connections');
	});

	it('describes zero state correctly', () => {
		const prompt = buildSystemPrompt(makeInfo({ activeCount: 0, connectionCount: 0 }));

		expect(prompt).toContain('0 active particles');
		expect(prompt).toContain('0 connections');
	});

	it('mentions key tools', () => {
		const prompt = buildSystemPrompt(makeInfo());

		expect(prompt).toContain('set_particles');
		expect(prompt).toContain('connect');
	});

	it('mentions 0-indexed coordinates', () => {
		const prompt = buildSystemPrompt(makeInfo());

		expect(prompt).toContain('0-indexed');
	});
});
