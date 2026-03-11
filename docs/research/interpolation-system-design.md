# Interpolation System Design Recommendation

> Synthesized from research conducted 2026-03-11
> See `interpolation-system-research.md` for detailed research, sources, and mathematical foundations.

---

## Executive Summary

The interpolation system transforms LLM-defined keyframes into smooth animation frames on a discrete integer grid. This document specifies the recommended architecture, algorithms, and implementation strategy. The core challenge is producing perceptually smooth animation when all particles exist at integer `[row, col]` coordinates -- a problem that requires grid-specific solutions not found in traditional continuous-space animation systems.

**Key design decisions:**
1. OKLAB color space for perceptually uniform color interpolation
2. Alpha-based interpolation model (inspired by Manim) with easing as a separate transform
3. Bilinear opacity distribution for sub-grid smoothness
4. Struct-of-Arrays typed arrays for batch interpolation performance
5. Precomputed easing curves for springs and custom beziers
6. Hybrid keyframe matching (position + group + ID)

---

## 1. Recommended Architecture

### 1.1 Core Interfaces

```typescript
// === Easing ===

/** A function that maps t in [0,1] to an eased value (usually [0,1], may overshoot) */
type EasingFn = (t: number) => number;

/** Named easing or custom bezier specification */
type EasingSpec =
  | 'linear'
  | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad'
  | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  | 'easeInQuart' | 'easeOutQuart' | 'easeInOutQuart'
  | 'easeInQuint' | 'easeOutQuint' | 'easeInOutQuint'
  | 'easeInSine' | 'easeOutSine' | 'easeInOutSine'
  | 'easeInExpo' | 'easeOutExpo' | 'easeInOutExpo'
  | 'easeInCirc' | 'easeOutCirc' | 'easeInOutCirc'
  | 'easeInBack' | 'easeOutBack' | 'easeInOutBack'
  | 'easeInElastic' | 'easeOutElastic' | 'easeInOutElastic'
  | 'easeInBounce' | 'easeOutBounce' | 'easeInOutBounce'
  | { type: 'cubicBezier'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'spring'; stiffness: number; damping: number; mass: number }
  | { type: 'steps'; count: number; jump: 'start' | 'end' };


// === Keyframe ===

interface Keyframe {
  /** Time offset in milliseconds from animation start */
  time: number;

  /** Easing function for the transition TO this keyframe (from the previous one) */
  easing: EasingSpec;

  /** Per-property easing overrides (optional) */
  propertyEasing?: {
    color?: EasingSpec;
    opacity?: EasingSpec;
    size?: EasingSpec;
  };

  /** Particle states at this keyframe (sparse -- only particles that differ from previous) */
  particles: KeyframeParticle[];

  /** Connection states at this keyframe */
  connections: KeyframeConnection[];
}

interface KeyframeParticle {
  row: number;
  col: number;
  color?: string;       // hex RGB "#RRGGBB"
  opacity?: number;     // 0.0 - 1.0
  size?: number;        // multiplier
  group?: string;
}

interface KeyframeConnection {
  from: [number, number];  // [row, col]
  to: [number, number];
  color?: string;
  width?: number;
  opacity?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  curve?: number;
  directed?: boolean;
}


// === Discrete Events ===

interface DiscreteEvent {
  /** Exact time in milliseconds */
  time: number;

  /** The action to perform */
  action:
    | { type: 'addParticle'; row: number; col: number; properties?: Partial<KeyframeParticle> }
    | { type: 'removeParticle'; row: number; col: number }
    | { type: 'addConnection'; from: [number, number]; to: [number, number]; properties?: Partial<KeyframeConnection> }
    | { type: 'removeConnection'; from: [number, number]; to: [number, number] };

  /** How the event manifests visually */
  transition: 'instant' | 'fadeIn' | 'fadeOut' | 'grow' | 'shrink' | 'pop';

  /** Duration of the transition effect in ms (0 for instant) */
  transitionDuration: number;
}


// === Animation ===

interface Animation {
  id: string;
  duration: number;          // total duration in ms
  fps: number;               // target frames per second
  keyframes: Keyframe[];     // sorted by time, first must be at time=0
  events: DiscreteEvent[];   // sorted by time
  defaultEasing: EasingSpec; // fallback when keyframe doesn't specify
}


// === Interpolation Engine ===

interface InterpolationEngine {
  /**
   * Prepare an animation for playback.
   * Precomputes easing curves, keyframe matching, color conversions, etc.
   */
  prepare(animation: Animation, store: ParticleStore): PreparedAnimation;

  /**
   * Compute a single frame at the given time.
   * Returns the computed frame state (particle properties + connection properties).
   */
  computeFrame(prepared: PreparedAnimation, timeMs: number): FrameState;

  /**
   * Generate all frames as an iterator (for batch rendering).
   */
  generateFrames(prepared: PreparedAnimation): Iterator<FrameState>;
}

interface PreparedAnimation {
  animation: Animation;
  easingFns: Map<string, EasingFn>;          // precomputed/resolved easing functions
  keyframeMatches: KeyframeMatchResult[];     // particle correspondence per segment
  colorBuffers: OKLABBuffer[];               // precomputed OKLAB values per keyframe
  springCurves: Map<string, Float32Array>;    // precomputed spring lookup tables
}

interface FrameState {
  timeMs: number;
  frameIndex: number;
  particles: FrameParticle[];     // all active particles with computed properties
  connections: FrameConnection[]; // all active connections with computed properties
}

interface FrameParticle {
  row: number;
  col: number;
  colorR: number;  // 0-255 sRGB
  colorG: number;
  colorB: number;
  opacity: number; // 0.0-1.0
  size: number;    // multiplier
}

interface FrameConnection {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  colorR: number;
  colorG: number;
  colorB: number;
  opacity: number;
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
  curve: number;
  directed: boolean;
}
```

