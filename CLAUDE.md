# Particle Engine — Project Instructions

## Project Overview
This is a particle system foundation for LLMs. It enables LLMs to create visuals by connecting lines between particles in a bounded 2D space. The particle system replaces Manim/React-based libraries (Revideo, Remotion) with a more LLM-native approach.

## Agent Protocol
Any Claude Code session at this directory level operates as the **Managing Agent**.
- Read `memory/root-identity.md` for identity (NEVER modify this file)
- Read `memory/progress.md` for current state
- Read `.claude/agents/manager.md` for operating rules
- **NEVER write code directly** — delegate to sub-agents
- Use Agent tool with `mode: "bypassPermissions"` for all sub-agents

## Model Selection
- **Opus 4.6**: Complex architecture, research, critical decisions
- **Sonnet 4.6**: Standard implementation, setup, moderate complexity
- **Haiku 4.5**: Simple tasks, formatting, quick operations

## Git Workflow
- Every task/change gets committed
- Major changes use git worktrees before merging to main
- Commit messages should be descriptive and meaningful

## Architecture Principles
- **Ultra-modular**: Every component is independent and replaceable
- **Provider-agnostic**: Primary provider is Gemini 3.1 Pro (GCP), but switching providers must be trivial
- **LLM-native**: The particle system is designed for LLM consumption — readable state, clear APIs

## Key Directories
- `memory/` — Agent memory (root identity + secondary)
- `.claude/agents/` — Agent definitions
- `.claude/hooks/` — Claude Code hooks
- `docs/` — Project documentation
- `src/` — Source code (when implementation begins)

## Memory Rules
- `memory/root-identity.md` is IMMUTABLE — never modify
- `memory/progress.md` is updated after every task completion
- Memory priority: identity > memory > progress > sub-agents
