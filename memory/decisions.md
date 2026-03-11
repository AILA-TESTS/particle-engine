# Architectural Decision Log

> This file records key architectural and design decisions made throughout the project.

## Decision Format

Each decision follows this format:
- **Date**: When the decision was made
- **Context**: What prompted the decision
- **Decision**: What was decided
- **Rationale**: Why this choice was made
- **Status**: Active, Superseded, or Deprecated

---

## ADR-001: Particle System over Traditional Animation Libraries

- **Date:** 2026-03-11
- **Context:** Need a visual generation system that LLMs can natively reason about and control.
- **Decision:** Build a custom particle engine instead of using Manim, Revideo, or Remotion.
- **Rationale:** Traditional animation libraries have complex APIs not designed for LLM consumption. A particle-based system provides a simpler, more composable abstraction that LLMs can manipulate through straightforward operations (set, connect, read, sequence).
- **Status:** Active

## ADR-002: Provider-Agnostic Architecture

- **Date:** 2026-03-11
- **Context:** Primary LLM provider is Gemini 3.1 Pro via GCP, but vendor lock-in is a risk.
- **Decision:** Design all provider interactions behind an abstraction layer so switching providers requires only configuration changes.
- **Rationale:** LLM providers evolve rapidly. Maintaining the ability to switch ensures the project can always use the best available model without architectural changes.
- **Status:** Active

## ADR-003: Managing Agent Pattern

- **Date:** 2026-03-11
- **Context:** Need a way to coordinate development across multiple Claude Code sessions.
- **Decision:** Use a managing agent that never writes code, only delegates to sub-agents with specific model assignments.
- **Rationale:** Separating orchestration from implementation ensures consistency, proper memory management, and appropriate model selection for each task.
- **Status:** Active

## ADR-004: Hybrid Data Structure (Grid Index + Flat Typed Arrays)

- **Date:** 2026-03-11
- **Context:** Need to choose a data structure for the particle store that balances LLM readability with rendering performance.
- **Decision:** Use a hybrid approach -- grid index for O(1) coordinate lookup combined with flat typed arrays (Struct-of-Arrays) for performance-critical operations.
- **Rationale:** The grid index gives the LLM a natural `[row, col]` coordinate system. The flat typed arrays provide ~30% better cache performance for batch operations (rendering, animation) and enable zero-copy GPU upload. The mapping is trivial: `index = row * cols + col`.
- **Status:** Active

## ADR-005: Pure Grid Coordinates (No Sub-Pixel / Continuous Coordinates)

- **Date:** 2026-03-11
- **Context:** The original research recommended grid-based coordinates with an optional sub-pixel offset (`offsetX`, `offsetY`) for fine-tuning. Need to decide whether to include continuous coordinate support.
- **Decision:** Use purely grid-based integer `[row, col]` coordinates. No sub-pixel offsets, no continuous coordinates, no `ParticlePosition` interface with `offsetX`/`offsetY` fields.
- **Rationale:** Sub-pixel offsets add complexity without clear benefit for LLM-driven creation. The LLM cannot visually verify sub-pixel differences, making them effectively useless. Pure integer coordinates keep the system fully deterministic, simpler to reason about, and more token-efficient.
- **Status:** Active

## ADR-006: Sparse JSON Format (Full Sparse Coordinates List)

- **Date:** 2026-03-11
- **Context:** Need to choose how the particle space state is represented for LLM consumption. Options included sparse coordinate list (JSON), ASCII grid, and compact binary-inspired text.
- **Decision:** Use Format A -- Sparse Coordinate List in JSON as the primary format. Only active particles and connections are included.
- **Rationale:** JSON is the format LLMs are most trained on. Sparse representation minimizes token usage (100 active particles + 50 connections = ~2,000 tokens). The format is structured, parseable, and unambiguous. An optional ASCII visualization can be provided alongside for visual overview.
- **Status:** Active

## ADR-007: Edge List for Connections

- **Date:** 2026-03-11
- **Context:** Need to choose how particle connections (lines) are represented. Options included edge list, adjacency list, and adjacency matrix.
- **Decision:** Use edge list as the primary representation for LLM communication. Store internally as an adjacency map (HashMap) for O(1) neighbor lookups.
- **Rationale:** Edge lists are self-contained (each connection has from, to, and properties), easy for the LLM to add/remove individual connections, and naturally map to "connect particle A to particle B" language. They are token-efficient for sparse graphs, which is the expected use case.
- **Status:** Active

## ADR-008: Keyframe + Interpolation Animation Model

- **Date:** 2026-03-11
- **Context:** Need to choose how animations are defined by the LLM. Options included full-state keyframes, delta-based changes, and keyframe + interpolation.
- **Decision:** Use Approach C -- Keyframe + Interpolation as the primary animation model, with discrete events for non-interpolatable changes (particle add/remove, connection add/remove).
- **Rationale:** Extremely token-efficient -- the LLM defines 5-20 keyframes and the engine generates hundreds of interpolated frames. Natural for LLMs ("at time 0 show this, at time 2.5s transition to this"). Supports easing functions for smooth transitions. Delta-based events handle discrete changes that cannot be smoothly interpolated.
- **Status:** Active

## ADR-009: No Shape Primitives

- **Date:** 2026-03-11
- **Context:** The original architecture included a `packages/shapes` module with pre-built shape primitives (circle, rectangle, polygon, etc.) and a `draw_shape` tool. The concern was that pre-built shapes would be positioned where the LLM does not know, making them effectively useless.
- **Decision:** Remove `packages/shapes` entirely. Remove the `draw_shape` tool. The LLM creates all visuals from scratch using raw particles (`set_particles`) and connections (`connect`).
- **Rationale:** The LLM must have full spatial awareness of every element it creates. Pre-built shape primitives abstract away the exact particle positions, meaning the LLM cannot reason about where individual particles ended up. By requiring the LLM to place each particle explicitly, it always knows the exact grid position of every element. This produces more predictable results and gives the LLM complete creative control.
- **Status:** Active

## ADR-010: Custom Interpolation System (Pending Deep Research)

- **Date:** 2026-03-11
- **Context:** The animation system requires an interpolation engine to generate smooth transitions between keyframes. The interpolation system's design involves significant complexity around easing functions, property-specific interpolation strategies, and grid-based coordinate constraints.
- **Decision:** The interpolation system will be designed through a dedicated deep research effort and documented separately.
- **Rationale:** Interpolation is a core subsystem that warrants focused research to get right. Rushing the design could lead to architectural mistakes that are costly to fix. A separate deep research agent is handling this to ensure the interpolation system is well-designed, performant, and handles edge cases properly.
- **Status:** Pending Research
