# @particle-engine/animation

Keyframe animation engine with perceptually correct interpolation. Converts an LLM-defined keyframe sequence into per-frame particle states. Includes 31 Penner easing functions, cubic bezier, spring physics with precomputed LUTs, and OKLAB color interpolation.

## Installation

```bash
pnpm add @particle-engine/animation
```

## Basic Usage

```typescript
import { AnimationEngine } from '@particle-engine/animation';
import type { Animation } from '@particle-engine/animation';

const animation: Animation = {
  id: 'anim_1',
  duration: 2000,   // milliseconds
  fps: 30,
  defaultEasing: 'easeInOutCubic',
  keyframes: [
    {
      time: 0,
      easing: 'linear',
      particles: [
        { row: 10, col: 10, color: '#FF0000', opacity: 0, size: 1 },
      ],
      connections: [],
    },
    {
      time: 2000,
      easing: 'easeOutCubic',
      particles: [
        { row: 10, col: 10, color: '#0000FF', opacity: 1, size: 2 },
      ],
      connections: [],
    },
  ],
  events: [],
};

const engine = new AnimationEngine();
const prepared = engine.prepare(animation);

// Generate all frames
const totalFrames = Math.ceil((animation.duration / 1000) * animation.fps);
for (let frame = 0; frame < totalFrames; frame++) {
  const frameState = engine.computeFrame(prepared, frame);
  // frameState.particles — interpolated particle properties for this frame
  // frameState.connections — interpolated connection properties for this frame
}
```

## API Overview

### `AnimationEngine`

The main class. Stateless — you can reuse a single instance for multiple animations.

```typescript
class AnimationEngine {
  prepare(animation: Animation): PreparedAnimation;
  computeFrame(prepared: PreparedAnimation, frameIndex: number): FrameState;
}
```

`prepare()` is called once per animation. It precomputes:
- Easing function resolution (including spring LUT generation)
- Keyframe sorting and matching data structures
- OKLAB color conversions for smooth interpolation

`computeFrame()` is called for each frame number (0-indexed). Returns a `FrameState` with fully interpolated values for all active particles and connections at that point in time.

### Easing functions

```typescript
import { resolveEasing, pennerEasings, createSpringEasing, cubicBezier } from '@particle-engine/animation';
```

All 31 standard Penner easing functions are available by string name:

```
linear
easeInQuad    easeOutQuad    easeInOutQuad
easeInCubic   easeOutCubic   easeInOutCubic
easeInQuart   easeOutQuart   easeInOutQuart
easeInQuint   easeOutQuint   easeInOutQuint
easeInSine    easeOutSine    easeInOutSine
easeInExpo    easeOutExpo    easeInOutExpo
easeInCirc    easeOutCirc    easeInOutCirc
easeInBack    easeOutBack    easeInOutBack
easeInElastic easeOutElastic easeInOutElastic
easeInBounce  easeOutBounce  easeInOutBounce
```

Spring physics easing:

```typescript
const easing: EasingSpec = {
  type: 'spring',
  stiffness: 200,  // higher = snappier
  damping: 20,     // higher = less oscillation
  mass: 1,
};
```

Cubic bezier (like CSS `cubic-bezier()`):

```typescript
const easing: EasingSpec = {
  type: 'bezier',
  x1: 0.42, y1: 0,
  x2: 0.58, y2: 1,
};
```

Step easing:

```typescript
const easing: EasingSpec = {
  type: 'steps',
  count: 5,
  direction: 'end',  // 'start' | 'end' | 'both' | 'none'
};
```

### Color interpolation (OKLAB)

Colors are interpolated in the OKLAB perceptual color space for smooth, hue-preserving transitions. OKLAB avoids the darkening artifact present in RGB interpolation.

```typescript
import { interpolateColorOKLAB, hexToOKLAB, oklabToHex } from '@particle-engine/animation';

const mid = interpolateColorOKLAB('#FF0000', '#0000FF', 0.5);
// Perceptually midpoint between red and blue
```

### Spawn and death effects

```typescript
import { fadeIn, fadeOut, grow, shrink, pop } from '@particle-engine/animation';

// These return opacity/size multiplier curves (alpha → value)
const opacity = fadeIn(alpha);   // 0→1 as alpha goes 0→1
const size    = pop(alpha);      // grows then settles
```

### Grid distribution utilities

```typescript
import { bilinearDistribute, bresenhamLine } from '@particle-engine/animation';

// Distribute particles smoothly across a grid region (bilinear interpolation)
const positions = bilinearDistribute(row1, col1, row2, col2, count);

// Integer grid positions along a line (Bresenham's algorithm)
const line = bresenhamLine(0, 0, 10, 5);
// [[0,0], [1,0], [2,1], ..., [10,5]]
```

### Stagger effects

```typescript
import { computeStaggerDelays } from '@particle-engine/animation';

// Compute per-particle time offsets for staggered entrance
const delays = computeStaggerDelays({
  count: 20,
  totalDelay: 500,    // ms spread across all particles
  mode: 'linear',     // 'linear' | 'random' | 'center-out' | 'edge-in'
});
```

## Key Types

```typescript
interface Animation {
  id: string;
  duration: number;          // total duration in ms
  fps: number;               // frames per second
  defaultEasing: EasingSpec; // easing used when a keyframe doesn't specify one
  keyframes: Keyframe[];
  events: DiscreteEvent[];   // discrete add/remove events at specific times
}

interface Keyframe {
  time: number;              // ms from animation start
  easing: EasingSpec;        // easing TO this keyframe FROM the previous one
  particles: KeyframeParticle[];
  connections: KeyframeConnection[];
  propertyEasing?: {         // per-property easing overrides
    color?: EasingSpec;
    opacity?: EasingSpec;
    size?: EasingSpec;
  };
}

interface FrameState {
  frameIndex: number;
  time: number;              // ms
  particles: FrameParticle[];
  connections: FrameConnection[];
}
```
