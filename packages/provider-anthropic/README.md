# @particle-engine/provider-anthropic

Anthropic Claude LLM provider for the particle engine. Implements the `LLMProvider` interface using `@anthropic-ai/sdk` with streaming tool use.

## Installation

```bash
pnpm add @particle-engine/provider-anthropic
```

## Usage

### Basic setup

```typescript
import { AnthropicProvider } from '@particle-engine/provider-anthropic';

const provider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  modelId: 'claude-sonnet-4-20250514',  // optional, this is the default
  maxTokens: 4096,                       // optional, defaults to 4096
});
```

### Using with the server

```typescript
import { serve } from '@hono/node-server';
import { createApp } from '@particle-engine/server';
import { AnthropicProvider } from '@particle-engine/provider-anthropic';

const provider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const app = createApp({ provider });
serve({ fetch: app.fetch, port: 3000 });
```

### Streaming tool calls directly

```typescript
import { AnthropicProvider } from '@particle-engine/provider-anthropic';
import type { Message } from '@particle-engine/provider-anthropic';

const provider = new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY! });

const messages: Message[] = [
  { role: 'system', content: 'You control a 100×100 particle grid...' },
  { role: 'user', content: 'Draw a spiral pattern' },
];

for await (const event of provider.stream(messages, toolDefinitions)) {
  switch (event.type) {
    case 'text':
      process.stdout.write(event.content);
      break;
    case 'tool_call':
      console.log(`Calling ${event.name} with`, event.arguments);
      break;
    case 'done':
      console.log(`Input tokens: ${event.usage.inputTokens}`);
      console.log(`Output tokens: ${event.usage.outputTokens}`);
      break;
    case 'error':
      console.error('Provider error:', event.error);
      break;
  }
}
```

## API Overview

### `AnthropicProvider`

```typescript
class AnthropicProvider implements LLMProvider {
  readonly name: 'anthropic';

  constructor(config: AnthropicProviderConfig);

  formatTools(tools: ToolDefinition[]): unknown;

  stream(
    messages: Message[],
    tools: ToolDefinition[],
    config?: ProviderConfig,
  ): AsyncIterable<LLMEvent>;
}
```

### `AnthropicProviderConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `apiKey` | `string` | required | Anthropic API key |
| `modelId` | `string` | `'claude-sonnet-4-20250514'` | Claude model ID |
| `maxTokens` | `number` | `4096` | Maximum output tokens |
| `baseURL` | `string` | — | Custom API endpoint |

### `ProviderConfig` (runtime overrides per call)

```typescript
interface ProviderConfig {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  stopSequences?: string[];
}
```

## Supported Models

Any Claude model that supports tool use:

- `claude-opus-4-20250514`
- `claude-sonnet-4-20250514` (default)
- `claude-haiku-4-20250514`
- `claude-3-5-sonnet-20241022`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
