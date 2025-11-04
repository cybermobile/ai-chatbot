# Quick Test Guide - RAG with AI Elements

## 🚀 Quick Start Testing

### Step 1: Start Your Development Server
```bash
npm run dev
```

### Step 2: Hard Refresh Browser
Clear cached JavaScript (important!):
- **Mac**: `Cmd + Shift + R`
- **Windows/Linux**: `Ctrl + Shift + R`

### Step 3: Open Browser Console
- **Mac**: `Cmd + Option + J`
- **Windows/Linux**: `Ctrl + Shift + J`
- Click "Preserve log" checkbox

### Step 4: Select a Document
1. Navigate to http://localhost:3000
2. Click the **file icon** (📁) at bottom right of chat input
3. Select a PDF from your knowledge base
4. Notice the **blue badge** with number appears on file icon
5. Close the modal

### Step 5: Ask About the Document
Type one of these:
```
"What is this document about?"
"Summarize the main points"
"What are the key findings?"
```

## ✅ What You Should See

### 1. Reasoning Display (While Processing)
```
🔍 Searching knowledge base...
   (1 document selected)
```

### 2. Tool Call Box
A collapsible box with:
- **Header**: "Knowledge Base Search" with ✓ Completed badge
- **Parameters**: Shows your question in JSON format
- Click to expand/collapse

### 3. Sources Section
```
📚 Found 3 relevant sources
  (click to expand)

#1 document-name.pdf
   Relevance: 94%
   "The document discusses AI and machine learning..."

#2 another-doc.pdf
   Relevance: 87%
   "Key findings include the following points..."

#3 report.pdf
   Relevance: 76%
   "This analysis shows that..."
```

### 4. AI Response
The AI should:
- Reference source numbers (e.g., "According to Source 1...")
- Quote specific passages
- Only use information from the retrieved sources
- Cite which sources contain which information

## 🔍 Visual Example

```
┌─────────────────────────────────────┐
│  User Message                       │
│  "What is this document about?"     │
└─────────────────────────────────────┘

        ↓ (you see this while processing)

┌─────────────────────────────────────┐
│  🔍 Searching knowledge base...     │
│     (1 document selected)           │
└─────────────────────────────────────┘

        ↓ (tool call appears)

┌─ Knowledge Base Search ─────────────┐
│ ✓ Completed                         │
│                                     │
│ ▼ Parameters                        │
│   {                                 │
│     "question": "What is this..."   │
│   }                                 │
│                                     │
│ 📚 Found 3 relevant sources         │
│                                     │
│ ▼ Sources                           │
│   #1 research-paper.pdf             │
│      Relevance: 94%                 │
│      "This paper presents..."       │
│                                     │
│   #2 guidelines.pdf                 │
│      Relevance: 87%                 │
│      "The following principles..."  │
│                                     │
│   #3 summary.pdf                    │
│      Relevance: 76%                 │
│      "In conclusion, the study..."  │
└─────────────────────────────────────┘

        ↓ (AI response)

┌─────────────────────────────────────┐
│  Assistant                          │
│                                     │
│  Based on the retrieved sources,    │
│  particularly Source 1 (research-   │
│  paper.pdf, 94% relevant), the      │
│  document presents findings on...   │
│                                     │
│  According to Source 2, the key     │
│  principles include...              │
│                                     │
│  As noted in Source 3, the study    │
│  concludes that...                  │
└─────────────────────────────────────┘
```

## 🐛 Quick Debugging

### Issue: Tool Not Showing
**Check:**
- [ ] Files selected? (blue badge visible)
- [ ] Hard refreshed browser?
- [ ] Browser console for errors?

**Browser console should show:**
```
[DEBUG Client] selectedFileIds updated: ["abc123"]
[DEBUG Client] Sending message with selectedFileIds: ["abc123"]
```

**Server logs should show:**
```
[DEBUG Server] selectedFileIds from body: ["abc123"]
[getContext] Called with question: "What is this about?"
[getContext] Selected file IDs: ["abc123"]
[getContext] Found results: 3
```

