import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
	resolve: {
		alias: {
			"@particle-engine/tools": path.resolve(__dirname, "../tools/src/index.ts"),
			"@particle-engine/core": path.resolve(__dirname, "../core/src/index.ts"),
		},
	},
});
