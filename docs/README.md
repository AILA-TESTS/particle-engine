# Particle Engine — Documentation

## Overview

The **Particle Engine** is a visual generation system designed for LLMs. Rather than relying on traditional animation libraries like Manim, Revideo, or Remotion, this project provides a native particle-based abstraction that LLMs can directly reason about and manipulate.

### Core Concept

Particles are dots in a bounded 2D space. An LLM can:
- **Set** particles at specific positions
- **Connect** particles with lines
- **Read** the current state of the space
- **Sequence** frames to create animations

The result is a system where an LLM can produce visual content by issuing simple, composable operations on particles and lines.

## Documentation Index

- [Architecture Overview](architecture.md) — System design, component diagram, and layer descriptions
- [API Design](api-design.md) — Particle, line, space, and animation operations

## Project Structure

```
particle-engine/
  memory/          — Agent memory (identity, progress, decisions)
  .claude/         — Agent definitions and hooks
  docs/            — This documentation
  src/             — Source code (when implementation begins)
```

## Provider Strategy

The engine is **provider-agnostic**. The primary LLM provider is Gemini 3.1 Pro via GCP, but the architecture ensures that switching providers is trivial through a clean abstraction layer.

## Contribution Guidelines

_Contribution guidelines will be defined as the project matures. For now, all development is coordinated through the managing agent system defined in `.claude/agents/manager.md`._
