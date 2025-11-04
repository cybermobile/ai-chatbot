# Migration Checklist: Mac → Linux with vLLM

Quick checklist for moving from Mac M2 with Ollama to Linux with RTX 3080 and vLLM.

## Before Migration

### On Your Mac (Current Setup)
- [ ] Commit and push all code changes
- [ ] Export any important chat data (optional)
- [ ] Note your current `.env` configuration
- [ ] Backup MinIO data if needed: `tar -czf minio-backup.tar.gz ./data/minio`
- [ ] Backup Postgres data if needed: `tar -czf postgres-backup.tar.gz ./data/db`

```bash
git add .
git commit -m "Prepare for vLLM migration"
git push origin main
```

## On Linux System

### Step 1: System Prerequisites
```bash
# Verify GPU
nvidia-smi

# Install Docker if not present
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/libnvidia-container/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker

# Verify GPU works in Docker
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
```

### Step 2: Clone Repository
```bash
cd ~
git clone <your-repo-url> ai-chatbot
cd ai-chatbot
```

### Step 3: Install Node.js & pnpm
```bash
# Install Node.js 20 (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Install pnpm
npm install -g pnpm

# Install project dependencies
pnpm install
```

### Step 4: Install @ai-sdk/openai
```bash
pnpm add @ai-sdk/openai
```

### Step 5: Configure Environment
```bash
# Copy example env file
cp .env.example .env

# Edit .env
nano .env
```

**Critical settings for Linux with vLLM:**
```env
# Database (will be created by docker-compose)
POSTGRES_URL=postgresql://postgres:postgres@localhost:5434/postgres

# MinIO (will be created by docker-compose)
MINIO_URL=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=password
MINIO_BUCKET=resources

# LLM Provider - SET TO VLLM
LLM_PROVIDER=vllm
LLM_BASE_URL=http://127.0.0.1:11434

# vLLM Embeddings
VLLM_EMBEDDING_URL=http://127.0.0.1:11435
VLLM_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5

# HuggingFace Token (REQUIRED for Llama 3.1)
# Get from: https://huggingface.co/settings/tokens
# Must accept license: https://huggingface.co/meta-llama/Meta-Llama-3.1-8B-Instruct
HF_TOKEN=hf_your_token_here

# Auth secret (generate new one)
AUTH_SECRET=$(openssl rand -base64 32)
```

### Step 6: Start Docker Services
```bash
# Start all services (db, minio, searxng, vllm, vllm-embeddings)
docker-compose up -d

# Monitor vLLM startup (first time will download model - takes 5-10 mins)
docker logs -f vllm
```

**Wait for this message:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

### Step 7: Initialize Database
```bash
# Run migrations
pnpm run generate:db
pnpm run migrate:db

# Or build (includes migration)
pnpm run build
```

### Step 8: Start Application
```bash
pnpm dev
```

### Step 9: Verify Everything Works
- [ ] Open http://localhost:3000
- [ ] Create an account / login
- [ ] Start a new chat
- [ ] Test basic chat (should work)
- [ ] Enable RAG tool in settings
- [ ] Upload a document to MinIO
- [ ] Ask a question about the document
- [ ] **Verify you get a complete response** (not just "thinking")

## Verification Tests

### Test 1: vLLM Chat API
```bash
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Meta-Llama-3.1-8B-Instruct",
    "messages": [{"role": "user", "content": "Hello! What is 2+2?"}],
    "max_tokens": 100
  }'
```

### Test 2: vLLM Embeddings API
```bash
curl http://localhost:11435/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "BAAI/bge-small-en-v1.5",
    "input": "Test embedding generation"
  }'
```

### Test 3: Tool Calling with RAG
1. Go to chat settings
2. Enable RAG tool
3. Upload a PDF document
4. Ask: "Can you summarize the document I uploaded?"
5. **Expected**: Model calls RAG tool → retrieves content → generates summary
6. **Success**: You see the full summary response (not stuck on "thinking")

## Troubleshooting

### Issue: "docker-compose: command not found"
```bash
# Install docker-compose
sudo apt-get install docker-compose-plugin
# Or use docker compose (v2 syntax)
docker compose up -d
```

### Issue: "CUDA out of memory"
```bash
# Edit docker-compose.yml, reduce GPU memory
nano docker-compose.yml
# Change: --gpu-memory-utilization 0.7 → 0.6
docker-compose restart vllm
```

### Issue: "Cannot download model from HuggingFace"
```bash
# Check you accepted the license
# https://huggingface.co/meta-llama/Meta-Llama-3.1-8B-Instruct

# Verify HF_TOKEN is set
docker-compose exec vllm env | grep HF

# Try downloading manually
docker exec -it vllm bash
huggingface-cli login --token $HUGGING_FACE_HUB_TOKEN
```

### Issue: "Port 11434 already in use"
```bash
# Check what's using it
sudo lsof -i :11434

# If it's Ollama, stop it
sudo systemctl stop ollama
```

### Issue: "vLLM container keeps restarting"
```bash
# Check logs
docker logs vllm

# Common issues:
# 1. GPU not accessible → check nvidia-container-toolkit
# 2. Out of memory → reduce --gpu-memory-utilization
# 3. Model download failed → check HF_TOKEN
```

## Performance Tuning

### For Better Speed
```yaml
# In docker-compose.yml
vllm:
  command: >
    ...existing flags...
    --max-num-seqs 8           # Increase concurrent sequences
    --gpu-memory-utilization 0.9  # Use more VRAM if available
```

### For Lower Memory
```yaml
vllm:
  command: >
    ...existing flags...
    --max-model-len 4096       # Reduce context length
    --gpu-memory-utilization 0.6  # Use less VRAM
```

### For Better Quality
```yaml
vllm:
  command: >
    ...existing flags...
    --tensor-parallel-size 1   # Single GPU
    --dtype float16            # Higher precision
```

## Expected Results

### Before (Ollama on Mac M2)
- ❌ Tool calls work but no final response
- ❌ User sees "thinking" indicator forever
- ⚠️ ~20 tokens/sec throughput

### After (vLLM on Linux RTX 3080)
- ✅ Tool calls work AND generate final response
- ✅ User sees complete answer with sources
- ✅ ~50-80 tokens/sec throughput
- ✅ Better concurrency (10+ users)
- ✅ Full OpenAI-compatible API

## Migration Complete!

Once all tests pass, you're done! Your chatbot now has:
- ✅ Working RAG with tool calling
- ✅ Hybrid search (semantic + keyword)
- ✅ Fast GPU inference
- ✅ Production-ready performance

## Rollback Plan

If something goes wrong, you can always switch back to Ollama:

```env
# .env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

Then install Ollama on Linux:
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b
ollama pull nomic-embed-text
```
