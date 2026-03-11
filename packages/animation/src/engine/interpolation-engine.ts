// ============================================================
// Interpolation Engine — Main animation engine
// ============================================================

import type {
  Animation,
  PreparedAnimation,
  FrameState,
  FrameParticle,
  FrameConnection,
  InterpolationEngine as IInterpolationEngine,
  EasingFn,
  EasingSpec,
  OKLABBuffer,
  KeyframeParticle,
  KeyframeConnection,
} from '../types.js';
import { resolveEasing, easingSpecKey } from '../easing/index.js';
import { computeSpringLUT, springKey } from '../easing/spring.js';
import { matchAllKeyframes } from './keyframe-matcher.js';
import { findActiveEvents, processEvents } from './event-processor.js';
import { lerp, clampedLerp } from '../interpolators/numeric.js';
import { midpointSwitch } from '../interpolators/discrete.js';
import { hexToRGB, rgbToOKLAB, oklabToRGB } from '../utils/oklab.js';
import { clamp } from '../utils/math.js';

// Default values for particle properties
const DEFAULT_COLOR = '#FFFFFF';
const DEFAULT_OPACITY = 1.0;
const DEFAULT_SIZE = 1.0;

// Default values for connection properties
const DEFAULT_CONN_COLOR = '#FFFFFF';
const DEFAULT_CONN_WIDTH = 1;
const DEFAULT_CONN_OPACITY = 1.0;
const DEFAULT_CONN_STYLE = 'solid' as const;
const DEFAULT_CONN_CURVE = 0;
const DEFAULT_CONN_DIRECTED = false;

/**
 * Resolve a particle's color to RGB, using default if not specified.
 */
function resolveColor(color: string | undefined): [number, number, number] {
  return hexToRGB(color ?? DEFAULT_COLOR);
}

/**
 * Main InterpolationEngine implementation.
 */
export class AnimationEngine implements IInterpolationEngine {
  /**
   * Prepare an animation for playback.
   * Precomputes easing curves, keyframe matching, color conversions, spring LUTs.
   */
  prepare(animation: Animation): PreparedAnimation {
    const easingFns = new Map<string, EasingFn>();
    const springCurves = new Map<string, Float32Array>();

    // Resolve the default easing
    resolveEasing(animation.defaultEasing, easingFns);

    // Resolve all keyframe easings and per-property easings
    for (const kf of animation.keyframes) {
      resolveEasing(kf.easing, easingFns);
      if (kf.propertyEasing) {
        if (kf.propertyEasing.color) resolveEasing(kf.propertyEasing.color, easingFns);
        if (kf.propertyEasing.opacity) resolveEasing(kf.propertyEasing.opacity, easingFns);
        if (kf.propertyEasing.size) resolveEasing(kf.propertyEasing.size, easingFns);
      }

      // Precompute spring LUTs
      if (typeof kf.easing !== 'string' && kf.easing.type === 'spring') {
        const key = springKey(kf.easing.stiffness, kf.easing.damping, kf.easing.mass);
        if (!springCurves.has(key)) {
          springCurves.set(key, computeSpringLUT(kf.easing.stiffness, kf.easing.damping, kf.easing.mass));
        }
      }
    }

    // Match keyframes
    const keyframeMatches = matchAllKeyframes(animation.keyframes);

    // Precompute OKLAB color buffers per keyframe
    const colorBuffers: OKLABBuffer[] = animation.keyframes.map(kf => {
      const count = kf.particles.length;
      const L = new Float32Array(count);
      const a = new Float32Array(count);
      const b = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        const [r, g, bVal] = resolveColor(kf.particles[i].color);
        const oklab = rgbToOKLAB(r, g, bVal);
        L[i] = oklab.L;
        a[i] = oklab.a;
        b[i] = oklab.b;
      }

      return { L, a, b };
    });

