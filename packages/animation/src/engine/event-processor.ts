// ============================================================
// Event Processor — Handle discrete events during frame computation
// ============================================================

import type { DiscreteEvent, FrameParticle, FrameConnection, ActiveEvent } from '../types.js';
import { getTransitionCurve } from '../effects/spawn-death.js';
import { clamp } from '../utils/math.js';
import { hexToRGB } from '../utils/oklab.js';

/**
 * Find all events that are active at the given time.
 * An event is active from its start time through its transition duration.
 */
export function findActiveEvents(events: DiscreteEvent[], timeMs: number): ActiveEvent[] {
  const active: ActiveEvent[] = [];

  for (const event of events) {
    const startTime = event.time;
    const endTime = event.time + event.transitionDuration;

    if (timeMs >= startTime && timeMs <= endTime) {
      const progress = event.transitionDuration > 0
        ? clamp((timeMs - startTime) / event.transitionDuration, 0, 1)
        : 1;
      active.push({ event, startTime, endTime, progress });
    }
  }

  return active;
}

/**
 * Process active events and produce additional particles/connections
 * or modifications to existing ones.
 */
export function processEvents(
  activeEvents: ActiveEvent[],
  timeMs: number
): { particles: FrameParticle[]; connections: FrameConnection[] } {
  const particles: FrameParticle[] = [];
  const connections: FrameConnection[] = [];

  for (const { event, progress } of activeEvents) {
    const curve = getTransitionCurve(event.transition);
    const action = event.action;

    if (action.type === 'addParticle') {
      const props = action.properties ?? {};
      const [r, g, b] = props.color ? hexToRGB(props.color) : [255, 255, 255];
      const baseOpacity = props.opacity ?? 1;
      const baseSize = props.size ?? 1;

      let opacity = baseOpacity;
      let size = baseSize;

      if (curve) {
        if (event.transition === 'fadeIn') {
          opacity = baseOpacity * curve(progress);
        } else if (event.transition === 'grow' || event.transition === 'pop') {
          size = baseSize * curve(progress);
        }
      }

      particles.push({
        row: action.row,
        col: action.col,
        colorR: r,
        colorG: g,
        colorB: b,
        opacity,
        size,
      });
    } else if (action.type === 'removeParticle') {
      // Removing particles — add a fading/shrinking particle
      if (curve && progress < 1) {
        let opacity = 1;
        let size = 1;

        if (event.transition === 'fadeOut') {
          opacity = curve(progress);
        } else if (event.transition === 'shrink') {
          size = curve(progress);
        }

        particles.push({
          row: action.row,
          col: action.col,
          colorR: 255,
          colorG: 255,
          colorB: 255,
          opacity,
          size,
        });
      }
    } else if (action.type === 'addConnection') {
      const props = action.properties ?? {};
      const [r, g, b] = props.color ? hexToRGB(props.color) : [255, 255, 255];
      const baseOpacity = props.opacity ?? 1;

      let opacity = baseOpacity;
      if (curve && event.transition === 'fadeIn') {
        opacity = baseOpacity * curve(progress);
      }

      connections.push({
        fromRow: action.from[0],
        fromCol: action.from[1],
        toRow: action.to[0],
        toCol: action.to[1],
        colorR: r,
        colorG: g,
        colorB: b,
        opacity,
        width: props.width ?? 1,
        style: props.style ?? 'solid',
        curve: props.curve ?? 0,
        directed: props.directed ?? false,
      });
    } else if (action.type === 'removeConnection') {
      if (curve && progress < 1) {
        let opacity = 1;
        if (event.transition === 'fadeOut') {
          opacity = curve(progress);
        }

        connections.push({
          fromRow: action.from[0],
          fromCol: action.from[1],
          toRow: action.to[0],
          toCol: action.to[1],
          colorR: 255,
          colorG: 255,
          colorB: 255,
          opacity,
          width: 1,
          style: 'solid',
          curve: 0,
          directed: false,
        });
      }
    }
  }

  return { particles, connections };
}