### 1.2 System Architecture Diagram

```
                    Animation Definition (from LLM)
                              |
                              v
                   +--------------------+
                   |    prepare()       |  <-- one-time precomputation
                   |  - resolve easing  |
                   |  - match keyframes |
                   |  - convert colors  |
                   |  - precompute LUTs |
                   +--------+-----------+
                            |
                    PreparedAnimation
                            |
              +-------------+-------------+
              |                           |
              v                           v
    +------------------+       +--------------------+
    | computeFrame(t)  |       | generateFrames()   |
    | (real-time)      |       | (batch rendering)  |
    +--------+---------+       +--------+-----------+
             |                          |
             v                          v
       +-----------+             +-----------+
       |  1. Find surrounding keyframes     |
       |  2. Compute local alpha            |
       |  3. Apply easing to alpha          |
       |  4. Process discrete events        |
       |  5. Interpolate particle props     |
       |     - Color (OKLAB lerp)           |
       |     - Opacity (lerp + clamp)       |
       |     - Size (lerp)                  |
       |  6. Interpolate connection props   |
       |  7. Handle appear/disappear        |
       |  8. Convert OKLAB -> sRGB          |
       |  9. Return FrameState              |
       +------------------------------------+
```

---

## 2. Specific Algorithms for Each Property Type

### 2.1 Color

**Algorithm:** OKLAB linear interpolation

**Steps:**
1. At `prepare()` time: convert all hex colors in keyframes to OKLAB (L, a, b) and store in Float32Arrays
2. At frame time: lerp L, a, b independently using the eased alpha
3. At output time: convert OKLAB back to sRGB for the FrameState

**Why OKLAB over HSL:** OKLAB produces perceptually uniform transitions. No muddy midpoints, no hue shifts. The extra conversion cost is absorbed by precomputation (step 1) and batched output (step 3).

**Edge case -- identical colors:** Skip interpolation entirely; copy the source value.

```typescript
// Pseudocode for batch color interpolation
function interpolateColors(
  fromL: Float32Array, fromA: Float32Array, fromB: Float32Array,
  toL: Float32Array, toA: Float32Array, toB: Float32Array,
  outR: Uint8Array, outG: Uint8Array, outB_: Uint8Array,
  alpha: number, count: number
): void {
  const mt = 1 - alpha;
  for (let i = 0; i < count; i++) {
    const L = fromL[i] * mt + toL[i] * alpha;
    const a = fromA[i] * mt + toA[i] * alpha;
    const b = fromB[i] * mt + toB[i] * alpha;
    oklabToSRGB(L, a, b, outR, outG, outB_, i);
  }
}
```

### 2.2 Opacity

**Algorithm:** Linear interpolation with easing, clamped to [0, 1]

```typescript
opacity_out = clamp(lerp(opacity_from, opacity_to, easedAlpha), 0, 1)
```

**Special cases:**
- Particle appearing (not in prev keyframe): lerp from 0 to target opacity
- Particle disappearing (not in next keyframe): lerp from current opacity to 0

