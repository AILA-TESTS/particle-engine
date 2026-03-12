# @particle-engine/provider-openai

OpenAI LLM provider for the particle engine. Implements the `LLMProvider` interface using the `openai` SDK with streaming function calls. Also compatible with OpenAI-compatible APIs such as Azure OpenAI and local models via custom `baseURL`.

## Installation

```bash
pnpm add @particle-engine/provider-openai
```

## Usage

### Basic setup

```typescript
import { OpenAIProvider } from '@particle-engine/provider-openai';

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  modelId: 'gpt-4o',   // optional, this is the default
});
```

### Azure OpenAI

```typescript
const provider = new OpenAIProvider({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  baseURL: 'https://my-resource.openai.azure.com/openai/deployments/my-deployment',
  modelId: 'gpt-4o',
});
```

### Using with the server

```typescript
import { serve } from '@hono/node-server';
import { createApp } from '@particle-engine/server';
import { OpenAIProvider } from '@particle-engine/provider-openai';

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
});

const app = createApp({ provider });
serve({ fetch: app.fetch, port: 3000 });
```

### Streaming tool calls directly

```typescript
import { OpenAIProvider } from '@particle-engine/provider-openai';
import type { Message } from '@particle-engine/provider-openai';

const provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! });

const messages: Message[] = [
  { role: 'system', content: 'You control a 100×100 particle grid...' },
  { role: 'user', content: 'Create a star shape with 5 points' },
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
      console.log(`Tokens: ${event.usage.inputTokens} in, ${event.usage.outputTokens} out`);
      break;
  }
}
```

## API Overview

### `OpenAIProvider`

```typescript
class OpenAIProvider implements LLMProvider {
  readonly name: 'openai';

  constructor(config: OpenAIProviderConfig, defaultConfig?: ProviderConfig);

  formatTools(tools: ToolDefinition[]): unknown;

  stream(
    messages: Message[],
    tools: ToolDefinition[],
    config?: ProviderConfig,
  ): AsyncIterable<LLMEvent>;
}
```

### `OpenAIProviderConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `apiKey` | `string` | required | OpenAI API key |
| `modelId` | `string` | `'gpt-4o'` | Model ID |
| `baseURL` | `string` | — | Custom API endpoint (Azure, local, etc.) |
| `organization` | `string` | — | OpenAI organization ID |

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

Any OpenAI model that supports function calling / tool use:

- `gpt-4o` (default)
- `gpt-4o-mini`
- `gpt-4-turbo`
- `o1`, `o3` (if tool use is supported in your API tier)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
