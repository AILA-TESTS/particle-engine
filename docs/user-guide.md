# Particle Engine — User Guide

Welcome to Particle Engine! This guide is for people who want to **use** the system — no setup required, no code needed. Someone else has already deployed everything. You just need a URL and some ideas.

---

## Table of Contents

1. [What is Particle Engine?](#1-what-is-particle-engine)
2. [Getting Started](#2-getting-started)
3. [The Grid](#3-the-grid)
4. [What You Can Ask the AI to Do](#4-what-you-can-ask-the-ai-to-do)
5. [Tips for Better Prompts](#5-tips-for-better-prompts)
6. [Using the API Directly](#6-using-the-api-directly)
7. [UI Features and Status Indicators](#7-ui-features-and-status-indicators)
8. [Troubleshooting](#8-troubleshooting)
9. [Glossary](#9-glossary)

---

## 1. What is Particle Engine?

Particle Engine is a visual creation tool where you describe what you want to see in plain language, and an AI builds it for you on a grid. The grid is a dark canvas made up of rows and columns of positions — think of it like graph paper. You can place glowing dots (called **particles**) at any position on the grid, connect them with lines (**connections**), animate them over time, and export the result as an SVG image or a video.

You never write code. You just type prompts like "Draw a triangle with red vertices connected by white lines" or "Animate 5 particles moving from left to right" and watch it appear. The AI understands your intent and calls the right tools behind the scenes to make it happen.

---

## 2. Getting Started

### Opening the UI

Open the URL you were given in any modern browser (Chrome, Firefox, Safari, Edge). You will see the Particle Engine interface load automatically. Within a moment, a session is created and the canvas is ready.

### What You See

The interface has four main areas:

```
+------------------------------------------+
|  Particle Engine   Session: abc123...     |  <- Header
+------------------------------------------+
|                         |                |
|                         |  [Log Panel]   |
|    [Canvas / Grid]      |                |
|                         |  [Prompt Box]  |
|                         |  [Send Button] |
+------------------------------------------+
|  Particles: 0   Connections: 0   Server: connected  |  <- Status Bar
+------------------------------------------+
```

| Area | What it does |
|------|-------------|
| **Canvas** | The main visual area. Your particles and connections appear here in real time. |
| **Log Panel** (right sidebar) | Shows a running history of everything: your prompts, the AI's responses, each tool call the AI makes, status messages, and errors. |
| **Prompt Box** | Where you type your instructions. |
| **Send Button** | Submits your prompt. You can also press **Enter**. |
| **Status Bar** | Shows the current particle count, connection count, and server status at a glance. |
| **Header** | Shows the session ID (abbreviated) and grid size (e.g., `100x100`). |

### Your First Prompt

Let's try something simple. Follow these steps:

1. Click the prompt box at the bottom right of the screen. You will see placeholder text: *"Describe what to create..."*
2. Type this:
   ```
   Place 5 red particles in a diagonal line and connect them
   ```
3. Press **Enter** or click **Send**.
4. Watch the log panel on the right. You will see:
   - Your message appear (green border, labelled with your text)
   - The AI's response (blue border)
   - Tool calls being made (amber border, showing which action the AI is taking)
   - Status entries in grey italic as the process completes
5. The canvas updates as each tool call finishes. Red dots appear, then lines connecting them.

That's it. You just created your first particle scene.

### What Happens Behind the Scenes

When you send a prompt, the system:
1. Sends your text to the AI along with information about your grid (dimensions, current state)
2. The AI decides what tools to call — for example, `set_particles` to place dots and `connect` to draw lines between them
3. Each tool call is executed immediately and the canvas updates in real time
4. When the AI is done, you see "Done" in the log panel and the Send button re-enables

The AI may call multiple tools in sequence for a single prompt. A complex request like "draw a star" might result in 2–3 separate tool calls: one to place the star points, one to place the inner vertices, and one to connect them.

---

## 3. The Grid

### What the Grid Is

The grid is a 2D space divided into rows and columns — by default **100 rows by 100 columns**, giving you 10,000 addressable positions. Think of it like a spreadsheet where each cell can hold a particle.

The grid renders as a dark canvas. Faint dots mark each position, so you can see the structure even when it is empty.

### Coordinate System

Every position on the grid is identified by `(row, col)`:

- **Row** counts from top to bottom. Row 0 is the very top. Row 99 is the very bottom.
- **Col** counts from left to right. Column 0 is the leftmost. Column 99 is the rightmost.

So the top-left corner is `(0, 0)`, the top-right corner is `(0, 99)`, the bottom-left corner is `(99, 0)`, and the center of a 100x100 grid is approximately `(50, 50)`.

```
(0,0) ────────────── (0,99)
  │                     │
  │    your canvas      │
  │                     │
(99,0) ─────────────(99,99)
```

### Particles

A particle is a colored dot placed at a grid position. Each particle has:

| Property | What it controls | Default |
|----------|-----------------|---------|
| `row`, `col` | Its position on the grid | (required) |
| `color` | Its color, as a hex code like `#FF0000` | white |
| `size` | A size multiplier — `1` is normal, `2` is twice as big, `0.5` is half | `1` |
| `opacity` | How transparent it is — `1.0` is fully visible, `0.0` is invisible | `1.0` |
| `group` | An optional label you can use to refer to a set of particles together | none |
| `label` | A text label attached to the particle | none |
| `layer` | Z-order — higher numbers appear in front | `0` |

### Connections

A connection is a line drawn between two particles. Both particles must already exist. Each connection can have:

| Property | What it controls | Default |
|----------|-----------------|---------|
| `from`, `to` | The two particle positions it connects | (required) |
| `color` | Line color as hex | white |
| `width` | Line thickness | `1` |
| `opacity` | Transparency | `1.0` |
| `style` | `solid`, `dashed`, or `dotted` | `solid` |
| `directed` | If `true`, draws an arrow indicating direction | `false` |
| `group` | Group name for batch removal | none |
| `label` | Text label on the connection | none |

### Grid Dots

The faint dots on the canvas represent empty grid positions. They are just a visual guide — they do not show up in rendered exports. Only actual particles (the ones you place) appear in SVG or video output.

---

## 4. What You Can Ask the AI to Do

The AI has 13 tools it can call. You never invoke these tools directly in the browser UI — you just write natural language and the AI picks the right ones. This section groups capabilities by what you might want to accomplish.

### Placing Particles

**Single particle:**
```
Place a bright yellow particle at the center of the grid
```

```
Put one large white particle at row 10, column 50
```

**A line of particles:**
```
Place 5 red particles in a horizontal line at row 20,
starting at column 10 and spaced 10 columns apart
```

```
Place 8 white particles in a vertical line at column 50,
rows 10 through 80, evenly spaced
```

**Diagonal arrangement:**
```
Place 6 particles along a diagonal from the top-left
to the bottom-right of the grid. Use bright cyan (#00FFFF).
```

**Scattered field:**
```
Place 20 particles scattered randomly across the grid.
Mix of colors: some red, some blue, some green.
Make them small (size 0.5).
```

**Particles at the corners:**
```
Place one particle at each corner of the grid.
Top-left red, top-right green, bottom-left blue, bottom-right white.
```

**Using groups (to manage particles together later):**
```
Place 5 particles at row 30, columns 10–50, spaced 10 apart.
Color them orange. Group them as "top-row".
```

### Creating Patterns and Shapes

**Rectangle outline:**
```
Draw a rectangle outline using particles:
top-left at (10, 10), bottom-right at (60, 80).
Place particles at all four corners and along each edge
every 5 positions. Connect them to form the outline.
```

**Triangle:**
```
Draw a triangle:
- Top vertex at (10, 50)
- Bottom-left at (70, 15)
- Bottom-right at (70, 85)
Connect the three vertices with white lines.
```

**Circle approximation:**
```
Approximate a circle using 12 particles evenly distributed
around center (50, 50) with a radius of 20 grid units.
Connect adjacent particles to outline the shape.
```

**Five-pointed star:**
```
Create a five-pointed star. Place particles at the 5 outer tips
and 5 inner points. Connect the tips in star order
(tip 1 to tip 3 to tip 5 to tip 2 to tip 4 back to tip 1)
using bright yellow lines.
```

**Grid pattern:**
```
Create a 5x5 grid of particles in the top-left quadrant
(starting at row 10, column 10, with 8-unit spacing).
Alternate colors: blue at even positions, green at odd positions.
```

**Color gradient:**
```
Place 10 particles in a horizontal line at row 50,
columns 5 to 95, evenly spaced.
Leftmost particle is solid red (#FF0000),
rightmost is solid blue (#0000FF).
Transition smoothly from red to blue across the row.
```

**Spiral:**
```
Create a spiral of 20 particles starting near the center (50, 50).
Each successive particle is placed slightly further out,
rotated about 30 degrees around the center.
Color transitions from red at the center to blue at the edge.
Opacity decreases from 1.0 at center to 0.3 at the edge.
```

**Text-like patterns:**
```
Using particles, approximate the letter "L":
a vertical column from (10, 20) to (50, 20) with spacing 5,
then a horizontal row from (50, 20) to (50, 40) with spacing 5.
Use white particles.
```

### Connecting Particles

**Connect two specific particles:**
```
Connect the particle at (10, 10) to the particle at (50, 90)
with a white line.
```

**Outline a shape:**
```
Connect the particles at (10, 50), (50, 15), and (50, 85)
in a loop to form a triangle outline.
```

**Mesh (every particle connected to every other):**
```
Connect all particles in the "corners" group to each other
with thin grey lines (opacity 0.5).
```

**Network / hub-and-spoke:**
```
Place one particle at the center (50, 50) and 6 particles
arranged in a ring around it at radius 20.
Connect each outer particle to the center with a dashed line.
```

**Styled connections:**
```
Connect (10, 10) to (30, 80) with a thick red dashed line (width 3).
Connect (30, 80) to (70, 50) with a thin dotted blue line.
```

**Directed connections (arrows):**
```
Place three particles at (10, 20), (30, 50), and (60, 30).
Connect them in sequence with directed (arrow) connections.
```

### Reading and Inspecting State

You can ask the AI what is on the grid at any time. It will call `get_state` or `get_space_info` and describe what it finds.

```
How many particles are on the grid right now?
```

```
What particles are in the top-left quadrant (rows 0–40, columns 0–40)?
```

```
List all particles in the "corners" group.
```

```
What connections exist? Show me from and to positions.
```

```
What is the current grid size?
```

### Modifying Existing Work

**Change color of specific particles:**
```
Change the particle at (10, 50) to bright green (#00FF00).
```

```
Change all particles in the "top-row" group to purple (#8800FF).
```

**Move a particle:**
```
Move the particle at (20, 20) to (30, 40).
```
(Note: there is no "move" tool directly. The AI will clear the old particle and place a new one at the new position. Any connections to the old position will need to be reconnected.)

**Remove specific particles:**
```
Remove the particle at row 15, column 30.
```

```
Remove all particles in the "background" group.
```

```
Clear all particles from the grid.
```

**Remove connections:**
```
Remove the connection between (10, 20) and (50, 80).
```

```
Remove all connections in the "frame" group.
```

**Clear everything:**
```
Clear the entire canvas — remove all particles and connections.
```

### Snapshots and Undo

**Undo the last action:**
```
Undo that last change.
```

The undo system keeps a stack of states before every mutating action. If you place 5 particles and then say "undo", you revert to before those 5 particles were added. Undo only goes back one step per command, but you can issue multiple undo requests in a row.

**Save a named snapshot:**
```
Save the current state as "my-star-design".
```

```
Take a snapshot called "before-animation".
```

Use snapshots before making big changes so you have a safe point to return to. Snapshot names can be any text — choose something meaningful.

**Restore a snapshot:**
```
Restore the snapshot called "my-star-design".
```

```
Go back to the "before-animation" state.
```

### Animation

Particle Engine supports **keyframe animation**. You define what properties look like at specific moments in time, and the engine smoothly interpolates everything in between.

**What "keyframe" means in plain language:**
Think of keyframes like snapshots at key moments. You tell the AI: "At 0 milliseconds, this particle is at position A. At 1000 milliseconds, it is at position B." The engine fills in all the frames in between automatically, creating smooth motion.

**Moving particles over time:**
```
Create 3 particles in a vertical column on the left side (column 5).
Animate each one moving horizontally to column 95 over 2 seconds.
Start each particle 300 milliseconds after the previous one.
```

**Color transitions over time:**
```
Place a white particle at the center.
Animate its color changing from white to red over 1 second,
then back to white over another second. Use easeInOutSine easing.
```

**Size pulsing:**
```
Place a particle at (50, 50).
Animate its size from 0.5 to 3.0 and back over 1 second,
so it pulses continuously.
```

**Wave motion:**
```
Place 15 particles in a horizontal row at row 50.
Animate them as a sine wave: each particle moves vertically
with the same amplitude (±10 rows) but with a phase offset
based on its position. Full cycle in 2 seconds.
```

**Easing options** control how motion accelerates or decelerates:

| Easing name | What it feels like |
|-------------|-------------------|
| `linear` | Constant speed throughout |
| `easeInQuad` | Starts slow, finishes fast |
| `easeOutQuad` | Starts fast, finishes slow |
| `easeInOutQuad` | Starts and ends slow, fast in the middle |
| `easeInCubic` / `easeOutCubic` / `easeInOutCubic` | Like Quad but more pronounced |
| `easeInSine` / `easeOutSine` / `easeInOutSine` | Smooth, gentle curves |
| `easeInExpo` / `easeOutExpo` | Very slow start or end, dramatic acceleration |
| `easeInBack` / `easeOutBack` | Slight overshoot at start or end (like a rubber band) |
| `easeInElastic` / `easeOutElastic` | Spring-like wobble at start or end |
| `easeInBounce` / `easeOutBounce` | Bounces like a ball at start or end |

Use the names exactly as written above (case-sensitive).

You can also use spring physics for natural-feeling motion:
```
Animate using spring easing with stiffness 200, damping 20
```

**Modifying an animation after creation:**
```
Add a keyframe at 1500ms where the center particle returns to size 1.0.
```

```
Change the animation duration to 3 seconds.
```

### Rendering Output

**Get an SVG image:**

The SVG render endpoint is always available. Simply navigate to:
```
https://your-server-url/api/sessions/SESSION_ID/render
```
Your browser will display the current state of the canvas as an SVG. You can right-click and save it.

You can also ask the AI:
```
Render the current state as an SVG image.
```

Optional query parameters for the render URL:
- `width` — output width in pixels (default: 800)
- `height` — output height in pixels (default: 800)
- `backgroundColor` — background hex color (default: `#000000`)
- `padding` — padding in pixels (default: 20)

Example:
```
https://your-server-url/api/sessions/SESSION_ID/render?width=1200&height=800&backgroundColor=%23111111
```

**Get a video (MP4, WebM, or GIF):**

First create an animation, then ask the AI to render it:
```
Render the animation as an MP4 video, 1080x1080 pixels.
```

```
Render the current animation as a GIF.
```

---

## 5. Tips for Better Prompts

### Be Specific About Positions

The grid uses exact row/column numbers. Vague instructions like "near the top" work but may not place particles exactly where you want. If you care about placement, say so:

Instead of:
```
Place some particles near the top
```

Try:
```
Place 3 particles at row 5, columns 20, 50, and 80
```

### Specify Colors Precisely When It Matters

Color names like "red" or "blue" work, but for exact shades, use hex codes:

```
Use deep purple (#4B0082)
```
```
Use hot pink (#FF69B4)
```
```
Use a medium grey (#888888)
```

### Build Incrementally

Start simple and add complexity step by step. This makes it easier to catch mistakes and undo them cleanly:

1. Place the particles first
2. Connect them
3. Then animate

### Use "Undo" Freely

If something goes wrong, just say:
```
Undo that
```

Then try again with a more precise prompt.

### Save Snapshots Before Big Changes

Before a major operation (like adding animation or a complex pattern), save your work:
```
Save a snapshot called "clean-triangle"
```

If things go sideways, restore it:
```
Restore "clean-triangle"
```

### Describe the End Result, Not the Steps

The AI is better at understanding what you want than how to get there:

Instead of:
```
Call set_particles with row 10 col 10, then row 20 col 20...
```

Try:
```
Place 5 particles in a diagonal line from top-left to bottom-right
```

### Know Your Grid Size

The default grid is 100x100 (rows 0–99, columns 0–99). The session info in the header shows your actual grid dimensions. If you ask for a particle at row 150 on a 100-row grid, the request will fail.

### Use Groups for Complex Scenes

Assign particles to named groups when building layered or complex scenes. This lets you refer to them collectively later:

```
Place the background particles and group them as "bg".
Place the foreground particles and group them as "fg".
```

Later:
```
Clear all particles in the "bg" group.
```

### Two-Layer Compositions

Use the `layer` property to control what appears in front:
```
Place background particles at layer 0 with opacity 0.3.
Place foreground particles at layer 1 with full opacity.
```

---

## 6. Using the API Directly

Power users can bypass the browser UI and interact with the API using `curl`, Postman, or code. This section shows complete examples.

**Base URL:** Replace `http://localhost:3000` with your actual server URL.

### Step 1 — Create a Session

```bash
curl -X POST http://localhost:3000/api/sessions
```

Response:
```json
{
  "id": "abc123...",
  "config": { "rows": 100, "cols": 100, "spacing": 10 },
  "createdAt": "2026-03-12T10:00:00Z"
}
```

Save the `id` — you will use it in every subsequent request. You can also create a session with custom grid dimensions:

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H 'Content-Type: application/json' \
  -d '{"rows": 50, "cols": 50}'
```

### Step 2 — Send a Prompt to the AI

```bash
SESSION_ID="abc123..."

curl -X POST http://localhost:3000/api/sessions/$SESSION_ID/prompt \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "Draw a triangle using particles and connect the vertices with white lines"}'
```

Response includes the conversation messages, tool call count, and token usage:
```json
{
  "messages": [...],
  "toolCallCount": 3,
  "usage": { "inputTokens": 450, "outputTokens": 120 }
}
```

### Step 3 — Check the Current State

```bash
curl http://localhost:3000/api/sessions/$SESSION_ID
```

Response includes the full grid state with all active particles and connections.

### Step 4 — Get the SVG Render

```bash
curl http://localhost:3000/api/sessions/$SESSION_ID/render \
  --output scene.svg
```

Open `scene.svg` in your browser or vector graphics editor.

With custom dimensions:
```bash
curl "http://localhost:3000/api/sessions/$SESSION_ID/render?width=1200&height=1200&backgroundColor=%23111111&padding=40" \
  --output scene-large.svg
```

### Executing Tools Directly (Bypassing the AI)

For programmatic use, you can call tools directly without going through the AI:

```bash
# Place two particles
curl -X POST http://localhost:3000/api/sessions/$SESSION_ID/tool \
  -H 'Content-Type: application/json' \
  -d '{
    "tool": "set_particles",
    "params": {
      "particles": [
        {"row": 10, "col": 10, "color": "#FF0000", "size": 2},
        {"row": 50, "col": 50, "color": "#0000FF", "size": 1.5}
      ]
    }
  }'

# Connect them
curl -X POST http://localhost:3000/api/sessions/$SESSION_ID/tool \
  -H 'Content-Type: application/json' \
  -d '{
    "tool": "connect",
    "params": {
      "connections": [
        {"from": [10, 10], "to": [50, 50], "color": "#FFFFFF", "width": 2}
      ]
    }
  }'

# Undo the last action
curl -X POST http://localhost:3000/api/sessions/$SESSION_ID/tool \
  -H 'Content-Type: application/json' \
  -d '{"tool": "undo", "params": {}}'

# Save a snapshot
curl -X POST http://localhost:3000/api/sessions/$SESSION_ID/tool \
  -H 'Content-Type: application/json' \
  -d '{"tool": "snapshot", "params": {"name": "v1"}}'

# Restore a snapshot
curl -X POST http://localhost:3000/api/sessions/$SESSION_ID/tool \
  -H 'Content-Type: application/json' \
  -d '{"tool": "restore", "params": {"name": "v1"}}'

# Get grid info
curl -X POST http://localhost:3000/api/sessions/$SESSION_ID/tool \
  -H 'Content-Type: application/json' \
  -d '{"tool": "get_space_info", "params": {}}'
```

### Available Direct Tool Names

| Tool name | What it does |
|-----------|-------------|
| `set_particles` | Place or update particles |
| `clear_particles` | Remove particles |
| `connect` | Create connections |
| `disconnect` | Remove connections |
| `create_animation` | Define a new animation |
| `modify_animation` | Update an existing animation |
| `render_image` | Render to SVG/PNG |
| `render_video` | Render animation to video |
| `snapshot` | Save named state checkpoint |
| `restore` | Load a named checkpoint |
| `undo` | Revert last change |
| `get_state` | Read current particles/connections |
| `get_space_info` | Read grid dimensions and counts |

### List All Sessions

```bash
curl http://localhost:3000/api/sessions
```

### Delete a Session

```bash
curl -X DELETE http://localhost:3000/api/sessions/$SESSION_ID
```

### WebSocket for Real-Time Updates

The WebSocket connection streams events as the AI works, so your UI updates live instead of waiting for the whole response.

**Connect to the WebSocket:**
```
ws://localhost:3000/api/ws
```

**Message flow:**

1. Send a `join` message with your session ID:
```json
{"type": "join", "sessionId": "abc123..."}
```

2. Server responds:
```json
{"type": "joined", "sessionId": "abc123..."}
```

3. Send a prompt:
```json
{"type": "prompt", "text": "Draw a red circle"}
```

4. Server streams back events as the AI works:
```json
{"type": "text", "content": "I'll create a circle approximation..."}
{"type": "tool_call", "name": "set_particles", "args": {...}}
{"type": "tool_result", "name": "set_particles", "result": {...}}
{"type": "state_update", "state": {...}}
{"type": "done"}
```

The `state_update` events contain the full grid state after each tool call — use these to update your canvas in real time.

**Error message format:**
```json
{"type": "error", "message": "A prompt is already being processed"}
```

---

## 7. UI Features and Status Indicators

### The Header

The header bar shows:
- **"Particle Engine"** — the application name
- **Session info** — abbreviated session ID and grid size, e.g. `Session: abc123... (100x100)`

If the session fails to create (server unreachable), the session info shows "No session".

### The Status Bar

The status bar at the bottom updates automatically after every change:

| Field | What it shows |
|-------|--------------|
| **Particles** | Total number of active particles on the grid |
| **Connections** | Total number of connections |
| **Server** | `connected` when the server is reachable; `disconnected` if it is not |

### The Log Panel

The log panel is a scrolling history of everything that has happened in the session. Each entry has a color-coded left border:

| Border color | Entry type | Meaning |
|-------------|-----------|---------|
| Green | User | Your prompt text |
| Blue | Assistant | The AI's text response |
| Amber | Tool | A tool call the AI made (shows tool name and parameters, truncated) |
| Red | Error | An error occurred |
| None (italic grey) | Status | System messages: session created, WebSocket connected, "Done", token counts |

Tool entries look like this:
```
set_particles({"particles":[{"row":10,"col":10,"color":"#FF...
```
The parameters are truncated at 100 characters. This is normal.

Status entries at the end of each response show tool call counts and token usage:
```
3 tool calls, 570 tokens
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Enter** | Submit the prompt (same as clicking Send) |

There are no other keyboard shortcuts in the current version.

### Loading State

While a prompt is being processed:
- The prompt input is disabled (greyed out)
- The Send button shows "Sending..." and is disabled
- The canvas updates live as each tool call completes

Once processing finishes, everything re-enables and the log shows "Done".

### WebSocket vs HTTP Fallback

The client tries to connect via WebSocket first (for real-time streaming). If the WebSocket connection fails or drops, it automatically falls back to regular HTTP. In HTTP mode, the canvas only updates after the AI finishes all tool calls — not in real time. The log panel will note: *"WebSocket disconnected, falling back to HTTP"*.

---

## 8. Troubleshooting

### "Nothing happened after I sent my prompt"

The AI might not have understood the request, or the server might not have an LLM provider configured. Check the log panel for error messages in red. Try rephrasing with more specific details — include exact row/column numbers and explicit color values.

### "The particles appeared in the wrong place"

Double-check the coordinate system: row 0 is the **top**, not the bottom. Row increases downward, column increases to the right. If you said "top" but got something at the bottom, try using explicit numbers: `row 5, column 50`.

### "I tried to connect two particles but nothing happened"

Connections require both particles to already exist. If you clear particles and then try to connect positions that are now empty, the connection will fail. Make sure you place particles before connecting them. The log panel error entry will say something like: *"Particle at [row, col] is not active"*.

### "The animation I created doesn't seem to do anything"

Animations need to be explicitly rendered to a video file — they do not play back in the browser canvas by default. After creating an animation, ask the AI:
```
Render the animation as an MP4 video
```

### "I asked for a color by name and got the wrong shade"

Color names are interpreted by the AI, which may choose any shade for a vague name. For exact results, use hex codes. The format is `#RRGGBB` — for example, `#FF0000` for pure red, `#00FF00` for pure green, `#0000FF` for pure blue.

### "Server: disconnected in the status bar"

The browser cannot reach the server. This could mean the server is down, your URL is incorrect, or there is a network issue. Contact whoever set up your instance.

### "A prompt is already being processed"

The system handles one prompt at a time. Wait for "Done" to appear in the log before sending another prompt. The Send button will re-enable automatically.

### "Session not found"

Sessions are held in memory. If the server restarted since you opened the page, your session no longer exists. Refresh the browser to create a new session and start fresh. If persistence is configured on the server, sessions may survive restarts — but this depends on the deployment.

### "Unknown easing function: myEasing"

Easing function names are case-sensitive and must match exactly. See the easing table in section 4 for valid names. Common mistake: writing `EaseInQuad` instead of `easeInQuad`.

### "Invalid hex color"

Colors must be in the format `#RRGGBB` — exactly a `#` followed by 6 hexadecimal digits. `#FF0000` is valid. `red`, `FF0000` (missing `#`), and `#F00` (shorthand) are not accepted.

### "FPS must be at most 120"

Animations are capped at 120 frames per second. If you asked for a higher FPS, reduce it.

### The canvas looks empty but the status bar shows particles

This can happen if particles are placed outside the visible render area (e.g., very high row/column numbers that fall outside the canvas dimensions). Try asking:
```
What particles are on the grid? Show me their positions.
```
Then verify the positions are within your grid bounds.

---

## 9. Glossary

| Term | Definition |
|------|-----------|
| **Particle** | A colored dot placed at a specific `(row, col)` position on the grid. Has properties: color, size, opacity, group, label, layer. |
| **Connection** | A line drawn between two particle positions. Both particles must be active. Has properties: color, width, opacity, style (solid/dashed/dotted), directed, group, label. |
| **Grid** | The 2D space divided into rows and columns where everything lives. Default size is 100×100 positions. |
| **Row** | The vertical axis of the grid. Row 0 is the top, row 99 (or max) is the bottom. Increases downward. |
| **Col (Column)** | The horizontal axis of the grid. Column 0 is the left, column 99 (or max) is the right. Increases to the right. |
| **Keyframe** | A snapshot of particle states at a specific point in time during an animation. The engine smoothly interpolates between keyframes. |
| **Easing** | A mathematical curve that controls how fast or slow a transition happens. `linear` is constant speed; others like `easeInOut` accelerate in the middle, `easeOutBounce` bounces at the end, etc. |
| **Snapshot** | A saved copy of the entire grid state, stored under a name you choose. You can restore it at any time. Different from undo — snapshots are explicitly named and persist until you restore or overwrite them. |
| **Undo** | Reverts the last mutating action (placing particles, connecting, clearing, etc.). Automatically maintained — no need to save anything manually. |
| **Session** | A workspace on the server. Each browser tab creates its own session with its own grid, particles, connections, animations, and snapshots. Sessions are independent of each other. |
| **Tool Call** | An action the AI takes to modify the grid. When you send a prompt, the AI decides which tools to call (e.g., `set_particles`, `connect`, `create_animation`). You see these logged in the sidebar. |
| **Group** | An optional name you can assign to particles or connections so you can refer to them collectively — e.g., "clear the 'background' group" or "connect all particles in the 'ring' group". |
| **Layer** | A number controlling depth ordering. Particles and connections with higher layer values appear in front of those with lower values. Useful for multi-layer compositions. |
| **OKLAB** | The color space used for interpolation during animation. OKLAB produces perceptually smooth color transitions — a gradient from red to blue looks natural rather than muddy. You do not need to know how it works to use it. |
| **SVG** | Scalable Vector Graphics — the image format used for still renders. SVGs are crisp at any size and can be opened in any browser or vector editor. |
| **FPS** | Frames per second. Controls how smooth a video animation is. 24–30 FPS is cinematic; 60 FPS is smooth; 120 FPS is the maximum supported. |

---

*Particle Engine is designed to be driven by natural language. If something does not work as expected, the fastest fix is usually to rephrase your prompt with more specific details. Happy creating!*
