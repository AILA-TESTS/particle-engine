# @particle-engine/tools

The LLM-facing API layer. Defines the 13 tool schemas that an LLM can call, executes them against a `ParticleGrid`, and manages an undo stack. Also defines the `LLMProvider` interface shared by all provider packages.

## Installation

```bash
pnpm add @particle-engine/tools
```

## Basic Usage

```typescript
import { ToolExecutor } from '@particle-engine/tools';

// Create an executor with a grid
const executor = new ToolExecutor({ rows: 100, cols: 100, spacing: 10 });

// Execute a tool call (the same format an LLM produces)
const result = executor.execute('set_particles', {
  particles: [
    { row: 10, col: 20, color: '#FF6B6B', size: 1.5 },
    { row: 10, col: 30, color: '#4ECDC4' },
  ],
});
// result.success === true
// result.data — tool-specific response data

// Connect two particles
executor.execute('connect', {
  connections: [
    { from: [10, 20], to: [10, 30], color: '#FFFFFF', width: 1 },
  ],
});

// Read the current state
const stateResult = executor.execute('get_state', {});
// stateResult.data.state — SpaceState with active particles and connections

// Undo the last operation
executor.execute('undo', {});

// Get tool definitions to send to an LLM
const tools = executor.getToolDefinitions();
```

## The 13 Tools

| Tool | Mutates state | Description |
|------|:---:|---------|
| `get_space_info` | No | Grid dimensions, active count, connection count, group names |
| `get_state` | No | Active particles and connections; supports `region` and `group` filters |
| `set_particles` | Yes | Activate/update particles at `[row, col]` with color, size, opacity, group |
| `clear_particles` | Yes | Deactivate by coords array, group name, or all |
| `connect` | Yes | Create line connections between particle positions |
| `disconnect` | Yes | Remove connections by ID array, endpoint pairs, or group |
| `create_animation` | Yes | Define an animation with keyframes |
| `modify_animation` | Yes | Add or update keyframes in an existing animation |
| `render_image` | No | Render current state to SVG or PNG |
| `render_video` | No | Encode an animation to MP4, WebM, or GIF |
| `snapshot` | No | Save current grid state under a named key |
| `restore` | Yes | Restore a previously saved named snapshot |
| `undo` | Yes | Revert the last mutating operation |

## API Overview

### `ToolExecutor`

```typescript
class ToolExecutor {
  constructor(config: { rows: number; cols: number; spacing: number });

  // Execute a tool call; returns structured result
  execute(toolName: string, params: Record<string, unknown>): ToolResult;

  // Get all tool definitions (for sending to an LLM)
  getToolDefinitions(): ToolDefinition[];

  // Access the underlying ParticleGrid directly
  getGrid(): ParticleGrid;
}
```

`ToolResult`:
```typescript
type ToolResult =
  | { success: true; data: unknown }
  | { success: false; error: string };
```

The undo stack is maintained automatically. Every mutating tool call pushes a snapshot before executing. Read-only tools (`get_state`, `get_space_info`, `render_image`, `render_video`) do not push to the undo stack. `undo` pops the last snapshot and restores it.

### `LLMProvider` interface

All provider packages implement this interface:

```typescript
interface LLMProvider {
  readonly name: string;

  // Convert tool definitions to provider-specific format
  formatTools(tools: ToolDefinition[]): unknown;

  // Stream messages and yield LLMEvents
  stream(
    messages: Message[],
    tools: ToolDefinition[],
    config?: ProviderConfig,
  ): AsyncIterable<LLMEvent>;
}

type LLMEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'tool_call_delta'; id: string; argumentsDelta: string }
  | { type: 'done'; usage: { inputTokens: number; outputTokens: number } }
  | { type: 'error'; error: Error };
```

### Tool definition format

Tool definitions follow JSON Schema, provider-agnostic. Each provider package translates them to the appropriate format:

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}
```

### Implementing a custom provider

```typescript
import type { LLMProvider, LLMEvent, Message, ToolDefinition } from '@particle-engine/tools';

class MyProvider implements LLMProvider {
  readonly name = 'my-provider';

  formatTools(tools: ToolDefinition[]): unknown {
    // Convert to provider-specific format
    return tools.map(t => ({ name: t.name, schema: t.parameters }));
  }

  async *stream(
    messages: Message[],
    tools: ToolDefinition[],
  ): AsyncIterable<LLMEvent> {
    // Call your LLM API and yield LLMEvents
    yield { type: 'text', content: 'Thinking...' };
    yield { type: 'tool_call', id: '1', name: 'get_space_info', arguments: {} };
    yield { type: 'done', usage: { inputTokens: 100, outputTokens: 50 } };
  }
}
```
