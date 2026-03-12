#!/usr/bin/env bash
# =============================================================================
# setup-playground.sh — Create a clean testing environment for particle-engine
# =============================================================================
#
# This script creates a playground directory OUTSIDE the repo where you can
# safely run the server and client without modifying any source files.
#
# Usage:
#   bash scripts/setup-playground.sh [target-directory]
#
# Default target: ~/particle-playground
#
# What gets created:
#   <playground>/
#     .env                — Your API credentials (copied from .env.sample)
#     sessions/           — Where the server persists session JSON files
#     start-server.sh     — Starts the particle-engine HTTP + WebSocket server
#     start-client.sh     — Starts the Vite browser client dev server
#     start-all.sh        — Starts both server and client together
#     test-curl.sh        — Example curl commands to test the API
#     cleanup.sh          — Removes all generated files (sessions, etc.)
#
# =============================================================================

set -euo pipefail

# ── Resolve the repo directory (where this script lives) ────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Target directory (argument or default) ──────────────────────────────────

PLAYGROUND="${1:-$HOME/particle-playground}"

echo ""
echo "  particle-engine — Playground Setup"
echo "  ════════════════════════════════════════════════════════"
echo "  Repo:       $REPO_DIR"
echo "  Playground: $PLAYGROUND"
echo "  ════════════════════════════════════════════════════════"
echo ""

# ── Check prerequisites ────────────────────────────────────────────────────

if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v pnpm &>/dev/null; then
    echo "ERROR: pnpm is not installed. Install it with: npm install -g pnpm"
    exit 1
fi

# Check that the repo has node_modules (dependencies installed)
if [ ! -d "$REPO_DIR/node_modules" ]; then
    echo "WARNING: node_modules not found in the repo."
    echo "  Running 'pnpm install' in the repo first..."
    (cd "$REPO_DIR" && pnpm install)
fi

# Ensure tsx is available (it may not be installed as a regular dependency)
if ! (cd "$REPO_DIR" && pnpm exec tsx --version) &>/dev/null; then
    echo "  Installing tsx (TypeScript executor)..."
    (cd "$REPO_DIR" && pnpm add -D tsx)
fi

# ── Create playground directory ─────────────────────────────────────────────

mkdir -p "$PLAYGROUND"
mkdir -p "$PLAYGROUND/sessions"

echo "[1/7] Created playground directory: $PLAYGROUND"

# ── Copy .env.sample to playground/.env ─────────────────────────────────────

if [ -f "$PLAYGROUND/.env" ]; then
    echo "[2/7] .env already exists in playground — skipping (not overwriting)"
else
    if [ -f "$REPO_DIR/.env.sample" ]; then
        cp "$REPO_DIR/.env.sample" "$PLAYGROUND/.env"
        echo "[2/7] Copied .env.sample to $PLAYGROUND/.env"
    else
        # Create a minimal .env template
        cat > "$PLAYGROUND/.env" << 'ENVEOF'
# =============================================================================
# Particle Engine — Environment Variables
# =============================================================================
# Uncomment and fill in the credentials for your chosen LLM provider.
# The server auto-detects which provider to use based on which keys are set.

# --- Google Gemini ---
# GOOGLE_API_KEY=your-gemini-api-key

# --- Anthropic Claude ---
# ANTHROPIC_API_KEY=your-anthropic-api-key

# --- OpenAI ---
# OPENAI_API_KEY=your-openai-api-key
ENVEOF
        echo "[2/7] Created template .env at $PLAYGROUND/.env (fill in your API keys)"
    fi
fi

# ── Create start-server.sh ──────────────────────────────────────────────────

cat > "$PLAYGROUND/start-server.sh" << 'SERVEREOF'
#!/usr/bin/env bash
# =============================================================================
# start-server.sh — Start the particle-engine HTTP + WebSocket server
# =============================================================================
#
# This starts the server on port 3000 (default).
# Sessions are persisted to ./sessions/ in this playground directory.
# The .env file in this directory is loaded automatically.
#
# The server does NOT modify the original repo — all writes go to ./sessions/.
#
# Usage:
#   bash start-server.sh                        # Default (port 3000, auto-detect provider)
#   bash start-server.sh --port 8080            # Custom port
#   bash start-server.sh --provider anthropic   # Force a specific provider
#   bash start-server.sh --help                 # Show all options
# =============================================================================

set -euo pipefail

# Directory where this script lives (the playground)
PLAYGROUND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The repo directory (set during setup — DO NOT change this)
REPO_DIR="__REPO_DIR__"

