import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
	resolve: {
		alias: {
			'@particle-engine/core': path.resolve(__dirname, '../core/src/index.ts'),
			'@particle-engine/tools': path.resolve(__dirname, '../tools/src/index.ts'),
			'@particle-engine/animation': path.resolve(__dirname, '../animation/src/index.ts'),
			'@particle-engine/renderer-svg': path.resolve(__dirname, '../renderer-svg/src/index.ts'),
			'@particle-engine/renderer-canvas': path.resolve(__dirname, '../renderer-canvas/src/index.ts'),
			'@particle-engine/video': path.resolve(__dirname, '../video/src/index.ts'),
		},
	},
});
