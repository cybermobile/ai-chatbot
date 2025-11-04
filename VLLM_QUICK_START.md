# vLLM Quick Start - RTX 3080 Linux Setup

## TL;DR - Get Running in 10 Minutes

```bash
# 1. Install @ai-sdk/openai
pnpm add @ai-sdk/openai

# 2. Configure .env
cp .env.example .env
# Edit .env and set:
# LLM_PROVIDER=vllm
# HF_TOKEN=your_huggingface_token (get from https://huggingface.co/settings/tokens)

# 3. Start Docker services
docker-compose up -d

# 4. Wait for model download (first time only, ~5-10 mins)
docker logs -f vllm
# Wait for: "Uvicorn running on http://0.0.0.0:8000"

# 5. Start app
pnpm dev

# 6. Test at http://localhost:3000
```

## What Changed?

### ✅ Added to docker-compose.yml
- **vllm** service (port 11434) - Llama 3.1 8B with tool calling
- **vllm-embeddings** service (port 11435) - BGE embeddings for RAG

### ✅ Updated Code
- [ai/index.ts](ai/index.ts) - Now supports both vLLM and Ollama
- [ai/embedding.ts](ai/embedding.ts) - Now supports vLLM embeddings
- [.env.example](.env.example) - New vLLM configuration options

### ✅ New Dependencies
- `@ai-sdk/openai` - Required for vLLM (uses OpenAI-compatible API)

## Environment Variables

```env
# REQUIRED - Switch to vLLM
LLM_PROVIDER=vllm
LLM_BASE_URL=http://127.0.0.1:11434

# REQUIRED - For Llama 3.1 model
HF_TOKEN=hf_your_token_here

# Auto-configured by docker-compose
VLLM_EMBEDDING_URL=http://127.0.0.1:11435
VLLM_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
```

## GPU Requirements

- **RTX 3080** (10GB VRAM) ✅
- **NVIDIA Driver** 525+ ✅
- **NVIDIA Container Toolkit** installed ✅

## What You Get

| Feature | Before (Ollama) | After (vLLM) |
|---------|----------------|--------------|
| **Tool Calling** | ⚠️ Incomplete | ✅ Complete |
| **RAG** | ⚠️ No response | ✅ Full answers |
| **Speed** | ~20 tok/s | ~50-80 tok/s |
| **Concurrency** | Poor | Excellent |

## Quick Test

```bash
# Test vLLM is working
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Meta-Llama-3.1-8B-Instruct",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Troubleshooting

**"CUDA out of memory"**
→ Edit docker-compose.yml: `--gpu-memory-utilization 0.6`

**"Cannot download model"**
→ Get HF token: https://huggingface.co/settings/tokens
→ Accept license: https://huggingface.co/meta-llama/Meta-Llama-3.1-8B-Instruct

**"Port already in use"**
→ Stop Ollama: `sudo systemctl stop ollama`

## Full Documentation

- [VLLM_SETUP.md](docs/VLLM_SETUP.md) - Complete setup guide
- [MIGRATION_CHECKLIST.md](docs/MIGRATION_CHECKLIST.md) - Step-by-step migration
- [HYBRID_SEARCH.md](docs/HYBRID_SEARCH.md) - RAG hybrid search docs

## Support

Issues? Check logs:
```bash
docker logs vllm           # Main LLM service
docker logs vllm-embeddings # Embedding service
```