# Verify the repo still exists
if [ ! -f "$REPO_DIR/bin/particle-engine.ts" ]; then
    echo "ERROR: Cannot find particle-engine repo at:"
    echo "  $REPO_DIR"
    echo ""
    echo "If the repo has moved, re-run setup-playground.sh."
    exit 1
fi

echo ""
echo "  Starting particle-engine server..."
echo "  Working dir:  $PLAYGROUND_DIR"
echo "  Repo:         $REPO_DIR"
echo "  Sessions:     $PLAYGROUND_DIR/sessions"
echo ""

# Run from the playground directory so .env is picked up from here.
# The server's dotenv loader reads .env from process.cwd(), so we must
# cd to the playground BEFORE running the server.
# Use --persist-dir to write sessions into the playground.
# Pass through any extra arguments (e.g., --port, --provider).
cd "$PLAYGROUND_DIR"

# Find the tsx binary — check repo's node_modules first, then fall back to npx
TSX_BIN="$REPO_DIR/node_modules/.bin/tsx"
if [ ! -x "$TSX_BIN" ]; then
    # tsx might be in pnpm's virtual store — use pnpm to find it
    TSX_BIN="$(cd "$REPO_DIR" && pnpm bin)/tsx"
fi
if [ ! -x "$TSX_BIN" ]; then
    echo "ERROR: Cannot find tsx binary. Run 'pnpm add -D tsx' in the repo."
    exit 1
fi

exec "$TSX_BIN" "$REPO_DIR/bin/particle-engine.ts" \
    --persist-dir "$PLAYGROUND_DIR/sessions" \
    "$@"
SERVEREOF

# Replace the placeholder with the actual repo path
# Using a delimiter that won't appear in paths
sed -i '' "s|__REPO_DIR__|${REPO_DIR}|g" "$PLAYGROUND/start-server.sh"
chmod +x "$PLAYGROUND/start-server.sh"
echo "[3/7] Created start-server.sh"

# ── Create start-client.sh ──────────────────────────────────────────────────

cat > "$PLAYGROUND/start-client.sh" << 'CLIENTEOF'
#!/usr/bin/env bash
# =============================================================================
# start-client.sh — Start the Vite browser client dev server
# =============================================================================
#
# This starts the browser UI on port 5173.
# It proxies /api requests to the particle-engine server on port 3000.
#
# IMPORTANT: The server must be running first! Use start-server.sh or
# start-all.sh to start both together.
#
# The Vite dev server is READ-ONLY — it does not modify any repo files.
# It serves the client source directly from the repo via Vite's dev mode.
#
# Usage:
#   bash start-client.sh
# =============================================================================

set -euo pipefail

# The repo directory (set during setup — DO NOT change this)
REPO_DIR="__REPO_DIR__"

# Verify the repo still exists
if [ ! -d "$REPO_DIR/packages/client" ]; then
    echo "ERROR: Cannot find client package at:"
    echo "  $REPO_DIR/packages/client"
    echo ""
    echo "If the repo has moved, re-run setup-playground.sh."
    exit 1
fi

echo ""
echo "  Starting particle-engine browser client..."
echo "  Client URL:   http://localhost:5173"
echo "  Server proxy: http://localhost:3000/api"
echo ""

# Run Vite dev server from the client package directory.
# Vite reads files but does not write to the repo.
cd "$REPO_DIR/packages/client"

# Find the vite binary
VITE_BIN="$REPO_DIR/node_modules/.bin/vite"
if [ ! -x "$VITE_BIN" ]; then
    VITE_BIN="$(cd "$REPO_DIR" && pnpm bin)/vite"
fi
if [ ! -x "$VITE_BIN" ]; then
    echo "ERROR: Cannot find vite binary. Run 'pnpm install' in the repo."
    exit 1
fi

exec "$VITE_BIN" --host
CLIENTEOF

sed -i '' "s|__REPO_DIR__|${REPO_DIR}|g" "$PLAYGROUND/start-client.sh"
chmod +x "$PLAYGROUND/start-client.sh"
echo "[4/7] Created start-client.sh"

# ── Create start-all.sh ────────────────────────────────────────────────────

cat > "$PLAYGROUND/start-all.sh" << 'ALLEOF'
#!/usr/bin/env bash
# =============================================================================
# start-all.sh — Start both server and client together
# =============================================================================
#
# This launches the HTTP server (port 3000) and the Vite client (port 5173)
# as background processes. Press Ctrl+C to stop both cleanly.
#
# Usage:
#   bash start-all.sh
#   bash start-all.sh --provider anthropic   # Extra args are passed to server
# =============================================================================

