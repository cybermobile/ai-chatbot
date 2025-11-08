# Local Docker Deployment Guide

Complete guide for running the AI Chatbot locally with Docker, including all services: Supabase (PostgreSQL), Caddy, Nginx, SearXNG, vLLM, Neo4j, and scheduled workflows with cron.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                 Caddy Reverse Proxy (:80)                │
│                    (Optional HTTPS)                       │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│           Next.js Application (:3000)                    │
│    ├─ API Routes (workflows, chat, documents)           │
│    ├─ MCP Filesystem Server                             │
│    └─ UI Components                                     │
└──────────────────────────────────────────────────────────┘
                          ↓
     ┌────────────────────┼────────────────────┐
     ↓                    ↓                    ↓
┌─────────┐      ┌─────────────┐      ┌─────────────┐
│TimescaleDB│     │    vLLM      │      │   SearXNG   │
│(Postgres)│     │  AI Model    │      │ Web Search  │
│:5434    │     │    :11436    │      │    :8081    │
└─────────┘      └─────────────┘      └─────────────┘
     ↓                    ↓                    ↓
┌─────────┐      ┌─────────────┐      ┌─────────────┐
│  MinIO  │      │  Embeddings  │      │   Neo4j     │
│:9000/:9001│     │    :11435    │      │:7474/:7687  │
└─────────┘      └─────────────┘      └─────────────┘
                          ↓
               ┌─────────────────┐
               │  Cron Service   │
               │ (Hourly/Daily)  │
               └─────────────────┘
```

## Prerequisites

### Required
- **Docker** 20.10+ with Docker Compose
- **NVIDIA GPU** (for vLLM inference)
- **NVIDIA Container Toolkit** (for GPU access in Docker)
- **8GB+ RAM** (16GB+ recommended)
- **20GB+ Disk Space** (for models and data)

### Optional
- **Windows SMB Share** (for MCP file access)
- **Domain name** (for Caddy HTTPS)

## Quick Start

### 1. Clone and Setup

```bash
git clone <your-repo>
cd ai-chatbot

# Copy environment template
cp .env.example .env.local

# Edit environment variables
nano .env.local
```

### 2. Configure Environment Variables

Edit `.env.local`:

```bash
# Database
POSTGRES_PASSWORD=your_secure_password
AUTH_SECRET=$(openssl rand -base64 32)

# Neo4j
NEO4J_PASSWORD=your_neo4j_password

# Windows File Share (for MCP)
WINDOWS_SERVER=192.168.1.100
WINDOWS_SHARE=Logs
WINDOWS_USERNAME=admin
WINDOWS_PASSWORD=your_windows_password

# Email Alerts (optional)
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=security@yourdomain.com
SECURITY_ALERT_RECIPIENTS=admin@yourdomain.com

# HuggingFace (for models)
HF_TOKEN=your_huggingface_token
```

### 3. Start All Services

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f app

# Check service health
docker compose ps
```

### 4. Access Services

| Service | URL | Description |
|---------|-----|-------------|
| **App** | http://localhost:3000 | Main AI Chatbot interface |
| **Caddy** | http://localhost | Reverse proxy (optional) |
| **MinIO Console** | http://localhost:9001 | Object storage UI |
| **Neo4j Browser** | http://localhost:7474 | Graph database UI |
| **SearXNG** | http://localhost:8081 | Web search engine |
| **vLLM** | http://localhost:11436 | LLM API endpoint |

### 5. Initialize Database

```bash
# Run migrations
docker compose exec app npm run migrate:db

# Check database
docker compose exec db psql -U postgres -c "\dt"
```

## Service Details

### TimescaleDB (PostgreSQL with pgvector)

**Image**: `timescale/timescaledb-ha:pg16`
**Port**: 5434 (mapped to avoid conflicts with local Postgres)
**Extensions**: pgvector for embeddings, TimescaleDB for time-series

```bash
# Connect to database
docker compose exec db psql -U postgres

# Check pgvector
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### vLLM (LLM Inference)

**Image**: `vllm/vllm-openai:latest`
**Model**: Llama-3.1-8B-Instruct (AWQ INT4 quantized)
**GPU**: Requires NVIDIA GPU with 8GB+ VRAM
**API**: OpenAI-compatible endpoint

```bash
# Test LLM API
curl http://localhost:11436/v1/models

# Generate text
curl http://localhost:11436/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4",
    "prompt": "Hello, who are you?",
    "max_tokens": 100
  }'
