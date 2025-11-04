# Tool Calling Implementation Guide

This guide explains how to implement and use tool calling in your AI SDK v4 chatbot.

## ⚠️ IMPORTANT: Model Compatibility

**Not all models support tool calling!** When using Ollama, only certain models have tool calling capabilities:

### Ollama Models with Tool Support:
- ✅ **`mistral:latest` (7B)** - **BEST CHOICE** - Most reliable tool support
- ✅ **`llama3.1:8b`** - **RECOMMENDED** - Excellent tool support
- ✅ `mistral-nemo:latest` - Good tool support
- ✅ `firefunction-v2:latest` - Specialized for function calling
- ✅ `qwen2.5:latest` (NOT qwen3) - Good tool support
- ✅ `command-r:latest` - Good tool support
- ✅ `command-r-plus:latest` - Excellent tool support

### Models WITHOUT Tool Support (REMOVED FROM THIS PROJECT):
- ❌ `llama2:latest` - No tool support
- ❌ `llama3.2:3b` - **BROKEN** - Returns empty responses with tools enabled
- ❌ `llama3.2:1b` - Too small, no proper tool support
- ❌ `qwen3:8b` - Incomplete/unreliable tool support
- ❌ `gemma:latest` - No tool support
- ❌ `phi:latest` - No tool support
- ❌ Most older/smaller models

**If your model doesn't support tools, the assistant will return empty responses** because it tries to use the tool calling format but fails.

### Recommended Setup:
1. **Primary:** Use `mistral:latest` for best tool calling reliability
2. **Alternative:** Use `llama3.1:8b` for Llama-based tool support
3. **Always disable all tools** when testing non-compatible models

## Overview

Tool calling allows the AI model to execute functions like web search or RAG search when it determines they're needed. You can now toggle these features on/off in the UI.

## How It Works

1. **User toggles tools** in the UI (via ToolToggle component)
2. **Tool config is sent** to the API route with each message
3. **API enables tools** based on the config using `getEnabledTools()`
4. **Model decides** when to call tools based on user questions
5. **Tools execute** and return results to the model
6. **Model uses results** to generate final response

## Files Modified

- `ai/tools.ts` - Tool definitions
- `app/api/chat/route.ts` - API route with tool support
- `components/custom/chat.tsx` - Added tool config state
- `components/custom/tool-toggle.tsx` - UI for toggling tools

## Implementing Tool Logic

### 1. Web Search Tool

Update `ai/tools.ts` to implement actual web search:

```typescript
export const webSearchTool = tool({
  description: 'Search the web for current information...',
  parameters: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }) => {
    // Option 1: Use Brave Search API
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'X-Subscription-Token': process.env.BRAVE_API_KEY!,
        },
      }
    );
    const data = await response.json();

    return {
      results: data.web?.results?.slice(0, 5).map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
      })) || [],
      query,
    };

    // Option 2: Use Tavily API
    // const tavily = new TavilySearchAPIClient({ apiKey: process.env.TAVILY_API_KEY });
    // const results = await tavily.search(query, { maxResults: 5 });
    // return { results, query };

    // Option 3: Use SerpAPI, Serper.dev, etc.
  },
});
```

### 2. RAG Tool

Implement RAG using your existing embedding setup:

```typescript
import { generateEmbedding } from '@/ai/embedding';
import { db } from '@/db/queries'; // or your vector DB client

export const ragTool = tool({
  description: 'Search through your knowledge base...',
  parameters: z.object({
    query: z.string().describe('The question to search for'),
    topK: z.number().optional().default(5),
  }),
  execute: async ({ query, topK }) => {
    // 1. Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // 2. Query your vector database
    // Example with Postgres + pgvector:
    const results = await db.execute(sql`
      SELECT content, metadata, 1 - (embedding <=> ${queryEmbedding}) as similarity
      FROM document_chunks
      ORDER BY embedding <=> ${queryEmbedding}
      LIMIT ${topK}
    `);

    // 3. Return relevant chunks
    return {
      results: results.rows.map(row => ({
        content: row.content,
        similarity: row.similarity,
        source: row.metadata?.source || 'unknown',
      })),
      query,
    };
  },
});
```

## Environment Variables

Add these to your `.env.local`:

```bash
# For web search (choose one)
BRAVE_API_KEY=your_brave_api_key
TAVILY_API_KEY=your_tavily_api_key
SERPER_API_KEY=your_serper_api_key

# For RAG (if using external vector DB)
PINECONE_API_KEY=your_pinecone_key
# or
QDRANT_URL=your_qdrant_url
```

## Usage Example

1. Start your app: `npm run dev`
2. Click "Tools" button above the input
3. Toggle on "Web Search" and/or "RAG Search"
4. Ask a question that requires those tools:
   - Web Search: "What's the latest news about AI?"
   - RAG: "What does the documentation say about authentication?"

The model will automatically call the appropriate tool when needed.

## Tool Response Format

The AI SDK automatically handles:
- **Tool invocations** - When the model decides to call a tool
- **Tool results** - The data returned by your tool
- **Final response** - The model's answer using tool results

You can see tool calls in the stream by accessing `streamingData`:

```typescript
const { data: streamingData } = useChat({...});

// streamingData contains tool invocation and result information
```

## Adding Custom Tools

To add a new tool:

1. **Define the tool** in `ai/tools.ts`:
```typescript
export const myCustomTool = tool({
  description: 'Does something useful',
  parameters: z.object({
    param1: z.string(),
  }),
  execute: async ({ param1 }) => {
    // Your logic here
    return { result: 'something' };
  },
});
```

2. **Add to allTools** object:
```typescript
export const allTools = {
  webSearch: webSearchTool,
  rag: ragTool,
  myCustom: myCustomTool, // Add here
};
```

3. **Update ToolConfig** type:
```typescript
export type ToolConfig = {
  webSearch?: boolean;
  rag?: boolean;
  myCustom?: boolean; // Add here
};
```

4. **Add UI toggle** in `tool-toggle.tsx`:
```typescript
<ToolItem
  icon={MyIcon}
  label="My Custom Tool"
  description="Description here"
  enabled={toolConfig.myCustom || false}
  onToggle={() => toggleTool('myCustom')}
/>
```

## Debugging

Enable console logs to see tool execution:

```typescript
// In route.ts
console.log('[Tool Call]', toolCalls);
console.log('[Tool Results]', toolResults);
```

Check the browser console and terminal for tool-related logs.

## Best Practices

1. **Keep tools focused** - Each tool should do one thing well
2. **Validate inputs** - Use Zod schemas to validate parameters
3. **Handle errors** - Return error messages in tool results
4. **Limit results** - Don't return massive data sets
5. **Add timeouts** - Tools should fail fast if external APIs are slow
6. **Cache when possible** - Cache search results to save API calls

## Next Steps

- Implement actual web search API integration
- Connect RAG tool to your vector database
- Add more tools (image generation, code execution, etc.)
- Add visual indicators for tool usage in the UI
- Store tool usage in database for analytics
