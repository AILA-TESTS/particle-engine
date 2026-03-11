# @particle-engine/video

Generates video files from particle animations. Uses `@particle-engine/animation` to compute frames and `@particle-engine/renderer-canvas` to render each frame to a pixel buffer, then pipes raw RGBA frames to FFmpeg for encoding.

Supports MP4 (H.264), WebM (VP9), and GIF output. FFmpeg must be installed on the system.

## Installation

```bash
pnpm add @particle-engine/video
```

## Basic Usage

```typescript
import { VideoGenerator } from '@particle-engine/video';
import { createCanvas } from '@napi-rs/canvas';
import type { Animation } from '@particle-engine/animation';
import type { GridConfig } from '@particle-engine/core';

// Define an animation
const animation: Animation = {
  id: 'anim_1',
  duration: 3000,  // 3 seconds
  fps: 30,
  defaultEasing: 'easeInOutCubic',
  keyframes: [
    {
      time: 0,
      easing: 'linear',
      particles: [{ row: 10, col: 10, color: '#FF0000', opacity: 1, size: 1 }],
      connections: [],
    },
    {
      time: 3000,
      easing: 'easeOutCubic',
      particles: [{ row: 10, col: 10, color: '#0000FF', opacity: 1, size: 3 }],
      connections: [],
    },
  ],
  events: [],
};

const gridConfig: GridConfig = { rows: 50, cols: 50, spacing: 10 };

// Provide a canvas factory (any canvas library)
const canvasFactory = (width: number, height: number) => {
  const canvas = createCanvas(width, height);
  return { ctx: canvas.getContext('2d'), canvas };
};

const generator = new VideoGenerator(canvasFactory);

const result = await generator.generate({
  animation,
  gridConfig,
  outputPath: './output.mp4',
  config: {
    width: 600,
    height: 600,
    format: 'mp4',
    fps: 30,
    quality: 'high',       // 'low' | 'medium' | 'high' | 'lossless'
    backgroundColor: '#1a1a2e',
    pixelRatio: 1,
  },
});

console.log(`Video written to: ${result.outputPath}`);
console.log(`Duration: ${result.durationMs}ms, Frames: ${result.frameCount}`);
```

## API Overview

### `VideoGenerator`

```typescript
class VideoGenerator {
  constructor(canvasFactory: VideoCanvasFactory);
  generate(options: VideoGenerationOptions): Promise<VideoResult>;
}
```

The constructor accepts a `VideoCanvasFactory` — a function that creates a canvas and returns its 2D context. This keeps the package dependency-free with respect to specific canvas implementations.

### `VideoGenerationOptions`

| Field | Type | Description |
|-------|------|-------------|
| `animation` | `Animation` | The animation to render |
| `gridConfig` | `GridConfig` | Grid dimensions used for layout |
| `outputPath` | `string` | Destination file path (extension determines format hint) |
| `config` | `VideoConfig` | Video encoding and render settings |

### `VideoConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `width` | `number` | required | Frame width in pixels |
| `height` | `number` | required | Frame height in pixels |
| `format` | `'mp4' \| 'webm' \| 'gif'` | `'mp4'` | Output format |
| `fps` | `number` | animation.fps | Frames per second |
| `quality` | `'low' \| 'medium' \| 'high' \| 'lossless'` | `'high'` | Encoding quality (maps to CRF) |
| `backgroundColor` | `string` | `'#000000'` | Background fill color |
| `pixelRatio` | `number` | `1` | HiDPI scale factor |
| `padding` | `number` | `0` | Grid padding in pixels |
| `ffmpegPath` | `string` | `'ffmpeg'` | Path to FFmpeg binary |
| `showGrid` | `boolean` | `false` | Draw inactive grid dots |

### `VideoResult`

```typescript
interface VideoResult {
  outputPath: string;
  format: VideoFormat;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  durationMs: number;
}
```

### Frame pipeline

```
Animation
  → AnimationEngine.prepare()
  → AnimationEngine.computeFrame() × N
  → frameToSpaceState()           // FrameState → SpaceState
  → CanvasRenderer.renderToCanvas()
  → canvas.toBuffer('raw')        // RGBA pixel buffer
  → FFmpeg stdin (rawvideo pipe)
  → encoded video file
```

### Quality-to-CRF mapping

| Quality | MP4 CRF | WebM CRF |
|---------|---------|---------|
| `low` | 35 | 40 |
| `medium` | 28 | 33 |
| `high` | 18 | 23 |
| `lossless` | 0 | 0 |

### FFmpeg availability check

```typescript
import { checkFFmpegAvailable } from '@particle-engine/video';

const available = await checkFFmpegAvailable('/usr/local/bin/ffmpeg');
if (!available) {
  console.error('FFmpeg not found');
}
```

## Prerequisites

FFmpeg must be installed and accessible in `PATH`, or a custom path provided via `config.ffmpegPath`.

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
apt install ffmpeg
```
