# Deep Research: Interpolation Systems for Grid-Based Particle Animation

> Research conducted: 2026-03-11
> Purpose: Drive the design of the animation interpolation system -- the most critical component of the particle engine's animation pipeline.
> Context: Particles exist on a pure integer grid `[row, col]`. An LLM defines keyframes and the engine interpolates between them to generate smooth animation frames.

---

## Table of Contents

1. [Property Interpolation Methods](#1-property-interpolation-methods)
2. [Easing Functions -- Deep Dive](#2-easing-functions----deep-dive)
3. [Grid-Specific Interpolation Challenges](#3-grid-specific-interpolation-challenges)
4. [Path Interpolation](#4-path-interpolation)
5. [Keyframe System Design](#5-keyframe-system-design)
6. [Advanced Interpolation Techniques](#6-advanced-interpolation-techniques)
7. [Performance and Implementation](#7-performance-and-implementation)
8. [Reference Implementations](#8-reference-implementations)
9. [Sources](#9-sources)

---

## 1. Property Interpolation Methods

### 1.1 Color Interpolation

Color interpolation is one of the most visible aspects of animation quality. The choice of color space for interpolation dramatically affects the perceived smoothness of transitions.

#### RGB Interpolation

The simplest approach: linearly interpolate each channel (R, G, B) independently.

```typescript
function lerpRGB(c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] {
  return [
    c1[0] + (c2[0] - c1[0]) * t,
    c1[1] + (c2[1] - c1[1]) * t,
    c1[2] + (c2[2] - c1[2]) * t,
  ];
}
```

**Problems with RGB interpolation:**
- Passes through unnatural "muddy" midpoints (e.g., red-to-cyan goes through dark gray)
- Brightness dips in the middle of transitions (the "dark band" problem)
- Not perceptually uniform -- equal numeric steps do not correspond to equal visual steps
- Red (#FF0000) to green (#00FF00) produces a murky brown at t=0.5: (#808000)

**When to use:** Only when performance is critical and quality is secondary, or for interpolating within a very narrow color range where the problems are not visible.

#### HSL Interpolation

Interpolate in Hue-Saturation-Lightness space. Separates the "what color" (hue) from "how vivid" (saturation) and "how bright" (lightness).

```typescript
function lerpHSL(c1: HSL, c2: HSL, t: number): HSL {
  // Handle hue wrap-around (0-360 degrees)
  let dh = c2.h - c1.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;

  return {
    h: (c1.h + dh * t + 360) % 360,
    s: c1.s + (c2.s - c1.s) * t,
    l: c1.l + (c2.l - c1.l) * t,
  };
}
```

**Advantages over RGB:**
- Transitions through the hue spectrum rather than through gray
- Preserves saturation during transitions
- The hue wrap-around handling allows shortest-path transitions (red to blue goes through purple, not through green/cyan/blue)

**Problems with HSL:**
- Perceptually non-uniform: equal steps in H, S, or L do not produce equal visual steps
- "Blue" occupies a disproportionately large range while "yellow" is compressed
- Lightness is not perceptual lightness -- HSL L=50% can appear vastly different across hues
- Hue shifts can occur during saturation/lightness transitions
- Problematic for near-gray colors (hue becomes undefined/unstable)

**When to use:** A good default for most animation work. Handles most color transitions adequately.

#### OKLAB Interpolation (Recommended)

OKLAB is a perceptually uniform color space designed by Bjorn Ottosson in 2020. It was specifically optimized for smooth gradients and color manipulation.

**Conversion from sRGB to OKLAB:**

```
Step 1: sRGB -> Linear RGB (remove gamma)
  r_lin = r_sRGB <= 0.04045 ? r_sRGB / 12.92 : ((r_sRGB + 0.055) / 1.055)^2.4

Step 2: Linear RGB -> LMS cone response (M1 matrix)
  | l |   | 0.4122214708  0.5363325363  0.0514459929 |   | r_lin |
  | m | = | 0.2119034982  0.6806995451  0.1073969566 | * | g_lin |
  | s |   | 0.0883024619  0.2817188376  0.6299787005 |   | b_lin |

Step 3: Apply cube root nonlinearity
  l' = cbrt(l),  m' = cbrt(m),  s' = cbrt(s)

Step 4: LMS' -> Lab (M2 matrix)
  | L |   | 0.2104542553  0.7936177850 -0.0040720468 |   | l' |
  | a | = | 1.9779984951 -2.4285922050  0.4505937099 | * | m' |
  | b |   | 0.0259040371  0.7827717662 -0.8086757660 |   | s' |
```

**Interpolation in OKLAB is trivially linear:**

```typescript
function lerpOKLAB(c1: OKLAB, c2: OKLAB, t: number): OKLAB {
  return {
    L: c1.L + (c2.L - c1.L) * t,
    a: c1.a + (c2.a - c1.a) * t,
    b: c1.b + (c2.b - c1.b) * t,
  };
}
```

**Advantages:**
- Perceptually uniform: equal numeric steps produce equal visual steps
- No muddy midpoints -- transitions are clean and natural
- Lightness (L) accurately predicts perceived brightness across all hues
- The a/b axes represent chroma and hue independently
- Color modifications in one dimension minimally affect others
- Now supported natively in CSS Color Level 4 (Chrome, Firefox, Safari)
- Adopted by Photoshop for gradient interpolation, Unity, and Godot

**Edge cases handled well:**
- Red to green: smooth transition through warm orange/yellow tones (not murky brown)
- Across hue boundaries: consistent perceptual distance at every step
- Near-gray colors: stable behavior (unlike HSL where hue becomes undefined)
- Black to white: perfect linear lightness ramp

**Performance cost:** Approximately 3-4x more expensive than RGB interpolation due to the matrix multiplications and cube root operations. However, this can be mitigated by precomputing the OKLAB values for particle colors at keyframe time and only converting back to sRGB for rendering.

#### OKLCH Interpolation

OKLCH is the cylindrical (polar) form of OKLAB, analogous to how HSL relates to RGB:

```
Chroma: C = sqrt(a^2 + b^2)
Hue:    h = atan2(b, a)
```

**When to use OKLCH instead of OKLAB:** When you want to interpolate hue while keeping chroma/lightness constant (e.g., a "rainbow" transition). OKLCH handles hue wrap-around naturally, while OKLAB interpolation in the rectangular a/b plane can produce chroma dips during hue transitions.

#### Recommendation for the Particle Engine

**Primary:** OKLAB for all color interpolation. Convert particle colors from hex RGB to OKLAB at keyframe load time, interpolate in OKLAB space, and convert back to RGB only at render time.

**Fallback:** HSL with shortest-path hue interpolation for cases where OKLAB conversion overhead matters (extremely high particle counts with per-particle color animation).

**Implementation:** Precompute OKLAB values in Float32Array (3 floats per particle: L, a, b). During interpolation, lerp the Float32Arrays directly. Convert to Uint8Array RGB only in the final render pass.

### 1.2 Numeric Property Interpolation

Numeric properties (opacity, size, line width, curve factor) are the simplest to interpolate.

#### Linear Interpolation (Lerp)

```typescript
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
  // Numerically equivalent to: a * (1 - t) + b * t
  // But the first form has less floating-point error when t is near 0 or 1
}
```

The `t` parameter is the normalized time (0.0 to 1.0), typically modified by an easing function before being passed to `lerp`.

#### Clamped vs. Unclamped Interpolation

For opacity (0-1 range) and other bounded properties, clamping after interpolation is essential to prevent out-of-range values, especially when using easing functions like `easeOutBack` that overshoot:

```typescript
function clampedLerp(a: number, b: number, t: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, lerp(a, b, t)));
}
```

For properties like `size` (multiplier), some overshoot from easing functions can create a pleasing "bounce" effect and should not be clamped.

#### Multiplicative vs. Additive Interpolation

For size multipliers, consider whether interpolation should be linear or logarithmic:

- **Linear:** `lerp(1.0, 4.0, 0.5) = 2.5` -- half the visual "jump" appears to happen in the first third of the transition
- **Logarithmic:** `exp(lerp(ln(1.0), ln(4.0), 0.5)) = 2.0` -- perceptually uniform scaling

For our particle engine, linear interpolation is sufficient for size multipliers since the typical range is small (0.5x to 3.0x).

### 1.3 Integer-Constrained Interpolation (Grid Position)

This is the most challenging interpolation problem for a grid-based system. Particles MUST exist at integer `[row, col]` coordinates -- there is no continuous position space.

#### The Fundamental Problem

Traditional animation interpolates continuous positions: a circle at (100.0, 200.0) moves smoothly to (150.0, 300.0) by passing through (125.0, 250.0) at t=0.5. On a grid, position (12.5, 25.0) does not exist. The particle must be at either (12, 25) or (13, 25).

#### Approach 1: Bresenham-like Grid Walking

Use Bresenham's line algorithm to compute the sequence of integer grid cells along a path. Each intermediate "position" in the animation is an integer cell.

```typescript
function bresenhamPath(r0: number, c0: number, r1: number, c1: number): [number, number][] {
  const path: [number, number][] = [];
  let dr = Math.abs(r1 - r0);
  let dc = Math.abs(c1 - c0);
  let sr = r0 < r1 ? 1 : -1;
  let sc = c0 < c1 ? 1 : -1;
  let err = dr - dc;
  let r = r0, c = c0;

  while (true) {
    path.push([r, c]);
    if (r === r1 && c === c1) break;
    const e2 = 2 * err;
    if (e2 > -dc) { err -= dc; r += sr; }
    if (e2 < dr)  { err += dr; c += sc; }
  }
  return path;
}
```

The animation then steps through this path at a rate determined by the easing function:

```typescript
function getGridPosition(path: [number, number][], easedT: number): [number, number] {
  const index = Math.round(easedT * (path.length - 1));
  return path[Math.min(index, path.length - 1)];
}
```

**Advantage:** Clean, deterministic stepping. Each frame shows a particle at a valid grid position.

**Limitation:** Movement appears "jumpy" for short distances because there are only a few steps (e.g., moving 3 cells diagonally only has 3-4 intermediate positions).

#### Approach 2: Opacity-Based Sub-Grid Positioning (Recommended for Smoothness)

Instead of moving a single particle, simulate smooth movement using opacity to create "anti-aliased" motion:

```typescript
function interpolateGridPosition(
  r0: number, c0: number, r1: number, c1: number, t: number
): { row: number; col: number; opacity: number }[] {
  // Continuous interpolated position
  const rCont = r0 + (r1 - r0) * t;
  const cCont = c0 + (c1 - c0) * t;

  // Four surrounding grid cells
  const rFloor = Math.floor(rCont);
  const cFloor = Math.floor(cCont);
  const rFrac = rCont - rFloor;
  const cFrac = cCont - cFloor;

  // Bilinear weights (opacity values)
  return [
    { row: rFloor,     col: cFloor,     opacity: (1 - rFrac) * (1 - cFrac) },
    { row: rFloor,     col: cFloor + 1, opacity: (1 - rFrac) * cFrac },
    { row: rFloor + 1, col: cFloor,     opacity: rFrac * (1 - cFrac) },
    { row: rFloor + 1, col: cFloor + 1, opacity: rFrac * cFrac },
  ].filter(p => p.opacity > 0.01);  // Skip negligible contributions
}
```

This is essentially **bilinear interpolation** applied to the grid. The particle "exists" at up to 4 grid positions simultaneously, with opacity weights summing to 1.0. The visual effect is a smooth, anti-aliased motion path.

**Advantage:** Produces visually smooth movement even for short distances.

**Consideration:** Requires the renderer to support per-particle opacity and to render multiple "ghost" particles per logical particle during transitions.

#### Approach 3: Trail-Based Motion (Fade In/Out)

For a more stylistic approach: the particle at the old position fades out while the particle at the new position fades in, with a configurable overlap.

```typescript
function trailInterpolation(
  r0: number, c0: number, r1: number, c1: number, t: number, overlap: number = 0.3
): { row: number; col: number; opacity: number }[] {
  const results: { row: number; col: number; opacity: number }[] = [];

  // Old position fades out over [0, 0.5 + overlap/2]
  if (t < 0.5 + overlap / 2) {
    const fadeOut = 1 - t / (0.5 + overlap / 2);
    results.push({ row: r0, col: c0, opacity: fadeOut });
  }

  // New position fades in over [0.5 - overlap/2, 1]
  if (t > 0.5 - overlap / 2) {
    const fadeIn = (t - (0.5 - overlap / 2)) / (0.5 + overlap / 2);
    results.push({ row: r1, col: c1, opacity: Math.min(1, fadeIn) });
  }

  return results;
}
```

### 1.4 Boolean/Discrete Property Transitions

Properties like `active` (boolean), `style` (solid/dashed/dotted), and `directed` (boolean) cannot be smoothly interpolated.

#### Strategy 1: Midpoint Switch (Default)

Change the property at t=0.5 (halfway through the transition):

```typescript
function discreteSwitch<T>(a: T, b: T, t: number): T {
  return t < 0.5 ? a : b;
}
```

#### Strategy 2: Fade Through Zero Opacity

For `active` boolean, use opacity as a proxy:
- `active: true -> false`: Fade opacity from 1.0 to 0.0, then set `active = false`
- `active: false -> true`: Set `active = true`, then fade opacity from 0.0 to 1.0

```typescript
function activeTransition(wasActive: boolean, willBeActive: boolean, t: number): { active: boolean; opacity: number } {
  if (wasActive && !willBeActive) {
    // Fade out
    return { active: true, opacity: 1 - t };
  }
  if (!wasActive && willBeActive) {
    // Fade in
    return { active: true, opacity: t };
  }
  // Both same state
  return { active: wasActive, opacity: wasActive ? 1 : 0 };
}
```

#### Strategy 3: Crossfade for Style Changes

For line style transitions (solid -> dashed), render both styles simultaneously with complementary opacities:

```typescript
function styleCrossfade(styleA: string, styleB: string, t: number): { style: string; opacity: number }[] {
  if (styleA === styleB) return [{ style: styleA, opacity: 1 }];
  return [
    { style: styleA, opacity: 1 - t },
    { style: styleB, opacity: t },
  ];
}
```

#### Strategy 4: Step Function (CSS-like)

For deliberate "staccato" changes, use a step function that changes at a specific point:

```typescript
function step(a: any, b: any, t: number, stepAt: number = 0.5): any {
  return t < stepAt ? a : b;
}
```

#### Recommendation

- **Particle active/inactive:** Fade through opacity (Strategy 2)
- **Connection appearance/disappearance:** Fade through opacity (Strategy 2)
- **Line style changes:** Midpoint switch (Strategy 1) -- crossfade is visually confusing for line patterns
- **Directed flag changes:** Midpoint switch (Strategy 1)
- **Group/layer changes:** Instant at event time (no interpolation needed)

---

## 2. Easing Functions -- Deep Dive

Easing functions transform a linear time parameter `t` (0 to 1) into a non-linear output that controls the rate of change of animated properties. They are the primary tool for making animation feel natural rather than mechanical.

### 2.1 Mathematical Foundations (Robert Penner's Equations)

Robert Penner formalized easing functions in 2002 with a consistent API:

```
f(t, b, c, d)
  t = current time (0 to d)
  b = beginning value
  c = change in value (end - beginning)
  d = total duration
```

Modern implementations normalize to:

```
f(t)  where t is in [0, 1], returns value in [0, 1] (approximately)
```

The 30 standard easing functions fall into three categories per base function:
- **In:** Acceleration from zero velocity
- **Out:** Deceleration to zero velocity
- **InOut:** Acceleration then deceleration

### 2.2 All Standard Easing Curves

#### Polynomial Easings

**Quadratic (power of 2):**
```
easeInQuad(t)    = t^2
easeOutQuad(t)   = 1 - (1-t)^2  = t * (2 - t)
easeInOutQuad(t) = t < 0.5 ? 2*t^2 : 1 - (-2*t + 2)^2 / 2
```

**Cubic (power of 3):**
```
easeInCubic(t)    = t^3
easeOutCubic(t)   = 1 - (1-t)^3
easeInOutCubic(t) = t < 0.5 ? 4*t^3 : 1 - (-2*t + 2)^3 / 2
```

**Quartic (power of 4):**
```
easeInQuart(t)    = t^4
easeOutQuart(t)   = 1 - (1-t)^4
easeInOutQuart(t) = t < 0.5 ? 8*t^4 : 1 - (-2*t + 2)^4 / 2
```

**Quintic (power of 5):**
```
easeInQuint(t)    = t^5
easeOutQuint(t)   = 1 - (1-t)^5
easeInOutQuint(t) = t < 0.5 ? 16*t^5 : 1 - (-2*t + 2)^5 / 2
```

**General pattern:**
```
easeIn_n(t)    = t^n
easeOut_n(t)   = 1 - (1-t)^n
easeInOut_n(t) = t < 0.5 ? 2^(n-1) * t^n : 1 - (-2*t + 2)^n / 2
```

#### Trigonometric Easings

**Sinusoidal:**
```
easeInSine(t)    = 1 - cos(t * PI / 2)
easeOutSine(t)   = sin(t * PI / 2)
easeInOutSine(t) = -(cos(PI * t) - 1) / 2
```

**Circular:**
```
easeInCirc(t)    = 1 - sqrt(1 - t^2)
easeOutCirc(t)   = sqrt(1 - (t-1)^2)
easeInOutCirc(t) = t < 0.5
                    ? (1 - sqrt(1 - (2t)^2)) / 2
                    : (sqrt(1 - (-2t + 2)^2) + 1) / 2
```

#### Exponential Easing

```
easeInExpo(t)    = t === 0 ? 0 : 2^(10*t - 10)
easeOutExpo(t)   = t === 1 ? 1 : 1 - 2^(-10*t)
easeInOutExpo(t) = t === 0 ? 0 : t === 1 ? 1
                    : t < 0.5 ? 2^(20*t - 10) / 2
                    : (2 - 2^(-20*t + 10)) / 2
```

#### Overshoot Easings

**Back (overshoots, then returns):**
```
c1 = 1.70158  (10% overshoot, empirically chosen)
c2 = c1 * 1.525

easeInBack(t)    = (c1 + 1) * t^3 - c1 * t^2
easeOutBack(t)   = 1 + (c1 + 1) * (t-1)^3 + c1 * (t-1)^2
easeInOutBack(t) = t < 0.5
                    ? ((2t)^2 * ((c2+1) * 2t - c2)) / 2
                    : ((2t-2)^2 * ((c2+1) * (2t-2) + c2) + 2) / 2
```

**Elastic (spring-like oscillation):**
```
c4 = (2 * PI) / 3
c5 = (2 * PI) / 4.5

easeInElastic(t)    = t === 0 ? 0 : t === 1 ? 1
                      : -2^(10*t - 10) * sin((10*t - 10.75) * c4)
easeOutElastic(t)   = t === 0 ? 0 : t === 1 ? 1
                      : 2^(-10*t) * sin((10*t - 0.75) * c4) + 1
easeInOutElastic(t) = t === 0 ? 0 : t === 1 ? 1
                      : t < 0.5
                        ? -(2^(20*t - 10) * sin((20*t - 11.125) * c5)) / 2
                        : (2^(-20*t + 10) * sin((20*t - 11.125) * c5)) / 2 + 1
```

**Bounce:**
```
easeOutBounce(t) =
  if t < 1/2.75:    7.5625 * t^2
  elif t < 2/2.75:  7.5625 * (t - 1.5/2.75)^2 + 0.75
  elif t < 2.5/2.75: 7.5625 * (t - 2.25/2.75)^2 + 0.9375
  else:              7.5625 * (t - 2.625/2.75)^2 + 0.984375

easeInBounce(t)    = 1 - easeOutBounce(1 - t)
easeInOutBounce(t) = t < 0.5
                      ? (1 - easeOutBounce(1 - 2*t)) / 2
                      : (1 + easeOutBounce(2*t - 1)) / 2
```

### 2.3 Custom Cubic Bezier Curves

The CSS `cubic-bezier(x1, y1, x2, y2)` function defines a cubic Bezier curve with:
- Start point fixed at (0, 0)
- End point fixed at (1, 1)
- Two control points: (x1, y1) and (x2, y2)

**Mathematical definition:**

The curve is parametric in a parameter `u` (0 to 1):

```
X(u) = 3(1-u)^2 * u * x1 + 3(1-u) * u^2 * x2 + u^3
Y(u) = 3(1-u)^2 * u * y1 + 3(1-u) * u^2 * y2 + u^3
```

**The root-finding problem:**

Given a time value `t` (which is the X coordinate), we need to find the corresponding `u` parameter, then compute Y(u). This requires solving:

```
3(1-u)^2 * u * x1 + 3(1-u) * u^2 * x2 + u^3 = t
```

This is a cubic equation in `u` and cannot be solved analytically in the general case.

**Algorithm (as used by `bezier-easing` library, Firefox, and Chrome):**

1. **Sample the curve:** Precompute X(u) for evenly spaced u values (typically 11 samples)
2. **Initial estimate:** Binary search in the sample table to find the two u values that bracket the target X
3. **Refinement:** Apply Newton-Raphson iteration:
   ```
   u_next = u - (X(u) - t) / X'(u)
   where X'(u) = 3 * (1-u)^2 * x1 + 6 * (1-u) * u * (x2 - x1) + 3 * u^2 * (1 - x2)
   ```
4. **Fallback:** If Newton-Raphson does not converge (slope near zero), fall back to bisection search
5. **Compute Y:** Once u is found, compute Y(u)

**CSS-equivalent bezier values for standard easings:**

| Easing | cubic-bezier |
|--------|-------------|
| ease | (0.25, 0.1, 0.25, 1.0) |
| ease-in | (0.42, 0, 1.0, 1.0) |
| ease-out | (0, 0, 0.58, 1.0) |
| ease-in-out | (0.42, 0, 0.58, 1.0) |
| easeInQuad (approx) | (0.55, 0.085, 0.68, 0.53) |
| easeOutQuad (approx) | (0.25, 0.46, 0.45, 0.94) |
| easeInOutQuad (approx) | (0.455, 0.03, 0.515, 0.955) |
| easeInCubic (approx) | (0.55, 0.055, 0.675, 0.19) |
| easeOutCubic (approx) | (0.215, 0.61, 0.355, 1.0) |
| easeInOutCubic (approx) | (0.645, 0.045, 0.355, 1.0) |

Note: Penner easing functions like Elastic, Bounce, and Back cannot be exactly represented as cubic beziers because they involve oscillations or piecewise functions.

### 2.4 Spring-Based Easing

Spring physics produce natural, organic motion that is fundamentally different from mathematical easing curves. Springs are time-independent -- they converge to a target based on physical simulation, not on a fixed duration.

**The physics model:**

```
Hooke's Law:       F_spring  = -k * x       (restoring force)
Damping force:     F_damping = -d * v       (friction)
Newton's 2nd Law:  F = m * a

Combined:  a = (-k * x - d * v) / m

Where:
  k = stiffness (spring constant)
  d = damping coefficient
  v = velocity
  x = displacement from equilibrium
  m = mass
```

**Numerical integration (Euler method):**

```typescript
function springStep(
  state: { position: number; velocity: number },
  target: number,
  config: { stiffness: number; damping: number; mass: number },
  dt: number = 1 / 60
): { position: number; velocity: number } {
  const displacement = state.position - target;
  const springForce = -config.stiffness * displacement;
  const dampingForce = -config.damping * state.velocity;
  const acceleration = (springForce + dampingForce) / config.mass;

  const newVelocity = state.velocity + acceleration * dt;
  const newPosition = state.position + newVelocity * dt;

  return { position: newPosition, velocity: newVelocity };
}
```

**Common parameter presets:**

| Preset | Stiffness | Damping | Mass | Character |
|--------|-----------|---------|------|-----------|
| Gentle | 100 | 10 | 1 | Slow, smooth settle |
| Default (Framer) | 100 | 10 | 1 | Balanced |
| Wobbly | 180 | 12 | 1 | Bouncy, playful |
| Stiff | 210 | 20 | 1 | Quick, minimal overshoot |
| Slow | 280 | 60 | 1 | Heavy, damped |
| Molasses | 280 | 120 | 1 | Very heavy, no bounce |

**Critical damping:** When `d = 2 * sqrt(k * m)`, the spring reaches equilibrium in the minimum time without oscillation. This is the boundary between underdamped (bouncy) and overdamped (sluggish) behavior.

**Adapting springs to the alpha [0,1] model:**

Springs are naturally time-independent, but our keyframe system needs a fixed duration. To reconcile:

1. Pre-simulate the spring for N frames
2. Record the position at each frame
3. Normalize the positions to [0, 1]
4. Cache the resulting lookup table
5. During animation, sample the lookup table by alpha

```typescript
function precomputeSpringCurve(config: SpringConfig, steps: number = 120): Float32Array {
  const curve = new Float32Array(steps);
  let state = { position: 0, velocity: 0 };

  for (let i = 0; i < steps; i++) {
    state = springStep(state, 1.0, config, 1 / 60);
    curve[i] = state.position;
  }

  return curve;
}

function springEasing(curve: Float32Array, t: number): number {
  const index = t * (curve.length - 1);
  const lo = Math.floor(index);
  const hi = Math.min(lo + 1, curve.length - 1);
  const frac = index - lo;
  return curve[lo] + (curve[hi] - curve[lo]) * frac;
}
```

### 2.5 Step Functions

For deliberate staccato or "frame-by-frame" animation:

```typescript
function steps(numSteps: number, t: number, jumpTerm: 'start' | 'end' = 'end'): number {
  if (jumpTerm === 'start') {
    return Math.ceil(t * numSteps) / numSteps;
  }
  return Math.floor(t * numSteps) / numSteps;
}
```

This is equivalent to CSS `steps(n, jump-start)` and `steps(n, jump-end)`.

### 2.6 Easing Composition

Multiple easings can be combined for complex motion:

**Sequential composition (chain):**
```typescript
function chainEasings(easings: EasingFn[], breakpoints: number[], t: number): number {
  // breakpoints: [0.3, 0.7] means first easing covers 0-0.3, second covers 0.3-0.7, third covers 0.7-1.0
  let segStart = 0;
  for (let i = 0; i < breakpoints.length; i++) {
    if (t <= breakpoints[i]) {
      const localT = (t - segStart) / (breakpoints[i] - segStart);
      const localResult = easings[i](localT);
      const segRange = breakpoints[i] - segStart;
      return segStart + localResult * segRange;
    }
    segStart = breakpoints[i];
  }
  const localT = (t - segStart) / (1 - segStart);
  return segStart + easings[easings.length - 1](localT) * (1 - segStart);
}
```

**Blend composition (mix two easings):**
```typescript
function blendEasings(easingA: EasingFn, easingB: EasingFn, mix: number, t: number): number {
  return easingA(t) * (1 - mix) + easingB(t) * mix;
}
```

### 2.7 Implementation Recommendation

**For the particle engine:**

1. **Built-in library:** Implement all 30 standard Penner easings as pure functions (no dependencies). These are trivial ~2-5 line functions.

2. **Cubic bezier:** Use the `bezier-easing` npm library (tiny, battle-tested, used by React Native). Or port its algorithm (~100 lines) for zero-dependency builds.

3. **Spring:** Implement the spring simulator with precomputed lookup tables. Cache per unique spring configuration.

4. **Steps:** Built-in step function with configurable step count.

5. **Custom:** Allow the LLM to specify a cubic-bezier(x1,y1,x2,y2) or a named easing.

**Performance notes:**
- All polynomial easings are O(1) per evaluation (a few multiplications)
- Trigonometric easings (sin, cos) are slightly more expensive but still negligible
- Cubic bezier evaluation with Newton-Raphson is ~5-10x more expensive than polynomial but still sub-microsecond
- Spring precomputation takes ~0.1ms for 120 steps; lookup is O(1)
- For batch interpolation of 10,000 particles at 60fps, even the most expensive easing contributes < 0.5ms per frame

---

## 3. Grid-Specific Interpolation Challenges

### 3.1 The Fundamental Problem

On a continuous canvas, a circle at position (50.3, 75.7) is rendered with anti-aliasing for smooth, sub-pixel appearance. On our integer grid, a "circle" is a set of activated particles at integer coordinates. When this circle "moves," each particle must jump from one integer position to another. This creates several challenges:

1. **Temporal aliasing:** Movement appears jerky because positions snap between integers
2. **Shape distortion:** A shape that looks correct at one grid position may look different when shifted by 1 cell (especially for circles and diagonals)
3. **No sub-pixel precision:** Traditional anti-aliasing and motion blur techniques do not directly apply

### 3.2 Temporal Dithering

Different particles in a group can be activated/deactivated at different sub-frame times, creating the perception of smooth motion:

```typescript
function temporalDither(
  particles: { row: number; col: number; targetRow: number; targetCol: number }[],
  t: number,
  jitter: number = 0.1
): { row: number; col: number; active: boolean }[] {
  return particles.map((p, i) => {
    // Each particle transitions at a slightly different time
    const personalT = t + (hashFloat(i) - 0.5) * jitter;
    const clampedT = Math.max(0, Math.min(1, personalT));

    // Switch position at personal threshold
    const switched = clampedT > 0.5;
    return {
      row: switched ? p.targetRow : p.row,
      col: switched ? p.targetCol : p.col,
      active: true,
    };
  });
}

// Deterministic hash for consistent jitter per particle
function hashFloat(index: number): number {
  const x = Math.sin(index * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
```

This creates a "dissolve" effect where particles transition from old to new positions in a staggered pattern rather than all at once.

### 3.3 Opacity-Based Anti-aliasing

When a shape's mathematical boundary falls between grid points, use opacity to create the illusion of sub-grid precision:

```typescript
function antialiasedCircle(
  centerR: number, centerC: number, radius: number
): { row: number; col: number; opacity: number }[] {
  const result: { row: number; col: number; opacity: number }[] = [];

  for (let r = Math.floor(centerR - radius - 1); r <= Math.ceil(centerR + radius + 1); r++) {
    for (let c = Math.floor(centerC - radius - 1); c <= Math.ceil(centerC + radius + 1); c++) {
      const dist = Math.sqrt((r - centerR) ** 2 + (c - centerC) ** 2);

      if (dist <= radius - 0.5) {
        result.push({ row: r, col: c, opacity: 1.0 });
      } else if (dist <= radius + 0.5) {
        // Anti-alias: opacity falls off linearly across the boundary
        result.push({ row: r, col: c, opacity: radius + 0.5 - dist });
      }
    }
  }

  return result;
}
```

During animation, when the "center" of the circle moves continuously (even though individual particles are at integer positions), the opacity values of boundary particles change smoothly, creating the perception of smooth motion.

### 3.4 Trail Effects for Motion

Previous positions fade out while new positions fade in, creating a motion trail:

```typescript
function motionTrail(
  currentPositions: [number, number][],
  previousPositions: [number, number][][],  // last N frames
  trailLength: number = 3,
  decayRate: number = 0.5
): { row: number; col: number; opacity: number }[] {
  const result: Map<string, number> = new Map();

  // Current frame at full opacity
  for (const [r, c] of currentPositions) {
    const key = `${r},${c}`;
    result.set(key, Math.max(result.get(key) || 0, 1.0));
  }

  // Previous frames with decaying opacity
  for (let frame = 0; frame < Math.min(trailLength, previousPositions.length); frame++) {
    const opacity = Math.pow(decayRate, frame + 1);
    for (const [r, c] of previousPositions[frame]) {
      const key = `${r},${c}`;
      result.set(key, Math.max(result.get(key) || 0, opacity));
    }
  }

  return Array.from(result.entries()).map(([key, opacity]) => {
    const [r, c] = key.split(',').map(Number);
    return { row: r, col: c, opacity };
  });
}
```

### 3.5 Shape Preservation During Movement

When a group of particles forming a shape "moves" across the grid, the shape must be re-rasterized at each new position. This is analogous to moving a sprite on a pixel display.

**Algorithm:**

1. Store the shape as a **relative offset pattern** from a reference point (e.g., center):
   ```typescript
   interface GridShape {
     offsets: [number, number][];  // [deltaRow, deltaCol] from center
     properties: Map<string, ParticleProperties>;  // per-offset properties
   }
   ```

2. At each animation frame, compute the current center position and apply the offsets:
   ```typescript
   function renderShapeAt(shape: GridShape, centerR: number, centerC: number): ParticleState[] {
     return shape.offsets.map(([dr, dc]) => ({
       row: centerR + dr,
       col: centerC + dc,
       ...shape.properties.get(`${dr},${dc}`),
     }));
   }
   ```

3. During transition, the center moves via the eased position, and the shape is re-rasterized each frame.

**Key insight:** The shape itself does not interpolate -- the shape is a stamp that is applied at an interpolated position. This guarantees shape consistency.

### 3.6 Rotation on a Grid

Rotating shapes on a discrete grid is one of the hardest problems in digital geometry. A continuous rotation by angle theta transforms each point (r, c) to:

```
r' = r * cos(theta) - c * sin(theta)
c' = r * sin(theta) + c * cos(theta)
```

But rounding to integers causes information loss (up to 17% per rotation according to research) and shape distortion.

**Approach 1: Re-rasterize at each angle**

Rather than rotating individual particles, re-rasterize the entire shape at the target angle:

```typescript
function rotateShapeOnGrid(
  shape: GridShape,
  centerR: number, centerC: number,
  angle: number  // radians
): [number, number][] {
  const cos_a = Math.cos(angle);
  const sin_a = Math.sin(angle);

  return shape.offsets.map(([dr, dc]) => {
    const newDr = Math.round(dr * cos_a - dc * sin_a);
    const newDc = Math.round(dr * sin_a + dc * cos_a);
    return [centerR + newDr, centerC + newDc] as [number, number];
  });
}
```

**Approach 2: Shear decomposition (Three-Shear Rotation)**

Any 2D rotation can be decomposed into three shear operations, which preserve grid structure better than direct rotation:

```
| cos(a)  -sin(a) |   | 1  -tan(a/2) |   | 1    0   |   | 1  -tan(a/2) |
| sin(a)   cos(a) | = | 0      1     | * | sin(a) 1 | * | 0      1     |
```

Each shear shifts rows or columns by an integer amount, which preserves all pixels. This is the method used by image processing software for lossless rotation at certain angles.

**Approach 3: Opacity-weighted rotation (Recommended for smooth animation)**

Combine rotation with the bilinear opacity technique from Section 1.3:

```typescript
function smoothRotateOnGrid(
  shape: GridShape,
  centerR: number, centerC: number,
  angle: number
): { row: number; col: number; opacity: number }[] {
  const cos_a = Math.cos(angle);
  const sin_a = Math.sin(angle);
  const result: Map<string, number> = new Map();

  for (const [dr, dc] of shape.offsets) {
    // Continuous rotated position
    const newDr = dr * cos_a - dc * sin_a;
    const newDc = dr * sin_a + dc * cos_a;

    // Bilinear distribution to surrounding grid cells
    const rFloor = Math.floor(newDr);
    const cFloor = Math.floor(newDc);
    const rFrac = newDr - rFloor;
    const cFrac = newDc - cFloor;

    const contributions = [
      { r: centerR + rFloor,     c: centerC + cFloor,     w: (1-rFrac) * (1-cFrac) },
      { r: centerR + rFloor,     c: centerC + cFloor + 1, w: (1-rFrac) * cFrac },
      { r: centerR + rFloor + 1, c: centerC + cFloor,     w: rFrac * (1-cFrac) },
      { r: centerR + rFloor + 1, c: centerC + cFloor + 1, w: rFrac * cFrac },
    ];

    for (const { r, c, w } of contributions) {
      if (w > 0.01) {
        const key = `${r},${c}`;
        result.set(key, Math.min(1, (result.get(key) || 0) + w));
      }
    }
  }

  return Array.from(result.entries()).map(([key, opacity]) => {
    const [r, c] = key.split(',').map(Number);
    return { row: r, col: c, opacity: Math.min(1, opacity) };
  });
}
```

### 3.7 Scaling on a Grid

Enlarging or shrinking shapes on a discrete grid requires re-rasterization at the new scale:

```typescript
function scaleShapeOnGrid(
  shape: GridShape,
  centerR: number, centerC: number,
  scale: number
): [number, number][] {
  const result = new Set<string>();

  for (const [dr, dc] of shape.offsets) {
    const newDr = Math.round(dr * scale);
    const newDc = Math.round(dc * scale);
    result.add(`${centerR + newDr},${centerC + newDc}`);
  }

  // For scale > 1, fill gaps using Bresenham lines between scaled points
  // For scale < 1, some points will merge (handled by the Set)

  return Array.from(result).map(key => {
    const [r, c] = key.split(',').map(Number);
    return [r, c] as [number, number];
  });
}
```

**Gap-filling for upscaling:** When scaling up, adjacent particles in the original shape may have gaps between them in the scaled version. Use Bresenham line segments to fill these gaps, or re-rasterize the shape at the new scale using the original shape primitive algorithms (midpoint circle, scanline fill, etc.).

**Particle merging for downscaling:** When scaling down, multiple original particles may map to the same grid cell. Merge their properties (average colors, max opacity).

---

## 4. Path Interpolation

Path interpolation defines the trajectory that a property value follows between keyframes. While the simplest path is a straight line (lerp), curved paths can produce more natural and visually appealing motion.

### 4.1 Linear Interpolation (Lerp)

```typescript
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// For 2D positions (grid coordinates in continuous space before rounding)
function lerp2D(
  p0: [number, number], p1: [number, number], t: number
): [number, number] {
  return [
    p0[0] + (p1[0] - p0[0]) * t,
    p0[1] + (p1[1] - p0[1]) * t,
  ];
}
```

Simple, fast, and predictable. Suitable for most property animations. The easing function applied to `t` before lerp provides all needed non-linearity.

### 4.2 Cubic Bezier Paths

For motion trajectories (not to be confused with cubic-bezier easing), a cubic Bezier curve defines a smooth path through space:

```typescript
function cubicBezier2D(
  p0: [number, number],  // start
  p1: [number, number],  // control point 1
  p2: [number, number],  // control point 2
  p3: [number, number],  // end
  t: number
): [number, number] {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return [
    mt2 * mt * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t2 * t * p3[0],
    mt2 * mt * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t2 * t * p3[1],
  ];
}
```

**Application to grid:** The continuous Bezier position is converted to grid coordinates using the bilinear opacity technique (Section 1.3) or simple rounding.

### 4.3 Catmull-Rom Splines

Catmull-Rom splines are interpolating splines -- the curve passes directly through the control points (unlike Bezier curves which only approximate). This makes them ideal for multi-keyframe sequences where the animation should pass through each keyframe's state exactly.

**Mathematical definition:**

Given four control points P0, P1, P2, P3, the curve between P1 and P2 for parameter t in [0, 1]:

```
q(t) = 0.5 * (
  (-t^3 + 2t^2 - t) * P0 +
  (3t^3 - 5t^2 + 2) * P1 +
  (-3t^3 + 4t^2 + t) * P2 +
  (t^3 - t^2) * P3
)
```

Or equivalently using the matrix form:

```
q(t) = 0.5 * [1, t, t^2, t^3] * | 0  2  0  0 | * | P0 |
                                  | -1 0  1  0 |   | P1 |
                                  | 2 -5  4 -1 |   | P2 |
                                  | -1 3 -3  1 |   | P3 |
```

```typescript
function catmullRom(
  p0: number, p1: number, p2: number, p3: number, t: number
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (-t3 + 2 * t2 - t) * p0 +
    (3 * t3 - 5 * t2 + 2) * p1 +
    (-3 * t3 + 4 * t2 + t) * p2 +
    (t3 - t2) * p3
  );
}
```

**Tension parameter:** The standard Catmull-Rom uses tension = 0.5. Adjusting tension changes the "tightness" of the curve:

```typescript
function catmullRomWithTension(
  p0: number, p1: number, p2: number, p3: number,
  t: number, tension: number = 0.5
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  const s = tension;
  return (
    ((-s * t3 + 2 * s * t2 - s * t) * p0 +
    ((2 - s) * t3 + (s - 3) * t2 + 1) * p1 +
    ((s - 2) * t3 + (3 - 2 * s) * t2 + s * t) * p2 +
    (s * t3 - s * t2) * p3)
  );
}
```

**Endpoint handling:** The first and last segments need "phantom" control points. Options:
- Duplicate the first/last point: `P_phantom = P_end`
- Reflect: `P_phantom = 2 * P_end - P_adjacent`
- Natural: Compute phantom point that makes the curvature zero at the endpoint

**Application to keyframes:** For a sequence of keyframes K0, K1, K2, K3, ..., interpolation between K1 and K2 uses Catmull-Rom with control points K0, K1, K2, K3. This produces smooth transitions that pass through each keyframe exactly, with continuous first derivatives at the keyframe boundaries.

### 4.4 Arc-Based Paths

Circular or elliptical motion paths:

```typescript
function arcPath(
  center: [number, number],
  radius: number,
  startAngle: number,
  endAngle: number,
  t: number
): [number, number] {
  const angle = startAngle + (endAngle - startAngle) * t;
  return [
    center[0] + radius * Math.cos(angle),
    center[1] + radius * Math.sin(angle),
  ];
}
```

### 4.5 Applying Continuous Paths to Grid Positions

All the above path algorithms produce continuous (floating-point) positions. To render on the grid:

1. **Simple rounding:** `[Math.round(r), Math.round(c)]` -- fastest, but produces jumpy motion
2. **Bilinear distribution:** Distribute the particle's "presence" across 4 surrounding cells with opacity weights (see Section 1.3) -- smoothest, but requires multi-particle rendering
3. **Bresenham sampling:** Convert the continuous path to a Bresenham-like integer sequence and step through it -- deterministic, clean

**Recommendation:** Use bilinear distribution for high-quality animation, simple rounding for previews, and Bresenham sampling for "pixel-art" style animations where clean integer positions are desired.

---

## 5. Keyframe System Design

### 5.1 Keyframe Matching Strategies

When interpolating between two keyframes, the system must determine which particles in keyframe 1 correspond to which particles in keyframe 2. This is the "correspondence problem."

#### Strategy A: Match by Position (Grid Coordinates)

A particle at [5, 10] in keyframe 1 corresponds to a particle at [5, 10] in keyframe 2. This is the simplest and most natural for a grid system.

```typescript
function matchByPosition(kf1: Keyframe, kf2: Keyframe): ParticleMatch[] {
  const matches: ParticleMatch[] = [];
  const kf2Map = new Map(kf2.particles.map(p => [`${p.row},${p.col}`, p]));

  for (const p1 of kf1.particles) {
    const key = `${p1.row},${p1.col}`;
    const p2 = kf2Map.get(key);
    if (p2) {
      matches.push({ from: p1, to: p2, type: 'matched' });
      kf2Map.delete(key);
    } else {
      matches.push({ from: p1, to: null, type: 'removed' });
    }
  }

  for (const p2 of kf2Map.values()) {
    matches.push({ from: null, to: p2, type: 'added' });
  }

  return matches;
}
```

**Pros:** Simple, deterministic, O(n) with a hash map.
**Cons:** Cannot handle "movement" -- a particle at [5,10] in KF1 moving to [7,12] in KF2 would be treated as a removal at [5,10] and an addition at [7,12], not as a movement.

#### Strategy B: Match by ID

Each particle has a persistent identifier. Matching uses the ID regardless of position.

```typescript
function matchByID(kf1: Keyframe, kf2: Keyframe): ParticleMatch[] {
  const kf2Map = new Map(kf2.particles.map(p => [p.id, p]));
  // ... similar to above but using p.id as key
}
```

**Pros:** Handles movement -- if particle "p1" moves from [5,10] to [7,12], the system can interpolate the position change.
**Cons:** Requires the LLM to maintain consistent particle IDs across keyframes, which adds complexity to the LLM's task.

#### Strategy C: Match by Group (Recommended)

Group-level matching: particles in the same group across keyframes are matched by their relative position within the group.

```typescript
function matchByGroup(kf1: Keyframe, kf2: Keyframe): GroupMatch[] {
  // 1. Match groups by name
  // 2. Within each matched group, match particles by relative offset from group center
  // 3. Unmatched particles are treated as added/removed
}
```

**Pros:** Natural for shape animation (a "triangle" group in KF1 maps to a "triangle" group in KF2), allows the group to move/transform as a unit.
**Cons:** More complex matching algorithm.

#### Recommendation

Use a **hybrid approach:**
1. **Primary match by position** for particles not in a group
2. **Match by group name + relative offset** for grouped particles
3. **Fallback to ID** when the LLM explicitly provides particle IDs

### 5.2 The Missing Particle Problem

When a particle exists in keyframe 1 but not in keyframe 2:

**Option A: Instant removal at keyframe time**
The particle disappears immediately when keyframe 2 is reached. This is jarring.

**Option B: Fade out during transition (Recommended)**
The particle's opacity is interpolated from its KF1 value to 0 over the transition duration, then the particle is deactivated.

```typescript
function handleRemovedParticle(particle: ParticleState, t: number): ParticleState {
  return {
    ...particle,
    opacity: particle.opacity * (1 - t),
    active: t < 1, // deactivate at the end
  };
}
```

**Option C: Follow a discrete removal event**
If the LLM specifies a `remove_particle` event at a specific time, the particle is removed at that exact moment (not interpolated).

**Option D: Shrink and fade**
Combine opacity fade with size reduction for a more dramatic disappearance:

```typescript
function handleRemovedParticle(particle: ParticleState, t: number): ParticleState {
  return {
    ...particle,
    opacity: particle.opacity * (1 - t),
    size: particle.size * (1 - t * 0.5),  // shrink to 50% then disappear
    active: t < 1,
  };
}
```

### 5.3 The New Particle Problem

When a particle appears in keyframe 2 that was not in keyframe 1:

**Option A: Instant appearance** -- particle pops in at full opacity. Jarring.

**Option B: Fade in during transition (Recommended)**
```typescript
function handleNewParticle(particle: ParticleState, t: number): ParticleState {
  return {
    ...particle,
    opacity: particle.opacity * t,
    active: true,
  };
}
```

**Option C: Grow and fade in**
```typescript
function handleNewParticle(particle: ParticleState, t: number): ParticleState {
  return {
    ...particle,
    opacity: particle.opacity * t,
    size: particle.size * (0.5 + 0.5 * t),  // grow from 50% to 100%
    active: true,
  };
}
```

### 5.4 Per-Property Easing

Different properties within the same transition can use different easing functions:

```typescript
interface PropertyEasing {
  color?: EasingFunction;     // e.g., 'linear' for smooth color transitions
  opacity?: EasingFunction;   // e.g., 'easeInOutCubic' for natural fades
  size?: EasingFunction;      // e.g., 'easeOutBack' for bouncy size changes
  position?: EasingFunction;  // e.g., 'easeInOutQuad' for smooth movement
}

interface Keyframe {
  time: number;
  easing: EasingFunction | PropertyEasing;
  particles: ParticleDelta[];
  connections: ConnectionDelta[];
}
```

When a keyframe specifies per-property easing:

```typescript
function interpolateWithPropertyEasing(
  from: ParticleState,
  to: ParticleState,
  t: number,
  easing: PropertyEasing
): ParticleState {
  return {
    color: lerpOKLAB(from.color, to.color, applyEasing(easing.color || 'linear', t)),
    opacity: lerp(from.opacity, to.opacity, applyEasing(easing.opacity || 'easeInOutCubic', t)),
    size: lerp(from.size, to.size, applyEasing(easing.size || 'easeOutCubic', t)),
    // ... other properties
  };
}
```

### 5.5 Multi-Keyframe Sequences

For chains of 3+ keyframes, the engine must:

1. **Find surrounding keyframes:** For any time `t`, find the two keyframes K_prev and K_next such that `K_prev.time <= t < K_next.time`.

2. **Compute local alpha:** The interpolation parameter within this segment:
   ```
   alpha = (t - K_prev.time) / (K_next.time - K_prev.time)
   ```

3. **Apply easing:** `easedAlpha = K_next.easing(alpha)` (the easing function is associated with the target keyframe, defining how we approach it)

4. **Interpolate:** Use `easedAlpha` to interpolate between K_prev and K_next states.

**Smooth multi-keyframe transitions (C1 continuity):** To avoid abrupt changes in velocity at keyframe boundaries, use Catmull-Rom interpolation across keyframes (see Section 4.3). This requires looking at 4 keyframes at a time (the two surrounding + one on each side).

```typescript
function findSurroundingKeyframes(keyframes: Keyframe[], time: number): {
  k0: Keyframe | null;  // before k1 (for Catmull-Rom)
  k1: Keyframe;         // previous
  k2: Keyframe;         // next
  k3: Keyframe | null;  // after k2 (for Catmull-Rom)
  localT: number;
} {
  // Binary search for the segment
  let i = 0;
  while (i < keyframes.length - 1 && keyframes[i + 1].time <= time) i++;

  const k1 = keyframes[i];
  const k2 = keyframes[Math.min(i + 1, keyframes.length - 1)];
  const localT = k1.time === k2.time ? 0 : (time - k1.time) / (k2.time - k1.time);

  return {
    k0: i > 0 ? keyframes[i - 1] : null,
    k1,
    k2,
    k3: i + 2 < keyframes.length ? keyframes[i + 2] : null,
    localT,
  };
}
```

### 5.6 Alpha-Based Interpolation (Manim's Approach)

Manim's animation system uses an elegant alpha-based architecture:

**Core concept:** Every animation is controlled by a single `alpha` parameter in [0.0, 1.0]. At alpha=0, the animation shows the start state. At alpha=1, it shows the end state. In between, the animation's `interpolate_mobject(alpha)` method computes the intermediate state.

**How alpha is computed:**

```
For each frame:
  raw_alpha = elapsed_time / total_duration    (linear 0 to 1)
  eased_alpha = rate_function(raw_alpha)       (apply easing)
  animation.interpolate_mobject(eased_alpha)   (update object)
```

**Why this is elegant:**

1. **Separation of concerns:** The timing system produces raw alpha values. The easing function transforms them. The interpolation method applies them. Each component is independent.

2. **Composability:** Any easing function can be swapped in without changing the interpolation logic. Any interpolation method can be swapped without changing the timing.

3. **Predictability:** At alpha=0, we're exactly at the start state. At alpha=1, we're exactly at the end state. No floating-point drift.

4. **Reversibility:** Playing an animation backward is just `alpha = 1 - alpha`.

**Adaptation for our particle engine:**

```typescript
interface AnimationSegment {
  startTime: number;
  endTime: number;
  easing: EasingFunction;

  // The core interpolation method
  interpolate(alpha: number, store: ParticleStore): void;
}

class PropertyAnimation implements AnimationSegment {
  constructor(
    public startTime: number,
    public endTime: number,
    public easing: EasingFunction,
    private particleIndex: number,
    private property: string,
    private fromValue: number,
    private toValue: number,
  ) {}

  interpolate(alpha: number, store: ParticleStore): void {
    const easedAlpha = this.easing(alpha);
    const value = lerp(this.fromValue, this.toValue, easedAlpha);
    store.setProperty(this.particleIndex, this.property, value);
  }
}
```

---

## 6. Advanced Interpolation Techniques

### 6.1 Motion Blur Simulation on a Grid

On a continuous canvas, motion blur is achieved by averaging multiple sub-frame positions. On a grid, this translates to activating particles along the path of motion with decreasing opacity:

```typescript
function gridMotionBlur(
  shape: GridShape,
  fromCenter: [number, number],
  toCenter: [number, number],
  t: number,
  blurStrength: number = 3  // number of sub-frames to blend
): { row: number; col: number; opacity: number; color: string }[] {
  const result: Map<string, { opacity: number; color: string }> = new Map();

  for (let sub = 0; sub <= blurStrength; sub++) {
    const subT = t - (sub / blurStrength) * 0.1;  // look back slightly
    if (subT < 0) continue;

    const centerR = lerp(fromCenter[0], toCenter[0], subT);
    const centerC = lerp(fromCenter[1], toCenter[1], subT);
    const subOpacity = 1 / (sub + 1);  // latest frame brightest

    for (const [dr, dc] of shape.offsets) {
      const r = Math.round(centerR + dr);
      const c = Math.round(centerC + dc);
      const key = `${r},${c}`;
      const existing = result.get(key);
      if (!existing || existing.opacity < subOpacity) {
        result.set(key, { opacity: subOpacity, color: '#FFFFFF' });
      }
    }
  }

  return Array.from(result.entries()).map(([key, props]) => {
    const [r, c] = key.split(',').map(Number);
    return { row: r, col: c, ...props };
  });
}
```

### 6.2 Morphing (Shape-to-Shape Transition)

Morphing transitions one shape into another. On a grid, this requires deciding which particles in shape A correspond to which particles in shape B.

**Algorithm: Nearest-Neighbor Assignment**

```typescript
function computeMorphMapping(
  shapeA: [number, number][],
  shapeB: [number, number][]
): Map<number, number> {
  // Simple greedy nearest-neighbor (good for similar-sized shapes)
  const mapping = new Map<number, number>();
  const usedB = new Set<number>();

  // Sort by distance from centroid for better matching
  const centroidA = computeCentroid(shapeA);
  const centroidB = computeCentroid(shapeB);

  const sortedA = shapeA.map((p, i) => ({ p, i, angle: Math.atan2(p[0] - centroidA[0], p[1] - centroidA[1]) }))
    .sort((a, b) => a.angle - b.angle);
  const sortedB = shapeB.map((p, i) => ({ p, i, angle: Math.atan2(p[0] - centroidB[0], p[1] - centroidB[1]) }))
    .sort((a, b) => a.angle - b.angle);

  // Map by angular position (radial matching)
  for (let i = 0; i < sortedA.length; i++) {
    const bIndex = Math.round(i * (sortedB.length - 1) / (sortedA.length - 1));
    mapping.set(sortedA[i].i, sortedB[bIndex].i);
  }

  return mapping;
}
```

**Interpolating the morph:**

```typescript
function morphInterpolation(
  shapeA: [number, number][],
  shapeB: [number, number][],
  mapping: Map<number, number>,
  t: number
): { row: number; col: number; opacity: number }[] {
  const result: Map<string, number> = new Map();

  for (const [aIdx, bIdx] of mapping) {
    const [ar, ac] = shapeA[aIdx];
    const [br, bc] = shapeB[bIdx];

    // Continuous interpolated position
    const r = ar + (br - ar) * t;
    const c = ac + (bc - ac) * t;

    // Bilinear distribution to grid
    const rFloor = Math.floor(r);
    const cFloor = Math.floor(c);
    const rFrac = r - rFloor;
    const cFrac = c - cFloor;

    const contributions = [
      [`${rFloor},${cFloor}`, (1-rFrac) * (1-cFrac)],
      [`${rFloor},${cFloor+1}`, (1-rFrac) * cFrac],
      [`${rFloor+1},${cFloor}`, rFrac * (1-cFrac)],
      [`${rFloor+1},${cFloor+1}`, rFrac * cFrac],
    ] as [string, number][];

    for (const [key, weight] of contributions) {
      if (weight > 0.01) {
        result.set(key, Math.min(1, (result.get(key) || 0) + weight));
      }
    }
  }

  // Handle size differences: extra particles fade in/out
  // ... (particles in B but not mapped from A fade in)
  // ... (particles in A not mapped to B fade out)

  return Array.from(result.entries()).map(([key, opacity]) => {
    const [r, c] = key.split(',').map(Number);
    return { row: r, col: c, opacity };
  });
}
```

**Optimal Transport (Earth Mover's Distance):** For truly optimal morphing (minimizing total particle displacement), use the Hungarian algorithm or a simplified version. However, for our particle counts (typically 10-1000 particles per shape), the radial matching above is sufficient and much simpler.

### 6.3 Stagger/Cascade Effects

Stagger delays the animation start for sequential particle activation, creating a wave-like cascade:

```typescript
function staggerDelay(
  particleIndex: number,
  totalParticles: number,
  totalStaggerTime: number,
  pattern: 'sequential' | 'center-out' | 'random' | 'grid-wave' = 'sequential'
): number {
  switch (pattern) {
    case 'sequential':
      return (particleIndex / totalParticles) * totalStaggerTime;

    case 'center-out':
      // Particles near the center animate first
      const centerPos = totalParticles / 2;
      const distFromCenter = Math.abs(particleIndex - centerPos) / centerPos;
      return distFromCenter * totalStaggerTime;

    case 'random':
      return hashFloat(particleIndex) * totalStaggerTime;

    case 'grid-wave':
      // Requires knowledge of row/col -- see below
      return 0;
  }
}
```

**Grid-specific stagger patterns:**

```typescript
function gridStagger(
  row: number, col: number,
  gridRows: number, gridCols: number,
  totalTime: number,
  origin: 'top-left' | 'center' | 'bottom-right' | [number, number] = 'top-left'
): number {
  let originR: number, originC: number;

  switch (origin) {
    case 'top-left':     originR = 0; originC = 0; break;
    case 'center':       originR = gridRows / 2; originC = gridCols / 2; break;
    case 'bottom-right': originR = gridRows; originC = gridCols; break;
    default:             [originR, originC] = origin;
  }

  // Manhattan distance for square wave, Euclidean for circular wave
  const maxDist = Math.sqrt(gridRows ** 2 + gridCols ** 2);
  const dist = Math.sqrt((row - originR) ** 2 + (col - originC) ** 2);

  return (dist / maxDist) * totalTime;
}
```

**Applying stagger to animations:**

```typescript
function applyStagger(
  particles: ParticleState[],
  animation: (t: number) => ParticleState,
  globalT: number,
  staggerFn: (index: number) => number
): ParticleState[] {
  return particles.map((p, i) => {
    const delay = staggerFn(i);
    const localT = Math.max(0, Math.min(1, (globalT - delay) / (1 - delay)));
    return animation(localT);
  });
}
```

**Sweet spot for stagger timing:** 50-200ms between elements (per research from animation libraries). For grid animations with hundreds of particles, 10-50ms per particle creates a smooth wave effect.

### 6.4 Wave Propagation

Ripple effects across the grid, where a disturbance at one point propagates outward:

```typescript
function wavePropagation(
  epicenterR: number, epicenterC: number,
  gridRows: number, gridCols: number,
  time: number,
  waveSpeed: number = 5,  // cells per second
  wavelength: number = 4,
  amplitude: number = 0.5,
  decay: number = 0.1
): { row: number; col: number; sizeMultiplier: number; opacity: number }[] {
  const result: { row: number; col: number; sizeMultiplier: number; opacity: number }[] = [];

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const dist = Math.sqrt((r - epicenterR) ** 2 + (c - epicenterC) ** 2);
      const wavePhase = (dist / wavelength) - (time * waveSpeed / wavelength);
      const waveValue = Math.sin(wavePhase * 2 * Math.PI);
      const distDecay = Math.exp(-dist * decay);
      const timeDecay = Math.exp(-time * 0.5);

      const effect = waveValue * amplitude * distDecay * timeDecay;

      result.push({
        row: r,
        col: c,
        sizeMultiplier: 1 + effect,
        opacity: Math.max(0, Math.min(1, 1 + effect * 0.5)),
      });
    }
  }

  return result;
}
```

### 6.5 Physics-Based Interpolation

Simple physics simulations for natural motion without a full physics engine:

#### Simple Gravity

```typescript
function gravityDrop(
  startR: number, targetR: number,
  t: number,
  bounceElasticity: number = 0.6,
  gravity: number = 9.8
): number {
  // Free-fall to target, then bounce
  const fallTime = Math.sqrt(2 * Math.abs(targetR - startR) / gravity);
  const normalizedT = t * fallTime * 2;  // scale time

  if (normalizedT < fallTime) {
    // Free fall
    return startR + 0.5 * gravity * normalizedT * normalizedT * Math.sign(targetR - startR);
  } else {
    // Bounce (decreasing amplitude)
    const bounceT = normalizedT - fallTime;
    const bounceHeight = Math.abs(targetR - startR) * bounceElasticity;
    const bounceValue = bounceHeight * Math.sin(bounceT * Math.PI) * Math.exp(-bounceT * 3);
    return targetR - bounceValue * Math.sign(targetR - startR);
  }
}
```

#### Simple Spring (per-particle)

See Section 2.4 for the spring simulation. Apply it per-particle for "jelly-like" motion where each particle springs to its target position independently:

```typescript
function springToTarget(
  currentState: { position: number; velocity: number },
  target: number,
  config: { stiffness: number; damping: number; mass: number },
  dt: number
): { position: number; velocity: number } {
  // Same as Section 2.4 spring step
  return springStep(currentState, target, config, dt);
}
```

### 6.6 Particle Spawn/Death Curves

How particles appear and disappear aesthetically:

```typescript
type SpawnCurve = 'pop' | 'grow' | 'fade' | 'dissolve' | 'explode';

function applySpawnCurve(
  curve: SpawnCurve,
  t: number  // 0 = invisible, 1 = fully visible
): { opacity: number; size: number } {
  switch (curve) {
    case 'pop':
      return {
        opacity: t > 0.1 ? 1 : 0,
        size: t > 0.1 ? 1 : 0,
      };

    case 'grow':
      return {
        opacity: 1,
        size: easeOutBack(t) * 1.0,  // slight overshoot then settle
      };

    case 'fade':
      return {
        opacity: easeInOutCubic(t),
        size: 1,
      };

    case 'dissolve':
      // Random per-particle threshold (use with stagger)
      return {
        opacity: t,
        size: 0.5 + 0.5 * t,
      };

    case 'explode':
      // Quick scale up, then settle
      const scale = t < 0.3 ? easeOutExpo(t / 0.3) * 1.5 : 1.5 - 0.5 * easeInOutCubic((t - 0.3) / 0.7);
      return {
        opacity: Math.min(1, t * 3),
        size: scale,
      };
  }
}
```

**Death curves** are the reverse: apply `applySpawnCurve(curve, 1 - t)`.

---

## 7. Performance and Implementation

### 7.1 Batch Interpolation

For thousands of particles, per-particle function calls are expensive due to call overhead. Batch processing using typed arrays is essential.

```typescript
function batchLerp(
  from: Float32Array,
  to: Float32Array,
  out: Float32Array,
  t: number,
  count: number
): void {
  const oneMinusT = 1 - t;
  for (let i = 0; i < count; i++) {
    out[i] = from[i] * oneMinusT + to[i] * t;
  }
}
```

**Why this is fast:**
- No function call overhead per particle
- Float32Array guarantees contiguous memory
- The simple loop allows the JIT compiler to vectorize (auto-SIMD)
- No object allocation or GC pressure

**Benchmark reference:** A tight loop over Float32Array is approximately 3-5x faster than mapping over an Array of objects, primarily due to cache locality and reduced GC pressure.

### 7.2 Struct-of-Arrays (SoA) Layout for Animation

Store animation data in parallel typed arrays:

```typescript
interface AnimationBuffer {
  // Source keyframe values (per particle)
  fromOpacity: Float32Array;
  fromSize: Float32Array;
  fromColorL: Float32Array;  // OKLAB L
  fromColorA: Float32Array;  // OKLAB a
  fromColorB: Float32Array;  // OKLAB b

  // Target keyframe values (per particle)
  toOpacity: Float32Array;
  toSize: Float32Array;
  toColorL: Float32Array;
  toColorA: Float32Array;
  toColorB: Float32Array;

  // Output (computed each frame)
  outOpacity: Float32Array;
  outSize: Float32Array;
  outColorR: Uint8Array;  // sRGB for rendering
  outColorG: Uint8Array;
  outColorB: Uint8Array;
}
```

**Interpolation with this layout:**

```typescript
function interpolateFrame(
  buf: AnimationBuffer,
  count: number,
  easedT: number
): void {
  const t = easedT;
  const mt = 1 - t;

  // Opacity
  for (let i = 0; i < count; i++) {
    buf.outOpacity[i] = buf.fromOpacity[i] * mt + buf.toOpacity[i] * t;
  }

  // Size
  for (let i = 0; i < count; i++) {
    buf.outSize[i] = buf.fromSize[i] * mt + buf.toSize[i] * t;
  }

  // Color (OKLAB -> sRGB)
  for (let i = 0; i < count; i++) {
    const L = buf.fromColorL[i] * mt + buf.toColorL[i] * t;
    const a = buf.fromColorA[i] * mt + buf.toColorA[i] * t;
    const b = buf.fromColorB[i] * mt + buf.toColorB[i] * t;

    // OKLAB -> sRGB conversion (inline for performance)
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const r_lin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g_lin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const b_lin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    // Linear -> sRGB gamma
    buf.outColorR[i] = Math.max(0, Math.min(255, Math.round(
      (r_lin <= 0.0031308 ? r_lin * 12.92 : 1.055 * Math.pow(r_lin, 1/2.4) - 0.055) * 255
    )));
    buf.outColorG[i] = Math.max(0, Math.min(255, Math.round(
      (g_lin <= 0.0031308 ? g_lin * 12.92 : 1.055 * Math.pow(g_lin, 1/2.4) - 0.055) * 255
    )));
    buf.outColorB[i] = Math.max(0, Math.min(255, Math.round(
      (b_lin <= 0.0031308 ? b_lin * 12.92 : 1.055 * Math.pow(b_lin, 1/2.4) - 0.055) * 255
    )));
  }
}
```

### 7.3 Precomputation Strategies

**What to precompute:**

| Operation | Precompute? | Rationale |
|-----------|------------|-----------|
| Easing lookup table | Yes (for springs, custom beziers) | Spring simulation is iterative; precompute once per config |
| OKLAB conversion of keyframe colors | Yes | Convert hex -> OKLAB at keyframe load time |
| Bresenham paths for grid movement | Yes | Path is deterministic; compute once per movement |
| Catmull-Rom spline coefficients | Yes | Matrix multiplication for coefficient computation |
| Shape offset patterns | Yes | Store as relative offsets, reuse across frames |
| Morph particle mapping | Yes | Hungarian/radial matching computed once per morph |
| Stagger delay values | Yes | Delay per particle is constant across the animation |

**What to compute per frame:**

| Operation | Per-frame? | Rationale |
|-----------|-----------|-----------|
| Alpha computation | Yes | Depends on current time |
| Easing application | Yes | But uses precomputed lookup for springs |
| Lerp of all properties | Yes | Cannot avoid; the core per-frame work |
| OKLAB -> sRGB conversion | Yes | Must produce final render colors each frame |
| Bilinear grid distribution | Yes | Position-dependent, changes each frame |

### 7.4 Frame Caching

**Strategy: Compute-on-demand with optional caching**

For batch video rendering, frames are computed sequentially and piped to FFmpeg. No caching needed -- each frame is computed once and discarded.

For real-time preview with scrubbing (user drags a timeline slider), cache strategically:

```typescript
class FrameCache {
  private cache: Map<number, FrameState> = new Map();
  private maxSize: number;

  constructor(maxFrames: number = 60) {
    this.maxSize = maxFrames;
  }

  get(frameIndex: number): FrameState | null {
    return this.cache.get(frameIndex) || null;
  }

  set(frameIndex: number, frame: FrameState): void {
    if (this.cache.size >= this.maxSize) {
      // Evict the oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(frameIndex, frame);
  }

  invalidateRange(startFrame: number, endFrame: number): void {
    for (const key of this.cache.keys()) {
      if (key >= startFrame && key <= endFrame) {
        this.cache.delete(key);
      }
    }
  }
}
```

**Cache invalidation:** When the LLM modifies a keyframe, invalidate all cached frames between the modified keyframe and the next keyframe.

### 7.5 Memory Budget

For a 100x100 grid (10,000 particles) with animation:

```
Base particle store:
  active:    10,000 * 1 byte  =  10 KB
  colorRGB:  10,000 * 3 bytes =  30 KB
  opacity:   10,000 * 4 bytes =  40 KB
  size:      10,000 * 4 bytes =  40 KB
  layer:     10,000 * 2 bytes =  20 KB
  group:     10,000 * 2 bytes =  20 KB
  Total:     ~160 KB

Animation buffer (one segment):
  from values: 10,000 * 5 floats * 4 bytes = 200 KB
  to values:   10,000 * 5 floats * 4 bytes = 200 KB
  out values:  10,000 * 5 values * ~3 bytes = 150 KB
  Total:       ~550 KB

Frame cache (60 frames):
  Per frame:   ~160 KB (particle state)
  60 frames:   ~9.6 MB

Total for 100x100 animated grid: ~10.5 MB
```

For a 200x200 grid (40,000 particles):

```
Base store:        ~640 KB
Animation buffer:  ~2.2 MB
Frame cache:       ~38.4 MB

Total: ~41 MB
```

These are well within browser memory limits (typically 1-4 GB available) and Node.js defaults (1.5 GB heap).

---

## 8. Reference Implementations

### 8.1 Manim's Interpolation System

Manim Community edition (v0.20.1) architecture:

**Animation lifecycle:**
1. `Scene.play(animation)` is called
2. `animation.begin()` captures the starting state of the mobject
3. For each frame: `animation.interpolate(alpha)` where alpha = rate_func(t/duration)
4. `animation.finish()` ensures the mobject is at the final state

**Key classes:**
- `Animation`: Base class with `interpolate_mobject(alpha)` method
- `Transform`: Interpolates between two mobjects point-by-point
- `FadeIn/FadeOut`: Interpolates opacity
- `rate_functions`: Module containing all easing functions (smooth, linear, rush_into, etc.)

**What we adopt:**
- The alpha [0,1] model with easing as a separate transformation
- The begin/interpolate/finish lifecycle
- Per-mobject interpolation (maps to per-particle in our system)

**What we differ from:**
- Manim interpolates continuous coordinates; we interpolate on a grid
- Manim generates Python code; we accept JSON commands
- Manim's mobjects are complex geometric objects; our particles are simple property bags

### 8.2 CSS Web Animations API

The Web Animations API provides a mature keyframe interpolation model:

**Keyframe format:**
```javascript
element.animate([
  { opacity: 0, transform: 'scale(0.5)', offset: 0 },
  { opacity: 1, transform: 'scale(1.2)', offset: 0.7 },
  { opacity: 1, transform: 'scale(1)', offset: 1 }
], {
  duration: 1000,
  easing: 'ease-in-out',
  fill: 'forwards'
});
```

**Key concepts we adopt:**
- `offset` (equivalent to keyframe time as a fraction of total duration)
- Per-keyframe easing (the easing between the previous and current keyframe)
- `fill` modes: `forwards` (hold final state), `backwards` (apply initial state before start), `both`
- **Composite modes**: `replace` (default), `add`, `accumulate` -- determines how multiple animations on the same property combine

**Composite modes are relevant** when the LLM defines overlapping animations on the same particle:
- `replace`: Last animation wins (default, simplest)
- `add`: Values are added (useful for cumulative offsets)
- `accumulate`: Like add but for transforms

### 8.3 Game Engines -- Grid/Tile Animation

Game engines handle tile-based animation through a separation of **logical position** (tile coordinates) and **visual position** (pixel coordinates):

**The "pixel-by-tile" pattern:**
1. Game logic operates on tile coordinates (integers)
2. When a character moves from tile A to tile B, a **transition state** is set
3. During the transition, the **visual position** interpolates smoothly in pixel space
4. When the transition completes, the **logical position** updates to tile B

**Adaptation for our system:**
- Particles always have an integer grid position (logical position)
- During animation, particles can have a "visual offset" that smoothly interpolates
- The renderer uses the grid position + visual offset to determine actual render position
- This allows "smooth scrolling" within the grid without changing the fundamental integer-addressed model

However, this approach partially breaks our "pure integer grid" constraint. The visual offset means particles are rendered between grid points. For strict grid rendering, use the opacity-based approach (Section 1.3) instead.

### 8.4 After Effects Keyframe System

After Effects distinguishes between **spatial** and **temporal** interpolation:

- **Temporal interpolation:** How a value changes over time (the easing curve)
- **Spatial interpolation:** The path an object follows through space (the motion path)

**Interpolation types:**
- **Linear:** Straight line between values, constant speed
- **Bezier:** User-adjustable curve handles for fine control
- **Auto Bezier:** Automatically smooth curves (symmetric tangent handles)
- **Continuous Bezier:** Smooth but with adjustable tangent lengths
- **Hold:** No interpolation -- value jumps at keyframe time (equivalent to our step function)

**What we adopt:**
- The concept of separate temporal vs spatial interpolation (easing curve vs motion path)
- Hold keyframes for intentional jumps (already our "discrete event" model)
- Auto Bezier as a default for "just make it smooth" -- maps to easeInOutCubic

### 8.5 Animation Libraries

**GSAP (GreenSock):**
- Timeline-based with nested timelines for complex sequences
- "Staggers" feature for cascading animations
- Custom easing with `CustomEase` plugin
- Internal tick system using requestAnimationFrame
- Handles thousands of simultaneous tweens efficiently

**Motion (formerly Framer Motion):**
- Spring physics as a first-class primitive
- Layout animations using bounding box diffing
- Gesture-driven animations
- 2.5x faster than GSAP for animating from unknown values
- Modular tree-shakeable architecture

**Anime.js:**
- Lightweight (~14KB gzip)
- Built-in SVG path animation
- CSS transforms handling
- Timeline with offsets
- requestAnimationFrame-based rendering

**Key patterns we adopt from these libraries:**
- Stagger configuration object (from GSAP/Motion)
- Spring physics with sensible defaults (from Motion)
- Timeline with relative offsets (from GSAP)
- requestAnimationFrame rendering loop (from all)

---

## 9. Sources

### Color Interpolation
- [OKLCH in CSS: Why We Moved from RGB and HSL](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl) -- Evil Martians
- [A Perceptual Color Space for Image Processing](https://bottosson.github.io/posts/oklab/) -- Bjorn Ottosson (OKLAB creator)
- [OKLAB Color Space - Wikipedia](https://en.wikipedia.org/wiki/Oklab_color_space)
- [oklab() - CSS | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklab)
- [OKLCH vs RGB, HEX, HSL: Modern Color Science](https://ava-palettes.com/modern-color-science)

### Easing Functions
- [Robert Penner's Easing Functions](https://robertpenner.com/easing/) -- Original source
- [Easing Functions Cheat Sheet](https://easings.net/) -- Visual reference for all 30 standard easings
- [Bezier Curve Based Easing Functions -- From Concept to Implementation](https://greweb.me/2012/02/bezier-curve-based-easing-functions-from-concept-to-implementation) -- Gaetan Renaudeau
- [bezier-easing npm](https://www.npmjs.com/package/bezier-easing) -- The reference implementation
- [Cubic Bezier Approximations for Penner Equations](https://github.com/zz85/cubic-bezier-approximations)
- [Improved Easing Functions](https://joshondesign.com/2013/03/01/improvedEasingEquations)

### Spring Physics
- [The Physics Behind Spring Animations](https://blog.maximeheckel.com/posts/the-physics-behind-spring-animations/) -- Maxime Heckel
- [A Friendly Introduction to Spring Physics](https://www.joshwcomeau.com/animation/a-friendly-introduction-to-spring-physics/) -- Josh W. Comeau
- [spring -- Motion Documentation](https://motion.dev/docs/spring) -- Motion.dev
- [Effortless UI Spring Animations](https://www.kvin.me/posts/effortless-ui-spring-animations)

### Grid and Discrete Interpolation
- [Bresenham's Line Algorithm - Wikipedia](https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm)
- [Rotations in 2D and 3D Discrete Spaces](https://pastel.hal.science/tel-00596947/document) -- PhD thesis
- [Rotating Images (Data Genetics)](http://datagenetics.com/blog/august32013/index.html) -- Shear-based rotation
- [Pixel-Art Scaling Algorithms - Wikipedia](https://en.wikipedia.org/wiki/Pixel-art_scaling_algorithms)
- [Pixel-by-Tile Movement in Godot](https://christiantietze.de/posts/2020/06/pixel-by-tile-movement-godot/)
- [Smooth Tile-Based Movement Algorithm](https://paladin-t.github.io/articles/smooth-tile-based-movement-algorithm-with-sliding.html)

### Path Interpolation
- [Introduction to Catmull-Rom Splines](https://www.mvps.org/directx/articles/catmull/)
- [Centripetal Catmull-Rom Spline - Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline)
- [Smooth Paths Using Catmull-Rom Splines](https://qroph.github.io/2018/07/30/smooth-paths-using-catmull-rom-splines.html)
- [Catmull-Rom Splines (CMU)](https://graphics.cs.cmu.edu/nsp/course/15-462/Fall04/assts/catmullRom.pdf)

### Animation Systems and Reference Implementations
- [A Deep Dive into Manim's Internals](https://docs.manim.community/en/stable/guides/deep_dive.html) -- Manim Community
- [Manim Animation Class Reference](https://docs.manim.community/en/stable/reference/manim.animation.animation.Animation.html)
- [Keyframe Interpolation in After Effects](https://helpx.adobe.com/after-effects/using/keyframe-interpolation.html) -- Adobe
- [Web Animations API Keyframe Formats - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API/Keyframe_Formats)
- [KeyframeEffect - MDN](https://developer.mozilla.org/en-US/docs/Web/API/KeyframeEffect)

### Animation Libraries
- [GSAP Homepage](https://gsap.com/)
- [GSAP Staggers](https://gsap.com/resources/getting-started/Staggers/)
- [Motion (formerly Framer Motion)](https://motion.dev/docs/spring)
- [Comparing React Animation Libraries 2026](https://blog.logrocket.com/best-react-animation-libraries/)
- [GSAP vs Motion Comparison](https://motion.dev/docs/gsap-vs-motion)

### Morphing and Advanced Techniques
- [Shape Morphing with Material Point Method](https://arxiv.org/html/2409.15746)
- [Image Morphing Based on Optimal Mass Transport](https://www.researchgate.net/publication/4138087_Image_morphing_based_on_mutual_information_and_optimal_mass_transport)
- [Particles Morphing Shader (Three.js)](https://threejs-journey.com/lessons/particles-morphing-shader)

### Performance
- [Float32Array - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float32Array)
- [Typed Arrays in High Performance JavaScript](https://egghead.io/lessons/javascript-typed-arrays-in-high-performance-javascript)
- [When to Use Float32Array](https://www.xjavascript.com/blog/when-to-use-float32array-instead-of-array-in-javascript/)
- [Stagger Animation Patterns](https://www.hashbuilds.com/patterns/what-is-stagger-animation)
- [Different Approaches for Staggered Animation - CSS-Tricks](https://css-tricks.com/different-approaches-for-creating-a-staggered-animation/)
