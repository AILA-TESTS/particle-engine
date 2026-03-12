# @particle-engine/renderer-webgl

WebGL renderer for large particle scenes. Uses instanced rendering to draw all particles in a single draw call and GL_LINES for connections. Typed array buffers from `@particle-engine/core` map directly to GPU attribute buffers.

> **Status:** Scaffold implementation. The public API, shader source, and buffer utilities are defined and exported, but the full rendering loop is not yet implemented. For production use, use `@particle-engine/renderer-canvas` (up to ~50,000 elements) or `@particle-engine/renderer-svg` (up to ~5,000 elements).

Recommended for scenes with more than 50,000 total elements.

## Installation

```bash
pnpm add @particle-engine/renderer-webgl
```

## Intended Usage

```typescript
import { WebGLRenderer } from '@particle-engine/renderer-webgl';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const gl = canvas.getContext('webgl2')!;

const renderer = new WebGLRenderer(gl, {
  width: canvas.width,
  height: canvas.height,
  backgroundColor: '#000000',
  defaultParticleRadius: 3,
});

renderer.render(state);
renderer.dispose();
```

## API Overview

### `WebGLRenderer`

```typescript
class WebGLRenderer {
  constructor(gl: WebGLContextLike, config: WebGLRenderConfig);
  render(state: SpaceState): void;
  dispose(): void;
}
```

### `WebGLRenderConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `width` | `number` | required | Viewport width in pixels |
| `height` | `number` | required | Viewport height in pixels |
| `backgroundColor` | `string` | `'#000000'` | Clear color |
| `defaultParticleRadius` | `number` | `3` | Point sprite radius |
| `padding` | `number` | `20` | Grid padding in pixels |
| `pixelRatio` | `number` | `1` | HiDPI scale factor |

### Shader utilities

The shader source and program compilation utilities are exported for custom WebGL implementations:

```typescript
import {
  PARTICLE_VERTEX_SHADER,
  PARTICLE_FRAGMENT_SHADER,
  CONNECTION_VERTEX_SHADER,
  CONNECTION_FRAGMENT_SHADER,
  compileShader,
  linkProgram,
  createShaderProgram,
} from '@particle-engine/renderer-webgl';
```

### Buffer utilities

Typed array buffers can be uploaded directly to GPU with zero copy from the core SoA layout:

```typescript
import {
  createParticleBuffers,
  updateParticleBuffers,
  createConnectionBuffers,
  updateConnectionBuffers,
  createOrthographicMatrix,
} from '@particle-engine/renderer-webgl';
```

## Performance Characteristics

| Scene size | Draw calls (particles) | Draw calls (connections) |
|-----------|----------------------|------------------------|
| Any | 1 (instanced) | 1 (GL_LINES) |

WebGL renders all particles with a single instanced draw call by uploading position, color, size, and opacity as per-instance attributes. This achieves near-constant GPU overhead regardless of particle count, limited only by GPU memory and fill rate.
