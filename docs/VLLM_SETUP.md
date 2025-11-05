# vLLM Setup Guide for Arch Linux with RTX 3080

This guide will help you set up vLLM for better tool calling performance compared to Ollama.

## Prerequisites

### 1. Arch Linux System Requirements
- Arch Linux (up-to-date)
- RTX 3080 GPU (10GB VRAM)
- NVIDIA Driver 525+ installed
- Docker & Docker Compose installed
- NVIDIA Container Toolkit installed

### 2. Install Required Packages

```bash
# Install NVIDIA drivers (if not already installed)
sudo pacman -S nvidia nvidia-utils

# Install Docker and Docker Compose
sudo pacman -S docker docker-compose

# Enable and start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Add your user to docker group (to run docker without sudo)
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect
```

### 3. Install NVIDIA Container Toolkit (if not already installed)

```bash
# Install NVIDIA Container Toolkit from AUR
# Using yay (install yay first if you don't have it: sudo pacman -S yay)
yay -S nvidia-container-toolkit

# Alternatively, using paru
# paru -S nvidia-container-toolkit

# Configure Docker to use NVIDIA runtime
sudo nvidia-ctk runtime configure --runtime=docker

# Restart Docker
sudo systemctl restart docker

# Verify GPU is accessible
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
```

## Setup Steps

### 1. Install Dependencies

```bash
cd /path/to/ai-chatbot

# Install @ai-sdk/openai package
pnpm add @ai-sdk/openai
```

### 2. Configure Environment Variables

Create or update `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
# LLM Provider (vLLM for Linux with GPU)
LLM_PROVIDER=vllm
LLM_BASE_URL=http://127.0.0.1:11434

# vLLM Embedding Server
VLLM_EMBEDDING_URL=http://127.0.0.1:11435
VLLM_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5

# Optional: HuggingFace token for gated models (Llama requires acceptance of license)
# Get token from: https://huggingface.co/settings/tokens
HF_TOKEN=your_huggingface_token_here
```

**Important**: If you want to use Llama 3.1, you need to:
1. Create a HuggingFace account at https://huggingface.co
2. Accept the Llama license at https://huggingface.co/meta-llama/Meta-Llama-3.1-8B-Instruct
3. Generate an access token at https://huggingface.co/settings/tokens
4. Add it to your `.env` as `HF_TOKEN=hf_...`

### 3. Start Services

```bash
# Start all services including vLLM
docker-compose up -d

# Check vLLM is running
docker logs -f vllm

# You should see:
# INFO:     Uvicorn running on http://0.0.0.0:8000
# INFO:     Available routes:
# INFO:       GET /v1/models
# INFO:       POST /v1/chat/completions
```

### 4. Verify vLLM is Working

```bash
# Test chat completions endpoint
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Meta-Llama-3.1-8B-Instruct",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 50
  }'

# Test embeddings endpoint
curl http://localhost:11435/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "BAAI/bge-small-en-v1.5",
    "input": "Hello world"
  }'
```

### 5. Start Your Application

```bash
pnpm dev
```

## Docker Compose Services

Your `docker-compose.yml` now includes:

### 1. **vllm** (Main LLM inference)
- **Port**: 11434 (same as Ollama for easy migration)
- **Model**: Llama 3.1 8B Instruct
- **GPU Memory**: 70% (~7GB for RTX 3080)
- **Features**: Tool calling with proper streaming

### 2. **vllm-embeddings** (Embedding generation)
- **Port**: 11435
- **Model**: BAAI/bge-small-en-v1.5 (384 dimensions)
- **GPU Memory**: 30% (~3GB)
- **Purpose**: RAG document embeddings

Both services share your RTX 3080 GPU simultaneously.

## Model Options

You can change models by editing `docker-compose.yml`:

### Alternative Chat Models

```yaml
# Mistral NeMo (12B - better reasoning, needs ~8GB)
command: >
  --model mistralai/Mistral-Nemo-Instruct-2407
  --tool-call-parser mistral
  --chat-template /vllm-workspace/examples/tool_chat_template_mistral_parallel.jinja
  ...

# Qwen 2.5 7B (multilingual, good performance)
command: >
  --model Qwen/Qwen2.5-7B-Instruct
  --tool-call-parser qwen
  ...
```

### Alternative Embedding Models

```yaml
# nomic-embed-text (768 dims, same as Ollama)
command: >
  --model nomic-ai/nomic-embed-text-v1.5
  ...

# BGE Large (1024 dims, better quality but slower)
command: >
  --model BAAI/bge-large-en-v1.5
  ...
```

## Memory Management

Your RTX 3080 has 10GB VRAM. Current allocation:
- **vLLM chat**: 7GB (70% utilization for 8B model)
- **vLLM embeddings**: 3GB (30% utilization)
- **Total**: 10GB ✅

If you want to run larger models:

### Option 1: Use quantized models
```yaml
--model TheBloke/Llama-2-13B-chat-GPTQ  # 13B model in 4-bit
--quantization gptq
--gpu-memory-utilization 0.9
```

### Option 2: Run embeddings on CPU
```yaml
# Remove GPU from vllm-embeddings service
deploy:
  resources:
    limits:
      cpus: '2'
```

## Troubleshooting

### Issue: "CUDA out of memory"
**Solution**: Reduce `--gpu-memory-utilization` or use a smaller model

```yaml
--gpu-memory-utilization 0.6  # Reduce from 0.7 to 0.6
```

### Issue: "Model download is slow"
**Solution**: Models are cached in `~/.cache/huggingface`. First run takes time.

```bash
# Check download progress
docker logs -f vllm
```

### Issue: "Tool calling not working"
**Solution**: Verify you're using a tool-compatible model and template

```bash
# Check vLLM logs for tool call parsing
docker logs vllm | grep -i tool
```

### Issue: "Permission denied for GPU"
**Solution**: Verify NVIDIA runtime is configured

```bash
# Test GPU access
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi

# If fails, reinstall NVIDIA Container Toolkit
yay -S nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Ensure you're in the docker group
groups | grep docker
# If not, add yourself and log out/in
sudo usermod -aG docker $USER
```

## Performance Comparison

| Metric | Ollama (Mac M2) | vLLM (RTX 3080) |
|--------|-----------------|-----------------|
| **Tool calling** | ⚠️ Incomplete responses | ✅ Complete responses |
| **Throughput** | ~20 tokens/sec | ~50-80 tokens/sec |
| **Concurrency** | Poor (1-2 users) | Excellent (10+ users) |
| **Memory** | Shared CPU/GPU | Dedicated VRAM |
| **Streaming** | ✅ Works | ✅ Works better |

## Switching Back to Ollama

If you need to switch back (e.g., on Mac):

```env
# .env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

The code automatically detects the provider and switches accordingly.

## Additional Resources

- vLLM Documentation: https://docs.vllm.ai
- Supported Models: https://docs.vllm.ai/en/latest/models/supported_models.html
- Tool Calling Guide: https://docs.vllm.ai/en/stable/features/tool_calling.html
- HuggingFace Models: https://huggingface.co/models

## Next Steps

1. ✅ Start Docker services: `docker-compose up -d`
2. ✅ Verify vLLM is running: `docker logs vllm`
3. ✅ Install dependencies: `pnpm add @ai-sdk/openai`
4. ✅ Configure `.env` with `LLM_PROVIDER=vllm`
5. ✅ Start your app: `pnpm dev`
6. ✅ Test RAG with tool calling - should work perfectly now!
