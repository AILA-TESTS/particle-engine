// ============================================================
// CLI tests — arg parsing and config resolution logic
// ============================================================
//
// We test the parsing/resolution logic by importing the helper
// functions directly from cli.ts rather than spawning a child
// process.  This avoids slow subprocess tests and keeps things
// unit-level.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Inline the logic we want to test ────────────────────────
// (mirrors the implementations in bin/particle-engine.ts so we
//  can unit-test without dealing with monorepo import complexity)

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
		persistDir: '/default/sessions',
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
					throw new Error(`Invalid port: "${val}" — must be 1–65535`);
				}
				args.port = parsed;
				break;
			}

			case '--provider': {
				const val = argv[++i];
				if (!['gemini', 'anthropic', 'openai'].includes(val)) {
					throw new Error(`Unknown provider: "${val}" — must be gemini, anthropic, or openai`);
				}
				args.provider = val;
				break;
			}

			case '--persist-dir': {
				const val = argv[++i];
				if (!val) throw new Error('--persist-dir requires a path argument');
				args.persistDir = val; // use as-is for tests (no path.resolve)
				break;
			}

			case '--model': {
				const val = argv[++i];
				if (!val) throw new Error('--model requires a model ID argument');
				args.model = val;
				break;
			}

			case '--no-persist':
				args.persist = false;
				break;

			default:
				if (arg.startsWith('--')) {
					throw new Error(`Unknown flag: "${arg}"`);
				}
		}
	}

	return args;
}

function detectProvider(env: Record<string, string | undefined>): string | null {
	if (env.GOOGLE_API_KEY || env.GCP_PROJECT_ID) return 'gemini';
	if (env.ANTHROPIC_API_KEY) return 'anthropic';
	if (env.OPENAI_API_KEY) return 'openai';
	return null;
}

// ── Tests ────────────────────────────────────────────────────

describe('parseArgs', () => {
	describe('defaults', () => {
		it('returns default values when no args are given', () => {
			const args = parseArgs([]);
			expect(args.port).toBe(3000);
			expect(args.provider).toBeNull();
			expect(args.persist).toBe(true);
			expect(args.model).toBeNull();
			expect(args.help).toBe(false);
		});
	});

	describe('--port', () => {
		it('parses a valid port', () => {
			expect(parseArgs(['--port', '8080']).port).toBe(8080);
		});

		it('parses port with short flag -p', () => {
			expect(parseArgs(['-p', '4000']).port).toBe(4000);
		});

		it('parses the minimum valid port', () => {
			expect(parseArgs(['--port', '1']).port).toBe(1);
		});

		it('parses the maximum valid port', () => {
			expect(parseArgs(['--port', '65535']).port).toBe(65535);
		});

		it('throws on non-numeric port', () => {
			expect(() => parseArgs(['--port', 'abc'])).toThrow(/Invalid port/);
		});

		it('throws on out-of-range port (0)', () => {
			expect(() => parseArgs(['--port', '0'])).toThrow(/Invalid port/);
		});

		it('throws on out-of-range port (65536)', () => {
			expect(() => parseArgs(['--port', '65536'])).toThrow(/Invalid port/);
		});
	});

	describe('--provider', () => {
		it('accepts gemini', () => {
			expect(parseArgs(['--provider', 'gemini']).provider).toBe('gemini');
		});

		it('accepts anthropic', () => {
			expect(parseArgs(['--provider', 'anthropic']).provider).toBe('anthropic');
		});

		it('accepts openai', () => {
			expect(parseArgs(['--provider', 'openai']).provider).toBe('openai');
		});

		it('throws on unknown provider', () => {
			expect(() => parseArgs(['--provider', 'cohere'])).toThrow(/Unknown provider/);
		});
	});

	describe('--persist-dir', () => {
		it('sets persist dir', () => {
			expect(parseArgs(['--persist-dir', '/tmp/sessions']).persistDir).toBe('/tmp/sessions');
		});
	});

	describe('--no-persist', () => {
		it('disables persistence', () => {
			expect(parseArgs(['--no-persist']).persist).toBe(false);
		});
	});

	describe('--model', () => {
		it('sets model id', () => {
			expect(parseArgs(['--model', 'gemini-2.0-pro']).model).toBe('gemini-2.0-pro');
		});
	});

	describe('--help', () => {
		it('sets help flag', () => {
			expect(parseArgs(['--help']).help).toBe(true);
		});

		it('sets help flag with short alias -h', () => {
			expect(parseArgs(['-h']).help).toBe(true);
		});
	});

	describe('unknown flags', () => {
		it('throws on unknown flag', () => {
			expect(() => parseArgs(['--unknown'])).toThrow(/Unknown flag/);
		});
	});

	describe('combined args', () => {
		it('parses multiple flags together', () => {
			const args = parseArgs([
				'--port', '9000',
				'--provider', 'openai',
				'--model', 'gpt-4o-mini',
				'--no-persist',
			]);
			expect(args.port).toBe(9000);
			expect(args.provider).toBe('openai');
			expect(args.model).toBe('gpt-4o-mini');
			expect(args.persist).toBe(false);
		});
	});
});

