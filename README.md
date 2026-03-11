# particle-engine

A particle system foundation for LLM-driven visual creation. LLMs place particles on a bounded 2D integer grid, connect them with lines, define keyframe animations, and render to SVG, Canvas, or video — all through structured tool calls, never by generating code.

## Architecture

```
+----------------------------------------------------------------------+
|                         LLM Provider Layer                           |
|  +-------------------+  +---------------------+  +-----------------+ |
|  | provider-gemini   |  | provider-anthropic  |  | provider-openai | |
|  +--------+----------+  +----------+----------+  +--------+--------+ |
|           |                        |                       |          |
|           +------------+-----------+-----------+           |          |
|                        |                                              |
|                +-------v--------+                                     |
|                |     tools      |  <-- 13 LLM tools + ToolExecutor   |
|                +-------+--------+                                     |
+----------------------------------------------------------------------+
                         |
+----------------------------------------------------------------------+
|                          Engine Layer                                |
|                +-------v--------+                                    |
|                |      core      |  <-- ParticleGrid, connections     |
|                +---+--------+---+                                    |
|                    |        |                                         |
|          +---------+        +---------+                              |
|          |                            |                              |
|  +-------v------+            +--------v-----+                        |
|  |  animation   |            |  snapshots   |                        |
|  |  keyframes   |            |  undo/redo   |                        |
|  |  easing/OKLAB|            +--------------+                        |
|  +---------+----+                                                    |
+----------------------------------------------------------------------+
                         |
+----------------------------------------------------------------------+
|                        Rendering Layer                               |
|          +------------+------------+                                 |
|          |            |            |                                 |
|  +-------v--+  +------v---+  +----v-----+                           |
|  |renderer  |  |renderer  |  |renderer  |                           |
|  |  -svg    |  | -canvas  |  |  -webgl  |                           |
|  +----------+  +----+-----+  +----------+                           |
|                     |                                                |
|             +-------v--------+                                       |
|             |     video      |  <-- FFmpeg encoding pipeline        |
|             +----------------+                                       |
+----------------------------------------------------------------------+
                         |
+----------------------------------------------------------------------+
|                       Application Layer                              |
|          +------------+------------+                                 |
|          |                         |                                 |
|  +-------v--------+      +---------v------+                         |
|  |     server     |      |     client     |                         |
|  | HTTP API + WS  |      | Browser UI     |                         |
|  +----------------+      +----------------+                         |
+----------------------------------------------------------------------+
```

## Features

- **LLM-native API** — 13 structured tool calls replace code generation; LLMs interact with a clean JSON state
- **Pure integer grid** — Particles addressed by `[row, col]`; deterministic and unambiguous
- **Sparse state** — Only active particles and connections are serialized; minimizes LLM token usage
- **Keyframe animation** — LLM defines a handful of keyframes; engine interpolates hundreds of frames
- **OKLAB color interpolation** — Perceptually correct color transitions
- **Spring physics easing** — Physically realistic motion curves with precomputed LUTs
- **31 Penner easing functions** — Complete standard set plus cubic bezier and step easing
- **Multi-tier rendering** — SVG for simple scenes, Canvas for medium, WebGL for large
- **Video output** — FFmpeg pipeline renders MP4, WebM, and GIF from canvas frames
- **Provider-agnostic** — Gemini (Vertex AI or API key), Claude, and OpenAI are interchangeable
- **Undo stack** — Automatic state snapshots before each mutating tool call
- **Named snapshots** — LLM can save and restore named checkpoints
- **Zero-dependency core** — `@particle-engine/core` has no external dependencies
- **Isomorphic canvas renderer** — Works in Node.js and browsers via injected context
- **pnpm monorepo** — 12 independent packages, each with its own tests

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Build all packages

```bash
pnpm build
```

### 3. Start the server

```typescript
// server.ts
import { serve } from '@hono/node-server';
import { createApp } from '@particle-engine/server';
import { AnthropicProvider } from '@particle-engine/provider-anthropic';

const provider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  modelId: 'claude-sonnet-4-20250514',
});

const app = createApp({ provider });

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('Server running on http://localhost:3000');
});
```

### 4. Send a prompt

```bash
# Create a session
curl -X POST http://localhost:3000/api/sessions

# Send a prompt to the LLM (replace SESSION_ID)
curl -X POST http://localhost:3000/api/sessions/SESSION_ID/prompt \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "Draw a triangle using particles and connect the vertices"}'

# Get the SVG render
curl http://localhost:3000/api/sessions/SESSION_ID/render
```

### 5. Open the client

```bash
cd packages/client
pnpm dev
# Opens http://localhost:5173
```

## Package Overview

| Package | Description | Tests |
|---------|-------------|-------|
| `@particle-engine/core` | ParticleGrid, SoA typed arrays, connections, serialization, snapshots | 100 |
| `@particle-engine/animation` | Keyframe engine, 31 easings, OKLAB color, spring physics, bilinear distribution | 198 |
| `@particle-engine/tools` | 13 LLM tool definitions, ToolExecutor, zod validation, undo stack | 62 |
| `@particle-engine/renderer-svg` | Pure SVG string output, zero dependencies | 80 |
| `@particle-engine/renderer-canvas` | Isomorphic Canvas 2D renderer (browser + Node) | 66 |
| `@particle-engine/renderer-webgl` | WebGL instanced rendering for large scenes (scaffold) | — |
| `@particle-engine/video` | FFmpeg pipeline: animation frames → MP4/WebM/GIF | 63 |
| `@particle-engine/provider-gemini` | Google Gemini via Vertex AI SDK or API key | 34 |
| `@particle-engine/provider-anthropic` | Anthropic Claude via `@anthropic-ai/sdk` | 43 |
| `@particle-engine/provider-openai` | OpenAI GPT via `openai` SDK | 48 |
| `@particle-engine/server` | Hono HTTP API, session management, conversation loop, WebSocket | 52 |
| `@particle-engine/client` | Vite browser app, canvas grid preview, prompt input | 20 |
| **Total** | | **766** |

