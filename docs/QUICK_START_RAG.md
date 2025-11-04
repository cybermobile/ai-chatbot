# Quick Start: RAG in 5 Minutes

Get RAG working quickly for local development.

## 1. Start Services (30 seconds)

```bash
# Start Docker services
docker-compose up -d

# Verify services are running
docker-compose ps
```

## 2. Setup Database (1 minute)

```bash
# Enable pgvector extension
docker exec -it chatbot-db-1 psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
pnpm db:migrate
```

## 3. Setup Ollama (2 minutes)

```bash
# Pull embedding model (768 dimensions, ~300MB)
ollama pull nomic-embed-text:latest

# Verify model is available
ollama list
```

## 4. Configure Environment (1 minute)

Update your `.env` file:

```env
POSTGRES_URL=postgresql://postgres:postgres@localhost:5434/postgres
MINIO_URL=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=password
MINIO_BUCKET=chatbot-files
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

## 5. Create MinIO Bucket (30 seconds)

```bash
# Using MinIO Console
open http://localhost:9001

# Login: minio / password
# Create bucket: chatbot-files
```

## 6. Test RAG (30 seconds)

1. Start your app: `pnpm dev`
2. Go to http://localhost:3000
3. Enable the **RAG** toggle in the chat
4. Upload a document via the file upload API
5. Ask questions about your document!

## Done! 🎉

Your RAG system is now ready to use.

## What Just Happened?

- ✅ PostgreSQL with pgvector for vector storage
- ✅ MinIO for file storage
- ✅ Ollama with nomic-embed-text for embeddings
- ✅ Vector search with HNSW index

## Next: Upload Your First Document

See [RAG_SETUP.md](./RAG_SETUP.md) for details on uploading documents.
