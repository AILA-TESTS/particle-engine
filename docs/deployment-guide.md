# Particle Engine — Deployment Guide

This guide covers every deployment path for `particle-engine`, from local development through production on Google Cloud Platform.

---

## Table of Contents

1. [Local Development Setup](#1-local-development-setup)
2. [Local Production Deployment](#2-local-production-deployment)
3. [Google Cloud Platform (GCP) Deployment](#3-google-cloud-platform-gcp-deployment)
   - [Option A: Cloud Run (recommended)](#option-a-cloud-run-recommended--serverless-simple)
   - [Option B: Compute Engine](#option-b-compute-engine-vm--full-control)
   - [Option C: Google Kubernetes Engine](#option-c-google-kubernetes-engine-gke--for-scale)
4. [Docker Setup](#4-docker-setup)
5. [Environment Variables Reference](#5-environment-variables-reference)
6. [Security Considerations](#6-security-considerations)
7. [Monitoring and Maintenance](#7-monitoring-and-maintenance)

---

## 1. Local Development Setup

### Prerequisites

| Requirement | Version | Required | Notes |
|-------------|---------|----------|-------|
| Node.js     | 22+     | Yes      | LTS recommended (`node -v`) |
| pnpm        | 10+     | Yes      | `corepack enable && corepack prepare pnpm@latest --activate` |
| FFmpeg      | 6+      | No       | Only needed for video generation (`render_video` tool) |

### Clone and install

```bash
git clone https://github.com/AILA-TESTS/particle-engine.git
cd particle-engine
pnpm install
```

### Configure environment variables

Create a `.env` file in the project root. You need at least one LLM provider key:

```bash
# Copy from the template and fill in your keys
cat > .env << 'EOF'
# ── LLM Provider Keys (set at least one) ──────────────────────
# Google Gemini (API key mode)
GOOGLE_API_KEY=your-google-api-key

# Google Gemini (Vertex AI mode — alternative to API key)
# GCP_PROJECT_ID=your-gcp-project-id
# GCP_REGION=us-central1

# Anthropic Claude
# ANTHROPIC_API_KEY=your-anthropic-api-key

# OpenAI GPT
# OPENAI_API_KEY=your-openai-api-key
EOF
```

The server auto-detects which provider to use based on which key is set. Priority order: Gemini > Anthropic > OpenAI. You can override with the `--provider` flag.

### Start the API server

```bash
pnpm start
```

This runs `npx tsx bin/particle-engine.ts` which:
- Loads `.env` from the working directory
- Auto-detects the LLM provider from environment variables
- Starts the Hono HTTP server on port 3000
- Enables session persistence in `./sessions/`
- Starts the WebSocket server on `ws://localhost:3000/ws`

Override defaults with CLI flags:

```bash
pnpm start -- --port 8080 --provider anthropic --model claude-sonnet-4-20250514
pnpm start -- --no-persist
pnpm start -- --persist-dir /tmp/particle-sessions
```

### Start the browser client (development)

In a separate terminal:

```bash
cd packages/client
pnpm dev
```

This starts Vite on `http://localhost:5173` with a proxy that forwards `/api/*` requests to `http://localhost:3000`.

Open your browser to: **http://localhost:5173**

### Test with curl

```bash
# Health check — list sessions (should return empty array)
curl http://localhost:3000/api/sessions

# Create a new session
curl -X POST http://localhost:3000/api/sessions

# Save the session ID from the response, then send a prompt
SESSION_ID="s_1710000000000_abcdef01"  # replace with actual ID

curl -X POST "http://localhost:3000/api/sessions/${SESSION_ID}/prompt" \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "Place 3 particles in a triangle pattern and connect them"}'

# Get the SVG render
curl "http://localhost:3000/api/sessions/${SESSION_ID}/render" -o triangle.svg

# Execute a tool directly (without LLM)
curl -X POST "http://localhost:3000/api/sessions/${SESSION_ID}/tool" \
  -H 'Content-Type: application/json' \
  -d '{"tool": "get_space_info", "params": {}}'

# Get full session state
curl "http://localhost:3000/api/sessions/${SESSION_ID}"

# Delete a session
curl -X DELETE "http://localhost:3000/api/sessions/${SESSION_ID}"
```

### Run tests

```bash
# All 766 tests across 11 packages
pnpm test

# Single package
cd packages/core && pnpm test
cd packages/server && pnpm test
```

### Troubleshooting

| Problem | Solution |
|---------|----------|
| `ERR_MODULE_NOT_FOUND` on start | Run `pnpm build` first — the server imports from workspace packages that need to be built |
| Port 3000 already in use | Use `--port 8080` or kill the existing process: `lsof -ti:3000 \| xargs kill` |
| `/api/sessions/:id/prompt` returns 503 | No LLM provider configured. Set an API key in `.env` or pass `--provider` |
| FFmpeg errors on `render_video` | Install FFmpeg: `brew install ffmpeg` (macOS) or `apt install ffmpeg` (Linux) |
| `pnpm install` fails | Ensure pnpm 10+: `pnpm -v`. If using corepack: `corepack enable && corepack prepare pnpm@10.6.2 --activate` |
| Client shows CORS errors | The Vite dev server proxies `/api` to port 3000. Make sure the API server is running. |

---

## 2. Local Production Deployment

### Build all packages

```bash
pnpm build
```

Turborepo builds packages in dependency order. Output goes to `dist/` in each package.

### Build the client for production

```bash
cd packages/client
pnpm build
```

This produces static files in `packages/client/dist/`.

### Run the server in production mode

```bash
NODE_ENV=production npx tsx bin/particle-engine.ts --port 3000 --persist-dir /var/lib/particle-engine/sessions
```

### Serve the client as static files

In production, you should serve the client's built static files through a reverse proxy (nginx) rather than the Vite dev server.

### nginx reverse proxy configuration

```nginx
# /etc/nginx/sites-available/particle-engine

upstream particle_api {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name particle.example.com;

    # Serve the built client files
    root /path/to/particle-engine/packages/client/dist;
    index index.html;

    # API requests → Node.js server
    location /api/ {
        proxy_pass http://particle_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # LLM conversations can be slow — increase timeout
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    # WebSocket connections
    location /ws {
        proxy_pass http://particle_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
    }

    # Client-side routing fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/particle-engine /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Process management with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start the server
pm2 start npx --name particle-engine -- tsx bin/particle-engine.ts --port 3000

# Or use an ecosystem file
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'particle-engine',
    script: 'npx',
    args: 'tsx bin/particle-engine.ts --port 3000',
    cwd: '/path/to/particle-engine',
    env: {
      NODE_ENV: 'production',
      GOOGLE_API_KEY: 'your-key-here',
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '1G',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
EOF

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # Generate startup script for system boot
```

### Process management with systemd

```ini
# /etc/systemd/system/particle-engine.service

[Unit]
Description=Particle Engine Server
After=network.target

[Service]
Type=simple
User=particle
Group=particle
WorkingDirectory=/opt/particle-engine
ExecStart=/usr/bin/npx tsx bin/particle-engine.ts --port 3000 --persist-dir /var/lib/particle-engine/sessions
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/particle-engine/.env

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/particle-engine

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable particle-engine
sudo systemctl start particle-engine
sudo systemctl status particle-engine
sudo journalctl -u particle-engine -f  # View logs
```

---

## 3. Google Cloud Platform (GCP) Deployment

### Option A: Cloud Run (recommended -- serverless, simple)

Cloud Run is the best fit for particle-engine: zero infrastructure management, scales to zero when idle, and supports both HTTP and WebSocket.

#### Step 1: Create a Dockerfile

A production `Dockerfile` is included at the repository root. It performs a multi-stage build:

1. **install** -- installs all dependencies
2. **build** -- builds all packages with turborepo
3. **production** -- copies only the built output and production dependencies

#### Step 2: Build and push the container image

```bash
# Set your GCP project
export PROJECT_ID=your-gcp-project-id
export REGION=us-central1

# Enable required APIs
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# Create an Artifact Registry repository (one-time)
gcloud artifacts repositories create particle-engine \
  --repository-format=docker \
  --location=$REGION \
  --description="Particle Engine container images"

# Configure Docker to authenticate with Artifact Registry
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build and push the image
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/particle-engine/server:latest .
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/particle-engine/server:latest
```

#### Step 3: Store API keys in Secret Manager

```bash
# Create secrets for each API key you need
echo -n "your-google-api-key" | gcloud secrets create GOOGLE_API_KEY --data-file=-
echo -n "your-anthropic-api-key" | gcloud secrets create ANTHROPIC_API_KEY --data-file=-
echo -n "your-openai-api-key" | gcloud secrets create OPENAI_API_KEY --data-file=-

# Grant the Cloud Run service account access to the secrets
export SA_EMAIL=$(gcloud iam service-accounts list \
  --filter="displayName:Compute Engine default" \
  --format="value(email)")

gcloud secrets add-iam-policy-binding GOOGLE_API_KEY \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"
```

#### Step 4: Deploy to Cloud Run

```bash
gcloud run deploy particle-engine \
  --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/particle-engine/server:latest \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=120s \
  --set-secrets="GOOGLE_API_KEY=GOOGLE_API_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest" \
  --set-env-vars="NODE_ENV=production"
```

#### Step 5: Configure WebSocket timeout

Cloud Run supports WebSocket but has a default request timeout of 300s. For long-running WebSocket connections:

```bash
gcloud run services update particle-engine \
  --region=$REGION \
  --timeout=3600s \
  --session-affinity
```

Note: `--session-affinity` ensures WebSocket connections stick to the same instance.

#### Step 6: Custom domain

```bash
# Map a custom domain
gcloud run domain-mappings create \
  --service=particle-engine \
  --domain=particle.example.com \
  --region=$REGION

# Follow the DNS instructions printed by the command
# (usually a CNAME record pointing to ghs.googlehosted.com)
```

#### Step 7: Persistent sessions on Cloud Run

Cloud Run is stateless by default. For session persistence, you have two options:

**Option 1: Cloud Storage (recommended for Cloud Run)**

Add a Cloud Storage FUSE volume mount:

```bash
# Create a bucket for sessions
gsutil mb -l $REGION gs://${PROJECT_ID}-particle-sessions

# Deploy with volume mount
gcloud run deploy particle-engine \
  --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/particle-engine/server:latest \
  --region=$REGION \
  --execution-environment=gen2 \
  --add-volume=name=sessions,type=cloud-storage,bucket=${PROJECT_ID}-particle-sessions \
  --add-volume-mount=volume=sessions,mount-path=/sessions \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="GOOGLE_API_KEY=GOOGLE_API_KEY:latest" \
  --update-env-vars="PERSIST_DIR=/sessions" \
  --allow-unauthenticated
```

Note: Requires gen2 execution environment. The Dockerfile CMD uses `--persist-dir /sessions` or you can set it via environment variable in the entrypoint.

**Option 2: Disable persistence**

For stateless usage, start with `--no-persist`. Sessions live in memory only for the lifetime of the instance.

---

### Option B: Compute Engine (VM -- full control)

Use Compute Engine when you need full control, persistent disk storage, or want to run FFmpeg for video generation.

#### Step 1: Create a VM instance

```bash
export PROJECT_ID=your-gcp-project-id
export ZONE=us-central1-a

gcloud compute instances create particle-engine-vm \
  --project=$PROJECT_ID \
  --zone=$ZONE \
  --machine-type=e2-small \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=20GB \
  --tags=http-server,https-server
```

#### Step 2: Configure firewall rules

```bash
# Allow HTTP (port 80) and HTTPS (port 443)
gcloud compute firewall-rules create allow-http \
  --allow=tcp:80 \
  --target-tags=http-server \
  --description="Allow HTTP traffic"

gcloud compute firewall-rules create allow-https \
  --allow=tcp:443 \
  --target-tags=https-server \
  --description="Allow HTTPS traffic"
```

#### Step 3: SSH into the VM and set up the environment

```bash
gcloud compute ssh particle-engine-vm --zone=$ZONE
```

On the VM:

```bash
# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
corepack enable
corepack prepare pnpm@10.6.2 --activate

# Install FFmpeg (for video generation)
sudo apt-get install -y ffmpeg

# Install nginx
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Clone and build
cd /opt
sudo mkdir particle-engine && sudo chown $(whoami) particle-engine
git clone https://github.com/AILA-TESTS/particle-engine.git
cd particle-engine
pnpm install
pnpm build

# Build the client
cd packages/client && pnpm build && cd ../..

# Create environment file
cat > .env << 'EOF'
GOOGLE_API_KEY=your-key-here
# ANTHROPIC_API_KEY=your-key-here
# OPENAI_API_KEY=your-key-here
EOF
chmod 600 .env

# Create sessions directory
sudo mkdir -p /var/lib/particle-engine/sessions
sudo chown $(whoami) /var/lib/particle-engine/sessions
```

#### Step 4: Set up PM2 for process management

```bash
sudo npm install -g pm2

pm2 start npx --name particle-engine -- \
  tsx bin/particle-engine.ts \
  --port 3000 \
  --persist-dir /var/lib/particle-engine/sessions

pm2 save
pm2 startup  # Follow the printed instructions to enable on boot
```

#### Step 5: Configure nginx with SSL

```nginx
# /etc/nginx/sites-available/particle-engine
server {
    listen 80;
    server_name particle.example.com;

    root /opt/particle-engine/packages/client/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/particle-engine /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Set up SSL with Let's Encrypt
sudo certbot --nginx -d particle.example.com
```

---

### Option C: Google Kubernetes Engine (GKE) -- for scale

Use GKE when you need:
- Multiple replicas with load balancing
- Auto-scaling beyond what Cloud Run offers
- Complex networking (VPC, internal services)
- Persistent volume claims for session storage

#### When to choose GKE over Cloud Run

| Factor | Cloud Run | GKE |
|--------|-----------|-----|
| Setup complexity | Minimal | High |
| Cost at low traffic | Near-zero (scales to 0) | Cluster always running |
| WebSocket support | Yes (with timeout config) | Full control |
| Persistent storage | Cloud Storage FUSE (limited) | PersistentVolumeClaims |
| Scaling | Automatic (0-N) | HPA + cluster autoscaler |
| Best for | Most deployments | Large-scale, multi-service |

#### Overview

1. Use the same `Dockerfile` from the repo root
2. Push to Artifact Registry (same as Cloud Run steps)
3. Create a GKE cluster:

```bash
gcloud container clusters create-auto particle-cluster \
  --region=$REGION \
  --project=$PROJECT_ID
```

4. Create Kubernetes manifests (Deployment + Service + Ingress):

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: particle-engine
spec:
  replicas: 2
  selector:
    matchLabels:
      app: particle-engine
  template:
    metadata:
      labels:
        app: particle-engine
    spec:
      containers:
        - name: particle-engine
          image: us-central1-docker.pkg.dev/PROJECT_ID/particle-engine/server:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: production
          envFrom:
            - secretRef:
                name: particle-engine-secrets
          volumeMounts:
            - name: sessions
              mountPath: /sessions
      volumes:
        - name: sessions
          persistentVolumeClaim:
            claimName: particle-sessions-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: particle-engine
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3000
  selector:
    app: particle-engine
```

5. Apply and expose:

```bash
kubectl apply -f k8s/
kubectl expose deployment particle-engine --type=LoadBalancer --port=80 --target-port=3000
```

For production GKE deployments, refer to the [GKE documentation](https://cloud.google.com/kubernetes-engine/docs).

---

## 4. Docker Setup

### Dockerfile

A production-ready `Dockerfile` is provided at the repository root. It uses a multi-stage build:

```
Stage 1 (install): Install all dependencies with pnpm
Stage 2 (build):   Build all packages with turborepo
Stage 3 (prod):    Copy built output, install production deps only, run server
```

### Build and run with Docker

```bash
# Build the image
docker build -t particle-engine .

# Run with environment variables
docker run -d \
  --name particle-engine \
  -p 3000:3000 \
  -e GOOGLE_API_KEY=your-key-here \
  -v particle-sessions:/app/sessions \
  particle-engine

# Check logs
docker logs -f particle-engine

# Stop
docker stop particle-engine && docker rm particle-engine
```

### docker-compose for local development

A `docker-compose.yml` is provided at the repository root. Run:

```bash
# Start the server
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Stop and remove volumes (clears session data)
docker compose down -v
```

To pass API keys, create a `.env` file in the project root (it is gitignored):

```bash
GOOGLE_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
```

### docker-compose for production (with nginx)

Create a `docker-compose.prod.yml`:

```yaml
version: "3.8"

services:
  particle-engine:
    build: .
    restart: always
    expose:
      - "3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
    volumes:
      - sessions:/app/sessions

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./packages/client/dist:/usr/share/nginx/html:ro
      - certs:/etc/letsencrypt:ro
    depends_on:
      - particle-engine

volumes:
  sessions:
  certs:
```

Create `nginx.conf` for the production compose:

```nginx
upstream api {
    server particle-engine:3000;
}

server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /ws {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Run:

```bash
# Build the client first
pnpm build

# Start production stack
docker compose -f docker-compose.prod.yml up -d
```

---

## 5. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_API_KEY` | No* | -- | Google Generative AI API key (Gemini API key mode) |
| `GCP_PROJECT_ID` | No* | -- | GCP project ID (Gemini Vertex AI mode) |
| `GCP_REGION` | No | `us-central1` | GCP region for Vertex AI |
| `ANTHROPIC_API_KEY` | No* | -- | Anthropic API key for Claude models |
| `OPENAI_API_KEY` | No* | -- | OpenAI API key for GPT models |
| `NODE_ENV` | No | `development` | Set to `production` for production deployments |
| `PORT` | No | `3000` | Server port (can also use `--port` CLI flag) |

*At least one LLM provider key is required for the `/api/sessions/:id/prompt` endpoint to work. Without any key, the server still starts but the prompt endpoint returns 503.

### CLI flags (override environment variables)

| Flag | Default | Description |
|------|---------|-------------|
| `--port <number>` | `3000` | Port to listen on |
| `--provider <name>` | auto-detect | Force a specific provider: `gemini`, `anthropic`, `openai` |
| `--model <id>` | Provider default | Override the model ID (e.g., `gemini-2.0-flash`, `claude-sonnet-4-20250514`, `gpt-4o`) |
| `--persist-dir <path>` | `./sessions` | Directory for session persistence files |
| `--no-persist` | -- | Disable session persistence (in-memory only) |

### Default model IDs by provider

| Provider | Default Model |
|----------|---------------|
| Gemini (API key) | `gemini-2.0-flash` |
| Gemini (Vertex AI) | `gemini-2.0-flash` |
| Anthropic | `claude-sonnet-4-20250514` |
| OpenAI | `gpt-4o` |

### Setting environment variables by deployment method

| Method | How to set |
|--------|-----------|
| Local development | `.env` file in project root (auto-loaded by CLI) |
| Docker | `-e KEY=value` flag or `env_file` in docker-compose |
| Cloud Run | `--set-env-vars` or `--set-secrets` with Secret Manager |
| Compute Engine | `.env` file or `EnvironmentFile` in systemd unit |
| GKE | Kubernetes Secrets + `envFrom` in pod spec |

---

## 6. Security Considerations

### Never commit secrets

The `.env` file is listed in `.gitignore`. Never commit API keys to the repository.

```bash
# Verify .env is ignored
git status  # .env should NOT appear
```

### Use Secret Manager in production

On GCP, store all API keys in [Secret Manager](https://cloud.google.com/secret-manager):

```bash
# Create a secret
echo -n "sk-..." | gcloud secrets create OPENAI_API_KEY --data-file=-

# Reference from Cloud Run
gcloud run services update particle-engine \
  --set-secrets="OPENAI_API_KEY=OPENAI_API_KEY:latest"
```

Never pass secrets as plain environment variables in CI/CD pipelines or container registries.

### CORS configuration

The server currently enables CORS for all origins (`cors()` with no restrictions in `app.ts`). This is fine for development but should be restricted in production.

To restrict CORS, modify `packages/server/src/app.ts`:

```typescript
import { cors } from 'hono/cors';

// Production: restrict to your domain
app.use('*', cors({
  origin: 'https://particle.example.com',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));
```

### Rate limiting

The server does not include rate limiting by default. For production, add rate limiting at the reverse proxy level:

```nginx
# nginx rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://particle_api;
    # ...
}
```

Or use Cloud Run's built-in concurrency limits (`--concurrency=80`).

### API key rotation

1. Generate a new key with your provider
2. Update the secret in Secret Manager (or `.env`)
3. Restart the server (or redeploy on Cloud Run)
4. Revoke the old key

On Cloud Run, updating a secret version and redeploying picks up the new value automatically:

```bash
echo -n "new-key-value" | gcloud secrets versions add GOOGLE_API_KEY --data-file=-
gcloud run services update particle-engine --region=$REGION
```

### Session data

Session files (in `./sessions/` or the configured persistence directory) contain the full grid state and conversation history. They may contain user prompts. Treat them as sensitive data:

- Restrict filesystem permissions (`chmod 700 sessions/`)
- Enable encryption at rest on GCP (default for Cloud Storage and Persistent Disks)
- Implement session expiration / cleanup (see Section 7)

---

## 7. Monitoring and Maintenance

### Health check endpoint

Use the sessions list endpoint as a lightweight health check:

```bash
curl -f http://localhost:3000/api/sessions || echo "Server is down"
```

For Docker and Cloud Run health checks:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/sessions || exit 1
```

Cloud Run health check (via gcloud):

```bash
gcloud run services update particle-engine \
  --region=$REGION \
  --update-env-vars=PORT=3000 \
  --use-http2=false
```

Cloud Run performs automatic health checks on the configured port.

### Logging

The server logs to stdout/stderr:

- `[particle-engine]` -- CLI / startup messages
- `[SessionManager]` -- Session persistence events

View logs by deployment method:

| Method | Command |
|--------|---------|
| Local | Terminal output |
| PM2 | `pm2 logs particle-engine` |
| systemd | `journalctl -u particle-engine -f` |
| Docker | `docker logs -f particle-engine` |
| Cloud Run | `gcloud run services logs read particle-engine --region=$REGION` |
| GKE | `kubectl logs -f deployment/particle-engine` |

### Session cleanup

Sessions persist indefinitely by default. To clean up old sessions:

```bash
# Delete session files older than 7 days
find /var/lib/particle-engine/sessions -name "*.json" -mtime +7 -delete
```

Add to crontab for automatic cleanup:

```bash
# Run daily at 3 AM
0 3 * * * find /var/lib/particle-engine/sessions -name "*.json" -mtime +7 -delete
```

Or via the API:

```bash
# List all sessions and delete old ones
curl http://localhost:3000/api/sessions | \
  jq -r '.sessions[] | select(.createdAt < (now - 604800) * 1000) | .id' | \
  while read id; do
    curl -X DELETE "http://localhost:3000/api/sessions/${id}"
  done
```

### Updating the deployment

#### Local / VM

```bash
cd /opt/particle-engine
git pull origin main
pnpm install
pnpm build
cd packages/client && pnpm build && cd ../..
pm2 restart particle-engine
# or: sudo systemctl restart particle-engine
```

#### Cloud Run

```bash
# Rebuild and push
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/particle-engine/server:latest .
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/particle-engine/server:latest

# Deploy the new image
gcloud run deploy particle-engine \
  --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/particle-engine/server:latest \
  --region=$REGION
```

#### Docker Compose

```bash
git pull origin main
docker compose build
docker compose up -d
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Install dependencies | `pnpm install` |
| Build everything | `pnpm build` |
| Start dev server | `pnpm start` |
| Start dev client | `cd packages/client && pnpm dev` |
| Run all tests | `pnpm test` |
| Build Docker image | `docker build -t particle-engine .` |
| Run Docker container | `docker run -p 3000:3000 -e GOOGLE_API_KEY=xxx particle-engine` |
| Start with Docker Compose | `docker compose up -d` |
| Deploy to Cloud Run | See [Section 3A](#option-a-cloud-run-recommended--serverless-simple) |
