import { describe, it, expect, vi } from 'vitest';
import { runConversation } from '../src/conversation-loop.js';
import type { ConversationEvent } from '../src/conversation-loop.js';
import { ToolExecutor } from '@particle-engine/tools';
import type { LLMProvider, LLMEvent, Message, ToolCall, ProviderConfig } from '../src/types.js';
import type { ToolDefinition, ToolResult } from '@particle-engine/tools';

// ── Mock LLM Provider ──────────────────────────────────────

/** Create a mock provider that returns pre-defined sequences of events per round */
function createMockProvider(rounds: LLMEvent[][]): LLMProvider {
	let roundIndex = 0;

	return {
		name: 'mock',

		formatTools(tools: ToolDefinition[]): unknown {
			return tools;
		},

		stream(
			_messages: Message[],
			_tools: ToolDefinition[],
			_config?: ProviderConfig,
		): AsyncIterable<LLMEvent> {
			const events = rounds[roundIndex] ?? [];
			roundIndex++;

			return {
				[Symbol.asyncIterator]() {
					let i = 0;
					return {
						async next() {
							if (i < events.length) {
								return { value: events[i++], done: false };
							}
							return { value: undefined as unknown as LLMEvent, done: true };
						},
					};
				},
			};
		},

		parseToolCall(raw: unknown): ToolCall {
			return raw as ToolCall;
		},

		formatToolResult(_name: string, result: ToolResult): unknown {
			return result;
		},
	};
}

