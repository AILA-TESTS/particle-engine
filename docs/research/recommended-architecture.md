# Recommended Architecture: Particle Engine

> Synthesized from research conducted 2026-03-11
> See `particle-system-research.md` for detailed research and sources.

---

## Executive Summary

The particle engine is a **bounded 2D grid of addressable particles** that an LLM controls through **structured function calls** (not code generation). The LLM can activate particles, connect them with lines, read the full state, and define animations as keyframe sequences. The system is built in **TypeScript**, runs isomorphically (server + browser), and treats the LLM provider as a swappable module.

---

## Core Design Principles

1. **Data over code.** The LLM sends structured JSON commands, never generates code.
2. **Grid-first addressing.** Particles are addressed by `[row, col]` integer coordinates.
3. **Sparse by default.** Only active particles and connections are stored and transmitted.
4. **Keyframe animation.** The LLM defines key states; the engine interpolates frames.
5. **Ultra-modular.** Every component is an independent package with explicit dependencies.
6. **Provider-agnostic.** Switching from Gemini to Claude to GPT requires changing one config value.
7. **Multi-tier rendering.** SVG for simple, Canvas for medium, WebGL for heavy scenes.

---

## System Architecture

```
+------------------------------------------------------------------+
|                        LLM Provider Layer                        |
|  +------------------+  +------------------+  +----------------+  |
|  | provider-gemini  |  | provider-anthropic|  | provider-openai|  |
|  +--------+---------+  +--------+---------+  +-------+--------+  |
|           |                     |                     |           |
|           +----------+----------+----------+----------+           |
|                      |                                            |
|              +-------v--------+                                   |
|              |   tools (API)  |  <-- Tool definitions & executor  |
|              +-------+--------+                                   |
|                      |                                            |
+------------------------------------------------------------------+
                       |
+------------------------------------------------------------------+
|                        Engine Layer                               |
|                      |                                            |
|              +-------v--------+                                   |
|              |      core      |  <-- Grid, particles, connections |
|              +---+--------+---+                                   |
|                  |        |                                       |
|          +-------+        +--------+                              |
|          |                         |                               |
|  +-------v-----+           +------v------+                       |
|  |  animation  |           |    state    |                       |
|  |  keyframes  |           |  snapshots  |                       |
|  |  interp.    |           |  undo/redo  |                       |
|  |  easing     |           +-------------+                       |
|  +------+------+                                                 |
|                      |                                            |
+------------------------------------------------------------------+
                       |
+------------------------------------------------------------------+
|                      Rendering Layer                              |
|                      |                                            |
|          +-----------+-----------+                                 |
|          |           |           |                                 |
|  +-------v--+  +----v----+  +---v------+                          |
|  |renderer  |  |renderer |  |renderer  |                          |
|  |  -svg    |  | -canvas |  |  -webgl  |                          |
|  +----------+  +---------+  +----------+                          |
|                      |                                            |
|              +-------v--------+                                   |
|              |     video      |  <-- FFmpeg encoding              |
|              +----------------+                                   |
|                                                                   |
+------------------------------------------------------------------+
                       |
+------------------------------------------------------------------+
|                     Application Layer                             |
|                      |                                            |
|          +-----------+-----------+                                 |
|          |                       |                                 |
|  +-------v--------+    +--------v-------+                         |
|  |     server     |    |     client     |                         |
|  | (HTTP API,     |    | (Browser UI,   |                         |
|  |  batch render) |    |  live preview) |                         |
|  +----------------+    +----------------+                         |
|                                                                   |
+------------------------------------------------------------------+
```

---

## Package Breakdown

### `packages/core` -- Particle Grid Engine

**Dependencies:** None (zero external dependencies)

**Responsibilities:**
- Grid initialization and configuration
- Particle state management (activate, deactivate, modify properties)
- Connection management (add, remove, query)
- State serialization/deserialization to JSON
- Bounds validation
- Neighbor queries