set -euo pipefail

PLAYGROUND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Track child PIDs for cleanup
SERVER_PID=""
CLIENT_PID=""

# ── Cleanup handler — kill both processes on exit ───────────────────────────
cleanup() {
    echo ""
    echo "  Shutting down..."

    if [ -n "$CLIENT_PID" ] && kill -0 "$CLIENT_PID" 2>/dev/null; then
        echo "  Stopping client (PID $CLIENT_PID)..."
        kill "$CLIENT_PID" 2>/dev/null || true
        wait "$CLIENT_PID" 2>/dev/null || true
    fi

    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "  Stopping server (PID $SERVER_PID)..."
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi

    echo "  All processes stopped."
    echo ""
}

# Trap signals to ensure clean shutdown
trap cleanup EXIT INT TERM

echo ""
echo "  ╔═══════════════════════════════════════════════════════╗"
echo "  ║         particle-engine — Starting All Services       ║"
echo "  ╠═══════════════════════════════════════════════════════╣"
echo "  ║  Server:  http://localhost:3000                       ║"
echo "  ║  Client:  http://localhost:5173                       ║"
echo "  ║  API:     http://localhost:3000/api                   ║"
echo "  ║                                                       ║"
echo "  ║  Press Ctrl+C to stop both services.                  ║"
echo "  ╚═══════════════════════════════════════════════════════╝"
echo ""

# ── Start server in background ──────────────────────────────────────────────
echo "  [1/2] Starting server..."
bash "$PLAYGROUND_DIR/start-server.sh" "$@" &
SERVER_PID=$!

# Give the server a moment to start before launching the client
sleep 2

# ── Start client in background ──────────────────────────────────────────────
echo "  [2/2] Starting client..."
bash "$PLAYGROUND_DIR/start-client.sh" &
CLIENT_PID=$!

echo ""
echo "  Both services are running. Open http://localhost:5173 in your browser."
echo "  Press Ctrl+C to stop."
echo ""

# ── Wait for either process to exit ─────────────────────────────────────────
# If one dies, the cleanup handler will kill the other.
wait -n "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true
ALLEOF

chmod +x "$PLAYGROUND/start-all.sh"
echo "[5/7] Created start-all.sh"

# ── Create test-curl.sh ────────────────────────────────────────────────────

cat > "$PLAYGROUND/test-curl.sh" << 'CURLEOF'
#!/usr/bin/env bash
# =============================================================================
# test-curl.sh — Example curl commands to test the particle-engine API
# =============================================================================
#
# Run these commands while the server is running (start-server.sh or start-all.sh).
# Each section can be run independently.
#
# Usage:
#   bash test-curl.sh           # Run all examples
#   bash test-curl.sh create    # Just create a session
#   bash test-curl.sh prompt    # Create + send a prompt (requires LLM provider)
# =============================================================================

set -euo pipefail

BASE_URL="${PARTICLE_ENGINE_URL:-http://localhost:3000}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# ── Helper: extract session ID from JSON response ───────────────────────────
extract_id() {
    # Simple extraction — works with the server's JSON response format
    echo "$1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4
}

# ── 1. Health Check ─────────────────────────────────────────────────────────
do_health() {
    section "1. Health Check — List Sessions"
    echo "  GET $BASE_URL/api/sessions"
    echo ""
    curl -s "$BASE_URL/api/sessions" | python3 -m json.tool 2>/dev/null || \
        curl -s "$BASE_URL/api/sessions"
    echo ""
}

# ── 2. Create a Session ─────────────────────────────────────────────────────
do_create() {
    section "2. Create a New Session"
    echo "  POST $BASE_URL/api/sessions"
    echo "  Body: { \"rows\": 20, \"cols\": 30 }"
    echo ""
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/sessions" \
        -H "Content-Type: application/json" \
        -d '{"rows": 20, "cols": 30}')
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

    SESSION_ID=$(extract_id "$RESPONSE")
    if [ -n "$SESSION_ID" ]; then
        echo ""
        echo -e "  ${GREEN}Session created! ID: $SESSION_ID${NC}"
        echo "  $SESSION_ID" > /tmp/particle-session-id
    fi
    echo ""
}

