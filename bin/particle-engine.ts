#!/usr/bin/env node
// ============================================================
// particle-engine CLI — Start the server from the command line
// ============================================================
//
// Usage:
//   npx tsx bin/particle-engine.ts [options]
//
// Options:
//   --port <number>        Port to listen on (default: 3000)
//   --provider <name>      LLM provider: gemini | anthropic | openai (default: auto-detect)
//   --persist-dir <path>   Directory to persist sessions (default: ./sessions)
//   --model <id>           Override the model ID for the selected provider
//   --no-persist           Disable session persistence
//   --help                 Show this help message
//
// Environment variables:
//   GOOGLE_API_KEY         Google Gemini API key (for gemini provider, API key mode)
//   GCP_PROJECT_ID         GCP project ID (for gemini provider, Vertex AI mode)
//   GCP_REGION             GCP region (for gemini provider, Vertex AI mode — default: us-central1)
//   ANTHROPIC_API_KEY      Anthropic API key (for anthropic provider)
//   OPENAI_API_KEY         OpenAI API key (for openai provider)
//
// Example:
//   npx tsx bin/particle-engine.ts --port 8080 --provider anthropic
//   npx tsx bin/particle-engine.ts --provider gemini --no-persist

import * as path from 'node:path';
import * as fs from 'node:fs';
import { createServer } from 'node:http';
import { serve } from '@hono/node-server';

// ── Simple dotenv loader (no dependencies) ──────────────────

/**
 * Load .env file from a given path into process.env.
 * Only sets variables that are not already set.
 */
function loadDotenv(envPath: string): void {
	if (!fs.existsSync(envPath)) return;

	const content = fs.readFileSync(envPath, 'utf-8');
	for (const line of content.split('\n')) {
		const trimmed = line.trim();
		// Skip comments and blank lines
		if (!trimmed || trimmed.startsWith('#')) continue;

		const eqIdx = trimmed.indexOf('=');
		if (eqIdx === -1) continue;

		const key = trimmed.slice(0, eqIdx).trim();
		let value = trimmed.slice(eqIdx + 1).trim();

		// Strip surrounding quotes
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		// Only set if not already in the environment
		if (key && !(key in process.env)) {
			process.env[key] = value;
		}
	}
}

// ── Argument parser ─────────────────────────────────────────

interface CLIArgs {
	port: number;
	provider: string | null;
	persistDir: string;
	persist: boolean;
	model: string | null;
	help: boolean;
}

function parseArgs(argv: string[]): CLIArgs {
	const args: CLIArgs = {
		port: 3000,
		provider: null,
		persistDir: path.resolve(process.cwd(), 'sessions'),
		persist: true,
		model: null,
		help: false,
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case '--help':
			case '-h':
				args.help = true;
				break;

			case '--port':
			case '-p': {
				const val = argv[++i];
				const parsed = parseInt(val, 10);
				if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
					console.error(`[particle-engine] Invalid port: "${val}" — must be 1–65535`);
					process.exit(1);
				}
				args.port = parsed;
				break;
			}

			case '--provider': {
				const val = argv[++i];
				if (!['gemini', 'anthropic', 'openai'].includes(val)) {
					console.error(
						`[particle-engine] Unknown provider: "${val}" — must be gemini, anthropic, or openai`,
					);
					process.exit(1);
				}
				args.provider = val;
				break;
			}

			case '--persist-dir': {
				const val = argv[++i];
				if (!val) {
					console.error('[particle-engine] --persist-dir requires a path argument');
					process.exit(1);
				}
				args.persistDir = path.resolve(process.cwd(), val);
				break;
			}

			case '--model': {
				const val = argv[++i];
				if (!val) {
					console.error('[particle-engine] --model requires a model ID argument');
					process.exit(1);
				}
				args.model = val;
				break;
			}

			case '--no-persist':
				args.persist = false;
				break;

			default:
				if (arg.startsWith('--')) {
					console.error(`[particle-engine] Unknown flag: "${arg}" — run with --help for usage`);
					process.exit(1);
				}
		}
	}

	return args;
}

