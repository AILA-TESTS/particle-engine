# API Design

This document outlines the planned API surface for the Particle Engine. All operations are designed to be simple, composable, and readable by LLMs.

## Particle Operations

Operations for managing individual particles in the 2D space.

### `particle.set(id, x, y, [properties])`
Place or update a particle at position (x, y) in the bounded space.

### `particle.move(id, x, y, [duration])`
Move an existing particle to a new position. Optional duration for animated movement.

### `particle.delete(id)`
Remove a particle from the space. Any connected lines are also removed.

### `particle.get(id)`
Retrieve the current state of a particle (position, properties, connections).

### `particle.list([filter])`
List all particles, optionally filtered by region or properties.

---

## Line Operations

Operations for connecting and disconnecting particles with lines.

### `line.connect(particle_a, particle_b, [properties])`
Draw a line between two particles. Properties may include color, thickness, style.

### `line.disconnect(particle_a, particle_b)`
Remove the line between two particles.

### `line.get(particle_a, particle_b)`
Retrieve properties of a line between two particles.

### `line.list([filter])`
List all lines, optionally filtered by connected particles or properties.

---

## Space Operations

Operations for reading and querying the overall state of the 2D space.

### `space.read()`
Return the full current state: all particles, all lines, space bounds.

### `space.query(region)`
Return particles and lines within a specified rectangular or circular region.

### `space.bounds()`
Return the dimensions of the bounded 2D space.

### `space.clear()`
Remove all particles and lines, resetting the space.

### `space.snapshot()`
Capture a serialized snapshot of the current state for later restoration.

### `space.restore(snapshot)`
Restore the space to a previously captured snapshot.

---

## Animation Operations

Operations for creating temporal sequences from particle states.

### `animation.keyframe(time, state)`
Define a keyframe at a specific time with a given particle/line state.

### `animation.sequence(keyframes, [interpolation])`
Create an animation sequence from a series of keyframes. Interpolation defines how transitions between keyframes are computed (linear, ease-in-out, etc.).

### `animation.render(sequence, format, [options])`
Render an animation sequence to a specified format (video, GIF, image sequence).

### `animation.preview(sequence, [time])`
Preview a single frame or the animation at a given time point.

---

_These API signatures are preliminary and will be refined during implementation. The goal is to keep the interface minimal, composable, and intuitive for LLM-driven usage._