# ── 3. Get Session State ────────────────────────────────────────────────────
do_state() {
    section "3. Get Session State"
    SESSION_ID="${1:-$(cat /tmp/particle-session-id 2>/dev/null || echo '')}"
    if [ -z "$SESSION_ID" ]; then
        echo -e "  ${YELLOW}No session ID. Run 'bash test-curl.sh create' first.${NC}"
        return
    fi
    echo "  GET $BASE_URL/api/sessions/$SESSION_ID"
    echo ""
    curl -s "$BASE_URL/api/sessions/$SESSION_ID" | python3 -m json.tool 2>/dev/null || \
        curl -s "$BASE_URL/api/sessions/$SESSION_ID"
    echo ""
}

# ── 4. Execute a Tool (place particles manually) ───────────────────────────
do_tool() {
    section "4. Execute Tool — Place Particles"
    SESSION_ID="${1:-$(cat /tmp/particle-session-id 2>/dev/null || echo '')}"
    if [ -z "$SESSION_ID" ]; then
        echo -e "  ${YELLOW}No session ID. Run 'bash test-curl.sh create' first.${NC}"
        return
    fi
    echo "  POST $BASE_URL/api/sessions/$SESSION_ID/tool"
    echo "  Tool: set_particles"
    echo ""
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/sessions/$SESSION_ID/tool" \
        -H "Content-Type: application/json" \
        -d '{
            "tool": "set_particles",
            "params": {
                "particles": [
                    { "row": 5, "col": 5, "color": "#ff0000" },
                    { "row": 5, "col": 10, "color": "#00ff00" },
                    { "row": 5, "col": 15, "color": "#0000ff" },
                    { "row": 10, "col": 5, "color": "#ffff00" },
                    { "row": 10, "col": 10, "color": "#ff00ff" },
                    { "row": 10, "col": 15, "color": "#00ffff" }
                ]
            }
        }')
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    echo ""
}

# ── 5. Render as SVG ────────────────────────────────────────────────────────
do_render() {
    section "5. Render Session as SVG"
    SESSION_ID="${1:-$(cat /tmp/particle-session-id 2>/dev/null || echo '')}"
    if [ -z "$SESSION_ID" ]; then
        echo -e "  ${YELLOW}No session ID. Run 'bash test-curl.sh create' first.${NC}"
        return
    fi
    echo "  GET $BASE_URL/api/sessions/$SESSION_ID/render?width=600&height=400"
    echo ""
    SVG_FILE="/tmp/particle-render.svg"
    curl -s "$BASE_URL/api/sessions/$SESSION_ID/render?width=600&height=400" > "$SVG_FILE"
    echo "  SVG saved to: $SVG_FILE"
    echo "  Open it with: open $SVG_FILE"
    echo ""
    # Show first few lines
    head -5 "$SVG_FILE"
    echo "  ..."
    echo ""
}

# ── 6. Send a Prompt (requires LLM provider) ───────────────────────────────
do_prompt() {
    section "6. Send LLM Prompt"
    SESSION_ID="${1:-$(cat /tmp/particle-session-id 2>/dev/null || echo '')}"
    if [ -z "$SESSION_ID" ]; then
        echo -e "  ${YELLOW}No session ID. Run 'bash test-curl.sh create' first.${NC}"
        return
    fi
    echo "  POST $BASE_URL/api/sessions/$SESSION_ID/prompt"
    echo "  Prompt: \"Draw a simple smiley face using particles\""
    echo ""
    echo -e "  ${YELLOW}(This requires an LLM provider. If you get a 503, configure your .env)${NC}"
    echo ""
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/sessions/$SESSION_ID/prompt" \
        -H "Content-Type: application/json" \
        -d '{"prompt": "Draw a simple smiley face using particles. Use yellow particles for the face outline and black for the eyes and mouth."}')
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    echo ""
}

# ── 7. Delete a Session ────────────────────────────────────────────────────
do_delete() {
    section "7. Delete Session"
    SESSION_ID="${1:-$(cat /tmp/particle-session-id 2>/dev/null || echo '')}"
    if [ -z "$SESSION_ID" ]; then
        echo -e "  ${YELLOW}No session ID. Run 'bash test-curl.sh create' first.${NC}"
        return
    fi
    echo "  DELETE $BASE_URL/api/sessions/$SESSION_ID"
    echo ""
    curl -s -X DELETE "$BASE_URL/api/sessions/$SESSION_ID" | python3 -m json.tool 2>/dev/null || \
        curl -s -X DELETE "$BASE_URL/api/sessions/$SESSION_ID"
    rm -f /tmp/particle-session-id
    echo ""
}

# ── Command dispatch ────────────────────────────────────────────────────────