### 2.3 Size

**Algorithm:** Linear interpolation with easing, clamped to [0, maxSize]

```typescript
size_out = clamp(lerp(size_from, size_to, easedAlpha), 0, MAX_SIZE)
```

Allow slight overshoot for `easeOutBack` and `easeOutElastic` to create "pop" effects -- clamp only to prevent negative sizes.

### 2.4 Line Width

**Algorithm:** Linear interpolation with easing, clamped to [0.1, maxWidth]

Same as size but applied to connection width.

### 2.5 Line Style

**Algorithm:** Midpoint switch (discrete)

```typescript
style_out = easedAlpha < 0.5 ? style_from : style_to
```

Style changes happen at the midpoint of the transition. No crossfade (dashed-to-dotted crossfade looks chaotic).

### 2.6 Boolean Properties (active, directed)

**Algorithm:** Mediated by opacity transition

- `active: true -> false`: Fade opacity to 0, then set active=false at t=1
- `active: false -> true`: Set active=true at t=0, then fade opacity from 0 to target
- `directed: true -> false`: Midpoint switch at t=0.5

### 2.7 Curve Factor

**Algorithm:** Linear interpolation

```typescript
curve_out = lerp(curve_from, curve_to, easedAlpha)
```

---

## 3. Grid-Specific Solutions for Smooth Animation

### 3.1 Strategy Selection by Animation Type

| Animation Type | Strategy | Rationale |
|---------------|----------|-----------|
| Property change (color, opacity, size) at fixed position | Direct interpolation | No grid challenge; particle stays in place |
| Single particle "moving" | Opacity-based bilinear distribution | Smoothest result |
| Shape/group translating | Re-rasterize at interpolated center + bilinear edges | Preserves shape integrity |
| Shape rotating | Re-rasterize at each angle with bilinear anti-aliasing | Avoids discrete rotation artifacts |
| Shape scaling | Re-rasterize at each scale with gap-filling | Handles both upscale gaps and downscale merging |
| Shape morphing into another | Radial particle mapping + bilinear interpolation | Natural-looking transitions |
| Particle appear/disappear | Fade + optional size animation | Smooth aesthetics |
| Wave/ripple effect | Per-particle opacity/size modulation | No position changes needed |
| Stagger/cascade | Time-offset per particle | Delay-based, not position-based |

### 3.2 The Bilinear Distribution System

This is the core technique for smooth grid animation. When a continuous position maps to non-integer grid coordinates, distribute the particle's visual "weight" across 2-4 surrounding cells:

```typescript
interface SubGridParticle {
  row: number;
  col: number;
  weight: number;  // 0.0 to 1.0, represents contribution
}

function bilinearDistribute(
  continuousR: number,
  continuousC: number
): SubGridParticle[] {
  const rFloor = Math.floor(continuousR);
  const cFloor = Math.floor(continuousC);
  const rFrac = continuousR - rFloor;
  const cFrac = continuousC - cFloor;

  const particles: SubGridParticle[] = [];

  const w00 = (1 - rFrac) * (1 - cFrac);
  const w01 = (1 - rFrac) * cFrac;
  const w10 = rFrac * (1 - cFrac);
  const w11 = rFrac * cFrac;

  if (w00 > 0.01) particles.push({ row: rFloor,     col: cFloor,     weight: w00 });
  if (w01 > 0.01) particles.push({ row: rFloor,     col: cFloor + 1, weight: w01 });
  if (w10 > 0.01) particles.push({ row: rFloor + 1, col: cFloor,     weight: w10 });
  if (w11 > 0.01) particles.push({ row: rFloor + 1, col: cFloor + 1, weight: w11 });

  return particles;
}
```

The `weight` modulates the particle's opacity (and optionally size) at each grid cell. The visual effect is a particle that appears to "slide" smoothly between grid positions.

**Integration with the rendering pipeline:** The renderer must support receiving multiple sub-grid particles per logical particle. During frame generation, each animated particle that is at a non-integer continuous position is expanded into 1-4 FrameParticles with adjusted opacity.

### 3.3 Group Animation (Shape Movement)

When a group of particles (forming a shape) moves:

1. Compute the group's centroid in the source and target keyframes
2. Interpolate the centroid position continuously
3. Apply each particle's offset from the centroid
4. For particles near the shape boundary, apply bilinear distribution