**Key Data Structures:**

```typescript
// Grid configuration
interface GridConfig {
  rows: number;          // e.g., 100
  cols: number;          // e.g., 100
  spacing: number;       // pixel distance between particles
  origin: { x: number; y: number };  // top-left corner in pixel space
}

// Particle storage -- Hybrid Grid Index + Flat Arrays
interface ParticleStore {
  config: GridConfig;

  // Flat typed arrays (SoA layout for performance)
  active: Uint8Array;       // 0 or 1
  colorR: Uint8Array;       // 0-255
  colorG: Uint8Array;       // 0-255
  colorB: Uint8Array;       // 0-255
  opacity: Float32Array;    // 0.0-1.0
  size: Float32Array;       // multiplier
  layer: Int16Array;        // z-index
  group: Uint16Array;       // group ID (0 = ungrouped)

  // Index helpers
  toIndex(row: number, col: number): number;   // row * cols + col
  toRowCol(index: number): [number, number];   // [Math.floor(i/cols), i%cols]
}

// Connection storage -- Edge list + Adjacency map
interface ConnectionStore {
  edges: Map<string, Connection>;              // id -> connection
  adjacency: Map<number, Set<string>>;         // particle index -> connection ids
}

// Serialized state for LLM consumption
interface SpaceState {
  grid: { rows: number; cols: number; spacing: number };
  summary: { active_count: number; connection_count: number; groups: string[] };
  particles: SerializedParticle[];             // only active particles
  connections: SerializedConnection[];
}
```

**Why this design:**
- Typed arrays give 30% better cache performance for batch operations (rendering, animation)
- Grid indexing gives O(1) lookup by coordinates
- Sparse serialization keeps LLM token usage minimal
- Zero dependencies means it can run anywhere (Node, browser, Deno, edge)

---

### `packages/animation` -- Keyframe & Interpolation System

**Dependencies:** `core`

**Responsibilities:**
- Keyframe timeline management
- Property interpolation (color, opacity, size)
- Easing function library
- Discrete event scheduling (particle add/remove, connection add/remove)
- Frame generation from keyframe sequences

**Key Architecture:**

```typescript
interface Animation {
  id: string;
  duration: number;        // milliseconds
  fps: number;             // frames per second
  keyframes: Keyframe[];   // sorted by time
  events: DiscreteEvent[]; // sorted by time
}

interface Keyframe {
  time: number;            // milliseconds from start
  easing: EasingFunction;  // how to interpolate TO this keyframe
  particles: ParticleDelta[];   // particles to set/modify at this keyframe
  connections: ConnectionDelta[];
}

interface DiscreteEvent {
  time: number;
  action: 'add_particle' | 'remove_particle' | 'add_connection' | 'remove_connection';
  params: Record<string, unknown>;
}

// Frame generator
class FrameGenerator {
  generate(animation: Animation, store: ParticleStore): Iterator<FrameState> {
    const totalFrames = Math.ceil(animation.duration / 1000 * animation.fps);
    for (let frame = 0; frame < totalFrames; frame++) {
      const time = (frame / animation.fps) * 1000;
      // Apply discrete events up to this time
      // Interpolate between surrounding keyframes
      // Yield the computed frame state
      yield computeFrame(animation, store, time);
    }
  }
}
```

**Interpolation approach (from Manim):**
- Each frame computed via alpha value [0.0, 1.0] between surrounding keyframes
- Alpha modified by easing function before application
- Color interpolated in HSL space for perceptually smooth transitions
- Discrete properties (active, group, style) applied at exact event time

> **Note:** The interpolation system is undergoing deep research and will be documented separately.

**Supported easing functions:**
- Linear, Quad (In/Out/InOut), Cubic, Quart, Quint
- Sine, Expo, Circ, Back, Elastic, Bounce
- Custom bezier via `bezier-easing` library

---

