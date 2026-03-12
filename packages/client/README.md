# @particle-engine/client

Browser preview application for the particle engine. A Vite-based vanilla TypeScript web app with a dark UI, live canvas grid rendering, a prompt input for LLM interaction, a tool call log, and status indicators.

Also exports `ApiClient`, `WebSocketClient`, `GridRenderer`, and `UI` as reusable TypeScript classes for building custom browser integrations.

## Running the App

```bash
cd packages/client
pnpm dev       # dev server on http://localhost:5173
pnpm build     # production build to dist/
pnpm preview   # preview production build
```

The app expects the particle engine server running at `http://localhost:3000`. Start the server first:

```bash
# From the repo root
cd packages/server
node dist/index.js   # or your server entry point
```

## Using the Exported Classes

### `ApiClient`

Typed HTTP client for the server REST API:

```typescript
import { ApiClient } from '@particle-engine/client';

const client = new ApiClient({ baseUrl: 'http://localhost:3000' });

// Create a session
const session = await client.createSession({ rows: 100, cols: 100 });
console.log(session.id);

// Execute a tool call
const result = await client.executeTool(session.id, 'set_particles', {
  particles: [{ row: 10, col: 20, color: '#FF6B6B' }],
});

// Send a prompt to the LLM
const response = await client.sendPrompt(session.id, 'Draw a hexagon');
console.log(response.toolCallCount, 'tool calls made');

// Get SVG render
const svg = await client.renderSVG(session.id);
document.getElementById('preview')!.innerHTML = svg;
```

### `WebSocketClient`

Real-time WebSocket client with typed event handlers:

```typescript
import { WebSocketClient } from '@particle-engine/client';

const ws = new WebSocketClient({
  url: 'ws://localhost:3000/ws/session/SESSION_ID',
  handlers: {
    onState: (state) => {
      console.log('Grid updated:', state.summary.active_count, 'particles');
    },
    onText: (content) => {
      process.stdout.write(content);
    },
    onToolCall: ({ name, arguments: args }) => {
      console.log(`LLM calling: ${name}`);
    },
    onDone: ({ toolCallCount, usage }) => {
      console.log(`Done. ${toolCallCount} tool calls, ${usage.outputTokens} output tokens`);
    },
    onError: (error) => {
      console.error('WS error:', error);
    },
  },
});

ws.connect();

// Send a prompt via WebSocket
ws.sendPrompt('Animate a bouncing ball');

// Execute a tool directly via WebSocket
ws.executeTool('clear_particles', {});

ws.disconnect();
```

### `GridRenderer`

Renders a `SpaceState` onto a canvas element using `@particle-engine/renderer-canvas`:

```typescript
import { GridRenderer } from '@particle-engine/client';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const renderer = new GridRenderer(canvas);

// Render a state
renderer.render(state, {
  width: canvas.clientWidth,
  height: canvas.clientHeight,
  backgroundColor: '#1a1a2e',
  pixelRatio: window.devicePixelRatio,
});
```

### `UI`

Manages the full app UI (prompt input, tool log, status bar):

```typescript
import { UI } from '@particle-engine/client';

const ui = new UI({
  promptInput: document.getElementById('prompt') as HTMLInputElement,
  sendButton: document.getElementById('send') as HTMLButtonElement,
  toolLog: document.getElementById('tool-log') as HTMLElement,
  statusBar: document.getElementById('status') as HTMLElement,
  onPrompt: async (prompt) => {
    // Handle prompt submission
  },
});

ui.setStatus('Connected');
ui.appendToolLog({ name: 'set_particles', arguments: { particles: [] } });
```

## API Overview

### `ClientConfig`

```typescript
interface ClientConfig {
  baseUrl: string;   // Server base URL, e.g. 'http://localhost:3000'
}
```

### `WSClientConfig`

```typescript
interface WSClientConfig {
  url: string;                    // WebSocket URL
  handlers: WSEventHandlers;
  reconnectDelay?: number;        // ms before reconnect on disconnect (default: 2000)
  maxReconnectAttempts?: number;  // 0 = unlimited (default: 0)
}
```

### `WSEventHandlers`

```typescript
interface WSEventHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onState?: (state: SpaceState) => void;
  onText?: (content: string) => void;
  onToolCall?: (call: PromptToolCall) => void;
  onToolResult?: (result: PromptToolResult) => void;
  onDone?: (result: { toolCallCount: number; usage: {...} }) => void;
  onError?: (error: string) => void;
}
```