function printHelp(): void {
	console.log(`
particle-engine — LLM-native visual creation server

Usage:
  npx tsx bin/particle-engine.ts [options]

Options:
  --port <number>        Port to listen on (default: 3000)
  --provider <name>      LLM provider: gemini | anthropic | openai
                         (default: auto-detect from environment)
  --model <id>           Override the model ID for the selected provider
  --persist-dir <path>   Directory to persist sessions (default: ./sessions)
  --no-persist           Disable session persistence
  --help                 Show this help message

Environment variables:
  GOOGLE_API_KEY         Google Gemini API key (API key mode)
  GCP_PROJECT_ID         GCP project for Vertex AI (Gemini Vertex mode)
  GCP_REGION             GCP region for Vertex AI (default: us-central1)
  ANTHROPIC_API_KEY      Anthropic API key
  OPENAI_API_KEY         OpenAI API key

Examples:
  npx tsx bin/particle-engine.ts
  npx tsx bin/particle-engine.ts --port 8080 --provider anthropic
  npx tsx bin/particle-engine.ts --provider gemini --model gemini-2.0-flash
  npx tsx bin/particle-engine.ts --no-persist
`);
}

// ── Provider auto-detection ──────────────────────────────────

type ProviderName = 'gemini' | 'anthropic' | 'openai';

function detectProvider(): ProviderName | null {
	if (process.env.GOOGLE_API_KEY || process.env.GCP_PROJECT_ID) return 'gemini';
	if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
	if (process.env.OPENAI_API_KEY) return 'openai';
	return null;
}

// ── Startup banner ───────────────────────────────────────────

function printBanner(opts: {
	port: number;
	providerName: string | null;
	modelId: string | null;
	persistDir: string | null;
}): void {
	const line = '─'.repeat(56);
	console.log(`\n  particle-engine`);
	console.log(`  ${line}`);
	console.log(`  Server URL  : http://localhost:${opts.port}`);
	console.log(`  Client URL  : http://localhost:5173  (run pnpm dev)`);
	console.log(`  API base    : http://localhost:${opts.port}/api`);
	if (opts.providerName) {
		const modelLabel = opts.modelId ? ` (${opts.modelId})` : '';
		console.log(`  Provider    : ${opts.providerName}${modelLabel}`);
	} else {
		console.log(`  Provider    : NONE — prompt endpoint disabled`);
	}
	if (opts.persistDir) {
		console.log(`  Persistence : ${opts.persistDir}`);
	} else {
		console.log(`  Persistence : disabled (in-memory only)`);
	}
	console.log(`  ${line}\n`);
}

// ── Provider error hints ─────────────────────────────────────

function warnMissingProvider(): void {
	console.warn('[particle-engine] WARNING: No LLM provider configured.');
	console.warn('  The /api/sessions/:id/prompt endpoint will return 503.');
	console.warn('  To enable LLM features, set one of:');
	console.warn('    GOOGLE_API_KEY    — Gemini via API key');
	console.warn('    GCP_PROJECT_ID    — Gemini via Vertex AI');
	console.warn('    ANTHROPIC_API_KEY — Anthropic Claude');
	console.warn('    OPENAI_API_KEY    — OpenAI GPT');
	console.warn('  Or pass --provider gemini|anthropic|openai\n');
}

// ── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
	// Load .env from the working directory (silently skip if missing)
	loadDotenv(path.resolve(process.cwd(), '.env'));

	const args = parseArgs(process.argv.slice(2));

	if (args.help) {
		printHelp();
		process.exit(0);
	}

	// Resolve provider
	const providerName = (args.provider as ProviderName | null) ?? detectProvider();

	// Build provider instance
	let provider: import('../packages/server/src/types.js').LLMProvider | undefined;
	let resolvedModelId: string | null = args.model;

	if (providerName === 'gemini') {
		const { GeminiProvider } = await import('../packages/provider-gemini/src/index.js');
		const apiKey = process.env.GOOGLE_API_KEY;
		const projectId = process.env.GCP_PROJECT_ID;
		const location = process.env.GCP_REGION ?? 'us-central1';

		if (!apiKey && !projectId) {
			console.error(
				'[particle-engine] ERROR: Gemini provider selected but no credentials found.\n' +
					'  Set GOOGLE_API_KEY (API key mode) or GCP_PROJECT_ID (Vertex AI mode).',
			);
			process.exit(1);
		}

		const config = apiKey
			? { apiKey, modelId: args.model ?? undefined }
			: { projectId: projectId!, location, modelId: args.model ?? undefined };

		provider = new GeminiProvider(config);
		resolvedModelId = args.model ?? (apiKey ? 'gemini-2.0-flash' : 'gemini-2.0-flash');
	} else if (providerName === 'anthropic') {
		const { AnthropicProvider } = await import('../packages/provider-anthropic/src/index.js');
		const apiKey = process.env.ANTHROPIC_API_KEY;

		if (!apiKey) {
			console.error(
				'[particle-engine] ERROR: Anthropic provider selected but ANTHROPIC_API_KEY is not set.',
			);
			process.exit(1);
		}

		provider = new AnthropicProvider({ apiKey, modelId: args.model ?? undefined });
		resolvedModelId = args.model ?? 'claude-sonnet-4-20250514';
	} else if (providerName === 'openai') {
		const { OpenAIProvider } = await import('../packages/provider-openai/src/index.js');
		const apiKey = process.env.OPENAI_API_KEY;

		if (!apiKey) {
			console.error(
				'[particle-engine] ERROR: OpenAI provider selected but OPENAI_API_KEY is not set.',
			);
			process.exit(1);
		}

		provider = new OpenAIProvider({ apiKey, modelId: args.model ?? undefined });
		resolvedModelId = args.model ?? 'gpt-4o';
	} else {
		warnMissingProvider();
	}

	// Build server config
	const { createAppWithWebSocket } = await import('../packages/server/src/app.js');
	const { WebSocketServer } = await import('ws');

	const persistenceConfig = args.persist
		? { enabled: true, directory: args.persistDir }
		: undefined;

	const { app, sessionManager, wsHandler } = createAppWithWebSocket({
		port: args.port,
		provider,
		persistence: persistenceConfig,
	});

	// Wait for session manager initialization (loads persisted sessions if any)
	await sessionManager.initialize();

	if (args.persist) {
		const sessionCount = sessionManager.listSessions().length;
		if (sessionCount > 0) {
			console.log(`[particle-engine] Loaded ${sessionCount} persisted session(s) from ${args.persistDir}`);
		}
	}

	// Print startup banner
	printBanner({
		port: args.port,
		providerName,
		modelId: resolvedModelId,
		persistDir: args.persist ? args.persistDir : null,
	});

	// Create HTTP server and attach WebSocket support
	const httpServer = createServer();

	// Mount WebSocket upgrade handler
	const wss = new WebSocketServer({ noServer: true });
	wss.on('connection', wsHandler);

	httpServer.on('upgrade', (req, socket, head) => {
		if (req.url === '/ws') {
			wss.handleUpgrade(req, socket, head, (ws) => {
				wss.emit('connection', ws, req);
			});
		} else {
			socket.destroy();
		}
	});

	// Start the Hono app via @hono/node-server on the existing httpServer
	serve(
		{
			fetch: app.fetch,
			port: args.port,
		},
		(info) => {
			console.log(`[particle-engine] Listening on http://localhost:${info.port}`);
		},
	);
}

main().catch((err) => {
	console.error('[particle-engine] Fatal error:', err instanceof Error ? err.message : String(err));
	process.exit(1);
});
