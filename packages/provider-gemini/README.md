# @particle-engine/provider-gemini

Google Gemini LLM provider for the particle engine. Implements the `LLMProvider` interface and supports two authentication modes: Vertex AI (GCP service account / ADC) and API key (Google Generative AI API).

## Installation

```bash
pnpm add @particle-engine/provider-gemini
```

## Usage

### Vertex AI mode (recommended for production)

Uses Application Default Credentials (ADC) — set up with `gcloud auth application-default login` or a service account.

```typescript
import { GeminiProvider } from '@particle-engine/provider-gemini';

const provider = new GeminiProvider({
  projectId: 'my-gcp-project',
  location: 'us-central1',          // optional, defaults to 'us-central1'
  modelId: 'gemini-2.0-flash',      // optional, this is the default
});
```

### API key mode

```typescript
import { GeminiProvider } from '@particle-engine/provider-gemini';

const provider = new GeminiProvider({
  apiKey: process.env.GOOGLE_API_KEY!,
  modelId: 'gemini-2.0-flash',
});
```

### Using with the server

```typescript
import { serve } from '@hono/node-server';
import { createApp } from '@particle-engine/server';
import { GeminiProvider } from '@particle-engine/provider-gemini';

const provider = new GeminiProvider({
  projectId: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
});

const app = createApp({ provider });
serve({ fetch: app.fetch, port: 3000 });
```

### Streaming tool calls directly

```typescript
import { GeminiProvider } from '@particle-engine/provider-gemini';
import type { Message } from '@particle-engine/provider-gemini';

const provider = new GeminiProvider({ apiKey: process.env.GOOGLE_API_KEY! });

const messages: Message[] = [
  { role: 'user', content: 'Draw a circle of particles' },
];

for await (const event of provider.stream(messages, toolDefinitions)) {
  if (event.type === 'text') {
    process.stdout.write(event.content);
  } else if (event.type === 'tool_call') {
    console.log(`Tool: ${event.name}`, event.arguments);
  } else if (event.type === 'done') {
    console.log('Tokens used:', event.usage);
  }
}
```

## API Overview

### `GeminiProvider`

```typescript
class GeminiProvider implements LLMProvider {
  readonly name: 'gemini';

  constructor(config: GeminiProviderConfig, defaultConfig?: ProviderConfig);

  formatTools(tools: ToolDefinition[]): unknown;

  stream(
    messages: Message[],
    tools: ToolDefinition[],
    config?: ProviderConfig,
  ): AsyncIterable<LLMEvent>;
}
```

### `GeminiProviderConfig`

| Field | Type | Description |
|-------|------|-------------|
| `modelId` | `string` | Model ID (default: `'gemini-2.0-flash'`) |
| `authMode` | `'apiKey' \| 'vertexai'` | Auth mode (auto-detected if not set) |
| `apiKey` | `string` | Google Generative AI API key (API key mode) |
| `projectId` | `string` | GCP project ID (Vertex AI mode) |
| `location` | `string` | GCP region (Vertex AI mode, default: `'us-central1'`) |

Auth mode is auto-detected: if `apiKey` is set it uses API key mode; if `projectId` is set it uses Vertex AI mode.

### `ProviderConfig` (runtime overrides)

```typescript
interface ProviderConfig {
  temperature?: number;        // 0.0–2.0
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
}
```

## Supported Models

Any Gemini model accessible via Vertex AI or the Generative AI API:

- `gemini-2.0-flash` (default — fast, cost-effective)
- `gemini-2.0-pro`
- `gemini-1.5-pro`
- `gemini-1.5-flash`

## Environment Variables

| Variable | Mode | Description |
|----------|------|-------------|
| `GOOGLE_API_KEY` | API key | Google Generative AI API key |
| `GOOGLE_CLOUD_PROJECT` | Vertex AI | GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | Vertex AI | GCP region |
| `GOOGLE_APPLICATION_CREDENTIALS` | Vertex AI | Path to service account JSON (if not using ADC) |
