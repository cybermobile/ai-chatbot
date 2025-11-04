# Changelog: vLLM Integration

## Summary

Added support for vLLM as an alternative to Ollama for better tool calling performance on Linux with NVIDIA GPUs.

## What's New

### ✅ Docker Compose Services
Added two new services to [docker-compose.yml](docker-compose.yml):

1. **vllm** - Main LLM inference (Llama 3.1 8B with tool calling)
   - Port: 11434 (replaces Ollama port)
   - GPU: RTX 3080 with 70% memory allocation
   - Features: Tool calling, streaming, OpenAI-compatible API

2. **vllm-embeddings** - Embedding generation for RAG
   - Port: 11435
   - Model: BAAI/bge-small-en-v1.5 (384 dimensions)
   - GPU: RTX 3080 with 30% memory allocation

### ✅ Code Changes

#### [ai/index.ts](ai/index.ts)
- Added support for both vLLM and Ollama providers
- Detects provider via `LLM_PROVIDER` environment variable
- Uses `@ai-sdk/openai` for vLLM (OpenAI-compatible API)
- Falls back to `ollama-ai-provider-v2` for Ollama

```typescript
export const customModel = (apiIdentifier: string) => {
  if (LLM_PROVIDER === 'vllm') {
    return openai(apiIdentifier, {
      baseURL: `${LLM_BASE_URL}/v1`,
      apiKey: 'vllm',
    });
  }
  return ollama(apiIdentifier);
};
```

#### [ai/embedding.ts](ai/embedding.ts)
- Added support for vLLM embeddings
- Uses OpenAI provider for vLLM
- Falls back to Ollama embeddings

```typescript
export const embeddingModel = LLM_PROVIDER === 'vllm'
  ? openai.textEmbeddingModel(VLLM_EMBEDDING_MODEL, {
      baseURL: `${VLLM_EMBEDDING_URL}/v1`,
      apiKey: 'vllm',
    })
  : ollama.textEmbeddingModel(OLLAMA_EMBEDDING_MODEL);
```

#### [.env.example](.env.example)
- Added vLLM configuration options
- Added provider selection (`LLM_PROVIDER`)
- Added HuggingFace token for gated models
- Kept Ollama configuration for backwards compatibility

### ✅ Documentation

Created comprehensive guides:
- **[VLLM_QUICK_START.md](VLLM_QUICK_START.md)** - 10-minute quick start
- **[docs/VLLM_SETUP.md](docs/VLLM_SETUP.md)** - Complete setup guide
- **[docs/MIGRATION_CHECKLIST.md](docs/MIGRATION_CHECKLIST.md)** - Mac to Linux migration steps

## Why vLLM?

### Problem with Ollama
- Tool calling works but models don't generate final text responses
- User stuck on "thinking" indicator after tool execution
- Documented Ollama limitation in streaming mode

### Solution: vLLM
- ✅ Complete tool calling: tool execution → final answer
- ✅ 2-3x faster throughput (50-80 vs 20 tokens/sec)
- ✅ Better concurrency (10+ users vs 1-2)
- ✅ OpenAI-compatible API
- ✅ Native NVIDIA GPU support

## Dependencies

### New Required Package
```json
{
  "dependencies": {
    "@ai-sdk/openai": "^1.0.0"
  }
}
```

**Install with:**
```bash
pnpm add @ai-sdk/openai
```

## Configuration

### For Linux with RTX 3080 (vLLM)
```env
LLM_PROVIDER=vllm
LLM_BASE_URL=http://127.0.0.1:11434
VLLM_EMBEDDING_URL=http://127.0.0.1:11435
VLLM_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
HF_TOKEN=hf_your_token_here
```

### For Mac with Apple Silicon (Ollama)
```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

## Backwards Compatibility

- ✅ Ollama still works (set `LLM_PROVIDER=ollama`)
- ✅ Existing code unchanged (provider detection automatic)
- ✅ No breaking changes to API

## Migration Path

1. **Mac users**: Keep using Ollama (no changes needed)
2. **Linux users with GPU**: Switch to vLLM for better performance
3. **Production**: Recommend vLLM for reliability

## System Requirements

### vLLM (Linux only)
- Ubuntu 20.04+
- NVIDIA GPU (RTX 3080 or better)
- 10GB+ VRAM for Llama 3.1 8B
- NVIDIA Driver 525+
- NVIDIA Container Toolkit
- Docker & Docker Compose

### Ollama (Mac or Linux)
- macOS 11+ with Apple Silicon, or
- Linux with CPU/GPU
- No special requirements

## Performance Comparison

| Metric | Ollama (Mac M2) | vLLM (RTX 3080) |
|--------|-----------------|-----------------|
| Tool calling | ⚠️ Incomplete | ✅ Complete |
| Throughput | ~20 tok/s | ~50-80 tok/s |
| Concurrency | 1-2 users | 10+ users |
| Memory | Shared 8-16GB | Dedicated 10GB VRAM |
| Setup | Easy | Moderate |
| Cost | $0 (local) | $0 (local) |

## Known Issues

### vLLM
- ❌ Not supported on macOS
- ❌ Requires NVIDIA GPU (no AMD/Intel support yet)
- ⚠️ First model download takes 5-10 minutes

### Ollama
- ⚠️ Tool calling generates incomplete responses
- ⚠️ Lower throughput than vLLM
- ✅ Works on Mac, easier setup

## Testing

### Verify vLLM Installation
```bash
# Check services are running
docker ps | grep vllm

# Test chat API
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "meta-llama/Meta-Llama-3.1-8B-Instruct", "messages": [{"role": "user", "content": "Hi"}]}'

# Test embeddings API
curl http://localhost:11435/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "BAAI/bge-small-en-v1.5", "input": "test"}'
```

### Verify RAG Tool Calling
1. Enable RAG tool in chat settings
2. Upload a document
3. Ask: "What's in the document?"
4. ✅ Should get complete answer (not stuck on "thinking")

## Rollback

If issues occur, switch back to Ollama:

```env
LLM_PROVIDER=ollama
```

Restart your application - no code changes needed.

## Future Work

- [ ] Add support for other vLLM models (Mistral, Qwen, etc.)
- [ ] Add quantization support (GPTQ, AWQ) for larger models
- [ ] Add multi-GPU support for bigger models
- [ ] Add model hot-swapping
- [ ] Add performance monitoring dashboard

## Credits

- vLLM: https://github.com/vllm-project/vllm
- AI SDK: https://sdk.vercel.ai
- Ollama: https://ollama.com

## Support

Questions or issues?
- Check [VLLM_SETUP.md](docs/VLLM_SETUP.md) for detailed setup
- Check [MIGRATION_CHECKLIST.md](docs/MIGRATION_CHECKLIST.md) for migration steps
- Open an issue on GitHub
