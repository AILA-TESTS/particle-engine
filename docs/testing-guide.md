# Particle Engine — Testing Guide

This guide explains how to set up a clean testing environment for the particle-engine, run the server and browser client, test prompts, and clean up afterward.

## Why Use a Separate Directory?

The particle-engine server persists session data as JSON files on disk. Running the server directly from the repo would create `sessions/` and other data files inside the source tree, polluting the git working directory.

The **playground setup** solves this by:
- Creating a separate directory (e.g., `~/particle-playground`) for all runtime data
- Pointing the server's persistence to that directory
- Keeping the `.env` credentials file outside the repo
- Ensuring the original repo remains completely unmodified

The Vite client dev server is inherently read-only -- it serves source files via hot module replacement and writes nothing to disk.

## Prerequisites

- **Node.js 18+** (check with `node --version`)
- **pnpm** (install with `npm install -g pnpm`)
- **Dependencies installed**: run `pnpm install` in the repo root if not already done
- **At least one LLM API key** (Gemini, Anthropic, or OpenAI) for prompt testing

## Quick Start

### 1. Run the Setup Script

```bash
# From the particle-engine repo directory:
bash scripts/setup-playground.sh

# Or specify a custom directory:
bash scripts/setup-playground.sh ~/my-particle-test
```

This creates `~/particle-playground/` (or your chosen directory) with all the scripts and a `.env` file.

### 2. Configure Your API Keys

Edit the `.env` file in the playground directory:

```bash
nano ~/particle-playground/.env
```

Uncomment and fill in at least one provider's API key:

```bash
# Google Gemini (recommended — fastest)
GOOGLE_API_KEY=your-key-here

# Anthropic Claude
ANTHROPIC_API_KEY=your-key-here

# OpenAI GPT-4
OPENAI_API_KEY=your-key-here
```

The server auto-detects which provider to use based on which environment variables are set. Priority: Gemini > Anthropic > OpenAI.

### 3. Start the Services

**Option A: Start both together** (recommended)

```bash
bash ~/particle-playground/start-all.sh
```

This launches the server (port 3000) and client (port 5173) together. Press `Ctrl+C` to stop both.

**Option B: Start separately** (useful for debugging)

```bash
# Terminal 1 — Server
bash ~/particle-playground/start-server.sh

# Terminal 2 — Client
bash ~/particle-playground/start-client.sh
```

### 4. Open the Browser UI

Navigate to: **http://localhost:5173**

You should see the particle-engine web interface with:
- A canvas area showing the particle grid
- A prompt input field
- Session controls (create, load, delete)

### 5. Test with the Browser UI

1. Click **"New Session"** to create a particle grid
2. Type a prompt like: `Draw a red triangle` or `Create a starfield pattern`
3. Watch as the LLM calls particle tools and the canvas updates in real-time
4. Try more complex prompts: `Draw the letter A using blue particles with white connections`

### 6. Test with curl

While the server is running, you can also test the API directly:

```bash
# Run all basic tests (create session, place particles, render SVG)
bash ~/particle-playground/test-curl.sh

# Individual commands
bash ~/particle-playground/test-curl.sh create    # Create a session
bash ~/particle-playground/test-curl.sh tool       # Place particles manually
bash ~/particle-playground/test-curl.sh render     # Render as SVG
bash ~/particle-playground/test-curl.sh prompt     # Send an LLM prompt
bash ~/particle-playground/test-curl.sh delete     # Clean up session
```

## What Files Get Created and Where

```
~/particle-playground/
  .env                  Your API credentials (never sent to the repo)
  sessions/             Server-persisted session JSON files
    <session-id>.json   One file per session with grid state + messages
  start-server.sh       Starts the HTTP + WebSocket server on port 3000
  start-client.sh       Starts the Vite browser client on port 5173
  start-all.sh          Starts both services together
  test-curl.sh          Example curl commands for API testing
  cleanup.sh            Removes generated files
```

The **repo directory** is never modified. The server reads code from the repo but writes all data to the playground.

## Server Options

The server supports several command-line flags. Pass them through `start-server.sh` or `start-all.sh`:

```bash
# Custom port
bash start-server.sh --port 8080

# Force a specific LLM provider
bash start-server.sh --provider anthropic

# Use a specific model
bash start-server.sh --provider openai --model gpt-4o-mini

# Disable session persistence (in-memory only)
bash start-server.sh --no-persist

# Show all options
bash start-server.sh --help
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions` | Create a new session |
| `GET` | `/api/sessions` | List all sessions |
| `GET` | `/api/sessions/:id` | Get session with grid state |
| `DELETE` | `/api/sessions/:id` | Delete a session |
| `POST` | `/api/sessions/:id/tool` | Execute a particle tool |
| `POST` | `/api/sessions/:id/prompt` | Send a prompt to the LLM |
| `GET` | `/api/sessions/:id/render` | Render session as SVG |