```typescript
function animateGroup(
  group: GroupedParticles,
  fromCentroid: [number, number],
  toCentroid: [number, number],
  easedAlpha: number
): FrameParticle[] {
  const currentR = lerp(fromCentroid[0], toCentroid[0], easedAlpha);
  const currentC = lerp(fromCentroid[1], toCentroid[1], easedAlpha);

  const result: FrameParticle[] = [];

  for (const particle of group.particles) {
    const absoluteR = currentR + particle.offsetR;
    const absoluteC = currentC + particle.offsetC;

    // If position is near-integer, just round
    if (Math.abs(absoluteR - Math.round(absoluteR)) < 0.05 &&
        Math.abs(absoluteC - Math.round(absoluteC)) < 0.05) {
      result.push({
        row: Math.round(absoluteR),
        col: Math.round(absoluteC),
        opacity: particle.opacity,
        // ... other properties interpolated separately
      });
    } else {
      // Bilinear distribution
      for (const sub of bilinearDistribute(absoluteR, absoluteC)) {
        result.push({
          row: sub.row,
          col: sub.col,
          opacity: particle.opacity * sub.weight,
          // ... other properties
        });
      }
    }
  }

  return result;
}
```

---

## 4. Performance Strategies

### 4.1 Memory Layout

Use Struct-of-Arrays (SoA) with typed arrays for all animation data:

```typescript
class AnimationBufferPool {
  private buffers: Map<number, AnimationBuffer> = new Map();

  /** Get or create a buffer for the given particle count */
  acquire(particleCount: number): AnimationBuffer {
    // Round up to nearest power of 2 for reuse
    const size = nextPowerOf2(particleCount);

    if (this.buffers.has(size)) {
      return this.buffers.get(size)!;
    }

    const buf: AnimationBuffer = {
      fromOpacity:  new Float32Array(size),
      fromSize:     new Float32Array(size),
      fromColorL:   new Float32Array(size),
      fromColorA:   new Float32Array(size),
      fromColorB:   new Float32Array(size),
      toOpacity:    new Float32Array(size),
      toSize:       new Float32Array(size),
      toColorL:     new Float32Array(size),
      toColorA:     new Float32Array(size),
      toColorB:     new Float32Array(size),
      outOpacity:   new Float32Array(size),
      outSize:      new Float32Array(size),
      outColorR:    new Uint8Array(size),
      outColorG:    new Uint8Array(size),
      outColorB:    new Uint8Array(size),
    };

    this.buffers.set(size, buf);
    return buf;
  }
}
```

### 4.2 Precomputation at prepare() Time

| What | How | Cost |
|------|-----|------|
| Easing function resolution | Map EasingSpec names to EasingFn functions | ~0.01ms |
| Spring curve precomputation | Simulate 120 steps per unique spring config | ~0.1ms per spring |
| Custom bezier compilation | Create bezier-easing instance per unique bezier | ~0.01ms per bezier |
| Hex color -> OKLAB conversion | Parse hex, linearize sRGB, apply M1, cbrt, apply M2 | ~0.05ms per 1000 particles |
| Keyframe particle matching | Hash-based matching by position/group | ~0.1ms per 1000 particles |
| Bresenham paths (if needed) | Compute integer paths for grid movement | ~0.01ms per path |
| Stagger delays | Compute delay per particle once | ~0.01ms per 1000 particles |

**Total prepare() cost for 10,000 particles:** < 1ms

### 4.3 Per-Frame Computation Budget

Target: < 2ms per frame for 10,000 particles at 60fps

| Operation | Cost (10K particles) | Notes |
|-----------|---------------------|-------|
| Find keyframes (binary search) | ~0.001ms | O(log n) in keyframe count |
| Compute alpha + easing | ~0.001ms | Single function call |
| Batch opacity lerp | ~0.05ms | Tight Float32Array loop |
| Batch size lerp | ~0.05ms | Tight Float32Array loop |
| Batch color lerp (OKLAB) | ~0.15ms | Three Float32Array loops |
| OKLAB -> sRGB conversion | ~0.3ms | Math.pow per channel per particle |
| Bilinear distribution | ~0.2ms | Only for moving particles |
| Process discrete events | ~0.01ms | Typically few events per frame |
| Assemble FrameState | ~0.1ms | Array construction |
| **Total** | **~0.9ms** | Well within 2ms budget |

### 4.4 Optimization Techniques