## How LLM Interaction Works

The LLM never generates code. It interacts with the particle grid exclusively through structured tool calls.

### The 13 tools

| Tool | Purpose |
|------|---------|
| `get_space_info` | Read grid dimensions and active particle/connection counts |
| `get_state` | Read active particles and connections, with optional region or group filter |
| `set_particles` | Activate particles at `[row, col]` coordinates with color, size, opacity |
| `clear_particles` | Deactivate particles by coordinates, group name, or all at once |
| `connect` | Create line connections between particle positions |
| `disconnect` | Remove connections by ID or endpoints |
| `create_animation` | Define an animation with keyframes and easing |
| `modify_animation` | Add or update keyframes in an existing animation |
| `render_image` | Render the current grid state to SVG or PNG |
| `render_video` | Encode an animation to MP4, WebM, or GIF via FFmpeg |
| `snapshot` | Save current state under a named key |
| `restore` | Restore a previously saved named snapshot |
| `undo` | Revert the last mutating operation |

### End-to-end flow

```
User prompt: "Draw a rotating triangle"
       |
Server builds system prompt with grid dimensions and sends to LLM
       |
LLM calls: set_particles([{row:20, col:50}, {row:50, col:20}, {row:50, col:80}])
       |
LLM calls: connect([{from:[20,50], to:[50,20]}, {from:[50,20], to:[50,80]}, ...])
       |
LLM calls: create_animation({ duration: 3000, fps: 30, keyframes: [...] })
       |
LLM calls: render_video({ format: "mp4", animation_id: "anim_1" })
       |
FrameGenerator interpolates 90 frames (30fps × 3s)
       |
CanvasRenderer draws each frame to a pixel buffer
       |
FFmpeg encodes frames → triangle.mp4
       |
Video path returned to user
```

### Conversation loop

Each prompt runs a multi-round tool-use loop:

1. LLM receives system prompt (grid context) + user message
2. LLM responds with tool calls
3. Server executes tool calls via `ToolExecutor`
4. Results are appended to the conversation
5. LLM continues calling tools until it sends no more tool calls
6. Final state is persisted to the session

## Configuration

### Environment variables

| Variable | Provider | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | `provider-anthropic` | Anthropic API key |
| `OPENAI_API_KEY` | `provider-openai` | OpenAI API key |
| `GOOGLE_API_KEY` | `provider-gemini` (API key mode) | Google Generative AI API key |
| `GOOGLE_CLOUD_PROJECT` | `provider-gemini` (Vertex AI mode) | GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | `provider-gemini` (Vertex AI mode) | GCP region (default: `us-central1`) |

### Server configuration

```typescript
import { createApp } from '@particle-engine/server';

const app = createApp({
  port: 3000,                // HTTP port (used if you call serve() yourself)
  provider,                  // LLMProvider instance
  defaultGridRows: 100,      // default grid height (particles)
  defaultGridCols: 100,      // default grid width (particles)
  defaultGridSpacing: 10,    // pixel distance between adjacent grid positions
  persistence: {
    enabled: true,
    directory: './sessions', // directory for persisted session JSON files
  },
});
```

### Provider selection

Swap providers by changing one constructor call — the server and conversation loop accept any `LLMProvider`:

```typescript
// Gemini via Vertex AI
import { GeminiProvider } from '@particle-engine/provider-gemini';
const provider = new GeminiProvider({ projectId: 'my-gcp-project', location: 'us-central1' });

// Gemini via API key
const provider = new GeminiProvider({ apiKey: process.env.GOOGLE_API_KEY });

// Claude
import { AnthropicProvider } from '@particle-engine/provider-anthropic';
const provider = new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY });

// OpenAI
import { OpenAIProvider } from '@particle-engine/provider-openai';
const provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY });
```

## Development

### Prerequisites

- Node.js 22+
- pnpm 10+
- FFmpeg (for video generation)

### Commands

```bash
# Install dependencies
pnpm install

# Build all packages (respects dependency order via turborepo)
pnpm build

# Run all tests
pnpm test

# Run tests for a single package
cd packages/core && pnpm test

# Lint and format check
pnpm lint

# Auto-fix lint issues
pnpm lint:fix

# Clean build artifacts
pnpm clean
```

### Adding a new package

1. Create `packages/<name>/package.json` with `"name": "@particle-engine/<name>"`
2. Add the package to `pnpm-workspace.yaml`
3. List it in `turbo.json` if it has build or test tasks
4. Implement `src/index.ts` as the public API boundary

### Dependency graph

```
core  ←  animation  ←  tools  ←  provider-*
 ↑             ↑           ↑
renderer-*   video       server  ←  client
```

## HTTP API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sessions` | Create a new session |
| `GET` | `/api/sessions` | List all sessions |
| `GET` | `/api/sessions/:id` | Get session state |
| `DELETE` | `/api/sessions/:id` | Delete a session |
| `POST` | `/api/sessions/:id/tool` | Execute a tool call directly |
| `POST` | `/api/sessions/:id/prompt` | Send a prompt to the LLM |
| `GET` | `/api/sessions/:id/render` | Render current state as SVG |

WebSocket connections are handled at `ws://localhost:3000/ws/session/:id`.

## License

MIT
