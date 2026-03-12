import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
	resolve: {
		alias: {
			'@particle-engine/core': path.resolve(__dirname, '../core/src/index.ts'),
			'@particle-engine/renderer-canvas': path.resolve(
				__dirname,
				'../renderer-canvas/src/index.ts',
			),
		},
	},
	server: {
		port: 5173,
		proxy: {
			'/api': 'http://localhost:3000',
		},
	},
});