1. **Skip unchanged particles:** If a particle's properties are identical in both surrounding keyframes and no discrete event affects it, skip interpolation entirely.

2. **Dirty flags:** Track which property channels have changes in each keyframe segment. Only interpolate dirty channels.

3. **OKLAB fast path:** For particles where both keyframe colors are identical, skip the OKLAB->sRGB conversion and copy the color directly.

4. **Easing LUT for springs:** Pre-sampled to 120 entries. Lookup with linear interpolation between samples. Total cost: 2 array accesses + 1 lerp per particle.

5. **Batch OKLAB->sRGB:** The `Math.pow(x, 1/2.4)` in gamma correction is the bottleneck. For higher performance, use a lookup table (256 entries) or approximate with `x * (0.4672 + x * (0.5328 + x * 0))` (polynomial approximation with < 0.5% error).

### 4.5 Frame Caching Strategy

| Mode | Strategy |
|------|----------|
| Batch render (video export) | No caching; compute-and-pipe each frame sequentially |
| Real-time playback (preview) | No caching; compute on requestAnimationFrame |
| Timeline scrubbing | LRU cache of ~60 frames; invalidate on keyframe edit |
| Thumbnail strip | Precompute every Nth frame (e.g., 1 per second) |

---

## 5. Implementation Priority Order

### Phase 1: Core Interpolation (Must-Have)

**Priority 1 -- Basic frame generation:**
- [ ] `InterpolationEngine.prepare()` with keyframe matching by position
- [ ] `InterpolationEngine.computeFrame()` with linear interpolation for all numeric properties
- [ ] RGB color interpolation (simpler than OKLAB; upgrade later)
- [ ] `InterpolationEngine.generateFrames()` iterator
- [ ] Basic easing functions: linear, easeInOutCubic, easeInOutQuad

**Priority 2 -- Essential easing library:**
- [ ] All 30 Penner easing functions (pure functions, no dependencies)
- [ ] Cubic bezier easing (port bezier-easing algorithm, ~100 lines)
- [ ] Step function easing

**Priority 3 -- Discrete events:**
- [ ] Particle add/remove events with fade in/out transitions
- [ ] Connection add/remove events with opacity transitions
- [ ] Event processing integrated into frame computation

### Phase 2: Quality (Should-Have)

**Priority 4 -- OKLAB color interpolation:**
- [ ] sRGB -> OKLAB conversion functions
- [ ] OKLAB -> sRGB conversion functions
- [ ] Precomputed OKLAB buffers in prepare()
- [ ] Batch OKLAB interpolation

**Priority 5 -- Grid smoothness:**
- [ ] Bilinear opacity distribution for sub-grid positioning
- [ ] Group centroid tracking and shape re-rasterization
- [ ] Anti-aliased circle/shape boundaries during movement

**Priority 6 -- Per-property easing:**
- [ ] PropertyEasing support in keyframes
- [ ] Different easing curves for color vs opacity vs size

**Priority 7 -- Keyframe matching improvements:**
- [ ] Group-based matching (match by group name + relative offset)
- [ ] ID-based matching fallback

### Phase 3: Advanced (Nice-to-Have)

**Priority 8 -- Spring physics:**
- [ ] Spring simulation with precomputed lookup tables
- [ ] Spring config presets (gentle, wobbly, stiff, etc.)

**Priority 9 -- Advanced motion:**
- [ ] Catmull-Rom spline interpolation across 3+ keyframes
- [ ] Stagger/cascade delay system
- [ ] Wave propagation effect

**Priority 10 -- Morphing and effects:**
- [ ] Shape-to-shape morphing with radial particle mapping
- [ ] Motion blur simulation (trail of fading particles)
- [ ] Grid rotation with bilinear anti-aliasing
- [ ] Grid scaling with gap-filling

**Priority 11 -- Performance optimization:**
- [ ] AnimationBuffer pool with typed array reuse
- [ ] Dirty flag optimization (skip unchanged properties)
- [ ] OKLAB fast path for identical colors
- [ ] Frame cache with LRU eviction for scrubbing

---

## 6. TypeScript Module Structure

Within `packages/animation/`:

```
packages/animation/
  src/
    index.ts                      -- Public API exports
    types.ts                      -- All interface/type definitions
    engine/
      interpolation-engine.ts     -- Main InterpolationEngine class
      frame-generator.ts          -- Iterator-based frame generation
      keyframe-matcher.ts         -- Particle matching across keyframes
      event-processor.ts          -- Discrete event handling
    easing/
      index.ts                    -- Easing function registry + resolver
      penner.ts                   -- All 30 Penner easing functions
      bezier.ts                   -- Cubic bezier easing (ported algorithm)
      spring.ts                   -- Spring physics simulator + LUT
      steps.ts                    -- Step function
      compose.ts                  -- Easing composition (chain, blend)
    interpolators/
      numeric.ts                  -- lerp, clampedLerp, etc.
      color.ts                    -- OKLAB conversion + interpolation
      discrete.ts                 -- Boolean/enum property transitions
      grid-position.ts            -- Bilinear distribution, Bresenham paths
    effects/
      stagger.ts                  -- Stagger/cascade delay computation
      morph.ts                    -- Shape-to-shape morphing
      wave.ts                     -- Wave propagation
      trail.ts                    -- Motion trail / blur
      spawn-death.ts              -- Particle appear/disappear curves
    buffers/
      animation-buffer.ts         -- SoA typed array buffers
      buffer-pool.ts              -- Buffer allocation and reuse
      frame-cache.ts              -- LRU frame cache
    utils/
      math.ts                     -- clamp, smoothstep, hash, etc.
      oklab.ts                    -- OKLAB/OKLCH conversion utilities
  tests/
    easing.test.ts
    color-interpolation.test.ts
    grid-position.test.ts
    keyframe-matcher.test.ts
    frame-generator.test.ts
    stagger.test.ts
```

---

## 7. LLM-Facing Animation API (Tool Call Format)

The `create_animation` tool call from the LLM maps directly to the `Animation` interface:

```json
{
  "tool": "create_animation",
  "params": {
    "duration": 3000,
    "fps": 30,
    "defaultEasing": "easeInOutCubic",
    "keyframes": [
      {
        "time": 0,
        "particles": [
          { "row": 10, "col": 10, "color": "#FF0000", "opacity": 1.0, "group": "dot" }
        ],
        "connections": []
      },
      {
        "time": 1500,
        "easing": "easeOutElastic",
        "particles": [
          { "row": 10, "col": 10, "color": "#0000FF", "opacity": 1.0, "size": 2.0, "group": "dot" }
        ],
        "connections": []
      },
      {
        "time": 3000,
        "easing": "easeInOutQuad",
        "particles": [
          { "row": 10, "col": 10, "color": "#00FF00", "opacity": 0.5, "size": 1.0, "group": "dot" }
        ],
        "connections": []
      }
    ],
    "events": [
      {
        "time": 500,
        "action": { "type": "addParticle", "row": 15, "col": 15, "properties": { "color": "#FFFF00" } },
        "transition": "grow",
        "transitionDuration": 300
      }
    ]
  }
}
```

This format is LLM-friendly because:
- Keyframes are self-contained JSON objects
- Easing is specified by name (the LLM does not need to know the math)
- Sparse specification: only changed particles need to be listed
- Events handle non-interpolatable changes explicitly

---

## 8. Key Design Decisions Summary

| Decision | Choice | Alternative Considered | Rationale |
|----------|--------|----------------------|-----------|
| Color space | OKLAB | RGB, HSL, OKLCH | Perceptually uniform, no muddy midpoints, adopted by major tools |
| Easing model | Alpha with separate easing transform | Time-based easing | Clean separation of concerns; Manim-proven; reversible |
| Grid smoothness | Bilinear opacity distribution | Bresenham stepping, trail effects | Smoothest visual result; renderer already supports per-particle opacity |
| Keyframe matching | Position-first, group-fallback | ID-only, position-only | Natural for grid system; groups handle shape movement |
| Data layout | SoA typed arrays | AoS objects | 3-5x faster batch operations; cache-friendly |
| Spring easing | Precomputed LUT | Real-time simulation | Fixed-duration keyframes require deterministic output; LUT is O(1) per frame |
| Missing particles | Fade out during transition | Instant removal | Smooth aesthetics; consistent with professional animation tools |
| Line style changes | Midpoint switch | Crossfade | Crossfade of dash patterns is visually confusing |
| Path interpolation | Linear (default) + optional Catmull-Rom | Always Catmull-Rom | Linear is sufficient with easing; Catmull-Rom adds complexity |
| Frame caching | Compute-on-demand; optional LRU for scrubbing | Full precomputation | Memory efficient; precomputation waste for sequential playback |