### `packages/renderer-svg`, `renderer-canvas`, `renderer-webgl`

**Dependencies:** `core`

Each renderer implements a common interface:

```typescript
interface Renderer {
  initialize(config: RenderConfig): void;
  renderFrame(state: FrameState): RenderOutput;
  dispose(): void;
}

interface RenderConfig {
  width: number;
  height: number;
  backgroundColor: string;
  antialiasing: boolean;
  pixelRatio: number;
}

type RenderOutput = {
  type: 'svg';
  svg: string;
} | {
  type: 'canvas';
  buffer: Buffer | ImageData;
} | {
  type: 'webgl';
  buffer: Buffer | ImageData;
};
```

**Auto-selection logic:**

```typescript
function selectRenderer(particleCount: number, connectionCount: number): Renderer {
  const totalElements = particleCount + connectionCount;
  if (totalElements < 5_000) return new SVGRenderer();
  if (totalElements < 50_000) return new CanvasRenderer();
  return new WebGLRenderer();
}
```

**SVG Renderer** generates clean SVG markup. Ideal for static images, exports, and small animations. Each particle is a `<circle>`, each connection is a `<line>` or `<path>`.

**Canvas Renderer** uses `CanvasRenderingContext2D` (or `node-canvas` on server). Draws particles as filled arcs, connections as stroked paths. Supports OffscreenCanvas for non-blocking rendering.

**WebGL Renderer** uses instanced rendering. Particles rendered as point sprites (single draw call for all particles). Connections rendered as GL_LINES. Attributes (position, color, size) uploaded as typed array buffers matching the core SoA layout directly (zero-copy when possible).

---

### `packages/video` -- Video Generation

**Dependencies:** `animation`, `renderer-canvas` (or `renderer-webgl`)

**Pipeline:**

```
Animation -> FrameGenerator -> Renderer -> FFmpeg stdin pipe -> Video file
```

```typescript
class VideoGenerator {
  async generate(animation: Animation, store: ParticleStore, options: VideoOptions): Promise<string> {
    const renderer = new CanvasRenderer();
    const frames = new FrameGenerator().generate(animation, store);

    const ffmpeg = spawn('ffmpeg', [
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-s', `${options.width}x${options.height}`,
      '-r', String(animation.fps),
      '-i', 'pipe:0',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      options.outputPath
    ]);

    for (const frame of frames) {
      const rendered = renderer.renderFrame(frame);
      ffmpeg.stdin.write(rendered.buffer);
    }

    ffmpeg.stdin.end();
    return options.outputPath;
  }
}
```

---

### `packages/tools` -- LLM Tool Definitions & Executor

**Dependencies:** `core`, `animation`

This is the **LLM-facing API layer**. It defines the tools the LLM can call and executes them against the particle store.

**Tool count:** 13 tools (well under the recommended ~20 limit)

| # | Tool | Purpose |
|---|------|---------|
| 1 | `get_space_info` | Get grid dimensions and summary statistics |
| 2 | `get_state` | Get active particles and connections (with optional region/group filter) |
| 3 | `set_particles` | Activate/modify particles at specified coordinates |
| 4 | `clear_particles` | Deactivate particles (by coords, group, or all) |
| 5 | `connect` | Create line connections between particles |
| 6 | `disconnect` | Remove connections |
| 7 | `create_animation` | Define an animation with keyframes |
| 8 | `modify_animation` | Add/modify keyframes in an existing animation |
| 9 | `render_image` | Render current state to PNG/SVG |
| 10 | `render_video` | Render animation to MP4/WebM/GIF |
| 11 | `snapshot` | Save named state snapshot |
| 12 | `restore` | Restore named state snapshot |
| 13 | `undo` | Undo last operation |

**Tool definition format** (provider-agnostic JSON Schema):

