# Architecture Overview

## System Overview

The Particle Engine is structured as a layered system where each layer has a clear responsibility and communicates through well-defined interfaces. The design is ultra-modular: every component can be independently replaced or extended.

```
┌─────────────────────────────────────────────┐
│             LLM Integration Layer           │
│   (Provider-agnostic interface for LLMs)    │
├─────────────────────────────────────────────┤
│          Animation / Sequencing System      │
│     (Keyframes, timelines, rendering)       │
├─────────────────────────────────────────────┤
│            Particle System Core             │
│  (Particles, lines, space, state management)│
├─────────────────────────────────────────────┤
│         Provider Abstraction Layer          │
│      (Gemini, OpenAI, Anthropic, etc.)      │
└─────────────────────────────────────────────┘
```

## Component Diagram

_A detailed component diagram will be added once the core architecture is finalized._

## Provider Abstraction Layer

The bottom layer abstracts LLM provider specifics. It exposes a unified interface regardless of whether the underlying provider is Gemini, OpenAI, Anthropic, or another service.

**Responsibilities:**
- Authentication and connection management
- Request/response normalization
- Token and rate limit handling
- Provider-specific feature mapping

**Design Constraint:** Switching from one provider to another must require changing only configuration, not code.

## Particle System Core

The central engine that manages the 2D particle space.

**Key Concepts:**
- **Particle**: A point in 2D space with an ID and position (x, y)
- **Line**: A connection between two particles
- **Space**: The bounded 2D area containing all particles and lines
- **State**: A snapshot of all particles, lines, and their properties at a given moment

**Responsibilities:**
- Particle CRUD operations
- Line management (connect, disconnect)
- Spatial queries (region-based lookups, nearest neighbor)
- State serialization and deserialization

## LLM Integration Layer

The top layer provides a clean interface for LLMs to interact with the particle system.

**Responsibilities:**
- Translate natural LLM instructions into particle operations
- Provide readable state representations for LLM consumption
- Validate and constrain operations to the bounded space
- Expose a tool/function-calling API for LLM agents

## Animation / Sequencing System

Manages temporal aspects — turning static particle states into animated sequences.

**Responsibilities:**
- Keyframe definition and interpolation
- Timeline management
- Frame rendering
- Export to video or image sequences

_Detailed specifications for each component will be added as the architecture is finalized through research and prototyping._