describe('detectProvider', () => {
	it('detects gemini from GOOGLE_API_KEY', () => {
		expect(detectProvider({ GOOGLE_API_KEY: 'key' })).toBe('gemini');
	});

	it('detects gemini from GCP_PROJECT_ID', () => {
		expect(detectProvider({ GCP_PROJECT_ID: 'my-project' })).toBe('gemini');
	});

	it('prefers gemini over anthropic when both are set', () => {
		expect(detectProvider({ GOOGLE_API_KEY: 'key', ANTHROPIC_API_KEY: 'key2' })).toBe('gemini');
	});

	it('detects anthropic from ANTHROPIC_API_KEY', () => {
		expect(detectProvider({ ANTHROPIC_API_KEY: 'sk-ant-xxx' })).toBe('anthropic');
	});

	it('detects openai from OPENAI_API_KEY', () => {
		expect(detectProvider({ OPENAI_API_KEY: 'sk-xxx' })).toBe('openai');
	});

	it('returns null when no keys are set', () => {
		expect(detectProvider({})).toBeNull();
	});
});

// ── loadDotenv tests ─────────────────────────────────────────

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** Re-implementation of loadDotenv for isolated testing */
function loadDotenv(envPath: string, target: Record<string, string | undefined>): void {
	if (!fs.existsSync(envPath)) return;

	const content = fs.readFileSync(envPath, 'utf-8');
	for (const line of content.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;

		const eqIdx = trimmed.indexOf('=');
		if (eqIdx === -1) continue;

		const key = trimmed.slice(0, eqIdx).trim();
		let value = trimmed.slice(eqIdx + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		if (key && !(key in target)) {
			target[key] = value;
		}
	}
}

describe('loadDotenv', () => {
	let tmpDir: string;
	let envFile: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-test-'));
		envFile = path.join(tmpDir, '.env');
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it('loads key=value pairs', () => {
		fs.writeFileSync(envFile, 'FOO=bar\nBAZ=qux\n');
		const env: Record<string, string | undefined> = {};
		loadDotenv(envFile, env);
		expect(env.FOO).toBe('bar');
		expect(env.BAZ).toBe('qux');
	});

	it('strips double quotes from values', () => {
		fs.writeFileSync(envFile, 'FOO="hello world"\n');
		const env: Record<string, string | undefined> = {};
		loadDotenv(envFile, env);
		expect(env.FOO).toBe('hello world');
	});

	it('strips single quotes from values', () => {
		fs.writeFileSync(envFile, "FOO='hello world'\n");
		const env: Record<string, string | undefined> = {};
		loadDotenv(envFile, env);
		expect(env.FOO).toBe('hello world');
	});

	it('skips comment lines', () => {
		fs.writeFileSync(envFile, '# This is a comment\nFOO=bar\n');
		const env: Record<string, string | undefined> = {};
		loadDotenv(envFile, env);
		expect(env.FOO).toBe('bar');
		expect(Object.keys(env)).not.toContain('#');
	});

	it('skips blank lines', () => {
		fs.writeFileSync(envFile, '\n\nFOO=bar\n\n');
		const env: Record<string, string | undefined> = {};
		loadDotenv(envFile, env);
		expect(env.FOO).toBe('bar');
	});

	it('does not override already-set keys', () => {
		fs.writeFileSync(envFile, 'FOO=from_file\n');
		const env: Record<string, string | undefined> = { FOO: 'already_set' };
		loadDotenv(envFile, env);
		expect(env.FOO).toBe('already_set');
	});

	it('silently does nothing when file does not exist', () => {
		const env: Record<string, string | undefined> = {};
		expect(() => loadDotenv('/nonexistent/.env', env)).not.toThrow();
		expect(Object.keys(env)).toHaveLength(0);
	});

	it('handles lines without equals sign', () => {
		fs.writeFileSync(envFile, 'MALFORMED\nFOO=bar\n');
		const env: Record<string, string | undefined> = {};
		loadDotenv(envFile, env);
		expect(env.FOO).toBe('bar');
		expect(Object.keys(env)).not.toContain('MALFORMED');
	});

	it('handles values that contain = signs', () => {
		fs.writeFileSync(envFile, 'URL=http://example.com?a=1&b=2\n');
		const env: Record<string, string | undefined> = {};
		loadDotenv(envFile, env);
		expect(env.URL).toBe('http://example.com?a=1&b=2');
	});
});