```

### Embeddings (Text-Embeddings-Inference)

**Image**: `ghcr.io/huggingface/text-embeddings-inference:cpu-1.2`
**Model**: BAAI/bge-small-en-v1.5 (768 dimensions)
**Mode**: CPU (can switch to GPU if needed)

```bash
# Test embeddings API
curl http://localhost:11435/embed \
  -H "Content-Type: application/json" \
  -d '{"inputs": "Hello world"}'
```

### Neo4j (Graph Database)

**Image**: `neo4j:5.15.0`
**Plugins**: APOC, Graph Data Science
**Default Password**: Set via `NEO4J_PASSWORD`

```bash
# Access Neo4j browser
open http://localhost:7474

# Connect with credentials
# Username: neo4j
# Password: (from NEO4J_PASSWORD)

# Test query
MATCH (n) RETURN count(n);
```

### SearXNG (Web Search)

**Image**: `searxng/searxng:latest`
**Privacy**: No tracking, proxied results
**Configured**: Auto-configured for localhost

```bash
# Test search
curl "http://localhost:8081/search?q=artificial+intelligence&format=json"
```

### Cron Service (Scheduled Workflows)

**Image**: `alpine:3.18`
**Jobs**:
- Security monitoring (hourly)
- RAG ingestion (daily 2 AM)

```bash
# View cron logs
docker compose logs -f cron

# Manually trigger security scan
docker compose exec cron /scripts/security-monitor.sh

# Manually trigger RAG ingestion
docker compose exec cron /scripts/rag-ingest.sh
```

**Cron Schedule**:
```
0 * * * *    # Security monitoring - every hour
0 2 * * *    # RAG ingestion - daily at 2 AM
*/5 * * * *  # Health check - every 5 minutes
```

### Caddy (Reverse Proxy)

**Image**: `caddy:2.7-alpine`
**Features**: Automatic HTTPS, HTTP/3, compression
**Config**: `Caddyfile`

```bash
# Reload Caddy config
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile

# View Caddy logs
docker compose logs -f caddy
```

## Workflow Configuration

### Security Monitoring

**File**: `app/api/workflows/security-monitor/route.ts`
**Trigger**: Hourly via cron
**MCP**: Reads syslog files from Windows share
**AI**: Analyzes logs for security threats
**Output**: Email alerts + database records

**Manual Trigger**:
```bash
curl -X POST http://localhost:3000/api/workflows/security-monitor \
  -H "Content-Type: application/json" \
  -d '{
    "logDirectory": "logs",
    "severity": "medium"
  }'
```

### RAG Document Ingestion

**File**: `app/api/workflows/rag-ingest/route.ts`
**Trigger**: Daily at 2 AM via cron
**MCP**: Collects documents from Windows share
**AI**: Generates embeddings
**Output**: Vector database + searchable via chat

**Manual Trigger**:
```bash
curl -X POST http://localhost:3000/api/workflows/rag-ingest \
  -H "Content-Type: application/json" \
  -d '{
    "documentDirectory": "documents",
    "filePattern": "*.txt"
  }'
```

## MCP (Model Context Protocol)

### Local Stdio Transport

Perfect for Docker! The MCP filesystem server runs as a subprocess and accesses Windows shares via CIFS mount.

**Configuration** (automatic):
```typescript
// lib/mcp-client.ts detects local environment
const client = await createFilesystemMCPClient();
// Uses stdio transport automatically
```

### Windows Share Mounting

The app container mounts your Windows share at `/mnt/windows-share`:

**docker-compose.yml** (already configured):
```yaml
volumes:
  - windows-share:/mnt/windows-share:ro

volumes:
  windows-share:
    driver: local
    driver_opts:
      type: cifs
      o: "username=${WINDOWS_USERNAME},password=${WINDOWS_PASSWORD},vers=3.0"
      device: "//${WINDOWS_SERVER}/${WINDOWS_SHARE}"
```

**Troubleshooting**:
```bash
# Check if share is mounted
docker compose exec app ls -la /mnt/windows-share

# Test access
docker compose exec app cat /mnt/windows-share/test.txt

# Re-mount share
docker compose down
docker compose up -d
```

## Customizing Cron Jobs

Edit `scripts/cron/cron-entrypoint.sh`:

```bash
# Add new workflow
cat > /etc/crontabs/root <<'EOF'
0 * * * * /scripts/security-monitor.sh >> /var/log/cron.log 2>&1
0 2 * * * /scripts/rag-ingest.sh >> /var/log/cron.log 2>&1

# New: Custom workflow every 6 hours
0 */6 * * * /scripts/custom-task.sh >> /var/log/cron.log 2>&1
EOF
```

Create new script `scripts/cron/custom-task.sh`:
```bash
#!/bin/sh
echo "[$(date)] Running custom task..."
curl -X POST "${APP_URL}/api/workflows/custom-task" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Restart cron:
```bash
docker compose restart cron
```