```typescript
const tools: ToolDefinition[] = [
  {
    name: "set_particles",
    description: "Activate and configure one or more particles at specified grid coordinates. Each particle is addressed by row and column.",
    parameters: {
      type: "object",
      properties: {
        particles: {
          type: "array",
          description: "Array of particles to set",
          items: {
            type: "object",
            properties: {
              row: { type: "integer", description: "Grid row (0-indexed)" },
              col: { type: "integer", description: "Grid column (0-indexed)" },
              color: { type: "string", description: "Hex color, e.g. '#FF0000'", default: "#FFFFFF" },
              size: { type: "number", description: "Size multiplier (1.0 = default)", default: 1.0 },
              opacity: { type: "number", description: "Opacity 0.0-1.0", default: 1.0 },
              group: { type: "string", description: "Group name for bulk operations" }
            },
            required: ["row", "col"]
          }
        }
      },
      required: ["particles"]
    }
  },
  // ... other tool definitions follow the same pattern
];
```

**Execution model:**

```typescript
class ToolExecutor {
  private store: ParticleStore;
  private connectionStore: ConnectionStore;
  private history: StateSnapshot[];  // for undo

  async execute(toolName: string, params: unknown): Promise<ToolResult> {
    // 1. Validate params against schema (using zod)
    const validated = this.validate(toolName, params);
    if (validated.error) return { success: false, error: validated.error };

    // 2. Save snapshot for undo
    this.history.push(this.snapshot());

    // 3. Execute
    const result = this.handlers[toolName](validated.data);

    // 4. Return structured result
    return { success: true, data: result };
  }
}
```

---

### `packages/provider-gemini`, `provider-anthropic`, `provider-openai`

**Dependencies:** `tools`

Each provider package implements the `LLMProvider` interface:

```typescript
interface LLMProvider {
  readonly name: string;

  // Convert our tool definitions to provider-specific format
  formatTools(tools: ToolDefinition[]): unknown;

  // Send messages and receive events (streaming)
  stream(
    messages: Message[],
    tools: ToolDefinition[],
    config?: ProviderConfig
  ): AsyncIterable<LLMEvent>;

  // Parse a raw tool call from provider response
  parseToolCall(raw: unknown): { name: string; arguments: Record<string, unknown> };

  // Format tool result for sending back to provider
  formatToolResult(toolName: string, result: ToolResult): unknown;
}

type LLMEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'tool_call_delta'; id: string; argumentsDelta: string }
  | { type: 'done'; usage: { inputTokens: number; outputTokens: number } }
  | { type: 'error'; error: Error };
```

**Gemini-specific considerations:**
- Uses `functionCall` / `functionResponse` format
- Supports `streamFunctionCallArguments` for streaming tool args
- 1M token context window, 64K output
- Vertex AI SDK (`@google-cloud/vertexai`) for GCP integration

---

### `packages/server` -- HTTP API

**Dependencies:** All packages

Exposes the particle engine as an HTTP API for external integration:

```
POST /api/session          -- Create a new session (allocates a grid)
GET  /api/session/:id      -- Get session state
POST /api/session/:id/tool -- Execute a tool call
POST /api/session/:id/prompt -- Send a prompt to the LLM (LLM uses tools autonomously)
GET  /api/session/:id/render -- Render current state as image
POST /api/session/:id/render/video -- Render animation as video
WS   /ws/session/:id       -- WebSocket for real-time preview
```

### `packages/client` -- Browser Preview

**Dependencies:** `core`, `renderer-canvas` or `renderer-webgl`

A minimal browser application that:
- Connects to the server via WebSocket
- Renders the particle grid in real-time
- Shows LLM tool calls as they happen
- Allows manual zoom/pan of the grid
- Provides a prompt input for sending instructions to the LLM

---

## Data Flow: End-to-End

