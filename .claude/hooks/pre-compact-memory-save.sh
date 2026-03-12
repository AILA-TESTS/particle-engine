#!/bin/bash
# =============================================================================
# pre-compact-memory-save.sh — PreCompact hook for particle-engine
# =============================================================================
# Fires automatically when /compact is run (or when Claude Code auto-compacts
# at context limit). Saves a transcript snapshot to the snapshots directory
# and auto-cleans to keep only the 5 most recent snapshots.
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

# ---------------------------------------------------------------------------
# Project-specific memory directory (hardcoded for this project)
# ---------------------------------------------------------------------------
MEMORY_DIR="$HOME/.claude/projects/-Users-abdulazizmugayel-Downloads-Onedrive-Backup-AILA-AILA-TEST-Code-particle-engine/memory"
SNAPSHOT_DIR="${MEMORY_DIR}/snapshots"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)"

# Create snapshots directory if needed
mkdir -p "$SNAPSHOT_DIR"

# ---------------------------------------------------------------------------
# Generate timestamp (macOS/BSD-compatible date format)
# ---------------------------------------------------------------------------
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Short session ID (first 8 chars)
SHORT_SESSION="${SESSION_ID:0:8}"
# Fallback if SESSION_ID is empty
if [ -z "$SHORT_SESSION" ]; then
    SHORT_SESSION="unknown"
fi

# ---------------------------------------------------------------------------
# Copy transcript to snapshots
# ---------------------------------------------------------------------------
if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
    cp "$TRANSCRIPT_PATH" "${SNAPSHOT_DIR}/transcript_${SHORT_SESSION}_${TIMESTAMP}.jsonl"
else
    echo "WARNING: No transcript file found at '${TRANSCRIPT_PATH}' — skipping snapshot."
fi

# ---------------------------------------------------------------------------
# Auto-cleanup: retain only the 5 most recent snapshots
# ---------------------------------------------------------------------------
# Use a safe approach that handles filenames with spaces
SNAPSHOT_COUNT=0
while IFS= read -r file; do
    SNAPSHOT_COUNT=$((SNAPSHOT_COUNT + 1))
    if [ "$SNAPSHOT_COUNT" -gt 5 ]; then
        rm -f "$file"
    fi
done < <(ls -t "${SNAPSHOT_DIR}"/transcript_*.jsonl 2>/dev/null)

# ---------------------------------------------------------------------------
# Output instructions for the agent (Claude sees this after compaction)
# ---------------------------------------------------------------------------
cat <<EOF
===========================================================================
  PRE-COMPACTION MEMORY SAVE COMPLETE
===========================================================================

Transcript snapshot saved:
  ${SNAPSHOT_DIR}/transcript_${SHORT_SESSION}_${TIMESTAMP}.jsonl

Session: ${SHORT_SESSION} at ${TIMESTAMP}

WHEN RESUMING AFTER COMPACTION, read these files to restore context:

  1. ${PROJECT_ROOT}/memory/root-identity.md
     (Agent identity — IMMUTABLE, confirms who you are)

  2. ${MEMORY_DIR}/MEMORY.md
     (Auto-memory index — session history, project state, continuation context)

  3. ${PROJECT_ROOT}/memory/progress.md
     (Current task progress and next steps)

  4. ${PROJECT_ROOT}/.claude/agents/manager.md
     (Agent operating rules and delegation protocol)

  5. Any recent decision/feedback files in ${MEMORY_DIR}/

Memory priority: identity > memory > progress > sub-agents
===========================================================================
EOF

exit 0
