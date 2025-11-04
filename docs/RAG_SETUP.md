# RAG (Retrieval Augmented Generation) Setup Guide

This guide will help you set up RAG functionality to allow your chatbot to search through uploaded documents.

## Prerequisites

1. Docker and Docker Compose installed
2. Ollama installed locally
3. PostgreSQL with pgvector extension (included in TimescaleDB)

## Step 1: Start Docker Services

Start all required services (PostgreSQL, MinIO, SearXNG):

```bash
docker-compose up -d
```

This will start:
- **PostgreSQL (TimescaleDB)** on port 5434 (includes pgvector)
- **MinIO** on ports 9000 (API) and 9001 (Console)
- **SearXNG** on port 8080

## Step 2: Configure Environment Variables

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

Update these values in your `.env`:

```env
# Generate a random secret
AUTH_SECRET=your-random-secret-here

# Database (for docker-compose)
POSTGRES_URL=postgresql://postgres:postgres@localhost:5434/postgres

# MinIO (for docker-compose)
MINIO_URL=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=password
MINIO_BUCKET=chatbot-files

# Ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Web Search
SEARXNG_URL=http://localhost:8080
```

## Step 3: Enable pgvector Extension

Connect to your PostgreSQL database:

```bash
docker exec -it chatbot-db-1 psql -U postgres
```

Enable the pgvector extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

## Step 4: Run Database Migrations

Apply the database schema:

```bash
pnpm db:migrate
```

This will create all necessary tables including:
- `resource` - Stores uploaded files metadata
- `embedding` - Stores vector embeddings with HNSW index

## Step 5: Pull Ollama Embedding Model

Pull the embedding model (768 dimensions):

```bash
ollama pull nomic-embed-text:latest
```

## Step 6: Create MinIO Bucket

1. Open MinIO Console at http://localhost:9001
2. Login with credentials:
   - Username: `minio`
   - Password: `password`
3. Create a bucket named `chatbot-files`
4. Set bucket policy to allow uploads (or use access keys)

## Step 7: Upload Documents

Currently, you need to upload documents programmatically using the file upload API. A UI for uploading documents is in development.

### Example: Upload a PDF

```typescript
// Upload file to MinIO
const formData = new FormData();
formData.append('file', pdfFile);

const response = await fetch('/api/files/upload', {
  method: 'POST',
  body: formData,
});

const { resourceId } = await response.json();
```

The upload API will:
1. Upload file to MinIO
2. Extract text content
3. Split text into chunks
4. Generate embeddings using `nomic-embed-text`
5. Store embeddings in PostgreSQL with vector index

## Step 8: Test RAG

Enable the RAG tool in the chat interface and ask questions about your uploaded documents:

```
User: What is mentioned in the document about X?
```

The RAG tool will:
1. Generate embedding for your question
2. Search for similar chunks using cosine similarity
3. Return top 5 most relevant chunks
4. The LLM uses these chunks to answer your question

## Architecture

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Chat Interface (Web UI)                │
│  - Enable RAG tool toggle               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  RAG Tool (ai/tools.ts)                 │
│  - Receives query from LLM              │
│  - Generates embedding                  │
│  - Searches vector DB                   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Vector Search (db/queries.ts)          │
│  - findRelevantContent()                │
│  - Cosine similarity search             │
│  - Returns top K chunks                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  PostgreSQL + pgvector                  │
│  - embedding table (768 dimensions)     │
│  - HNSW index for fast search           │
└─────────────────────────────────────────┘
```

## Troubleshooting

### Error: "relation 'embedding' does not exist"
Run migrations: `pnpm db:migrate`

### Error: "type 'vector' does not exist"
Enable pgvector extension in PostgreSQL:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Error: "No documents found in your knowledge base"
Upload documents using the file upload API first.

### Slow vector search
The HNSW index should make searches fast. If slow:
1. Check index exists: `\d+ embedding` in psql
2. Ensure vector dimensions match: 768 for `nomic-embed-text`

### Embeddings not generating
1. Ensure Ollama is running: `ollama list`
2. Ensure model is pulled: `ollama pull nomic-embed-text:latest`
3. Check Ollama URL in .env: `OLLAMA_BASE_URL=http://127.0.0.1:11434`

## Next Steps

1. Build a UI for uploading documents (drag & drop)
2. Add support for more file types (DOCX, TXT, Markdown)
3. Display which documents were used in the answer
4. Allow users to delete uploaded documents
5. Show similarity scores in the UI
6. Add re-ranking for better results

## Performance Tips

1. **Chunk size**: Default is 1000 chars with 200 overlap. Adjust in `ai/embedding.ts` if needed.
2. **Top K**: Default is 5 chunks. Increase if answers lack context.
3. **HNSW index**: Already configured for fast approximate nearest neighbor search.
4. **Model choice**: `nomic-embed-text` is fast and accurate. For better quality, try `mxbai-embed-large` (1024 dims - requires schema update).

## Alternative Embedding Models

If you want to use a different model:

1. **mxbai-embed-large** (1024 dimensions):
   ```bash
   ollama pull mxbai-embed-large
   ```
   Update `ai/embedding.ts`:
   ```typescript
   export const embeddingModel = ollama.textEmbeddingModel('mxbai-embed-large');
   ```
   Update `db/schema.ts`:
   ```typescript
   embedding: vector('embedding', { dimensions: 1024 }),
   ```
   Run migration to update vector dimensions.

2. **Other models**: Check [Ollama library](https://ollama.com/library) for embedding models.