```
1. User sends prompt: "Draw a rotating triangle"
                |
2. Server forwards to LLM (Gemini 3.1 Pro) with tool definitions
                |
3. LLM calls: set_particles({ particles: [
     { row: 20, col: 50, color: "#FF0000" },
     { row: 50, col: 20, color: "#FF0000" },
     { row: 50, col: 80, color: "#FF0000" }
   ]})
                |
4. LLM calls: connect({ connections: [
     { from: [20,50], to: [50,20], color: "#FFFFFF", width: 1 },
     { from: [50,20], to: [50,80], color: "#FFFFFF", width: 1 },
     { from: [50,80], to: [20,50], color: "#FFFFFF", width: 1 }
   ]})
                |
5. ToolExecutor activates particles and creates connections
                |
6. LLM calls: create_animation({ duration: 3000, keyframes: [
     { time: 0, state: { /* triangle at position A */ } },
     { time: 3000, state: { /* triangle at position B (rotated) */ } }
   ]})
                |
7. ToolExecutor stores animation definition
                |
8. LLM calls: render_video({ format: "mp4", animation_id: "anim_1" })
                |
9. FrameGenerator interpolates 90 frames (30fps x 3s)
                |
10. CanvasRenderer renders each frame to pixel buffer
                |
11. FFmpeg encodes frames to MP4
                |
12. Video file returned to user
```

---

## State Management

### Undo/Redo

Every tool execution creates a state snapshot. The undo stack holds delta snapshots (not full state) for memory efficiency:

```typescript
interface StateDelta {
  timestamp: number;
  toolName: string;
  changes: {
    particlesModified: Map<number, { before: ParticleProps; after: ParticleProps }>;
    connectionsAdded: string[];
    connectionsRemoved: Map<string, Connection>;
  };
}
```

### Named Snapshots

Full state snapshots stored by name. Useful for the LLM to save checkpoints:
- "Save this as 'base_layout'"
- "Restore 'base_layout'"
- "Show me the diff between current state and 'base_layout'"

---

## LLM Conversation Loop

```typescript
async function conversationLoop(provider: LLMProvider, engine: ParticleEngine, prompt: string) {
  const messages: Message[] = [
    {
      role: 'system',
      content: buildSystemPrompt(engine.getSpaceInfo())
    },
    { role: 'user', content: prompt }
  ];

  while (true) {
    const events = provider.stream(messages, engine.getToolDefinitions());

    let pendingToolCalls: ToolCall[] = [];

    for await (const event of events) {
      if (event.type === 'text') {
        // Stream text to user
        emit('text', event.content);
      }
      if (event.type === 'tool_call') {
        pendingToolCalls.push(event);
      }
      if (event.type === 'done') {
        break;
      }
    }

    if (pendingToolCalls.length === 0) break; // LLM is done

    // Execute all tool calls
    const results = await Promise.all(
      pendingToolCalls.map(tc => engine.executeTool(tc.name, tc.arguments))
    );

    // Add tool calls and results to conversation
    messages.push({ role: 'assistant', tool_calls: pendingToolCalls });
    messages.push({ role: 'tool', results });

    // Broadcast state update to connected clients
    emit('state_update', engine.getState());
  }
}
```

---

## System Prompt Template

The system prompt sent to the LLM establishes context:

```
You are a visual creation assistant. You have access to a 2D particle grid space
with {rows} rows and {cols} columns of evenly-spaced dots.

You can:
- Activate particles at specific grid coordinates (row, col)
- Connect particles with lines
- Create animations with keyframes
- Render images and videos

The grid uses 0-indexed integer coordinates. Row 0 is the top, row {rows-1} is the bottom.
Column 0 is the left, column {cols-1} is the right.

Current state: {active_count} active particles, {connection_count} connections.

To create any visual (shapes, diagrams, text, illustrations), you place individual
particles at exact grid positions using set_particles, then connect them with lines
using connect. You have full control over every particle and every connection -- there
are no pre-built shape primitives. This means you always know exactly where every
element is positioned. For animations, define keyframes at key moments and the system
will smoothly interpolate between them.
```