WebSocket endpoint: `ws://localhost:3000/ws` (real-time grid updates)

## Example Test Session Walkthrough

Here is a complete walkthrough of creating a session, sending prompts, and viewing results:

### Step 1: Create a Session

```bash
curl -s -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"rows": 20, "cols": 30}' | python3 -m json.tool
```

Response:
```json
{
    "id": "abc123-...",
    "config": { "rows": 20, "cols": 30, "spacing": 1 },
    "createdAt": "2026-03-12T..."
}
```

Save the session ID for subsequent requests.

### Step 2: Send a Prompt

```bash
curl -s -X POST http://localhost:3000/api/sessions/SESSION_ID/prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Draw a simple house with a triangular roof"}' | python3 -m json.tool
```

The LLM will call particle tools (`set_particles`, `set_connections`, etc.) to place colored particles on the grid and connect them with lines.

### Step 3: View the Result

**As SVG (save and open):**
```bash
curl -s http://localhost:3000/api/sessions/SESSION_ID/render?width=800&height=600 > house.svg
open house.svg   # macOS
```

**As JSON state:**
```bash
curl -s http://localhost:3000/api/sessions/SESSION_ID | python3 -m json.tool
```

**In the browser:** Just open http://localhost:5173, select the session, and see the live canvas.

### Step 4: Iterate

Send more prompts to modify the scene:

```bash
curl -s -X POST http://localhost:3000/api/sessions/SESSION_ID/prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Add a sun in the top-right corner with yellow rays"}'
```

Each prompt builds on the existing grid state — the LLM sees what is already placed and adds to it.

### Step 5: Clean Up

```bash
curl -s -X DELETE http://localhost:3000/api/sessions/SESSION_ID
```

## Cleanup

### Remove session data only

```bash
bash ~/particle-playground/cleanup.sh
```

This clears the `sessions/` directory but keeps your `.env` and scripts.

### Remove the entire playground

```bash
bash ~/particle-playground/cleanup.sh --all
```

This deletes the entire playground directory. You can recreate it anytime with `setup-playground.sh`.

## Troubleshooting

### Port 3000 already in use

```
Error: listen EADDRINUSE: address already in use :::3000
```

Another process is using port 3000. Either:
- Stop the other process: `lsof -ti:3000 | xargs kill`
- Use a different port: `bash start-server.sh --port 3001`
  (Note: the client proxy is hardcoded to port 3000, so if you change the server port, the browser UI won't work unless you also update the Vite proxy config)

### Port 5173 already in use

Another Vite instance is running. Stop it or check if you already have the client running in another terminal.

### "No LLM provider configured" (503 on /prompt)

The server started without detecting any API keys. Make sure:
1. Your `.env` file is in the playground directory (not the repo)
2. The `.env` file has at least one uncommented API key
3. You started the server from the playground directory (the scripts handle this automatically)

### "Cannot find module" errors

Dependencies may not be installed. Run from the repo directory:

```bash
cd /path/to/particle-engine
pnpm install
```

### Server starts but client shows blank page

1. Check that the server is running on port 3000
2. Check the browser console for errors
3. Make sure you are on http://localhost:5173 (not port 3000)

### "Cannot find particle-engine repo" error

The playground scripts contain an absolute path to the repo. If you moved the repo after running setup, re-run:

```bash
bash /path/to/particle-engine/scripts/setup-playground.sh ~/particle-playground
```

### Session data lost after restart

Sessions are persisted to JSON files in `~/particle-playground/sessions/`. They survive server restarts. If sessions are missing:
- Check that `--no-persist` is not being passed
- Check that the `sessions/` directory exists and is writable

### WebSocket connection fails

The WebSocket endpoint is at `ws://localhost:3000/ws`. The Vite dev server does not proxy WebSocket connections by default. The client connects directly to `ws://localhost:3000/ws` for real-time updates.

## Architecture Notes

- **Server** (`bin/particle-engine.ts`): Hono-based HTTP server + WebSocket. Loads `.env` from the current working directory. Persists sessions to `--persist-dir`.
- **Client** (`packages/client/`): Vite-based SPA with canvas renderer. Proxies `/api` to `localhost:3000`. Read-only on the filesystem.
- **Providers**: Gemini, Anthropic, and OpenAI are supported. The server auto-detects from environment variables or accepts `--provider` flag.
- **Tools**: The LLM uses particle tools (`set_particles`, `set_connections`, `clear_particles`, etc.) to manipulate the grid. Tool definitions are provided to the LLM as function-calling schemas.
