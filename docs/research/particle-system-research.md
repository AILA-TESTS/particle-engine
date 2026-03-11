# Particle Engine Research: Building a Bounded Particle System for LLM-Driven Visual Creation

> Research conducted: 2026-03-11
> Purpose: Drive the architecture of an LLM-native particle engine that replaces Manim/React-based animation libraries.

---

## Table of Contents

1. [Particle System Fundamentals](#1-particle-system-fundamentals)
2. [Space Representation for LLMs](#2-space-representation-for-llms)
3. [Line/Connection System](#3-lineconnection-system)
4. [Animation/Sequencing](#4-animationsequencing)
5. [LLM Integration Patterns](#5-llm-integration-patterns)
6. [Rendering](#6-rendering)
7. [Existing Similar Systems](#7-existing-similar-systems)
8. [Provider Abstraction](#8-provider-abstraction)
9. [Technology Recommendations](#9-technology-recommendations)

---

## 1. Particle System Fundamentals

### 1.1 How Existing Particle Systems Work

Traditional particle systems (game engines, physics simulations) use a **lifecycle model**: particles are emitted from a source, have properties that evolve over time (position, velocity, color, size, lifetime), and are destroyed when their lifetime expires. This model is designed for **ephemeral effects** like fire, smoke, and sparks.

Our system is fundamentally different. Our particles are:
- **Persistent** -- they exist in a bounded grid and do not expire
- **Addressable** -- each particle has a fixed identity and can be referenced by the LLM
- **Static by default** -- particles only move when explicitly commanded
- **Connectable** -- particles serve as endpoints for lines/connections

This makes our system closer to a **fixed dot-grid display** or a **programmable LED matrix** than a traditional particle emitter.

### 1.2 Data Structures for a Bounded 2D Particle Grid

#### Option A: 2D Array (Grid-Indexed)

```typescript
// Simple 2D array -- particles addressed by [row][col]
type Grid = Particle[][];

interface Particle {
  id: string;        // "r12c34" or numeric index
  row: number;
  col: number;
  x: number;         // computed from col * spacing
  y: number;         // computed from row * spacing
  active: boolean;
  color: string;
  size: number;
  metadata: Record<string, unknown>;
}
```

**Pros:** O(1) lookup by grid position, intuitive for LLMs ("set particle at row 5, column 10"), easy to serialize.
**Cons:** Wastes memory if grid is sparse, rigid spacing.

#### Option B: Flat Typed Arrays (Struct of Arrays / SoA)

```typescript
// SoA layout -- each property in its own typed array
interface ParticleStore {
  count: number;
  x: Float32Array;
  y: Float32Array;
  active: Uint8Array;
  colorR: Uint8Array;
  colorG: Uint8Array;
  colorB: Uint8Array;
  size: Float32Array;
}
```

**Pros:** Cache-friendly, up to 30% faster for batch operations (benchmarked), excellent for GPU upload, minimal memory overhead.
**Cons:** Less readable for debugging, harder for LLM to reason about individual particles.

#### Option C: Hybrid -- Grid Index + Flat Storage

```typescript
// Grid provides O(1) lookup; flat arrays provide performance
interface ParticleSystem {
  grid: number[][];           // grid[row][col] = particle index
  store: ParticleStore;       // flat typed arrays for properties
  indexToGrid: Map<number, [number, number]>;  // reverse lookup
}
```

**Recommendation:** Use the **hybrid approach**. The grid index gives the LLM a natural coordinate system ("row 5, col 10"), while the flat arrays give the renderer performance. The grid-to-index mapping is trivial: `index = row * cols + col`.

### 1.3 Efficient Storage and Query

For a bounded grid of closely-spaced dots:
- A **100x100 grid** = 10,000 particles (very manageable)
- A **200x200 grid** = 40,000 particles (still fine with typed arrays)
- A **500x500 grid** = 250,000 particles (needs WebGL rendering)

**Spatial hashing** is unnecessary for our use case because particles are on a fixed grid -- their positions are deterministic from their row/col indices. Spatial hashing becomes relevant only if we allow particles to move to arbitrary continuous positions (off-grid).

For neighbor queries ("which particles are adjacent to particle at row 5, col 10?"), the grid structure gives O(1) access to all 8 neighbors directly.

### 1.4 Grid-Based vs. Continuous Coordinates

| Aspect | Grid-Based | Continuous |
|--------|-----------|------------|
| LLM readability | Excellent -- "row 5, col 10" | Moderate -- "x: 234.5, y: 178.2" |
| Token efficiency | Very compact | Verbose (floats) |
| Precision | Fixed resolution | Arbitrary precision |
| Shape drawing | Rasterized (like pixels) | Smooth curves |
| Complexity | Low | High |

**Recommendation:** Use a **grid-based system as the primary interface** for the LLM, with an optional continuous sub-pixel offset for fine-tuning. The LLM thinks in grid coordinates; the renderer can apply sub-pixel offsets for smoother visuals.

```typescript
interface ParticlePosition {
  row: number;        // grid coordinate (integer)
  col: number;        // grid coordinate (integer)
  offsetX?: number;   // sub-pixel offset [-0.5, 0.5]
  offsetY?: number;   // sub-pixel offset [-0.5, 0.5]
}
```

---

## 2. Space Representation for LLMs

### 2.1 How to Represent the 2D Space for LLM Consumption

The core design constraint: the LLM must be able to **read the entire state** of the particle space and **issue precise commands** to modify it. This requires a representation that is:
- **Compact** -- fits within token limits (Gemini 3.1 Pro: 1M input tokens, 64K output)
- **Unambiguous** -- no room for misinterpretation
- **Structured** -- parseable by both LLM and code
- **Diff-friendly** -- easy to describe changes

### 2.2 Representation Formats

#### Format A: Sparse Coordinate List (Recommended for Active Particles)

```json
{
  "space": { "rows": 100, "cols": 100, "spacing": 5 },
  "active_particles": [
    { "r": 5, "c": 10, "color": "#FF0000", "size": 2 },
    { "r": 5, "c": 11, "color": "#FF0000", "size": 2 },
    { "r": 6, "c": 10, "color": "#00FF00", "size": 1 }
  ],
  "connections": [
    { "from": [5, 10], "to": [5, 11], "color": "#FFFFFF", "width": 1 },
    { "from": [5, 10], "to": [6, 10], "color": "#FFFFFF", "width": 1 }
  ]
}
```

**Token cost for 100 active particles + 50 connections:** ~2,000 tokens
**Token cost for 1,000 active particles + 500 connections:** ~20,000 tokens

#### Format B: ASCII Grid (Good for Visual Overview)

```
Space: 20x20, Active: 5 particles
......................
......................
.........X............
........XXX...........
.........X............
......................
```

**Pros:** Very compact, visually intuitive.
**Cons:** No color/size info, limited resolution, hard to parse programmatically.

#### Format C: Compact Binary-Inspired Text

```
GRID:100x100
P:5,10,#F00,2|5,11,#F00,2|6,10,#0F0,1
L:5,10>5,11,#FFF,1|5,10>6,10,#FFF,1
```

**Pros:** Extremely compact.
**Cons:** Custom format, harder for LLM to generate reliably.

**Recommendation:** Use **Format A (Sparse Coordinate List in JSON)** as the primary format. It is structured, parseable, and LLMs are highly trained on JSON. For overview purposes, provide an optional ASCII visualization alongside the JSON state. For very large scenes (10,000+ active particles), use a paginated/windowed view showing only a region of interest.

### 2.3 Particle Metadata Schema

Each particle should carry:

```typescript
interface ParticleState {
  // Identity
  id: string;              // unique identifier "p_5_10"
  row: number;             // grid row
  col: number;             // grid column

  // Visual Properties
  active: boolean;         // whether the particle is "lit"
  color: string;           // hex color "#RRGGBB"
  opacity: number;         // 0.0 to 1.0
  size: number;            // relative size multiplier (1.0 = default)

  // Semantic Properties
  label?: string;          // optional text label
  group?: string;          // grouping identifier for bulk operations
  layer?: number;          // z-index for layering

  // Animation State
  animating?: boolean;     // whether particle is mid-animation
  keyframeIndex?: number;  // current keyframe position
}
```

### 2.4 Context Window Management

With Gemini 3.1 Pro's 1M token context window:
- A 100x100 grid with 500 active particles and 200 connections = ~5,000 tokens (trivial)
- A 200x200 grid with 5,000 active particles and 2,000 connections = ~50,000 tokens (5% of context)
- Full 500x500 grid dump with all particles active = ~500,000 tokens (50% of context -- avoid)

**Strategy:** Always use sparse representation. Only send active/modified particles. Provide a summary header ("Grid: 200x200, Active: 342 particles, 156 connections, 12 groups") and let the LLM request details for specific regions or groups.

---

## 3. Line/Connection System

### 3.1 Representing Connections

Connections (lines between particles) form a **graph**. Three standard representations:

#### Edge List (Recommended)

```json
{
  "connections": [
    { "id": "c1", "from": [5, 10], "to": [5, 11], "color": "#FFF", "width": 1, "style": "solid" },
    { "id": "c2", "from": [5, 10], "to": [6, 10], "color": "#FFF", "width": 2, "style": "dashed" }
  ]
}
```

**Why edge list wins for LLM interaction:**
- Each connection is self-contained (from, to, properties)
- Easy to add/remove individual connections
- LLM can reference connections by ID
- Naturally maps to "connect particle A to particle B" language
- Token-efficient for sparse graphs

#### Adjacency List

```json
{
  "adjacency": {
    "5,10": ["5,11", "6,10"],
    "5,11": ["5,10"],
    "6,10": ["5,10"]
  }
}
```

**Tradeoff:** More compact for dense graphs but loses per-edge properties (color, width, style).

#### Adjacency Matrix

```json
{
  "matrix": [
    [0, 1, 1],
    [1, 0, 0],
    [1, 0, 0]
  ]
}
```

**Tradeoff:** O(1) edge lookup but O(n^2) space. Impractical for grids larger than 50x50.

**Recommendation:** Use **edge list** as the primary representation. Store it internally as an adjacency list (HashMap) for O(1) neighbor lookups, but serialize as edge list for LLM communication.

### 3.2 Connection Properties

```typescript
interface Connection {
  id: string;                    // unique identifier
  from: [number, number];        // [row, col] of source particle
  to: [number, number];          // [row, col] of target particle
  color: string;                 // hex color
  width: number;                 // line thickness (pixels)
  opacity: number;               // 0.0 to 1.0
  style: 'solid' | 'dashed' | 'dotted';
  curve?: number;                // curvature factor (0 = straight)
  label?: string;                // optional label on the line
  group?: string;                // grouping for bulk operations
  layer?: number;                // z-index
  directed?: boolean;            // if true, render an arrowhead at 'to'
}
```

### 3.3 Describing Complex Shapes

Complex shapes are described as **groups of particles and connections**:

```json
{
  "shapes": [
    {
      "name": "triangle",
      "group": "shape_1",
      "particles": [[10,10], [10,15], [15,12]],
      "connections": [
        { "from": [10,10], "to": [10,15] },
        { "from": [10,15], "to": [15,12] },
        { "from": [15,12], "to": [10,10] }
      ]
    }
  ]
}
```

The system should provide **shape primitives** that the LLM can invoke as high-level operations (draw_circle, draw_rectangle, draw_line, draw_polygon) which internally activate the appropriate particles and connections.

---

## 4. Animation/Sequencing

### 4.1 Frame Representation

An animation is a sequence of states over time. Three approaches:

#### Approach A: Full-State Keyframes

Each keyframe stores the complete state:

```json
{
  "animation": {
    "fps": 30,
    "keyframes": [
      {
        "time": 0,
        "particles": [...],
        "connections": [...]
      },
      {
        "time": 1000,
        "particles": [...],
        "connections": [...]
      }
    ]
  }
}
```

**Pros:** Simple, each frame is self-contained, easy to debug.
**Cons:** Massive token cost -- repeating unchanged particles across frames is wasteful.

#### Approach B: Delta-Based (Changes Only)

Each frame describes only what changed:

```json
{
  "animation": {
    "fps": 30,
    "initial_state": { "particles": [...], "connections": [...] },
    "deltas": [
      {
        "time": 500,
        "add_particles": [{ "r": 7, "c": 7, "color": "#FF0" }],
        "remove_particles": [[5, 10]],
        "modify_particles": [{ "r": 5, "c": 11, "color": "#0FF" }],
        "add_connections": [{ "from": [7, 7], "to": [5, 11] }],
        "remove_connections": ["c1"]
      }
    ]
  }
}
```

**Pros:** Extremely token-efficient. LLM only describes what changes.
**Cons:** Harder to reason about absolute state; requires computing running state.

#### Approach C: Keyframe + Interpolation (Recommended)

The LLM defines **key states** and the system automatically interpolates between them:

```json
{
  "animation": {
    "fps": 30,
    "duration": 5000,
    "keyframes": [
      {
        "time": 0,
        "state": {
          "particles": [{ "r": 5, "c": 5, "color": "#FF0000" }],
          "connections": []
        }
      },
      {
        "time": 2500,
        "easing": "easeInOutCubic",
        "state": {
          "particles": [{ "r": 5, "c": 5, "color": "#0000FF" }, { "r": 10, "c": 10, "color": "#00FF00" }],
          "connections": [{ "from": [5, 5], "to": [10, 10] }]
        }
      }
    ]
  }
}
```

**Pros:** Token-efficient (LLM defines 5-20 keyframes, system generates 150 frames), natural for LLMs ("at time 0 show this, at time 2.5s transition to this"), supports easing functions.
**Cons:** Requires an interpolation engine, some properties (like adding/removing particles) cannot be smoothly interpolated.

**Recommendation:** Use **Approach C (Keyframe + Interpolation)** as the primary model, with **Approach B (Delta)** as a fallback for discrete, non-interpolatable changes. The LLM can mix both:

```json
{
  "animation": {
    "keyframes": [...],
    "events": [
      { "time": 1200, "action": "add_particle", "params": { "r": 7, "c": 7 } },
      { "time": 3000, "action": "remove_connection", "params": { "id": "c1" } }
    ]
  }
}
```

### 4.2 Interpolation System

Properties that can be interpolated:
- **Position offset** (linear or bezier)
- **Color** (RGB/HSL interpolation)
- **Opacity** (linear)
- **Size** (linear)
- **Line width** (linear)
- **Curve factor** (linear)

Properties that require discrete transitions:
- **Particle existence** (active/inactive -- use fade-in/fade-out)
- **Connection existence** (appears/disappears -- use opacity animation)
- **Style changes** (solid to dashed -- instant switch)
- **Group membership**

Standard easing functions to support:
- Linear
- easeInQuad, easeOutQuad, easeInOutQuad
- easeInCubic, easeOutCubic, easeInOutCubic
- easeInElastic, easeOutElastic
- easeInBounce, easeOutBounce
- Custom bezier curves

### 4.3 Lessons from Manim's Architecture

Manim's internal architecture follows a clear pattern:

1. **Scene** orchestrates the animation sequence
2. **Mobjects** (mathematical objects) hold state and geometry
3. **Animations** interpolate between mobject states using an alpha value [0.0, 1.0]
4. **Renderer** (Cairo or OpenGL) converts mobject geometry to pixels
5. **Video encoder** (PyAV) assembles frames

Key takeaways for our system:
- Manim's alpha-based interpolation is elegant and should be adopted
- The separation of Scene/Object/Animation/Renderer is excellent modularity
- Manim's biggest weakness for LLM use: the LLM must generate Python code (Manim scenes), which is error-prone and requires execution. Our system should accept **structured data** (JSON/function calls), not code
- Generative Manim projects (generative-manim, Manimator) wrap Manim with an LLM code-generation layer, but they still suffer from the code-generation bottleneck

---

## 5. LLM Integration Patterns

### 5.1 API Design for LLM Tool Use

The system should expose **function-calling tools** that the LLM invokes. Based on research into modern tool-calling patterns (2025-2026), the design should:

- Use **JSON Schema** for tool definitions (universal across providers)
- Keep tool count **under 20** (performance degrades beyond ~50 tools)
- Make each tool **atomic** -- one clear action per tool
- Return **structured responses** the LLM can parse
- Include **validation** -- reject invalid operations with clear error messages

### 5.2 Recommended Tool Set

```typescript
// === Space Management ===
tools.define("get_space_info", {
  description: "Get the dimensions and configuration of the particle space",
  parameters: {},
  returns: { rows: "number", cols: "number", spacing: "number", total_particles: "number", active_count: "number" }
});

tools.define("get_state", {
  description: "Get the current state of active particles and connections",
  parameters: {
    region: { type: "object", optional: true, properties: {
      rowStart: "number", rowEnd: "number", colStart: "number", colEnd: "number"
    }},
    group: { type: "string", optional: true },
    include_inactive: { type: "boolean", optional: true, default: false }
  },
  returns: { particles: "Particle[]", connections: "Connection[]", summary: "string" }
});

// === Particle Operations ===
tools.define("set_particles", {
  description: "Activate and configure one or more particles",
  parameters: {
    particles: { type: "array", items: {
      row: "number", col: "number", color: "string", size: "number",
      opacity: "number", label: "string", group: "string"
    }}
  }
});

tools.define("clear_particles", {
  description: "Deactivate particles by coordinates, group, or all",
  parameters: {
    coordinates: { type: "array", items: [number, number], optional: true },
    group: { type: "string", optional: true },
    all: { type: "boolean", optional: true }
  }
});

// === Connection Operations ===
tools.define("connect", {
  description: "Create connections between particles",
  parameters: {
    connections: { type: "array", items: {
      from: [number, number], to: [number, number],
      color: "string", width: "number", style: "string"
    }}
  }
});

tools.define("disconnect", {
  description: "Remove connections by ID, endpoints, or group",
  parameters: {
    ids: { type: "array", optional: true },
    endpoints: { type: "array", optional: true },
    group: { type: "string", optional: true }
  }
});

// === Shape Primitives ===
tools.define("draw_shape", {
  description: "Draw a predefined shape (circle, rectangle, line, polygon, text)",
  parameters: {
    type: "string",  // "circle" | "rectangle" | "line" | "polygon" | "text"
    params: "object", // shape-specific parameters
    color: "string",
    group: "string",
    fill: "boolean"
  }
});

// === Animation ===
tools.define("create_animation", {
  description: "Create an animation sequence with keyframes",
  parameters: {
    duration: "number",  // milliseconds
    fps: "number",
    keyframes: "Keyframe[]",
    events: "Event[]",
    easing: "string"
  }
});

tools.define("modify_keyframe", {
  description: "Add or modify a keyframe in an existing animation",
  parameters: {
    animation_id: "string",
    time: "number",
    state_changes: "object"
  }
});

// === Rendering ===
tools.define("render", {
  description: "Render the current state or an animation to an image or video",
  parameters: {
    format: "string",   // "png" | "svg" | "mp4" | "gif" | "webm"
    animation_id: "string",
    resolution: { width: "number", height: "number" }
  }
});

// === Utility ===
tools.define("undo", { description: "Undo the last operation" });
tools.define("redo", { description: "Redo the last undone operation" });
tools.define("snapshot", { description: "Save a named snapshot of the current state" });
tools.define("restore", { description: "Restore a named snapshot" });
```

### 5.3 State Query Patterns

The LLM should be able to query state at multiple granularities:

1. **Summary:** "Grid 100x100, 342 active particles, 156 connections, groups: [shape_1, label_a]"
2. **Region:** "Show me particles in rows 10-20, cols 30-40"
3. **Group:** "Show me all particles in group 'triangle_1'"
4. **Full state:** "Give me the complete state" (warning: may be large)
5. **Diff:** "What changed since my last query?"

### 5.4 Error Handling

```typescript
// Bounds checking
tools.validate("set_particles", (params) => {
  for (const p of params.particles) {
    if (p.row < 0 || p.row >= grid.rows) return { error: `Row ${p.row} out of bounds [0, ${grid.rows - 1}]` };
    if (p.col < 0 || p.col >= grid.cols) return { error: `Col ${p.col} out of bounds [0, ${grid.cols - 1}]` };
  }
});

// Connection validation
tools.validate("connect", (params) => {
  for (const c of params.connections) {
    if (!isActive(c.from)) return { error: `Particle at [${c.from}] is not active` };
    if (!isActive(c.to)) return { error: `Particle at [${c.to}] is not active` };
  }
});
```

Errors should be returned as structured JSON with:
- Clear error message
- The specific parameter that failed
- The valid range/options
- A suggestion for correction

---

## 6. Rendering

### 6.1 Technology Comparison

| Technology | Max Elements | Interactivity | Complexity | Best For |
|-----------|-------------|---------------|------------|----------|
| SVG | ~5,000 | Excellent (DOM events) | Low | Simple scenes, export |
| Canvas 2D | ~10,000 | Manual hit-testing | Medium | Medium scenes, real-time |
| WebGL | ~500,000 | Manual everything | High | Large scenes, performance |
| WebGPU | ~2,000,000 | Manual everything | Very High | Future-proof, massive scenes |

### 6.2 Recommended Rendering Strategy

**Multi-tier renderer with automatic fallback:**

1. **SVG Renderer** (default for < 5,000 particles)
   - Clean, sharp output
   - Easy to export as files
   - DOM-based interactivity
   - Ideal for most LLM-generated scenes

2. **Canvas 2D Renderer** (for 5,000-50,000 particles)
   - Good performance
   - OffscreenCanvas for background rendering
   - Use for medium complexity animations

3. **WebGL Renderer** (for 50,000+ particles or real-time preview)
   - Instanced rendering for particles (single draw call)
   - Point sprites for dots
   - Line rendering for connections
   - Necessary for full-grid visualizations

### 6.3 Video Generation Pipeline

For producing video output from animation sequences:

```
Keyframes (LLM) --> Interpolation Engine --> Frame Buffer --> Encoder --> Video File
```

**Server-side rendering (recommended for production):**
- Use **Node.js + node-canvas** (Cairo-backed) for frame generation
- Pipe frames to **FFmpeg** via stdin for encoding
- Support PNG frame sequences as intermediate format
- Libraries: `fluent-ffmpeg`, `ffmpeg-static`, `canvas` (node-canvas)

**Client-side rendering (for preview):**
- Render directly to `<canvas>` or WebGL context
- Use `MediaRecorder` API for browser-native recording
- Use `canvas.captureStream()` for real-time streaming

**Recommended output formats:**
- MP4 (H.264) -- universal compatibility
- WebM (VP9) -- web-native, smaller files
- GIF -- for simple animations (limited colors)
- PNG sequence -- for post-processing
- SVG sequence -- for vector output

### 6.4 Real-Time Preview vs. Batch Rendering

The system should support both modes:

- **Real-time preview:** Renders at screen refresh rate, may drop frames for complex scenes. Uses Canvas 2D or WebGL. Shows the LLM's changes immediately.
- **Batch rendering:** Renders every frame at full quality, outputs to file. Uses server-side Canvas or headless WebGL. No frame dropping.

The LLM workflow typically follows: design (real-time preview) then export (batch render).

---

## 7. Existing Similar Systems

### 7.1 Generative Manim

The closest existing system to our goal. Generative Manim wraps the Manim animation engine with an LLM layer that converts text prompts to Manim Python code. However, it has critical limitations:
- **Code generation bottleneck:** The LLM must produce syntactically correct Python/Manim code
- **Execution dependency:** Requires a Python runtime to execute generated code
- **Error recovery:** If generated code fails, the LLM must debug its own code
- **No direct state inspection:** The LLM cannot "read" the current visual state

Our system solves these by using **structured data** (JSON, function calls) instead of code generation.

### 7.2 Manim

Architecture insights:
- Scene/Mobject/Animation/Renderer separation is excellent
- Alpha-based interpolation [0.0, 1.0] for animations is clean
- Dual renderer support (Cairo for quality, OpenGL for speed)
- Community edition is well-maintained, open source

Limitations for LLM use:
- Requires Python code authoring
- No structured API for external control
- Rendering is tightly coupled to Python runtime

### 7.3 p5.js / Processing

Creative coding framework with:
- Simple draw-loop architecture (`setup()` + `draw()`)
- Rich primitive operations (point, line, circle, rect)
- Large community and educational resources
- WebGL mode for performance

Relevant patterns for our system:
- The `setup()` / `draw()` loop maps to our "configure space" / "render frame" pattern
- p5.js's immediate-mode rendering is simple but not suitable for LLM interaction (requires code)
- Object pooling pattern for particle recycling is useful

### 7.4 Remotion / Revideo

React-based programmatic video creation:
- Components define frames as React elements
- Frame-based timeline with interpolation
- Server-side rendering via headless browser

Limitations:
- Requires JSX/React code generation
- Heavy runtime (full React + browser)
- Not designed for LLM interaction

### 7.5 AI Co-Artist (GLSL Shader System)

Research paper on LLM-driven GLSL shader evolution:
- LLM iteratively refines shader code based on visual feedback
- Interesting for procedural effects but wrong abstraction level for our use case

### 7.6 Key Gap Our System Fills

No existing system provides:
1. A **structured, non-code API** for LLM visual creation
2. **Bidirectional state** -- LLM can both write and read the visual state
3. **Grid-based particle addressing** optimized for LLM token efficiency
4. **Provider-agnostic tool definitions** that work across LLM providers

---

## 8. Provider Abstraction

### 8.1 Design Principles

The system must treat the LLM provider as a **swappable module**. Based on research into provider-agnostic architectures:

1. **Unified interface layer** that normalizes request/response formats across providers
2. **Tool schema translation** -- define tools once, translate to provider-specific formats
3. **Streaming abstraction** -- normalize streaming behavior across providers
4. **Error normalization** -- map provider-specific errors to common error types

### 8.2 Tool Calling Differences Across Providers

| Feature | Gemini 3.1 Pro | Claude (Anthropic) | GPT-4+ (OpenAI) |
|---------|---------------|-------------------|-----------------|
| Tool schema format | JSON Schema | JSON Schema | JSON Schema |
| Parallel tool calls | Yes | Yes | Yes |
| Streaming tool args | Yes (streamFunctionCallArguments) | Yes | Yes |
| Max tools | High | ~128 | ~128 |
| Tool choice control | AUTO, NONE, specific | auto, any, tool | auto, none, required |
| Response format | functionCall objects | tool_use blocks | function_call objects |
| Structured output | Yes (with tools) | Yes | Yes |

### 8.3 Recommended Abstraction Pattern

```typescript
// Provider-agnostic tool definition
interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
  returns?: JSONSchema;
}

// Provider adapter interface
interface LLMProvider {
  name: string;
  sendMessage(messages: Message[], tools: ToolDefinition[]): AsyncIterator<LLMEvent>;
  parseToolCall(raw: unknown): ToolCall;
  formatToolResult(result: unknown): unknown;
}

// Provider implementations
class GeminiProvider implements LLMProvider { ... }
class AnthropicProvider implements LLMProvider { ... }
class OpenAIProvider implements LLMProvider { ... }

// The engine uses only the interface
class ParticleEngine {
  constructor(private provider: LLMProvider) {}

  async run(prompt: string) {
    const events = this.provider.sendMessage(
      [{ role: 'user', content: prompt }],
      this.tools
    );
    for await (const event of events) {
      if (event.type === 'tool_call') {
        const result = await this.executeTool(event.toolCall);
        // feed result back to provider
      }
    }
  }
}
```

### 8.4 Existing Libraries for Provider Abstraction

- **any-llm (Python):** Single config parameter to switch providers. Good for simple use cases.
- **AnyLLM (TypeScript):** Abstraction layer for TypeScript applications. Supports multiple providers.
- **ToolRegistry:** Protocol-agnostic tool management. Good architecture reference.
- **Vercel AI SDK:** Production-grade, supports many providers, TypeScript-native.
- **LiteLLM:** Python proxy that normalizes 100+ providers into OpenAI format.

**Recommendation:** Build a **thin custom adapter layer** rather than depending on a third-party abstraction. The tool-calling interface is simple enough that a custom implementation avoids dependency risk and gives full control. Use the Vercel AI SDK as an architecture reference but not a dependency.

---

## 9. Technology Recommendations

### 9.1 Language: TypeScript

**Rationale:**
- Full-stack capability (server rendering + browser preview)
- Strong type system for complex data structures
- Excellent ecosystem for web rendering (Canvas, WebGL, SVG)
- Native JSON handling (the primary LLM communication format)
- async/await for LLM streaming
- NPM ecosystem for FFmpeg bindings, canvas libraries, etc.

### 9.2 Runtime: Node.js (server) + Browser (client)

- **Server:** Node.js for batch rendering, FFmpeg integration, LLM API calls
- **Client:** Browser for real-time preview, interactive editing
- **Shared:** Core particle engine logic runs in both environments (isomorphic)

### 9.3 Key Libraries

| Purpose | Library | Rationale |
|---------|---------|-----------|
| Server-side canvas | `node-canvas` (Cairo) | High-quality 2D rendering, SVG export |
| Video encoding | `fluent-ffmpeg` + `ffmpeg-static` | Reliable FFmpeg integration |
| WebGL rendering | `pixi.js` or raw WebGL | PixiJS for convenience, raw for control |
| Easing functions | `bezier-easing` | Standard easing curves |
| Schema validation | `zod` | Runtime type checking for tool inputs |
| Testing | `vitest` | Fast, TypeScript-native testing |
| Build system | `tsup` or `esbuild` | Fast TypeScript compilation |
| Monorepo | `turborepo` or `pnpm workspaces` | Multi-package management |

### 9.4 Package Structure (Ultra-Modular)

```
packages/
  core/           -- Particle state, connections, grid logic (zero dependencies)
  animation/      -- Keyframe system, interpolation, easing (depends on core)
  renderer-svg/   -- SVG rendering (depends on core)
  renderer-canvas/-- Canvas 2D rendering (depends on core)
  renderer-webgl/ -- WebGL rendering (depends on core)
  video/          -- FFmpeg video generation (depends on renderer-canvas, animation)
  tools/          -- LLM tool definitions and execution (depends on core, animation)
  provider-gemini/-- Gemini provider adapter (depends on tools)
  provider-anthropic/ -- Anthropic adapter (depends on tools)
  provider-openai/    -- OpenAI adapter (depends on tools)
  shapes/         -- Shape primitives (circle, rect, polygon) (depends on core)
  server/         -- HTTP server for API access
  client/         -- Browser-based preview UI
```

### 9.5 Performance Targets

| Metric | Target |
|--------|--------|
| Grid initialization (100x100) | < 10ms |
| State serialization (1000 particles) | < 5ms |
| Single frame render (Canvas 2D, 10k particles) | < 16ms (60fps) |
| Animation interpolation (1000 particles) | < 2ms per frame |
| Video encoding (30fps, 1080p) | > 30fps encoding speed |
| Tool call round-trip (local) | < 1ms |
| LLM state query response | < 100 tokens overhead |

---

## Sources

### Particle Systems and Data Structures
- [Building a Million-Particle System](https://www.gamedeveloper.com/programming/building-a-million-particle-system)
- [Building an Advanced Particle System](https://www.gamedeveloper.com/programming/building-an-advanced-particle-system)
- [Particle Systems From the Ground Up](http://buildnewgames.com/particle-systems/)
- [2D Particle System](https://nintervik.github.io/2D-Particle-System/)
- [Optimizing Particle Systems with Grid Lookup and Spatial Hashing](https://www.gorillasun.de/blog/particle-system-optimization-grid-lookup-spatial-hashing/)

### LLM Tool Calling and Integration
- [Tool Calling in AI Agents 2026](https://www.techjunkgigs.com/tool-calling-in-ai-agents-how-llms-execute-real-world-actions-in-2026/)
- [Tool Calling Guide 2026 - Composio](https://composio.dev/blog/ai-agent-tool-calling-guide)
- [Function Calling with LLMs - Martin Fowler](https://martinfowler.com/articles/function-call-LLM.html)
- [APIs for AI Agents 2026 - Composio](https://composio.dev/blog/apis-ai-agents-integration-patterns)
- [Function calling with the Gemini API](https://ai.google.dev/gemini-api/docs/function-calling)
- [Gemini 3.1 Pro - Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-pro)

### Rendering and Graphics
- [SVG vs Canvas vs WebGL Performance 2025](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025)
- [Building a GPU-Accelerated Particle System with WebGL](https://dev.to/hexshift/building-a-custom-gpu-accelerated-particle-system-with-webgl-and-glsl-shaders-25d2)
- [GPU-Accelerated Particles with WebGL 2](https://gpfault.net/posts/webgl2-particles.txt.html)
- [JavaScript Particle System: WebGL Implementation 2026](https://copyprogramming.com/howto/efficient-particle-system-in-javascript-webgl)

### Animation and Manim
- [Manim Deep Dive Internals](https://docs.manim.community/en/stable/guides/deep_dive.html)
- [Manim Building Blocks](https://docs.manim.community/en/stable/tutorials/building_blocks.html)
- [Generative Manim: AI-Powered Video Creation](https://www.blog.brightcoding.dev/2026/02/22/generative-manim-ai-powered-video-creation-revolution)
- [Manimator: Research Papers to Visual Explanations](https://arxiv.org/html/2507.14306v1)
- [Easing Functions Cheat Sheet](https://easings.net/)

### Provider Abstraction
- [Implementing LLM Agnostic Architecture](https://www.entrio.io/blog/implementing-llm-agnostic-architecture-generative-ai-module)
- [The LLM Abstraction Layer](https://www.proxai.co/blog/archive/llm-abstraction-layer)
- [ToolRegistry: Protocol-Agnostic Tool Management](https://arxiv.org/html/2507.10593v1)
- [any-llm: Unified LLM API](https://blog.mozilla.ai/introducing-any-llm-a-unified-api-to-access-any-llm-provider/)

### Creative Coding
- [p5.js](https://p5js.org/)
- [AI Co-Artist: LLM-Powered GLSL Shader Animation](https://arxiv.org/html/2512.08951)
- [Video Rendering with Node.js and FFmpeg](https://creatomate.com/blog/video-rendering-with-nodejs-and-ffmpeg)

### Data Structures and Performance
- [Struct of Arrays vs Array of Structs Performance](https://hdembinski.github.io/posts/struct_of_arrays_vs_arrays_of_structs.html)
- [ECS Architecture - Web Game Dev](https://www.webgamedev.com/code-architecture/ecs)
- [Entity Component System - Wikipedia](https://en.wikipedia.org/wiki/Entity_component_system)
- [Graph Representations - AlgoDaily](https://algodaily.com/lessons/implementing-graphs-edge-list-adjacency-list-adjacency-matrix)
