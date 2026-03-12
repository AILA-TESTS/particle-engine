# @particle-engine/renderer-canvas

Isomorphic Canvas 2D renderer. Accepts any `CanvasRenderingContext2D`-compatible context — browser Canvas, `node-canvas`, `@napi-rs/canvas`, or a mock — so the same code runs in Node.js and the browser without modification.

Recommended for scenes with 5,000–50,000 total elements. For smaller scenes, use `@particle-engine/renderer-svg`. For larger scenes, use `@particle-engine/renderer-webgl`.

## Installation

```bash
pnpm add @particle-engine/renderer-canvas
```

## Basic Usage

### Browser

```typescript
import { ParticleGrid } from '@particle-engine/core';
import { CanvasRenderer } from '@particle-engine/renderer-canvas';

const grid = new ParticleGrid({ rows: 100, cols: 100, spacing: 10 });
grid.setParticle(50, 50, { color: '#FF6B6B', size: 2 });

const state = grid.getState();
const renderer = new CanvasRenderer();

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

renderer.renderToCanvas(ctx, state, {
  width: 1000,
  height: 1000,
  backgroundColor: '#1a1a2e',
});
```

### Node.js (with `@napi-rs/canvas`)

```typescript
import { createCanvas } from '@napi-rs/canvas';
import { CanvasRenderer } from '@particle-engine/renderer-canvas';

const canvas = createCanvas(1000, 1000);
const ctx = canvas.getContext('2d');

const renderer = new CanvasRenderer();
renderer.renderToCanvas(ctx, state, { width: 1000, height: 1000 });

const pngBuffer = canvas.toBuffer('image/png');
```

### Render to a new canvas via factory

```typescript
import { CanvasRenderer } from '@particle-engine/renderer-canvas';
import type { CanvasFactory } from '@particle-engine/renderer-canvas';
import { createCanvas } from '@napi-rs/canvas';

// CanvasFactory creates canvas instances on demand
const factory: CanvasFactory = (width, height) => {
  const c = createCanvas(width, height);
  return { ctx: c.getContext('2d'), canvas: c };
};

const renderer = new CanvasRenderer();
const { ctx, canvas } = renderer.renderToNewCanvas(factory, state, {
  width: 1920,
  height: 1080,
  pixelRatio: 2,  // HiDPI: actual canvas is 3840×2160
  backgroundColor: '#000000',
});
```

## API Overview

### `CanvasRenderer`

```typescript
class CanvasRenderer {
  // Render onto an existing canvas context
  renderToCanvas(ctx: CanvasContext2D, state: SpaceState, config: RenderConfig): void;

  // Create a new canvas via factory and render onto it
  renderToNewCanvas(
    factory: CanvasFactory,
    state: SpaceState,
    config: RenderConfig,
  ): { ctx: CanvasContext2D; canvas: CanvasLike };
}
```

### `RenderConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `width` | `number` | required | Canvas width in CSS pixels |
| `height` | `number` | required | Canvas height in CSS pixels |
| `backgroundColor` | `string` | `'#000000'` | Background fill color |
| `padding` | `number` | `20` | Padding around the grid in pixels |
| `antialiasing` | `boolean` | `true` | Enable `imageSmoothingEnabled` |
| `pixelRatio` | `number` | `1` | HiDPI multiplier (`scale()` applied to context) |
| `particleShape` | `'circle' \| 'square'` | `'circle'` | Particle shape |
| `defaultParticleRadius` | `number` | `3` | Radius in pixels (before `size` multiplier) |
| `showGrid` | `boolean` | `false` | Draw faint dots at inactive positions |
| `gridDotColor` | `string` | `'#333333'` | Color of inactive grid dots |
| `gridDotRadius` | `number` | `0.5` | Radius of inactive grid dots |

### Rendering order

Connections are drawn before particles (so particles appear on top). Within each group, elements are sorted by their `layer` property ascending.

### Utility functions

```typescript
import { gridToPixel, computeCanvasSize, drawParticle, drawConnection } from '@particle-engine/renderer-canvas';

// Convert grid row/col to pixel x/y
const { x, y } = gridToPixel(row, col, spacing, padding);

// Compute total canvas dimensions for a grid
const { width, height } = computeCanvasSize(rows, cols, spacing, padding);

// Draw a single particle onto a context
drawParticle(ctx, x, y, radius, particle, 'circle');

// Draw a single connection onto a context
drawConnection(ctx, x1, y1, x2, y2, connection);
```

### `CanvasFactory` type

```typescript
type CanvasFactory = (width: number, height: number) => {
  ctx: CanvasContext2D;
  canvas: CanvasLike;
};
```

Implement this to bridge any canvas library into the renderer.