describe('runConversation', () => {
	const gridConfig = { rows: 10, cols: 10, spacing: 10 };

	function makeExecutor(): ToolExecutor {
		return new ToolExecutor(gridConfig);
	}

	function makeMessages(prompt: string): Message[] {
		return [
			{ role: 'system', content: 'You are a test assistant.' },
			{ role: 'user', content: prompt },
		];
	}

	// ── Simple text response ────────────────────────────────

	it('handles simple text response (no tool calls)', async () => {
		const provider = createMockProvider([
			[
				{ type: 'text', content: 'Hello ' },
				{ type: 'text', content: 'world!' },
				{ type: 'done', usage: { inputTokens: 10, outputTokens: 5 } },
			],
		]);

		const executor = makeExecutor();
		const messages = makeMessages('Hi');

		const result = await runConversation(
			provider,
			executor,
			messages,
			executor.getToolDefinitions(),
		);

		expect(result.toolCallCount).toBe(0);
		expect(result.usage.inputTokens).toBe(10);
		expect(result.usage.outputTokens).toBe(5);
		// Should have system + user + assistant messages
		expect(result.messages).toHaveLength(3);
		expect(result.messages[2].role).toBe('assistant');
		expect(result.messages[2].content).toBe('Hello world!');
	});

	// ── Single tool call ────────────────────────────────────

	it('handles single tool call and continues', async () => {
		const provider = createMockProvider([
			// Round 1: tool call
			[
				{ type: 'tool_call', id: 'tc1', name: 'get_space_info', arguments: {} },
				{ type: 'done', usage: { inputTokens: 20, outputTokens: 10 } },
			],
			// Round 2: text response
			[
				{ type: 'text', content: 'The grid is 10x10.' },
				{ type: 'done', usage: { inputTokens: 30, outputTokens: 15 } },
			],
		]);

		const executor = makeExecutor();
		const result = await runConversation(
			provider,
			executor,
			makeMessages('What is the grid size?'),
			executor.getToolDefinitions(),
		);

		expect(result.toolCallCount).toBe(1);
		expect(result.usage.inputTokens).toBe(50);
		expect(result.usage.outputTokens).toBe(25);
		// system + user + assistant(toolCalls) + tool(results) + assistant(text)
		expect(result.messages).toHaveLength(5);
		expect(result.messages[2].role).toBe('assistant');
		expect(result.messages[2].toolCalls).toHaveLength(1);
		expect(result.messages[3].role).toBe('tool');
		expect(result.messages[3].toolResults).toHaveLength(1);
		expect(result.messages[3].toolResults![0].result.success).toBe(true);
		expect(result.messages[4].role).toBe('assistant');
		expect(result.messages[4].content).toBe('The grid is 10x10.');
	});

	// ── Multiple tool calls in one response ─────────────────

	it('handles multiple tool calls in one response', async () => {
		const provider = createMockProvider([
			// Round 1: two tool calls
			[
				{
					type: 'tool_call', id: 'tc1', name: 'set_particles',
					arguments: { particles: [{ row: 0, col: 0, color: '#FF0000' }] },
				},
				{
					type: 'tool_call', id: 'tc2', name: 'set_particles',
					arguments: { particles: [{ row: 1, col: 1, color: '#00FF00' }] },
				},
				{ type: 'done', usage: { inputTokens: 40, outputTokens: 20 } },
			],
			// Round 2: text
			[
				{ type: 'text', content: 'Done!' },
				{ type: 'done', usage: { inputTokens: 50, outputTokens: 5 } },
			],
		]);

		const executor = makeExecutor();
		const result = await runConversation(
			provider,
			executor,
			makeMessages('Place two particles'),
			executor.getToolDefinitions(),
		);

		expect(result.toolCallCount).toBe(2);
		// Verify particles were actually set
		const info = executor.getGrid().getSpaceInfo();
		expect(info.activeCount).toBe(2);
	});

	// ── Multiple rounds ─────────────────────────────────────

	it('handles multiple rounds of tool calls then text', async () => {
		const provider = createMockProvider([
			// Round 1: set particles
			[
				{
					type: 'tool_call', id: 'tc1', name: 'set_particles',
					arguments: { particles: [{ row: 0, col: 0 }, { row: 0, col: 1 }] },
				},
				{ type: 'done', usage: { inputTokens: 20, outputTokens: 10 } },
			],
			// Round 2: connect particles
			[
				{
					type: 'tool_call', id: 'tc2', name: 'connect',
					arguments: { connections: [{ from: [0, 0], to: [0, 1] }] },
				},
				{ type: 'done', usage: { inputTokens: 30, outputTokens: 15 } },
			],
			// Round 3: text
			[
				{ type: 'text', content: 'Created a line between two particles.' },
				{ type: 'done', usage: { inputTokens: 40, outputTokens: 20 } },
			],
		]);

		const executor = makeExecutor();
		const result = await runConversation(
			provider,
			executor,
			makeMessages('Draw a line'),
			executor.getToolDefinitions(),
		);

		expect(result.toolCallCount).toBe(2);
		expect(result.usage.inputTokens).toBe(90);
		expect(result.usage.outputTokens).toBe(45);

		// Verify state
		const info = executor.getGrid().getSpaceInfo();
		expect(info.activeCount).toBe(2);
		expect(info.connectionCount).toBe(1);
	});

	// ── Error handling ──────────────────────────────────────

	it('throws on provider error event', async () => {
		const provider = createMockProvider([
			[
				{ type: 'error', error: new Error('API rate limit') },
			],
		]);

		const executor = makeExecutor();

		await expect(
			runConversation(
				provider,
				executor,
				makeMessages('Hi'),
				executor.getToolDefinitions(),
			),
		).rejects.toThrow('API rate limit');
	});

	it('handles tool execution errors gracefully', async () => {
		const provider = createMockProvider([
			// Call an unknown tool
			[
				{ type: 'tool_call', id: 'tc1', name: 'nonexistent_tool', arguments: {} },
				{ type: 'done', usage: { inputTokens: 10, outputTokens: 5 } },
			],
			// Provider acknowledges the error and responds with text
			[
				{ type: 'text', content: 'That tool does not exist.' },
				{ type: 'done', usage: { inputTokens: 20, outputTokens: 10 } },
			],
		]);

		const executor = makeExecutor();
		const result = await runConversation(
			provider,
			executor,
			makeMessages('Run nonexistent tool'),
			executor.getToolDefinitions(),
		);

		// The tool result should report failure
		expect(result.messages[3].role).toBe('tool');
		expect(result.messages[3].toolResults![0].result.success).toBe(false);
		expect(result.messages[3].toolResults![0].result.error).toContain('Unknown tool');
	});

	// ── onEvent callback ────────────────────────────────────

	it('calls onEvent for each event', async () => {
		const provider = createMockProvider([
			[
				{ type: 'text', content: 'Hello' },
				{ type: 'tool_call', id: 'tc1', name: 'get_space_info', arguments: {} },
				{ type: 'done', usage: { inputTokens: 10, outputTokens: 5 } },
			],
			[
				{ type: 'text', content: 'Done' },
				{ type: 'done', usage: { inputTokens: 20, outputTokens: 10 } },
			],
		]);

		const executor = makeExecutor();
		const events: ConversationEvent[] = [];

		await runConversation(
			provider,
			executor,
			makeMessages('Hi'),
			executor.getToolDefinitions(),
			undefined,
			(event) => events.push(event),
		);

		// Should have: text, tool_call, done, tool_result, text, done
		const types = events.map((e) => e.type);
		expect(types).toContain('text');
		expect(types).toContain('tool_call');
		expect(types).toContain('done');
		expect(types).toContain('tool_result');
	});

	// ── Text with tool calls in same round ──────────────────

	it('preserves text content alongside tool calls', async () => {
		const provider = createMockProvider([
			[
				{ type: 'text', content: 'Let me check...' },
				{ type: 'tool_call', id: 'tc1', name: 'get_space_info', arguments: {} },
				{ type: 'done', usage: { inputTokens: 10, outputTokens: 5 } },
			],
			[
				{ type: 'text', content: 'All good!' },
				{ type: 'done', usage: { inputTokens: 20, outputTokens: 10 } },
			],
		]);

		const executor = makeExecutor();
		const result = await runConversation(
			provider,
			executor,
			makeMessages('Check the grid'),
			executor.getToolDefinitions(),
		);

		// The assistant message with tool calls should also have content
		expect(result.messages[2].role).toBe('assistant');
		expect(result.messages[2].content).toBe('Let me check...');
		expect(result.messages[2].toolCalls).toHaveLength(1);
	});

	// ── Empty text response ─────────────────────────────────

	it('handles empty text response (stream ends with just done)', async () => {
		const provider = createMockProvider([
			[
				{ type: 'done', usage: { inputTokens: 5, outputTokens: 0 } },
			],
		]);

		const executor = makeExecutor();
		const result = await runConversation(
			provider,
			executor,
			makeMessages('Hi'),
			executor.getToolDefinitions(),
		);

		expect(result.toolCallCount).toBe(0);
		// No assistant message added for empty text
		expect(result.messages).toHaveLength(2);
	});
});