---

## Technology Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Language | TypeScript | Full-stack, strong types, JSON-native |
| Runtime (server) | Node.js 22+ | LTS, stable, ecosystem |
| Runtime (client) | Modern browsers | Canvas/WebGL/WebGPU support |
| Package manager | pnpm | Efficient, workspace support |
| Monorepo | pnpm workspaces + turborepo | Fast builds, dependency management |
| Schema validation | zod | Runtime type safety for tool inputs |
| Server framework | Hono or Fastify | Lightweight, fast |
| WebSocket | ws (server), native (client) | Real-time preview |
| Canvas (server) | @napi-rs/canvas or node-canvas | Server-side rendering |
| Video encoding | fluent-ffmpeg + ffmpeg-static | Reliable FFmpeg binding |
| Easing | bezier-easing | Standard easing curves |
| Testing | vitest | Fast, TypeScript-native |
| Build | tsup | Fast TypeScript bundling |
| Linting | biome | Fast, unified linter+formatter |

---

## Implementation Phases

### Phase 1: Core Engine
- `packages/core` -- Grid, particles, connections, state serialization
- `packages/tools` -- Tool definitions and executor
- Unit tests for all core operations

### Phase 2: Rendering
- `packages/renderer-svg` -- SVG output
- `packages/renderer-canvas` -- Canvas 2D rendering
- Static image generation

### Phase 3: Animation
- `packages/animation` -- Keyframes, interpolation, easing
- `packages/video` -- FFmpeg video generation

### Phase 4: LLM Integration
- `packages/provider-gemini` -- Gemini 3.1 Pro adapter
- `packages/server` -- HTTP API + WebSocket
- Conversation loop implementation

### Phase 5: Client & Polish
- `packages/client` -- Browser preview UI
- `packages/renderer-webgl` -- WebGL for large scenes
- `packages/provider-anthropic`, `packages/provider-openai` -- Additional providers

---

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Grid vs continuous coordinates | Grid-only (pure integer coordinates, no continuous/sub-pixel) | LLMs work better with integers; fully deterministic; no ambiguity |
| State format | Sparse JSON (only active particles) | Minimizes token usage while keeping full fidelity |
| Animation model | Keyframe + interpolation with discrete events | Token-efficient; LLM defines 5-20 keyframes, engine generates hundreds of frames |
| Connection representation | Edge list (LLM) + adjacency map (internal) | Edge list is LLM-readable; adjacency map is query-efficient |
| Rendering | Multi-tier auto-selection (SVG/Canvas/WebGL) | Right tool for the job based on scene complexity |
| Provider abstraction | Custom thin adapter (not third-party lib) | Full control, minimal dependencies, simple interface |
| Data layout | Struct-of-Arrays (typed arrays) | 30% faster batch operations, direct GPU upload |
| Language | TypeScript | Isomorphic, JSON-native, strong ecosystem |
| Package structure | pnpm monorepo with independent packages | Ultra-modular, each package testable and replaceable |
| Video generation | Server-side Canvas + FFmpeg pipe | Reliable, high-quality, format-flexible |

---

## Scalability Considerations

- **10,000 particles** (100x100 grid): All renderers handle this trivially. State serialization ~5K tokens.
- **40,000 particles** (200x200 grid): Canvas and WebGL handle rendering. State serialization ~50K tokens for full active grid (use region queries).
- **250,000 particles** (500x500 grid): WebGL required for rendering. LLM should work with regions/groups, not full state. Typed array storage uses ~2.5MB RAM.
- **1,000,000 particles** (1000x1000 grid): WebGPU recommended. LLM interaction must be fully region/group-based. Typed array storage ~10MB RAM.

The architecture supports all these scales because:
1. Core uses typed arrays (constant-time per-particle access)
2. Serialization is sparse (only active particles transmitted)
3. Region/group filtering reduces LLM token usage
4. Renderer auto-selects based on element count
