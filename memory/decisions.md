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
