#!/usr/bin/env bash
# =============================================================================
# memory-guard.sh — Context/Memory Usage Monitor for Claude Code
# =============================================================================
#
# This hook runs after every tool use. It estimates context window utilization
# based on the conversation turn count (passed via environment or extracted
# from the hook JSON payload on stdin) and triggers a save-and-compact
# workflow when usage exceeds the configured threshold.
#
# How it works:
#   - Claude Code hooks receive a JSON payload on stdin with conversation
#     metadata. We read it once and parse what we need.
#   - We estimate context usage from turn_count / max_turns as a percentage.
#   - If no turn data is available, we fall back to counting existing
#     conversation turns from the payload or use a safe default.
#   - When the threshold is exceeded, we output a WARNING message that
#     instructs the agent to save memory and compact.
#
# Environment variables (optional overrides):
#   MEMORY_GUARD_THRESHOLD  — percentage threshold (default: 70)
#   MEMORY_GUARD_MAX_TURNS  — estimated max turns before context fills (default: 80)
#
# Exit codes:
#   0 — always (hooks must not block the agent)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
THRESHOLD="${MEMORY_GUARD_THRESHOLD:-70}"
MAX_TURNS="${MEMORY_GUARD_MAX_TURNS:-80}"

# Project root — resolve relative to this script's location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PROGRESS_FILE="$PROJECT_ROOT/memory/progress.md"

# ---------------------------------------------------------------------------
# Read stdin payload (Claude Code sends JSON on stdin for hooks)
# We consume it once and store it so we can parse multiple fields.
# ---------------------------------------------------------------------------
PAYLOAD=""
if [ ! -t 0 ]; then
    PAYLOAD="$(cat)"
fi

# ---------------------------------------------------------------------------
# Estimate context utilization
# ---------------------------------------------------------------------------
# Try to extract turn/message count from the hook payload.
# The payload structure may include conversation_turn_count or similar.
# We try several known field names; if none match we fall back to defaults.

TURN_COUNT=""

if [ -n "$PAYLOAD" ]; then
    # Try common field names in the hook payload using lightweight parsing.
    # We avoid requiring jq by using grep/sed for simple extraction.
    for field in "turn_count" "conversation_turn_count" "num_turns" "total_turns" "message_count"; do
        extracted=$(echo "$PAYLOAD" | grep -o "\"${field}\"[[:space:]]*:[[:space:]]*[0-9]*" 2>/dev/null | grep -o '[0-9]*$' 2>/dev/null || true)
        if [ -n "$extracted" ]; then
            TURN_COUNT="$extracted"
            break
        fi
    done
fi

# If we still have no turn count, try to estimate from the payload size.
# A typical turn is roughly 2000-4000 characters of JSON. We use the payload
# length as a very rough proxy when nothing else is available.
if [ -z "$TURN_COUNT" ] && [ -n "$PAYLOAD" ]; then
    payload_length=${#PAYLOAD}
    # Rough heuristic: each tool-use turn generates ~3000 chars of payload
    # context cumulatively. This is intentionally conservative.
    if [ "$payload_length" -gt 0 ]; then
        # We cannot derive cumulative usage from a single payload, so
        # we leave TURN_COUNT empty and let the fallback handle it.
        :
    fi
fi

# Fallback: if we cannot determine turn count, exit silently.
# We do not want to spam warnings when we have no data.
if [ -z "$TURN_COUNT" ]; then
    exit 0
fi

# Calculate estimated usage percentage
# Use integer arithmetic (bash doesn't do floating point)
USAGE_PERCENT=$(( (TURN_COUNT * 100) / MAX_TURNS ))

# Cap at 100%
if [ "$USAGE_PERCENT" -gt 100 ]; then
    USAGE_PERCENT=100
fi

# ---------------------------------------------------------------------------
# Check threshold and emit warning
# ---------------------------------------------------------------------------
if [ "$USAGE_PERCENT" -ge "$THRESHOLD" ]; then
    # Build the warning message. This is output to stdout, which Claude Code
    # surfaces as a user-facing message / hook output to the agent.
    cat <<WARN
===========================================================================
  MEMORY GUARD WARNING — Context usage is at ~${USAGE_PERCENT}% (threshold: ${THRESHOLD}%)
===========================================================================

Context window is running low. To preserve continuity, take these steps
IMMEDIATELY before doing anything else:

1. STOP current work — do not start new tool calls or tasks.

2. UPDATE memory/progress.md with:
   - Current session status and what was being worked on
   - Any in-flight tasks and their state (blocked, in-progress, done)
   - Decisions made this session
   - Next steps / what to pick up after compaction

3. SAVE task-specific documents:
   - If any sub-agent work is in progress, document its state in memory/
   - Ensure any architectural decisions are captured

4. RUN /compact to reduce context size while preserving memory.
   When compacting, include a summary of the session so far so the
   compacted context retains essential information.

Key files to update:
  - ${PROGRESS_FILE}
  - Any task-specific files under memory/

Estimated turn count: ${TURN_COUNT} / ${MAX_TURNS}
===========================================================================
WARN
fi

exit 0
