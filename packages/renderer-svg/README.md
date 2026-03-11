# @particle-engine/renderer-svg

Converts a `SpaceState` into a complete SVG string. Zero external dependencies. Supports circle and square particles, solid/dashed/dotted connections, quadratic bezier curves, directed arrowheads, layer-ordered rendering, and optional grid dot visualization.

Recommended for scenes with fewer than ~5,000 total elements (particles + connections). For larger scenes, use `@particle-engine/renderer-canvas` or `@particle-engine/renderer-webgl`.

## Installation

```bash
pnpm add @particle-engine/renderer-svg
```

## Basic Usage

```typescript
import { ParticleGrid } from '@particle-engine/core';
import { SVGRenderer } from '@particle-engine/renderer-svg';

const grid = new ParticleGrid({ rows: 50, cols: 50, spacing: 10 });

grid.setParticles([
  { row: 10, col: 10, color: '#FF6B6B' },
  { row: 10, col: 40, color: '#4ECDC4' },
  { row: 40, col: 25, color: '#FFE66D' },
]);
grid.connect([10, 10], [10, 40], { color: '#FFFFFF', width: 1 });
grid.connect([10, 40], [40, 25], { color: '#FFFFFF', width: 1 });
grid.connect([40, 25], [10, 10], { color: '#FFFFFF', width: 1 });

const state = grid.getState();

const renderer = new SVGRenderer();
const result = renderer.render(state, {
  width: 600,
  height: 600,
  backgroundColor: '#1a1a2e',
});

// result.svg — complete SVG string ready to write to file or embed in HTML
// result.width, result.height — pixel dimensions
console.log(result.svg);
```

## API Overview

### `SVGRenderer`

```typescript
class SVGRenderer {
  render(state: SpaceState, config: RenderConfig): SVGRenderResult;
}
```

### `RenderConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `width` | `number` | required | SVG width in pixels |
| `height` | `number` | required | SVG height in pixels |
| `backgroundColor` | `string` | `'#000000'` | Background fill color |
| `padding` | `number` | `20` | Padding in pixels around the grid |
| `antialiasing` | `boolean` | `true` | `geometricPrecision` vs `crispEdges` |
| `pixelRatio` | `number` | `1` | HiDPI multiplier (adjusts viewBox) |
| `particleShape` | `'circle' \| 'square'` | `'circle'` | Particle shape |
| `defaultParticleRadius` | `number` | `3` | Particle radius in pixels |
| `showGrid` | `boolean` | `false` | Draw faint dots at inactive grid positions |
| `gridDotColor` | `string` | `'#333333'` | Color of inactive grid dots |
| `gridDotRadius` | `number` | `0.5` | Radius of inactive grid dots |

### `SVGRenderResult`

```typescript
interface SVGRenderResult {
  svg: string;    // complete SVG markup
  width: number;  // pixel width
  height: number; // pixel height
}
```

### Rendering order

Elements are sorted by their `layer` property before rendering. Within the same layer, connections render before particles so particles always appear on top of lines.

### Connection styles

```typescript
// Solid line (default)
grid.connect([r1, c1], [r2, c2], { style: 'solid', width: 2 });

// Dashed line
grid.connect([r1, c1], [r2, c2], { style: 'dashed', width: 1 });

// Dotted line
grid.connect([r1, c1], [r2, c2], { style: 'dotted', width: 1 });

// Bezier curve (curve > 0 bends left, curve < 0 bends right)
grid.connect([r1, c1], [r2, c2], { curve: 20 });

// Directed arrowhead at destination
grid.connect([r1, c1], [r2, c2], { directed: true });
```

### Utility functions

```typescript
import { gridToPixel, computeViewBox, renderParticle, renderConnection } from '@particle-engine/renderer-svg';

// Convert grid coordinates to pixel coordinates
const { x, y } = gridToPixel(row, col, spacing, padding);

// Compute the SVG viewBox for a given grid
const viewBox = computeViewBox(rows, cols, spacing, padding);

// Generate SVG markup for a single particle
const circleSvg = renderParticle(particle, x, y, radius, 'circle');

// Generate SVG markup for a single connection
const lineSvg = renderConnection(connection, x1, y1, x2, y2);
```

## Writing to File

```typescript
import { writeFileSync } from 'fs';

const { svg } = renderer.render(state, config);
writeFileSync('output.svg', svg, 'utf-8');
```
