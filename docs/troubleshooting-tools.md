# Troubleshooting Tool Calling

## Common Issues and Solutions

### Issue 1: No Assistant Response When Tools Are Enabled

**Symptoms:**
- You enable tools in the UI
- You send a message
- The assistant doesn't respond at all
- No error messages appear

**Likely Cause:** Your model doesn't support tool calling.

**Solutions:**

1. **Check Your Model** - Run this in your terminal where Ollama is running:
   ```bash
   ollama list
   ```

2. **Use a Tool-Compatible Model** - Pull and use a compatible model:
   ```bash
   # Recommended: Llama 3.1 (best tool support)
   ollama pull llama3.1

   # Alternative: Mistral
   ollama pull mistral

   # Alternative: Mistral Nemo
   ollama pull mistral-nemo
   ```

3. **Disable Tools** - If you want to use a non-compatible model:
   - Click "Tools" in the UI
   - Make sure all tools are disabled (unchecked)
   - Try your message again

### Issue 2: Tools Called But No Results Shown

**Symptoms:**
- Tools appear to be called (you see "Searching..." messages)
- But no results appear
- Assistant doesn't use the results

**Solution:** Check your browser console and terminal logs:

**Browser Console (Chrome/Firefox DevTools):**
1. Press F12 to open DevTools
2. Go to the Console tab
3. Look for errors related to tool execution

**Terminal (where you run `npm run dev`):**
1. Look for logs like:
   ```
   [Chat API] Enabled tools: [ 'webSearch', 'rag' ]
   [Chat API] Step finished: { toolCallsCount: 1, ... }
   [Chat API] Tool calls: [ { name: 'webSearch', args: { query: '...' } } ]
   ```

2. If you see tool calls but no results, the tool's `execute` function likely failed
3. Check the tool implementation in `ai/tools.ts`

### Issue 3: Tool Called But Returns Placeholder Data

**Symptoms:**
- Tools work and show results
- But results are placeholder data (e.g., "Example Result", "Placeholder result")

**Solution:** You need to implement the actual tool logic!

The tools in `ai/tools.ts` currently have placeholder implementations. See the main guide for how to implement:
- Web Search (using Brave, Tavily, etc.)
- RAG Search (using your vector database)

### Issue 4: Model Keeps Calling Tools Repeatedly

**Symptoms:**
- Model calls the same tool multiple times
- Doesn't provide a final answer
- Hits the `maxSteps` limit (5 steps)

**Solutions:**

1. **Improve Tool Descriptions** - Make tool descriptions more specific in `ai/tools.ts`:
   ```typescript
   export const webSearchTool = tool({
     description: 'ONLY use this when the user explicitly asks for current/recent information that you do not have. Search the web for up-to-date facts, news, or data.',
     // ...
   });
   ```

2. **Update System Prompt** - Add guidance in `ai/prompts.ts`:
   ```typescript
   export const systemPrompt = `...

   When using tools:
   - Only call a tool once per query unless explicitly needed
   - After receiving tool results, provide your answer immediately
   - Do not call multiple tools unless the query requires it
   `;
   ```

3. **Reduce maxSteps** - In `app/api/chat/route.ts`, reduce from 5 to 3:
   ```typescript
   maxSteps: 3,
   ```

## Debugging Checklist

When tools aren't working, check these in order:

- [ ] **Model supports tools** - Using llama3.1, mistral, or another compatible model?
- [ ] **Tools are enabled** - Toggled on in the UI?
- [ ] **Console logs show tool config** - See `[Chat API] Enabled tools: [...]` in terminal?
- [ ] **Model attempts tool call** - See `[Chat API] Tool calls: [...]` in terminal?
- [ ] **Tool executes** - Check for errors in the tool's execute function
- [ ] **Results returned** - See tool results in the response?
- [ ] **UI renders results** - Check message.tsx has handlers for your tool names

## Testing Tools

### Test 1: Calculator (Simplest Test)

1. Enable "Calculator" tool
2. Ask: "What is 125 * 47?"
3. Expected behavior:
   - You see: "🧮 Calculating: 125 * 47..."
   - Then see the result: 5875
   - Assistant responds with the answer

### Test 2: Web Search (Requires Implementation)

1. Enable "Web Search" tool
2. Ask: "What's the latest news about SpaceX?"
3. Expected behavior:
   - You see: "🔍 Searching the web for: latest news about SpaceX..."
   - Results appear (currently placeholder)
   - Assistant summarizes the results

### Test 3: RAG (Requires Implementation + Documents)

1. Upload documents to your knowledge base
2. Enable "RAG Search" tool
3. Ask: "What does the documentation say about [topic from your docs]?"
4. Expected behavior:
   - You see: "📚 Searching knowledge base for: ..."
   - Relevant chunks appear
   - Assistant answers based on the chunks

## Getting Help

If none of these solutions work:

1. **Check the logs** - Copy the terminal output and browser console errors
2. **Verify your setup**:
   - AI SDK version: `npm list ai` (should be 4.3.19)
   - Ollama version: `ollama --version`
   - Model: What model are you using?
3. **Test without tools** - Disable all tools and confirm basic chat works
4. **Test with calculator only** - Enable just the calculator to isolate the issue

## Additional Tips

### Forcing Tool Usage (for Testing)

If the model doesn't call your tool, you can force it in the prompt:
- Instead of: "What's the weather like?"
- Try: "Use the web search tool to find current weather information"

### Checking Tool Support

To verify if your Ollama model supports tools, check the model's capabilities:
```bash
ollama show llama3.1 --modelfile
```

Look for mentions of "tools" or "functions" in the configuration.

### Performance Tips

- **Smaller models** (like llama3.2:1b) are faster but may not use tools as reliably
- **Larger models** (like llama3.1:70b) are more reliable but slower
- **Best balance**: llama3.1:8b or mistral:7b