case "${1:-all}" in
    health)   do_health ;;
    create)   do_create ;;
    state)    do_state "$2" 2>/dev/null || do_state ;;
    tool)     do_tool "$2" 2>/dev/null || do_tool ;;
    render)   do_render "$2" 2>/dev/null || do_render ;;
    prompt)   do_prompt "$2" 2>/dev/null || do_prompt ;;
    delete)   do_delete "$2" 2>/dev/null || do_delete ;;
    all)
        do_health
        do_create
        do_state
        do_tool
        do_render
        echo -e "  ${GREEN}All basic tests passed!${NC}"
        echo ""
        echo "  To test LLM prompts:  bash test-curl.sh prompt"
        echo "  To clean up:          bash test-curl.sh delete"
        echo ""
        ;;
    *)
        echo "Usage: bash test-curl.sh [command]"
        echo ""
        echo "Commands:"
        echo "  health    List sessions (health check)"
        echo "  create    Create a new session"
        echo "  state     Get session state"
        echo "  tool      Place particles via tool"
        echo "  render    Render session as SVG"
        echo "  prompt    Send an LLM prompt (requires API key)"
        echo "  delete    Delete a session"
        echo "  all       Run health + create + state + tool + render (default)"
        echo ""
        ;;
esac
CURLEOF

chmod +x "$PLAYGROUND/test-curl.sh"
echo "[6/7] Created test-curl.sh"

# ── Create cleanup.sh ──────────────────────────────────────────────────────

cat > "$PLAYGROUND/cleanup.sh" << 'CLEANEOF'
#!/usr/bin/env bash
# =============================================================================
# cleanup.sh — Remove all generated files from the playground
# =============================================================================
#
# This removes session files and other generated data.
# It does NOT remove the .env file (your credentials) or the scripts themselves.
#
# Usage:
#   bash cleanup.sh          # Remove sessions only
#   bash cleanup.sh --all    # Remove everything including this playground
# =============================================================================

set -euo pipefail

PLAYGROUND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "  particle-engine — Cleanup"
echo "  ════════════════════════════════════════════════════════"
echo ""

if [ "${1:-}" = "--all" ]; then
    echo "  WARNING: This will delete the ENTIRE playground directory:"
    echo "  $PLAYGROUND_DIR"
    echo ""
    read -p "  Are you sure? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "  Removing playground directory..."
        rm -rf "$PLAYGROUND_DIR"
        echo "  Done. Playground removed."
    else
        echo "  Cancelled."
    fi
else
    echo "  Removing session files..."
    rm -rf "$PLAYGROUND_DIR/sessions"
    mkdir -p "$PLAYGROUND_DIR/sessions"
    echo "  Done. Sessions cleared."
    echo ""
    echo "  To remove everything:  bash cleanup.sh --all"
    echo "  (Your .env and scripts are preserved)"
fi

echo ""
CLEANEOF

chmod +x "$PLAYGROUND/cleanup.sh"
echo "[7/7] Created cleanup.sh"

# ── Print final instructions ────────────────────────────────────────────────

echo ""
echo "  ╔═══════════════════════════════════════════════════════╗"
echo "  ║              Setup Complete!                          ║"
echo "  ╚═══════════════════════════════════════════════════════╝"
echo ""
echo "  Playground: $PLAYGROUND"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Edit your API credentials:"
echo "     nano $PLAYGROUND/.env"
echo ""
echo "  2. Start everything:"
echo "     bash $PLAYGROUND/start-all.sh"
echo ""
echo "     Or start server and client separately:"
echo "     bash $PLAYGROUND/start-server.sh    # Terminal 1"
echo "     bash $PLAYGROUND/start-client.sh    # Terminal 2"
echo ""
echo "  3. Open the browser UI:"
echo "     http://localhost:5173"
echo ""
echo "  4. Test the API with curl:"
echo "     bash $PLAYGROUND/test-curl.sh"
echo ""
echo "  5. Clean up when done:"
echo "     bash $PLAYGROUND/cleanup.sh           # Remove sessions"
echo "     bash $PLAYGROUND/cleanup.sh --all     # Remove everything"
echo ""
echo "  Files in the playground:"
echo "    .env              — Your API credentials"
echo "    sessions/         — Persisted session data"
echo "    start-server.sh   — Start the backend server"
echo "    start-client.sh   — Start the browser client"
echo "    start-all.sh      — Start both together"
echo "    test-curl.sh      — Example API commands"
echo "    cleanup.sh        — Clean up generated files"
echo ""
echo "  The original repo is NOT modified. All data stays here."
echo ""
