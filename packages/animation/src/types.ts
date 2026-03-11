// ============================================================
// Types — All interfaces and type definitions for @particle-engine/animation
// ============================================================

// === Easing ===

/** A function that maps t in [0,1] to an eased value (usually [0,1], may overshoot) */
export type EasingFn = (t: number) => number;

/** Named easing or custom bezier/spring/steps specification */
export type EasingSpec =
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

export interface Keyframe {
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

export interface KeyframeParticle {
  row: number;
  col: number;
  color?: string;       // hex RGB "#RRGGBB"
  opacity?: number;     // 0.0 - 1.0
  size?: number;        // multiplier
  group?: string;
}

export interface KeyframeConnection {
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

export interface DiscreteEvent {
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

export interface Animation {
  id: string;
  duration: number;          // total duration in ms
  fps: number;               // target frames per second
  keyframes: Keyframe[];     // sorted by time, first must be at time=0
  events: DiscreteEvent[];   // sorted by time
  defaultEasing: EasingSpec; // fallback when keyframe doesn't specify
}


// === Interpolation Engine ===

export interface InterpolationEngine {
  /**
   * Prepare an animation for playback.
   * Precomputes easing curves, keyframe matching, color conversions, etc.
   */
  prepare(animation: Animation): PreparedAnimation;

  /**
   * Compute a single frame at the given time.
   * Returns the computed frame state (particle properties + connection properties).
   */
  computeFrame(prepared: PreparedAnimation, timeMs: number): FrameState;

  /**
   * Generate all frames as an iterator (for batch rendering).
   */
  generateFrames(prepared: PreparedAnimation): Generator<FrameState>;
}


// === Prepared Animation ===

export interface KeyframeMatchResult {
  /** Particles that exist in both from and to keyframes, matched by position */
  matched: Array<{
    fromIndex: number;
    toIndex: number;
    key: string; // "row,col"
  }>;
  /** Particles that appear (only in the 'to' keyframe) */
  appearing: Array<{
    toIndex: number;
    key: string;
  }>;
  /** Particles that disappear (only in the 'from' keyframe) */
  disappearing: Array<{
    fromIndex: number;
    key: string;
  }>;
  /** Connection matches */
  connectionMatched: Array<{
    fromIndex: number;
    toIndex: number;
    key: string;
  }>;
  connectionAppearing: Array<{
    toIndex: number;
    key: string;
  }>;
  connectionDisappearing: Array<{
    fromIndex: number;
    key: string;
  }>;
}

export interface OKLABColor {
  L: number;
  a: number;
  b: number;
}

export interface OKLABBuffer {
  L: Float32Array;
  a: Float32Array;
  b: Float32Array;
}

export interface PreparedAnimation {
  animation: Animation;
  easingFns: Map<string, EasingFn>;          // precomputed/resolved easing functions
  keyframeMatches: KeyframeMatchResult[];     // particle correspondence per segment
  colorBuffers: OKLABBuffer[];               // precomputed OKLAB values per keyframe
  springCurves: Map<string, Float32Array>;    // precomputed spring lookup tables
}


// === Frame State ===

export interface FrameState {
  timeMs: number;
  frameIndex: number;
  particles: FrameParticle[];     // all active particles with computed properties
  connections: FrameConnection[]; // all active connections with computed properties
}

export interface FrameParticle {
  row: number;
  col: number;
  colorR: number;  // 0-255 sRGB
  colorG: number;
  colorB: number;
  opacity: number; // 0.0-1.0
  size: number;    // multiplier
}

export interface FrameConnection {
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


// === Animation Buffer (SoA typed arrays for batch interpolation) ===

export interface AnimationBuffer {
  fromOpacity: Float32Array;
  fromSize: Float32Array;
  fromColorL: Float32Array;
  fromColorA: Float32Array;
  fromColorB: Float32Array;
  toOpacity: Float32Array;
  toSize: Float32Array;
  toColorL: Float32Array;
  toColorA: Float32Array;
  toColorB: Float32Array;
  outOpacity: Float32Array;
  outSize: Float32Array;
  outColorR: Uint8Array;
  outColorG: Uint8Array;
  outColorB: Uint8Array;
}


// === Active Event (runtime tracking) ===

export interface ActiveEvent {
  event: DiscreteEvent;
  startTime: number;
  endTime: number;
  progress: number; // 0-1
}

// === Sub-grid particle for bilinear distribution ===

export interface SubGridParticle {
  row: number;
  col: number;
  weight: number; // 0.0 to 1.0
}