### Issue: Empty Sources
**Check:**
- [ ] Embeddings exist in database?
  ```sql
  SELECT COUNT(*) FROM embedding;
  ```
- [ ] Document content matches your query?
- [ ] Similarity threshold not too high? (currently 0.2)

### Issue: Tool Shows But No Answer
**Check:**
- [ ] Look for errors in browser console
- [ ] Check server logs for exceptions
- [ ] Verify `contextForLLM` is in tool result

## 📊 Success Checklist

After asking a question about your document:

- [ ] ✅ Reasoning shows "Searching knowledge base..."
- [ ] ✅ Tool call box appears with "Knowledge Base Search"
- [ ] ✅ Status badge shows "Completed"
- [ ] ✅ Parameters section shows your question
- [ ] ✅ Sources section shows "Found N sources"
- [ ] ✅ Each source shows:
  - [ ] Document name
  - [ ] Relevance percentage
  - [ ] Content excerpt
- [ ] ✅ Sources are expandable/collapsible
- [ ] ✅ AI response uses ONLY retrieved information
- [ ] ✅ AI cites source numbers in answer
- [ ] ✅ No hallucinated information

## 🎨 UI Features to Try

### Collapsible Sections
- Click on tool header to collapse/expand
- Click on "📚 Found N sources" to expand source list
- All sections remember their state

### Source Details
- Each source shows relevance as percentage
- Excerpts show first 200 characters
- Full chunk content available in context

### Copy Functionality
- Copy button on AI response still works
- Vote buttons (thumbs up/down) still work
- All existing features preserved

## 🧪 Edge Case Tests

### Test 1: No Files Selected
```
1. Don't select any files
2. Ask: "What is machine learning?"
3. Expected: Normal response, no RAG
```

### Test 2: Irrelevant Question
```
1. Select a PDF about AI
2. Ask: "What is the recipe for chocolate cake?"
3. Expected: "I don't have information about that..."
```

### Test 3: Multiple Documents
```
1. Select 2-3 PDFs
2. Ask: "Compare the main topics"
3. Expected: Sources from all selected files
```

### Test 4: Very Specific Question
```
1. Select a document
2. Ask about a very specific detail
3. Expected: High relevance source with exact info
```

## 📝 What Changed

### Before (Hidden RAG)
- ✅ RAG worked
- ❌ User couldn't see it
- ❌ No transparency
- ❌ Hard to debug

### After (Visible RAG)
- ✅ RAG still works
- ✅ User sees everything
- ✅ Full transparency
- ✅ Easy to debug
- ✅ Professional UI

## 🔧 Components Added

New AI Elements:
- `components/ai-elements/tool.tsx`
- `components/ai-elements/sources.tsx`
- `components/ai-elements/reasoning.tsx`
- `components/ai-elements/response.tsx`
- `components/ai-elements/code-block.tsx`
- `components/ai-elements/shimmer.tsx`

Modified Files:
- `components/custom/message.tsx` - Visualize tools
- `app/api/chat/route.ts` - Structured data
- `components/custom/chat.tsx` - Reasoning display
- `ai/prompts.ts` - RAG instructions

## 🎯 Next Steps

If everything works:
1. ✅ Test with different documents
2. ✅ Try various question types
3. ✅ Test edge cases
4. ✅ Share with users for feedback

If issues occur:
1. Check browser console
2. Check server logs
3. Review `RAG_WITH_AI_ELEMENTS.md`
4. Verify database has embeddings

## 📚 Documentation

- `RAG_WITH_AI_ELEMENTS.md` - Full implementation guide
- `RAG_DEBUG.md` - Original debugging guide
- [AI Elements Docs](https://ai-sdk.dev/elements)
- [AI SDK v5 Docs](https://v5.ai-sdk.dev/)

---

**Status:** ✅ Implementation Complete
**Test Time:** ~5 minutes
**Expected Result:** Beautiful RAG visualization! 🎉
