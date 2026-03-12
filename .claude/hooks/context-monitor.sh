#!/bin/bash
# =============================================================================
# context-monitor.sh — PostToolUse hook for particle-engine
# =============================================================================
# Monitors transcript JSONL file size as a proxy for context window usage.
# Claude Code does not expose context % directly, so file size is the best
# heuristic available.
#
# Thresholds:
#   ~1.2MB (~1,200,000 bytes) = WARNING  (~60-70% context)
#   ~1.8MB (~1,800,000 bytes) = CRITICAL (~80%+ context)
#
# Rate limiting:
#   120-second cooldown between checks to avoid spamming on every tool call.
#
# Arguments:
#   $1 — TRANSCRIPT_PATH (the JSONL file for the current session)
#   $2 — SESSION_ID (unique session identifier)
#
# Exit codes:
#   0 — always (hooks must not block the agent)
# =============================================================================

set -euo pipefail

TRANSCRIPT_PATH="${1:-}"
SESSION_ID="${2:-}"

# If no transcript path provided, exit silently
if [ -z "$TRANSCRIPT_PATH" ]; then
    exit 0
fi

# ---------------------------------------------------------------------------
# Rate limiting — don't check more than once every 120 seconds
# ---------------------------------------------------------------------------
COOLDOWN_FILE="/tmp/context-monitor-cooldown-${SESSION_ID:-unknown}"
NOW=$(date +%s)

if [ -f "$COOLDOWN_FILE" ]; then
    LAST_CHECK=$(cat "$COOLDOWN_FILE" 2>/dev/null || echo "0")
    # Validate that LAST_CHECK is a number
    if [[ "$LAST_CHECK" =~ ^[0-9]+$ ]]; then
        ELAPSED=$((NOW - LAST_CHECK))
        if [ "$ELAPSED" -lt 120 ]; then
            exit 0
        fi
    fi
fi

echo "$NOW" > "$COOLDOWN_FILE"

# ---------------------------------------------------------------------------
# Check transcript file size
# ---------------------------------------------------------------------------
if [ ! -f "$TRANSCRIPT_PATH" ]; then
    exit 0
fi

FILE_SIZE=$(wc -c < "$TRANSCRIPT_PATH" | tr -d ' ')

# Validate FILE_SIZE is a number
if ! [[ "$FILE_SIZE" =~ ^[0-9]+$ ]]; then
    exit 0
fi

# ---------------------------------------------------------------------------
# Thresholds (bytes)
# ---------------------------------------------------------------------------
WARNING_THRESHOLD=1200000    # ~1.2MB = ~60-70% context
CRITICAL_THRESHOLD=1800000   # ~1.8MB = ~80%+ context

# ---------------------------------------------------------------------------
# Project-specific paths
# ---------------------------------------------------------------------------
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)"
MEMORY_DIR="$HOME/.claude/projects/-Users-abdulazizmugayel-Downloads-Onedrive-Backup-AILA-AILA-TEST-Code-particle-engine/memory"

if [ "$FILE_SIZE" -gt "$CRITICAL_THRESHOLD" ]; then
    cat <<'BANNER'
===========================================================================
  CRITICAL: Context usage ~80%+ — IMMEDIATE ACTION REQUIRED
===========================================================================
BANNER
    echo "Transcript size: ${FILE_SIZE} bytes (threshold: ${CRITICAL_THRESHOLD})"
    echo ""
    echo "STOP all current work. Save progress to memory files NOW:"
    echo ""
    echo "  1. UPDATE memory/progress.md with:"
    echo "     - What was accomplished this session"
    echo "     - Current task state (in-progress, blocked, done)"
    echo "     - Decisions made"
    echo "     - Next steps to pick up after compaction"
    echo ""
    echo "  2. UPDATE ${MEMORY_DIR}/MEMORY.md with:"
    echo "     - Any new memory files created"
    echo "     - Updated session history"
    echo "     - Continuation context"
    echo ""
    echo "  3. SAVE any new decisions or feedback to:"
    echo "     - ${MEMORY_DIR}/feedback_*.md (user corrections)"
    echo "     - ${MEMORY_DIR}/project_*.md (architecture decisions)"
    echo ""
    echo "  4. RUN /compact to reduce context."
    echo ""
    echo "  Key files:"
    echo "    - ${PROJECT_ROOT}/memory/progress.md"
    echo "    - ${PROJECT_ROOT}/memory/root-identity.md (READ ONLY — IMMUTABLE)"
    echo "    - ${MEMORY_DIR}/MEMORY.md"
    echo "    - ${PROJECT_ROOT}/.claude/agents/manager.md"
    echo "==========================================================================="

elif [ "$FILE_SIZE" -gt "$WARNING_THRESHOLD" ]; then
    cat <<'BANNER'
===========================================================================
  WARNING: Context usage ~60-70% — Prepare for compaction
===========================================================================
BANNER
    echo "Transcript size: ${FILE_SIZE} bytes (threshold: ${WARNING_THRESHOLD})"
    echo ""
    echo "Context is getting elevated. Consider:"
    echo "  - Wrapping up the current task"
    echo "  - Saving important context to memory files before compacting"
    echo ""
    echo "  Files to update before compacting:"
    echo "    - memory/progress.md — session status and accomplishments"
    echo "    - ${MEMORY_DIR}/MEMORY.md — auto-memory index"
    echo "    - Any new decision or feedback files"
    echo "==========================================================================="
fi

exit 0
