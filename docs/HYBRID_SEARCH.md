# Hybrid Search: Semantic + Keyword (BM25)

Your RAG system now uses **hybrid search**, combining the best of both worlds:

## What is Hybrid Search?

Traditional RAG systems use only **semantic search** (vector similarity). But this can miss exact keyword matches. Hybrid search combines:

1. **Semantic Search** (Vector/Embeddings)
   - Understands meaning and context
   - Good for: conceptual queries, synonyms, paraphrasing
   - Example: "How do I authenticate?" matches "user login process"

2. **Keyword Search** (BM25/Full-Text)
   - Exact keyword matching with BM25 ranking
   - Good for: technical terms, names, specific phrases
   - Example: "OAuth 2.0" matches exact occurrences of "OAuth 2.0"

## How It Works

```typescript
// Hybrid Score Formula
hybridScore = (alpha * semanticScore) + ((1 - alpha) * keywordScore)

// Default: alpha = 0.6
// = 60% semantic + 40% keyword
```

### Alpha Parameter

- `alpha = 1.0` → 100% semantic (pure vector search)
- `alpha = 0.6` → 60% semantic, 40% keyword (default, balanced)
- `alpha = 0.5` → 50/50 mix (equal weight)
- `alpha = 0.0` → 100% keyword (pure BM25)

## Implementation Details

### Database Query

```sql
WITH query AS (
    SELECT embedding::vector AS emb, 'user query'::text AS qtxt
)
SELECT
    content,
    -- Semantic score: cosine similarity
    (1 - (embedding <#> query.emb)) AS semantic_score,

    -- Keyword score: PostgreSQL full-text search (BM25-like)
    ts_rank(to_tsvector('english', content), plainto_tsquery('english', query.qtxt)) AS keyword_score,

    -- Hybrid score: weighted combination
    (alpha * (1 - (embedding <#> query.emb))) +
    ((1 - alpha) * ts_rank(to_tsvector('english', content), plainto_tsquery('english', query.qtxt))) AS hybrid_score
FROM embedding
JOIN resource ON embedding.resource_id = resource.id
WHERE resource.user_id = $1
ORDER BY hybrid_score DESC
LIMIT 5;
```

### Code Structure