    return {
      animation,
      easingFns,
      keyframeMatches,
      colorBuffers,
      springCurves,
    };
  }

  /**
   * Compute a single frame at the given time.
   */
  computeFrame(prepared: PreparedAnimation, timeMs: number): FrameState {
    const { animation, easingFns, keyframeMatches, colorBuffers } = prepared;
    const { keyframes, fps, duration } = animation;

    // Clamp time
    const t = clamp(timeMs, 0, duration);
    const frameIndex = Math.round(t / (1000 / fps));

    // Find surrounding keyframes using binary search
    let kfIndex = 0;
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (t >= keyframes[i].time) {
        kfIndex = i;
      }
    }

    // If at or past the last keyframe, return that keyframe's state
    if (kfIndex >= keyframes.length - 1) {
      return this._buildFrameFromKeyframe(
        keyframes[keyframes.length - 1],
        colorBuffers[keyframes.length - 1],
        t, frameIndex
      );
    }

    const fromKf = keyframes[kfIndex];
    const toKf = keyframes[kfIndex + 1];
    const match = keyframeMatches[kfIndex];
    const fromColors = colorBuffers[kfIndex];
    const toColors = colorBuffers[kfIndex + 1];

    // Compute local alpha (0-1 within this segment)
    const segmentDuration = toKf.time - fromKf.time;
    const localAlpha = segmentDuration > 0
      ? clamp((t - fromKf.time) / segmentDuration, 0, 1)
      : 1;

    // Resolve easing for this segment
    const easingSpec = toKf.easing || animation.defaultEasing;
    const easingKey = easingSpecKey(easingSpec);
    const easingFn = easingFns.get(easingKey)!;
    const easedAlpha = easingFn(localAlpha);

    // Resolve per-property easings
    const colorEasingSpec = toKf.propertyEasing?.color;
    const opacityEasingSpec = toKf.propertyEasing?.opacity;
    const sizeEasingSpec = toKf.propertyEasing?.size;

    const colorAlpha = colorEasingSpec
      ? easingFns.get(easingSpecKey(colorEasingSpec))!(localAlpha)
      : easedAlpha;
    const opacityAlpha = opacityEasingSpec
      ? easingFns.get(easingSpecKey(opacityEasingSpec))!(localAlpha)
      : easedAlpha;
    const sizeAlpha = sizeEasingSpec
      ? easingFns.get(easingSpecKey(sizeEasingSpec))!(localAlpha)
      : easedAlpha;

    // Interpolate matched particles
    const particles: FrameParticle[] = [];

    for (const { fromIndex, toIndex } of match.matched) {
      const fromP = fromKf.particles[fromIndex];
      const toP = toKf.particles[toIndex];

      // Color: OKLAB lerp then convert to sRGB
      const mt = 1 - colorAlpha;
      const L = fromColors.L[fromIndex] * mt + toColors.L[toIndex] * colorAlpha;
      const a = fromColors.a[fromIndex] * mt + toColors.a[toIndex] * colorAlpha;
      const b = fromColors.b[fromIndex] * mt + toColors.b[toIndex] * colorAlpha;
      const [cr, cg, cb] = oklabToRGB(L, a, b);

      // Opacity and size: lerp with clamping
      const opacity = clampedLerp(
        fromP.opacity ?? DEFAULT_OPACITY,
        toP.opacity ?? DEFAULT_OPACITY,
        opacityAlpha
      );

      const size = clamp(
        lerp(fromP.size ?? DEFAULT_SIZE, toP.size ?? DEFAULT_SIZE, sizeAlpha),
        0,
        Infinity
      );

      particles.push({
        row: toP.row,
        col: toP.col,
        colorR: cr,
        colorG: cg,
        colorB: cb,
        opacity,
        size,
      });
    }

    // Handle appearing particles (fade in)
    for (const { toIndex } of match.appearing) {
      const toP = toKf.particles[toIndex];
      const [cr, cg, cb] = resolveColor(toP.color);

      particles.push({
        row: toP.row,
        col: toP.col,
        colorR: cr,
        colorG: cg,
        colorB: cb,
        opacity: clamp((toP.opacity ?? DEFAULT_OPACITY) * easedAlpha, 0, 1),
        size: toP.size ?? DEFAULT_SIZE,
      });
    }

    // Handle disappearing particles (fade out)
    for (const { fromIndex } of match.disappearing) {
      const fromP = fromKf.particles[fromIndex];
      const [cr, cg, cb] = resolveColor(fromP.color);

      particles.push({
        row: fromP.row,
        col: fromP.col,
        colorR: cr,
        colorG: cg,
        colorB: cb,
        opacity: clamp((fromP.opacity ?? DEFAULT_OPACITY) * (1 - easedAlpha), 0, 1),
        size: fromP.size ?? DEFAULT_SIZE,
      });
    }

    // Interpolate connections
    const connections: FrameConnection[] = [];

    for (const { fromIndex, toIndex } of match.connectionMatched) {
      const fromC = fromKf.connections[fromIndex];
      const toC = toKf.connections[toIndex];

      const fromRgb = resolveColor(fromC.color);
      const toRgb = resolveColor(toC.color);
      const fromOklab = rgbToOKLAB(fromRgb[0], fromRgb[1], fromRgb[2]);
      const toOklab = rgbToOKLAB(toRgb[0], toRgb[1], toRgb[2]);

      const mt = 1 - colorAlpha;
      const [cr, cg, cb] = oklabToRGB(
        fromOklab.L * mt + toOklab.L * colorAlpha,
        fromOklab.a * mt + toOklab.a * colorAlpha,
        fromOklab.b * mt + toOklab.b * colorAlpha
      );

      connections.push({
        fromRow: toC.from[0],
        fromCol: toC.from[1],
        toRow: toC.to[0],
        toCol: toC.to[1],
        colorR: cr,
        colorG: cg,
        colorB: cb,
        opacity: clampedLerp(
          fromC.opacity ?? DEFAULT_CONN_OPACITY,
          toC.opacity ?? DEFAULT_CONN_OPACITY,
          opacityAlpha
        ),
        width: clamp(
          lerp(fromC.width ?? DEFAULT_CONN_WIDTH, toC.width ?? DEFAULT_CONN_WIDTH, sizeAlpha),
          0.1,
          Infinity
        ),
        style: midpointSwitch(
          fromC.style ?? DEFAULT_CONN_STYLE,
          toC.style ?? DEFAULT_CONN_STYLE,
          easedAlpha
        ),
        curve: lerp(fromC.curve ?? DEFAULT_CONN_CURVE, toC.curve ?? DEFAULT_CONN_CURVE, easedAlpha),
        directed: midpointSwitch(
          fromC.directed ?? DEFAULT_CONN_DIRECTED,
          toC.directed ?? DEFAULT_CONN_DIRECTED,
          easedAlpha
        ),
      });
    }

    // Appearing connections
    for (const { toIndex } of match.connectionAppearing) {
      const toC = toKf.connections[toIndex];
      const [cr, cg, cb] = resolveColor(toC.color);

      connections.push({
        fromRow: toC.from[0],
        fromCol: toC.from[1],
        toRow: toC.to[0],
        toCol: toC.to[1],
        colorR: cr,
        colorG: cg,
        colorB: cb,
        opacity: clamp((toC.opacity ?? DEFAULT_CONN_OPACITY) * easedAlpha, 0, 1),
        width: toC.width ?? DEFAULT_CONN_WIDTH,
        style: toC.style ?? DEFAULT_CONN_STYLE,
        curve: toC.curve ?? DEFAULT_CONN_CURVE,
        directed: toC.directed ?? DEFAULT_CONN_DIRECTED,
      });
    }

    // Disappearing connections
    for (const { fromIndex } of match.connectionDisappearing) {
      const fromC = fromKf.connections[fromIndex];
      const [cr, cg, cb] = resolveColor(fromC.color);

      connections.push({
        fromRow: fromC.from[0],
        fromCol: fromC.from[1],
        toRow: fromC.to[0],
        toCol: fromC.to[1],
        colorR: cr,
        colorG: cg,
        colorB: cb,
        opacity: clamp((fromC.opacity ?? DEFAULT_CONN_OPACITY) * (1 - easedAlpha), 0, 1),
        width: fromC.width ?? DEFAULT_CONN_WIDTH,
        style: fromC.style ?? DEFAULT_CONN_STYLE,
        curve: fromC.curve ?? DEFAULT_CONN_CURVE,
        directed: fromC.directed ?? DEFAULT_CONN_DIRECTED,
      });
    }

    // Process discrete events
    const activeEvents = findActiveEvents(animation.events, t);
    if (activeEvents.length > 0) {
      const eventResults = processEvents(activeEvents, t);
      particles.push(...eventResults.particles);
      connections.push(...eventResults.connections);
    }

    return {
      timeMs: t,
      frameIndex,
      particles,
      connections,
    };
  }

  /**
   * Generate all frames as a Generator (for batch rendering).
   */
  *generateFrames(prepared: PreparedAnimation): Generator<FrameState> {
    const { animation } = prepared;
    const { duration, fps } = animation;
    const frameDuration = 1000 / fps;
    const totalFrames = Math.round(duration / frameDuration);

    for (let i = 0; i < totalFrames; i++) {
      const timeMs = i * frameDuration;
      yield this.computeFrame(prepared, timeMs);
    }
  }

  /**
   * Build a frame state directly from a single keyframe (no interpolation).
   */
  private _buildFrameFromKeyframe(
    kf: import('../types.js').Keyframe,
    colors: OKLABBuffer,
    timeMs: number,
    frameIndex: number
  ): FrameState {
    const particles: FrameParticle[] = [];

    for (let i = 0; i < kf.particles.length; i++) {
      const p = kf.particles[i];
      const [cr, cg, cb] = oklabToRGB(colors.L[i], colors.a[i], colors.b[i]);

      particles.push({
        row: p.row,
        col: p.col,
        colorR: cr,
        colorG: cg,
        colorB: cb,
        opacity: p.opacity ?? DEFAULT_OPACITY,
        size: p.size ?? DEFAULT_SIZE,
      });
    }

    const connections: FrameConnection[] = kf.connections.map(c => {
      const [cr, cg, cb] = resolveColor(c.color);
      return {
        fromRow: c.from[0],
        fromCol: c.from[1],
        toRow: c.to[0],
        toCol: c.to[1],
        colorR: cr,
        colorG: cg,
        colorB: cb,
        opacity: c.opacity ?? DEFAULT_CONN_OPACITY,
        width: c.width ?? DEFAULT_CONN_WIDTH,
        style: c.style ?? DEFAULT_CONN_STYLE,
        curve: c.curve ?? DEFAULT_CONN_CURVE,
        directed: c.directed ?? DEFAULT_CONN_DIRECTED,
      };
    });

    return { timeMs, frameIndex, particles, connections };
  }
}
