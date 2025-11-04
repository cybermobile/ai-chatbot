# Configuration Guide

## Environment Variables

This document describes all configurable environment variables for the AI Chatbot application.

### Required Configuration

#### Authentication
```bash
# Generate with: openssl rand -base64 32
AUTH_SECRET=your_secret_here
NEXTAUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=http://localhost:3000
```

#### Database
```bash
# PostgreSQL connection string
POSTGRES_URL=postgres://postgres:postgres@localhost:5434/postgres
```

#### Object Storage (MinIO)
```bash
MINIO_URL=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=password
```

### Optional Configuration

#### Ollama (AI Models)

**Base URL:**
```bash
# Default: http://127.0.0.1:11434
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

**Embedding Model for RAG/Vector Search:**
```bash
# Default: nomic-embed-text
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

**Available Embedding Models:**
- `nomic-embed-text` (137M params, recommended for most use cases)
- `mxbai-embed-large` (335M params, higher quality but slower)
- `all-minilm` (33M params, faster but lower quality)
- Any other Ollama-compatible embedding model

To use a different model, first pull it with Ollama:
```bash
ollama pull mxbai-embed-large
```

Then update your `.env`:
```bash
OLLAMA_EMBEDDING_MODEL=mxbai-embed-large
```

---

## Docker Setup

### Starting Services

Start PostgreSQL (with pgvector) and MinIO:
```bash
docker compose up -d
```

### Database Setup

Install the vector extension (only needed once):
```bash
docker exec chatbot-db-1 psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Run migrations:
```bash
npm run generate:db
npm run migrate:db
```

### Stopping Services

```bash
docker compose down
```

---

## Ollama Model Management

### List Available Models
```bash
ollama list
```

### Pull New Models

**Chat Models:**
```bash
ollama pull llama3.2:latest
ollama pull llama3.2:1b
ollama pull llama2:latest
ollama pull mistral:latest
```

**Embedding Models:**
```bash
ollama pull nomic-embed-text
ollama pull mxbai-embed-large
ollama pull all-minilm
```

### Model Selection

The app allows users to select any chat model you have installed in Ollama. The embedding model is configured via the `OLLAMA_EMBEDDING_MODEL` environment variable.

---

## Development

### Install Dependencies
```bash
npm install --legacy-peer-deps
```

### Run Development Server
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

---

## Features Configuration

### RAG (Retrieval-Augmented Generation)

RAG is automatically enabled when:
1. A user uploads PDF files
2. Files are selected from the knowledge base
3. The user asks questions about the documents

**Embedding Process:**
- PDFs are parsed and split into chunks (1000 chars, 200 overlap)
- Each chunk is embedded using the configured embedding model
- Embeddings are stored in PostgreSQL with pgvector
- Semantic search retrieves relevant chunks for user queries

**To disable RAG:**
Simply don't select any files from the knowledge base.

### Document Tools

The chatbot has built-in document creation and editing tools:
- `createDocument` - Creates new documents
- `updateDocument` - Modifies existing documents
- `requestSuggestions` - Generates improvement suggestions

These tools use the currently selected chat model.

---

## Troubleshooting

### "Model not found" Error

**Problem:** `model 'xxx' not found`

**Solution:**
```bash
ollama pull model-name
```

### Port Already in Use

**Problem:** Port 3000 is in use

**Solution:**
```bash
# Find and kill the process
lsof -i :3000
kill -9 <PID>
```

Or the app will automatically use the next available port (e.g., 3001).

### Database Connection Issues

**Problem:** Cannot connect to PostgreSQL

**Solution:**
1. Check Docker containers are running: `docker compose ps`
2. Verify connection string in `.env`
3. Ensure vector extension is installed (see Database Setup)

### MinIO Upload Failures

**Problem:** File uploads fail

**Solution:**
1. Check MinIO is running: `docker compose ps`
2. Verify credentials in `.env` match docker-compose.yml
3. Access MinIO console: `http://localhost:9001` (minio/password)

---

## Production Deployment

### Environment Variables

For production, ensure:
1. Use a strong `AUTH_SECRET`
2. Use a production-grade PostgreSQL instance
3. Use a production-grade object storage (S3, MinIO, etc.)
4. Set proper CORS and security headers
5. Use HTTPS for `NEXTAUTH_URL`

### Ollama Hosting

For production, you'll need to host Ollama:
- Self-hosted Ollama server
- Cloud GPU instances (AWS, GCP, Azure)
- Ollama Cloud (when available)

Update `OLLAMA_BASE_URL` to point to your production Ollama instance.

---

## Best Practices

1. **Model Selection:** Start with smaller models (llama3.2:1b) for testing, then scale up
2. **Embedding Model:** `nomic-embed-text` is recommended for balanced performance
3. **File Size Limits:** Current limit is 3MB per PDF, adjust in `app/api/files/upload/route.ts`
4. **Chunk Size:** Default 1000 chars with 200 overlap, tune based on your use case
5. **Database Backups:** Regularly backup your PostgreSQL database
6. **API Keys:** Rotate your `AUTH_SECRET` periodically

---

## Support

For issues or questions:
1. Check the logs: `tail -f /tmp/nextjs.log`
2. Check Docker logs: `docker compose logs -f`
3. Review the migration summary: `AI_SDK_V5_MIGRATION_SUMMARY.md`
