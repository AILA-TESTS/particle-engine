# @particle-engine/server

HTTP API server for the particle engine. Built with Hono, it exposes session management, direct tool execution, LLM conversation, and SVG rendering endpoints. Includes WebSocket support for real-time grid preview and optional disk persistence.

## Installation

```bash
pnpm add @particle-engine/server
```

## Basic Usage

```typescript
import { serve } from '@hono/node-server';
import { createApp } from '@particle-engine/server';
import { AnthropicProvider } from '@particle-engine/provider-anthropic';

const provider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const app = createApp({
  provider,
  defaultGridRows: 100,
  defaultGridCols: 100,
  defaultGridSpacing: 10,
});

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('Particle engine server on http://localhost:3000');
});
```

## Usage with WebSocket

```typescript
import { createServer } from 'http';
import { serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';
import { createAppWithWebSocket } from '@particle-engine/server';
import { GeminiProvider } from '@particle-engine/provider-gemini';

const provider = new GeminiProvider({ projectId: 'my-project' });

const { app, wsHandler } = createAppWithWebSocket({ provider });

const server = serve({ fetch: app.fetch, port: 3000 });
const wss = new WebSocketServer({ server: server as any });
wss.on('connection', (ws) => wsHandler(ws));
```

## With Session Persistence

```typescript
const app = createApp({
  provider,
  persistence: {
    enabled: true,
    directory: './sessions',  // JSON files written here
  },
});
```

## HTTP Endpoints

### Sessions

| Method | Path | Body | Response |
|--------|------|------|---------|
| `POST` | `/api/sessions` | `{ rows?, cols?, spacing? }` | `{ id, config, createdAt }` |
| `GET` | `/api/sessions` | — | `{ sessions: [...] }` |
| `GET` | `/api/sessions/:id` | — | `{ session, state }` |
| `DELETE` | `/api/sessions/:id` | — | `{ success: true }` |

### Tool execution

```
POST /api/sessions/:id/tool
{
  "tool": "set_particles",
  "params": {
    "particles": [{ "row": 10, "col": 20, "color": "#FF0000" }]
  }
}
```

Response: `{ result: { success: true, data: ... } }`

### LLM conversation

```
POST /api/sessions/:id/prompt
{
  "prompt": "Draw a triangle and animate it rotating",
  "config": { "temperature": 0.7 }
}
```

Response:
```json
{
  "messages": [...],
  "toolCallCount": 5,
  "usage": { "inputTokens": 1200, "outputTokens": 350 }
}
```

### Render

```
GET /api/sessions/:id/render
```

Returns an SVG string (`Content-Type: image/svg+xml`) of the current grid state.

## WebSocket Protocol

Connect to `ws://localhost:3000/ws/session/:id`.

### Client → Server messages

```typescript
// Send a prompt to the LLM
{ type: 'prompt', prompt: 'Draw a circle', config?: ProviderConfig }

// Execute a tool directly
{ type: 'tool', tool: 'set_particles', params: { particles: [...] } }

// Request current state
{ type: 'get_state' }
```

### Server → Client messages

```typescript
// Grid state update
{ type: 'state', state: SpaceState }

// LLM text streamed back
{ type: 'text', content: '...' }

// Tool call the LLM is making
{ type: 'tool_call', name: 'set_particles', arguments: {...} }

// Tool call result
{ type: 'tool_result', name: 'set_particles', result: {...} }

// Conversation complete
{ type: 'done', toolCallCount: 3, usage: {...} }

// Error
{ type: 'error', error: 'message' }
```

## API Overview

### `createApp(config?)`

Creates and returns a Hono app with all routes mounted.

### `createAppWithWebSocket(config?)`

Returns `{ app, sessionManager, wsHandler }`. The `wsHandler` is a function you call with each incoming `ws.WebSocket`.

### `ServerConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | `LLMProvider` | — | LLM provider instance |
| `defaultGridRows` | `number` | `100` | Default grid height |
| `defaultGridCols` | `number` | `100` | Default grid width |
| `defaultGridSpacing` | `number` | `10` | Pixel spacing between grid positions |
| `providerConfig` | `ProviderConfig` | — | Default provider config for all conversations |
| `persistence` | `PersistenceConfig` | — | Enable disk persistence for sessions |

### `SessionManager`

For programmatic session control without HTTP:

```typescript
import { SessionManager } from '@particle-engine/server';

const manager = new SessionManager({ rows: 50, cols: 50 });

const { id, session } = manager.createSession();
const data = manager.getSession(id);
// data.executor — ToolExecutor instance with full grid control
// data.session — session metadata

manager.deleteSession(id);
```

### `runConversation()`

The conversation loop used internally by the prompt endpoint:

```typescript
import { runConversation } from '@particle-engine/server';

const result = await runConversation(
  provider,
  executor,
  messages,
  tools,
  providerConfig,
);
// result.messages — full conversation history
// result.toolCallCount — total tool calls made
// result.usage — combined token usage
```

### `buildSystemPrompt()`

Generates the system prompt from grid info:

```typescript
import { buildSystemPrompt } from '@particle-engine/server';

const prompt = buildSystemPrompt(grid.getSpaceInfo());
```
