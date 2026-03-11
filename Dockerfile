# ============================================================
# particle-engine — Multi-stage production Dockerfile
# ============================================================
#
# Builds the full monorepo and produces a minimal image that
# serves both the API server (port 3000) and the built client
# as static files.
#
# Build:
#   docker build -t particle-engine .
#
# Run:
#   docker run -p 3000:3000 -e GOOGLE_API_KEY=xxx particle-engine
#
# ============================================================

# ── Stage 1: Install dependencies ───────────────────────────
FROM node:22-slim AS install

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.6.2 --activate

WORKDIR /app

# Copy package manifests first (for layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY turbo.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/animation/package.json packages/animation/package.json
COPY packages/tools/package.json packages/tools/package.json
COPY packages/renderer-svg/package.json packages/renderer-svg/package.json
COPY packages/renderer-canvas/package.json packages/renderer-canvas/package.json
COPY packages/renderer-webgl/package.json packages/renderer-webgl/package.json
COPY packages/video/package.json packages/video/package.json
COPY packages/provider-gemini/package.json packages/provider-gemini/package.json
COPY packages/provider-anthropic/package.json packages/provider-anthropic/package.json
COPY packages/provider-openai/package.json packages/provider-openai/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/client/package.json packages/client/package.json

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build all packages ─────────────────────────────
FROM install AS build

# Copy all source code
COPY . .

# Build all packages in dependency order via turborepo
RUN pnpm build

# Build the client for production (static files)
RUN cd packages/client && pnpm build

# ── Stage 3: Production image ───────────────────────────────
FROM node:22-slim AS production

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.6.2 --activate

WORKDIR /app

# Copy package manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY turbo.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/animation/package.json packages/animation/package.json
COPY packages/tools/package.json packages/tools/package.json
COPY packages/renderer-svg/package.json packages/renderer-svg/package.json
COPY packages/renderer-canvas/package.json packages/renderer-canvas/package.json
COPY packages/renderer-webgl/package.json packages/renderer-webgl/package.json
COPY packages/video/package.json packages/video/package.json
COPY packages/provider-gemini/package.json packages/provider-gemini/package.json
COPY packages/provider-anthropic/package.json packages/provider-anthropic/package.json
COPY packages/provider-openai/package.json packages/provider-openai/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/client/package.json packages/client/package.json

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built dist directories from the build stage
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/animation/dist packages/animation/dist
COPY --from=build /app/packages/tools/dist packages/tools/dist
COPY --from=build /app/packages/renderer-svg/dist packages/renderer-svg/dist
COPY --from=build /app/packages/renderer-canvas/dist packages/renderer-canvas/dist
COPY --from=build /app/packages/video/dist packages/video/dist
COPY --from=build /app/packages/provider-gemini/dist packages/provider-gemini/dist
COPY --from=build /app/packages/provider-anthropic/dist packages/provider-anthropic/dist
COPY --from=build /app/packages/provider-openai/dist packages/provider-openai/dist
COPY --from=build /app/packages/server/dist packages/server/dist

# Copy built client static files
COPY --from=build /app/packages/client/dist packages/client/dist

# Copy the CLI entry point and its source (runs via tsx)
COPY bin/ bin/
COPY packages/server/src/ packages/server/src/
COPY packages/provider-gemini/src/ packages/provider-gemini/src/
COPY packages/provider-anthropic/src/ packages/provider-anthropic/src/
COPY packages/provider-openai/src/ packages/provider-openai/src/

# Create sessions directory
RUN mkdir -p /app/sessions

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000

# Expose the server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/sessions || exit 1

# Start the server
# The CLI loads .env, starts the Hono server, and enables WebSocket
CMD ["npx", "tsx", "bin/particle-engine.ts", "--port", "3000", "--persist-dir", "/app/sessions"]
