# Fixing "[TOOL_CALLS]" Raw Text in UI

## The Problem

You're seeing raw text like this in your chat:
```
[TOOL_CALLS][{"name": "createDocument", "arguments": {}}]
```

**Root Cause:** Your model (Mistral-Nemo-Instruct-2407-quantized) is outputting tool calls as **text** instead of using the **structured tool calling API**. This happens when:

1. The model/vLLM isn't configured for structured tool calling
2. The model is trying to call tools but using the wrong format
3. The quantized version doesn't fully support tool calling

## Quick Solutions

### ✅ Solution 1: Use a Model with Better Tool Support (Recommended)

Switch to a model known to work well with tool calling:

```bash
# Option A: Use Llama 3.1 (best tool calling support)
ollama pull llama3.1:8b
# or
ollama pull llama3.1:70b  # if you have the RAM

# Option B: Use Qwen2.5 (excellent tool calling)
ollama pull qwen2.5:14b

# Option C: Use Mistral v0.3 (better than Nemo for tools)
ollama pull mistral:latest
```

Then update your `.env`:
```bash
LLM_PROVIDER=ollama
# The UI will auto-detect available models
```

---

### 🔧 Solution 2: Try Without Tools First

Test if the document feature works when you **explicitly tell the AI** what to do:

1. **Disable** the Create Document tool toggle
2. Ask: "Can you write a short essay about React? Please create it as a document."
3. The AI should respond with text (not try to use tools)

Then re-enable and try again with a more explicit prompt:
```
"Use the createDocument tool to write an essay about React Server Components"
```

---

### ⚙️ Solution 3: Check vLLM Tool Calling Configuration

If you're using vLLM, ensure tool calling is properly enabled:

**Check your vLLM startup command** (in docker-compose.yml or startup script):

```bash
# Should include these flags for tool calling:
--enable-auto-tool-choice \
--tool-call-parser hermes  # or appropriate parser for your model
```

**Update docker-compose.yml** if needed:

```yaml
vllm:
  command: >
    --model neuralmagic/Mistral-Nemo-Instruct-2407-quantized.w4a16
    --enable-auto-tool-choice
    --tool-call-parser mistral
    --max-model-len 8192
```

---

### 🎯 Solution 4: Test With Ollama Instead

Temporarily switch to Ollama to test if the document tools work:

```bash
# 1. Install Ollama (if not already)
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a tool-capable model
ollama pull llama3.1:8b

# 3. Start Ollama
ollama serve

# 4. Update .env
LLM_PROVIDER=ollama

# 5. Restart your app
pnpm dev
```

---

## Diagnosing the Issue

### Check Your Terminal Logs

When you enable the tool and send a message, look for:

**✅ Good (Structured Tool Call):**
```
[Chat API] Tool calls: [ { name: 'createDocument', args: { title: 'React' } } ]
[createDocument] Tool called with title: React
[createDocument] Generating document with ID: abc-123
```

**❌ Bad (Text Tool Call):**
```
# No tool call logs
# Just text response with [TOOL_CALLS][...] in it
```

### Check Model Capabilities

Not all models support tool calling equally well:

| Model | Tool Support | Notes |
|-------|--------------|-------|
| Llama 3.1 | ⭐⭐⭐⭐⭐ | Best, native support |
| Qwen2.5 | ⭐⭐⭐⭐⭐ | Excellent |
| Mistral v0.3 | ⭐⭐⭐⭐ | Good |
| Mistral Nemo | ⭐⭐⭐ | Okay (issues with quantized) |
| Llama 3 | ⭐⭐ | Limited |
| Llama 2 | ❌ | No support |

---

## Understanding the Empty Arguments Issue

The log shows: `{"name": "createDocument", "arguments": {}}`

This means:
1. ✅ The model recognized it should use a tool
2. ❌ The model didn't extract the `title` parameter
3. ❌ It's outputting as text instead of structured format

**Why this happens:**
- Quantized models sometimes lose instruction-following ability
- vLLM might not be configured for tool calling
- The model needs clearer prompting

---

## Testing Different Prompts

Try these prompts to test (with Create Document enabled):

### ❌ Too Vague:
```
"Write something about React"
```
Result: Model confused, might not use tool or use it wrong

### ✅ More Explicit:
```
"Create a document titled 'React Server Components Guide'"
```
Result: Clearer what the title should be

### ✅ Most Explicit:
```
"Use the createDocument tool with title 'React Server Components' to write a comprehensive guide"
```
Result: Very clear intent, best chance of working

---

## Workaround: Use Without Tools

If tools continue to cause issues, you can still use document creation manually:

1. Ask the AI to write content in the chat
2. Copy the content
3. Create a document manually in your app (if you have that feature)
4. Or wait while we implement a fallback for models without good tool support

---

## Recommended Path Forward

**For Development:**
1. Switch to `llama3.1:8b` with Ollama (most reliable)
2. Test document tools thoroughly
3. Once working, experiment with other models

**For Production:**
1. Use `llama3.1:70b` or `qwen2.5:14b` if you have resources
2. Or use an API provider (OpenAI, Anthropic, etc.) with perfect tool support
3. Configure vLLM properly if self-hosting

---

## Still Not Working?

If you still see `[TOOL_CALLS]` after trying the above:

1. **Check your model choice**:
   ```bash
   # What model are you using?
   ollama list
   # or check vLLM logs
   ```

2. **Test tool calling works at all**:
   - Enable Calculator tool
   - Ask: "What is 123 * 456?"
   - Does it use the calculator tool properly?

3. **Share your logs**:
   - The full terminal output when you see `[TOOL_CALLS]`
   - Your LLM_PROVIDER and model name
   - Your vLLM/Ollama configuration

---

## Technical Explanation

The AI SDK expects tool calls in this format:
```json
{
  "role": "assistant",
  "content": [
    {
      "type": "tool-use",
      "name": "createDocument",
      "input": { "title": "React Guide" }
    }
  ]
}
```

But some models output them as text:
```json
{
  "role": "assistant",
  "content": "[TOOL_CALLS][{\"name\": \"createDocument\", \"arguments\": {}}]"
}
```

This is incompatible with the AI SDK and causes the raw text to show up in the UI.

---

## Related Files

- `/ai/models.ts` - Model configuration
- `/ai/tools.ts` - Tool definitions (now with better logging)
- `/app/api/chat/route.ts` - Tool execution logic
- `/docker-compose.yml` - vLLM configuration
- `/.env` - LLM provider setting