## Development Workflow

### Local Development
```bash
# Start only required services
docker compose up db storage vllm embeddings searxng neo4j -d

# Run app locally
npm install
npm run dev

# App connects to Docker services
```

### Full Stack
```bash
# Start everything
docker compose up -d

# Hot reload works with volume mounts
# Edit code, changes reflect immediately
```

### Debugging
```bash
# View all logs
docker compose logs -f

# View specific service
docker compose logs -f app

# Shell into container
docker compose exec app sh

# Check environment variables
docker compose exec app env | grep DATABASE
```

## Production Deployment

### 1. Build Production Image

```bash
# Update Dockerfile for production
# Set NODE_ENV=production

docker compose build app
```

### 2. Enable HTTPS with Caddy

Edit `Caddyfile`:
```
yourdomain.com {
  reverse_proxy app:3000
  encode gzip
}
```

```bash
docker compose up -d caddy
```

### 3. Secure Services

```bash
# Change default passwords
# Add firewall rules
# Use Docker secrets for sensitive data
```

## Monitoring

### Health Checks
```bash
# Check all services
docker compose ps

# Should show all as "healthy"
```

### Resource Usage
```bash
# Monitor resource usage
docker stats

# View specific container
docker stats chatbot-app
```

### Logs
```bash
# All logs
docker compose logs -f

# Cron logs
docker compose logs -f cron

# Workflow execution
docker compose logs -f app | grep -i workflow
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker compose logs service-name

# Remove and recreate
docker compose down
docker compose up -d
```

### GPU Not Detected
```bash
# Check NVIDIA runtime
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi

# Verify docker-compose.yml has:
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

### Windows Share Not Mounting
```bash
# Test from host
smbclient //SERVER/SHARE -U username

# Check Docker volume
docker volume inspect chatbot_windows-share

# Recreate volume
docker compose down -v
docker compose up -d
```

### Database Connection Failed
```bash
# Check if DB is running
docker compose ps db

# Test connection
docker compose exec db psql -U postgres -c "SELECT 1"

# Check app can connect
docker compose exec app node -e "console.log(process.env.DATABASE_URL)"
```

## Backup & Restore

### Database Backup
```bash
# Backup
docker compose exec db pg_dump -U postgres > backup.sql

# Restore
docker compose exec -T db psql -U postgres < backup.sql
```

### Full Data Backup
```bash
# Backup all volumes
tar -czf backup.tar.gz ./data

# Restore
tar -xzf backup.tar.gz
```

## Updating

```bash
# Pull latest images
docker compose pull

# Rebuild and restart
docker compose up -d --build

# View changes
docker compose logs -f app
```

## Cleanup

```bash
# Stop all services
docker compose down

# Remove volumes (DATA LOSS!)
docker compose down -v

# Remove images
docker compose down --rmi all

# Clean everything
docker system prune -a --volumes
```

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL password |
| `AUTH_SECRET` | (required) | NextAuth secret |
| `NEO4J_PASSWORD` | `password` | Neo4j password |
| `WINDOWS_SERVER` | - | Windows SMB server IP |
| `WINDOWS_SHARE` | - | SMB share name |
| `WINDOWS_USERNAME` | - | SMB username |
| `WINDOWS_PASSWORD` | - | SMB password |
| `RESEND_API_KEY` | - | Resend email API key |
| `HF_TOKEN` | - | HuggingFace token |

## Performance Tuning

### vLLM
```yaml
# Adjust GPU memory usage
--gpu-memory-utilization 0.9  # Use 90% of GPU

# Increase batch size
--max-num-seqs 8

# Longer context
--max-model-len 16384
```

### Database
```yaml
# Increase shared memory
environment:
  - POSTGRES_SHARED_BUFFERS=1GB
  - POSTGRES_MAX_CONNECTIONS=200
```

### Embeddings
```yaml
# Use GPU instead of CPU
image: ghcr.io/huggingface/text-embeddings-inference:latest
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          capabilities: [gpu]
```

## Support

- **Documentation**: See `WORKFLOW_INTEGRATION.md` for workflow details
- **MCP Setup**: See `MCP_PRODUCTION_DEPLOYMENT.md`
- **Issues**: See `KNOWN_ISSUES.md`

## Next Steps

1. ✅ **Configure .env.local** with your settings
2. ✅ **Start services** with `docker compose up -d`
3. ✅ **Access app** at http://localhost:3000
4. ✅ **Test workflows** via UI or cron
5. ✅ **Monitor logs** for any issues

Enjoy your self-hosted AI chatbot! 🚀
