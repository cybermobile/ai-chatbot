# Debugging: No Response After Tool Call

## Quick Diagnosis Steps

### Step 1: Check Your Terminal Logs

When you send a message with tools enabled, you should see logs like this:

```
[Chat API] Request received: { id: '...', messageCount: 2, toolConfig: { calculator: true } }
[Chat API] Enabled tools: [ 'calculator' ]
[Chat API] Model: llama3.1:latest | Has tools: true
[Chat API] Starting stream with 2 messages

# Step 1: Tool is called
[Chat API] Step finished: {
  stepType: 'tool',
  hasText: false,
  toolCallsCount: 1,
  finishReason: 'tool-calls'
}
[Chat API] Tool calls: [ { name: 'calculator', args: { expression: '150 * 23' } } ]

# Step 2: Model generates final response
[Chat API] Step finished: {
  stepType: 'text',
  hasText: true,
  textLength: 45,
  textPreview: 'The result of 150 * 23 is 3,450.',
  toolCallsCount: 0,
  finishReason: 'stop'
}

[Chat API] Stream finished: { hasText: true, textLength: 45, ... }
```

### Step 2: Identify the Problem

Compare your logs to the scenarios below:

#### ❌ Scenario A: No Tool Calls at All
```
[Chat API] Step finished: {
  hasText: true,
  textLength: 50,
  toolCallsCount: 0,  // <-- Problem: Should be 1
  finishReason: 'stop'
}
```

**Problem:** Model doesn't support tool calling or doesn't understand when to use tools.

**Solution:**
1. Confirm you're using a tool-capable model (llama3.1, mistral, etc.)
2. Try being more explicit: "Use the calculator tool to compute 150 * 23"

#### ❌ Scenario B: Tool Called But No Final Response
```
# Step 1
[Chat API] Step finished: {
  toolCallsCount: 1,
  finishReason: 'tool-calls'
}

# No Step 2! It just stops here.
[Chat API] Stream finished: { hasText: false, textLength: 0 }
```

**Problem:** Model called the tool but didn't generate a follow-up response.

**Solution:**
1. This is the current issue - model stops after tool execution
2. Try reducing `maxSteps` from 5 to 3
3. Update your system prompt (already done)
4. Check if your model needs specific prompting

#### ❌ Scenario C: Error During Tool Execution
```
[Chat API] Tool calls: [ { name: 'calculator', args: { expression: '150 * 23' } } ]
[Chat API] Error: <some error>
```

**Problem:** Tool execution failed.

**Solution:** Check the tool implementation in `ai/tools.ts`

### Step 3: Test with Different Configurations

#### Test 1: Disable maxSteps
Try commenting out `maxSteps` temporarily:

```typescript
// In app/api/chat/route.ts
...(hasTools && {
  tools,
  // maxSteps: 5,  // <-- Comment this out
  toolChoice: 'auto',
}),
```

This will force a single-step execution where the model MUST respond after calling the tool.

#### Test 2: Use Explicit Tool Prompting
Instead of: "What is 150 * 23?"
Try: "Please use the calculator to find 150 * 23, then tell me the result."

#### Test 3: Try Without Tools
Disable all tools and ask: "What is 150 * 23?"
If the model responds, your basic setup is working - it's a tool-specific issue.

### Step 4: Model-Specific Workarounds

Some models need specific handling:

#### For Llama 3.1
Should work out of the box. If not:
- Make sure you have the latest version: `ollama pull llama3.1`
- Try the larger variant if using the small one

#### For Mistral
Works well with tools. No special handling needed.

#### For Qwen 2.5
Sometimes needs more explicit instructions:
```typescript
system: `${systemPrompt}\n\nIMPORTANT: After using any tool, you must provide a text response to the user explaining the results.`
```

#### For Local Models Generally
If using a fine-tuned or custom model:
- It may not support the tool calling format
- Consider switching to a known-good model for testing

## Common Fixes

### Fix 1: Force Final Response (Workaround)

Add this to your system prompt:

```typescript
export const toolsPrompt = `
**CRITICAL TOOL RULE:**
After calling ANY tool and receiving the result, you MUST immediately generate a natural language response.

REQUIRED FORMAT:
1. Call the tool if needed
2. Receive the tool result
3. Generate your response to the user

NEVER stop after just calling a tool. The user is waiting for your response!
`;
```

### Fix 2: Reduce maxSteps

```typescript
maxSteps: 1,  // Force single-step: tool call + response in one go
```

This makes the model choose between:
- Respond directly (no tool)
- Call tool AND respond in the same step

### Fix 3: Add onChunk Logging

To see exactly what's being streamed:

```typescript
onChunk: ({ chunk }) => {
  console.log('[Chat API] Chunk:', chunk);
},
```

## Expected Behavior

When everything works correctly:

1. **User sends:** "What is 150 * 23?"
2. **Model thinks:** "I should use the calculator tool"
3. **Step 1:** Model calls `calculator({ expression: "150 * 23" })`
4. **Tool executes:** Returns `{ result: 3450 }`
5. **Step 2:** Model sees the result and generates: "The result is 3,450."
6. **User sees:** The response text

## Still Not Working?

### Last Resort: Simplify

Try this minimal configuration:

```typescript
const result = await streamText({
  model: customModel(model.apiIdentifier),
  system: 'You are helpful. After using tools, always respond to the user.',
  messages: coreMessages,
  tools: { calculator: calculatorTool },
  maxSteps: 1,
});
```

If this works, gradually add back complexity.

### Check AI SDK Version

```bash
npm list ai
```

Should show `4.3.19`. If different, there might be compatibility issues.

### Try Different Model

As a test:
```bash
ollama pull mistral
```

Then select Mistral in the UI and try again. Mistral has excellent tool support.

## What to Share When Asking for Help

If you need to ask for help, share:

1. **Your model:** (e.g., "llama3.1:latest")
2. **Terminal logs:** (everything from `[Chat API]`)
3. **Browser console:** (any errors or warnings)
4. **Your question:** (exactly what you typed)
5. **Tool config:** (which tools were enabled)
6. **Expected vs actual:** (what you expected vs what happened)