**1. Vector Search Function** ([db/queries.ts:345](../db/queries.ts#L345))
```typescript
export async function findRelevantContent({
  userQuery,
  userId,
  topK = 5,
  alpha = 0.6, // Hybrid weight
}) {
  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(userQuery);

  // Perform hybrid search
  const results = await db
    .select({
      semanticScore: sql`1 - (cosine_distance(...))`,
      keywordScore: sql`ts_rank(to_tsvector(...), ...)`,
      hybridScore: sql`(alpha * semantic) + ((1-alpha) * keyword)`,
    })
    .orderBy(desc(sql`hybrid_score`))
    .limit(topK);

  return results;
}
```

**2. RAG Tool** ([ai/tools.ts:64](../ai/tools.ts#L64))
```typescript
export const ragTool = tool({
  parameters: z.object({
    query: z.string(),
    topK: z.number().optional().default(5),
    alpha: z.number().optional().default(0.6), // NEW!
  }),
  execute: async ({ query, topK, alpha }) => {
    const results = await findRelevantContent({
      userQuery: query,
      userId: session.user.id,
      topK,
      alpha, // Pass through to database
    });

    return {
      results: results.map(r => ({
        content: r.content,
        hybridScore: r.similarity,
        semanticScore: r.semanticScore,
        keywordScore: r.keywordScore,
        source: r.resourceName,
      })),
    };
  },
});
```

## Performance Comparison

### Pure Semantic (alpha = 1.0)
✅ Good for: Natural language queries, paraphrasing
❌ Bad for: Exact technical terms, acronyms, specific names

**Example Query:** "How do I reset my password?"
- Matches: "user account recovery", "credential renewal"
- Misses: Exact string "password reset"

### Pure Keyword (alpha = 0.0)
✅ Good for: Exact matches, technical terms, code snippets
❌ Bad for: Synonyms, conceptual queries, paraphrasing

**Example Query:** "OAuth authentication"
- Matches: Exact "OAuth" occurrences
- Misses: "user login", "authorization flow"

### Hybrid (alpha = 0.6) - RECOMMENDED
✅ Best of both worlds
✅ Robust to query variations
✅ Good for most use cases

**Example Query:** "How does OAuth work?"
- Matches: Both "OAuth" keyword + conceptual meaning
- Ranks higher: Results with both semantic relevance AND keyword matches

## Tuning Guidelines

### When to adjust alpha:

**Increase alpha (more semantic):**
- Documents are well-written with varied vocabulary
- Users ask conceptual questions
- Content has many synonyms
- Example: Marketing materials, blog posts, FAQs

**Decrease alpha (more keyword):**
- Technical documentation with specific terms
- Code repositories
- API references
- Example: Technical docs, code comments, API specs

**Keep default (0.6):**
- General knowledge base
- Mixed content types
- Varied query patterns

## Advanced: Per-Query Alpha

You can let the LLM choose alpha based on the query:

```typescript
// In system prompt (ai/prompts.ts)
**RAG Tool:**
- For technical/specific queries: use alpha=0.4 (more keyword-focused)
- For conceptual/general queries: use alpha=0.8 (more semantic)
- For mixed queries: use alpha=0.6 (default)
```

## PostgreSQL Full-Text Search Features

Our implementation uses PostgreSQL's built-in full-text search:

- **`to_tsvector('english', text)`** - Tokenizes and stems text
  - Removes stop words (the, a, is, etc.)
  - Applies English stemming (running → run)
  - Creates searchable index

- **`plainto_tsquery('english', query)`** - Parses search query
  - Handles multi-word queries
  - Applies same stemming as tsvector

- **`ts_rank(...)`** - BM25-like ranking
  - Considers term frequency
  - Document length normalization
  - Position-based weighting

## Adding Full-Text Index (Optional)

For even faster keyword search, add a GIN index:

```sql
-- Create GIN index on content
CREATE INDEX idx_embedding_content_fts
ON embedding
USING GIN (to_tsvector('english', content));
```

This will speed up keyword searches on large datasets (10k+ documents).

## Comparison to Python Implementation

Your Python code used:
```python
semantic_score = 1 - cosine_distance
keyword_score = ts_rank_cd(...)  # More sophisticated ranking
hybrid_score = (1 - alpha) * semantic + alpha * keyword
```

Our TypeScript implementation:
```typescript
semanticScore = 1 - cosineDistance
keywordScore = ts_rank(...)  # Simpler but still effective
hybridScore = alpha * semantic + (1 - alpha) * keyword
```

**Differences:**
- We use `ts_rank` instead of `ts_rank_cd` (simpler, faster)
- We swapped alpha meaning (Python: alpha=semantic, ours: same)
- Same core algorithm, just TypeScript + Drizzle ORM

## Monitoring & Debugging

Check the logs to see how hybrid search performs:

```bash
# Watch logs
pnpm dev

# Look for:
[DB] Hybrid search found 5 relevant chunks for query: "OAuth 2.0"
[DB] Using alpha = 0.6 (semantic weight)
[RAG] Hybrid search found 5 chunks for: "OAuth 2.0"
```

## Future Enhancements

1. **Reranking** - Use a cross-encoder model to rerank results
2. **Query expansion** - Generate multiple query variations
3. **Metadata filtering** - Filter by tags, dates, file types
4. **Semantic caching** - Cache embeddings for common queries
5. **A/B testing** - Compare different alpha values

## References

- PostgreSQL Full-Text Search: https://www.postgresql.org/docs/current/textsearch.html
- BM25 Algorithm: https://en.wikipedia.org/wiki/Okapi_BM25
- Hybrid Search Paper: https://arxiv.org/abs/2104.08663
- pgvector Documentation: https://github.com/pgvector/pgvector
