# Particle Engine — Example Prompts

A curated set of prompts demonstrating what the particle engine can do.
Use these via the `/api/sessions/:id/prompt` endpoint or the WebSocket connection.

---

## Simple — Place Particles

These prompts exercise the basics: placing particles at specific positions with
colors, sizes, and opacity.

**1. Horizontal line of particles**
```
Place 5 red particles in a horizontal line at row 10,
starting at column 5 and spaced 5 columns apart.
```

**2. Vertical line of particles**
```
Place 8 white particles in a vertical line at column 50,
starting at row 10 and spaced 5 rows apart.
```

**3. Centered dot**
```
Place a single large bright-yellow particle at the center of the grid.
```

**4. Colored corners**
```
Place one particle at each corner of the grid.
Use red (top-left), green (top-right), blue (bottom-left),
and white (bottom-right).
```

**5. Scattered random field**
```
Place 20 particles scattered across the grid.
Use a mix of colors: some red, some blue, some green.
```

---

## Intermediate — Patterns and Shapes

These prompts build geometric structures and visual patterns.

**6. Grid of alternating colors**
```
Create a 10x10 grid of particles in the top-left quadrant of the space
(starting at row 5, column 5, with 5-unit spacing).
Alternate colors: blue on even positions, green on odd positions.
```

**7. Triangle with connected vertices**
```
Draw a triangle using particles:
- Top vertex at the center-top of the grid
- Bottom-left vertex near the lower-left
- Bottom-right vertex near the lower-right
Then connect the three vertices with white lines.
```

**8. Circle approximation**
```
Approximate a circle with 12 particles evenly distributed
around a center point at (row 50, col 50) with a radius of 20 grid units.
Connect adjacent particles to outline the circle.
```

**9. Red-to-blue gradient line**
```
Place 10 particles in a horizontal line across the middle of the grid.
The leftmost particle should be solid red (#FF0000),
the rightmost should be solid blue (#0000FF),
and the particles in between should gradually transition from red to blue.
```

**10. Star pattern**
```
Create a five-pointed star shape using particles.
Place particles at each of the 5 outer tips and 5 inner points.
Connect the tips in star order (tip 1 to tip 3 to tip 5 to tip 2 to tip 4 back to tip 1)
using bright-yellow lines.
```

---

## Advanced — Animation and Layering

These prompts exercise the animation and layering capabilities of the engine.

**11. Particles moving left to right**
```
Create 3 particles in a vertical column on the left side of the grid (column 5).
Animate each particle moving horizontally to the right side (column 95)
over 60 frames, with each particle starting 10 frames after the previous one.
```

**12. Pulsing central particle**
```
Place a white particle at the center of the grid.
Animate its size from small (0.5) to large (3.0) and back over 30 frames,
looping so it pulses continuously.
```

**13. Spiral fading from red to blue**
```
Create a spiral pattern of 20 particles starting near the center.
Each successive particle should be placed slightly further out and
rotated approximately 30 degrees around the center.
Color should gradually transition from red (#FF0000) at the center
to blue (#0000FF) at the outermost particle.
Opacity should decrease from 1.0 at the center to 0.3 at the edge.
```

**14. Two-layer composition**
```
Layer 1 (background): Place a 5x5 grid of dim grey particles (opacity 0.3)
spread evenly across the center of the grid.

Layer 2 (foreground): On top, place 5 bright-white particles at the points
of a pentagon shape, and connect them with white lines to form the outline.

Use layer indices to ensure the pentagon appears above the grid.
```

**15. Wave animation**
```
Place 15 particles in a horizontal row across the middle of the grid.
Animate them to form a sine wave: each particle oscillates vertically
with the same amplitude (±10 rows) but with a phase offset of 24 degrees
relative to its neighbor. The full cycle should complete in 60 frames.
```
