# RAG System Debug Guide

## Current Issue

The `selectedFileIds` are not being passed from the client to the server properly.

## Expected Flow

1. **User selects files** in the Files modal (Files.tsx)
   - Updates `selectedFileIds` state in Chat component
   - State stored in ref: `selectedFileIdsRef.current`

2. **User sends message** 
   - Custom `fetch` override intercepts the request
   - Injects `selectedFileIds` from ref into request body
   - Server receives `selectedFileIds` in request body

3. **Server processes request** (app/api/chat/route.ts)
   - Extracts `selectedFileIds` from request body
   - If files selected, enables `getContext` tool via `experimental_activeTools`

4. **AI calls getContext tool**
   - Passes user's question to the tool
   - Tool calls `getSimilarResults(question, userId, selectedFileIds)`

5. **Vector search** (db/queries.ts)
   - Generates embedding for question
   - Searches embeddings table for similar vectors
   - Filters by userId and selectedFileIds
   - Returns top 5 results with similarity > 0.2

6. **Context returned to AI**
   - Formatted chunks from PDFs
   - AI uses context to answer question

## Debug Checklist

### Client-Side (Browser Console)

Check for these logs:
- `[DEBUG Client] selectedFileIds updated: [...]` - When file is selected
- `[DEBUG Client] Fetch with selectedFileIds: [...]` - When message is sent

### Server-Side (Terminal/Logs)

Check for these logs:
- `[DEBUG Server] selectedFileIds from body: [...]` - Should show array with IDs
- `[getContext] Called with question: ...` - Tool was invoked
- `[getContext] Selected file IDs: [...]` - Tool received the IDs
- `[getContext] Found results: N` - Results were found

## Testing Steps

### 1. Hard Refresh the Browser
   ```
   Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   ```
   This clears cached JavaScript and loads the new client code.

### 2. Open Browser DevTools
   - Open Console tab
   - Click "Preserve log" to keep logs across navigation

### 3. Select a File
   - Click file icon in chat
   - Select a PDF file
   - Check console for: `[DEBUG Client] selectedFileIds updated: ["..."]`

### 4. Send a Message About the Document
   - Type: "What can you tell me about this document?"
   - Press Send
   - Check console for: `[DEBUG Client] Fetch with selectedFileIds: ["..."]`

### 5. Check Server Logs
   ```bash
   tail -f /tmp/nextjs.log
   ```
   Look for:
   - `[DEBUG Server] selectedFileIds from body:` - Should have IDs, not empty array
   - Tool invocation logs

## Known Issues

### Issue 1: Empty selectedFileIds on Server
**Symptoms:** Server logs show `selectedFileIds from body: []` even when files are selected

**Possible Causes:**
1. Browser hasn't loaded new client code (needs hard refresh)
2. Custom fetch override not working in AI SDK v5
3. useChat hook not using custom fetch function
4. Ref not updating properly

**Solution:**
- Hard refresh browser
- Check browser console for fetch debug log
- If still failing, may need alternative approach (see Alternative Approaches below)

### Issue 2: Tool Not Being Called
**Symptoms:** No `[getContext] Called` logs even with files selected

**Possible Causes:**
1. `experimental_activeTools` is empty (because selectedFileIds is empty)
2. AI not recognizing document-related query
3. System prompt not clear enough

**Solution:**
- Fix selectedFileIds passing first
- Check system prompt includes context instructions
- Use explicit document-related questions

## Alternative Approaches (If Custom Fetch Fails)

### Option A: URL Query Parameters
Pass selectedFileIds in the API URL:

```typescript
// In chat.tsx
const apiUrl = useMemo(
  () => `/api/chat?selectedFiles=${encodeURIComponent(JSON.stringify(selectedFileIds))}`,
  [selectedFileIds]
);

useChat({
  api: apiUrl,
  // ...
});
```

```typescript
// In route.ts
const url = new URL(request.url);
const selectedFilesParam = url.searchParams.get('selectedFiles');
const selectedFileIds = selectedFilesParam ? JSON.parse(decodeURIComponent(selectedFilesParam)) : [];
```

### Option B: Headers
Pass in custom headers:

```typescript
// In chat.tsx
useChat({
  headers: {
    'Content-Type': 'application/json',
    'X-Selected-Files': JSON.stringify(selectedFileIds),
  },
  // ...
});
```

### Option C: Middleware
Use Next.js middleware to inject data.

## Current Code State

### Files.tsx
✅ File selection UI works
✅ Updates `setSelectedFileIds` state correctly

### Chat.tsx
✅ Receives `selectedFileIds` prop from parent
✅ Syncs to ref with useEffect
⚠️  Custom fetch override added (needs testing)
❓ May need browser hard refresh to activate

### app/api/chat/route.ts
✅ Extracts `selectedFileIds` from body
✅ Conditionally enables `getContext` tool
✅ Tool implementation looks correct

### db/queries.ts
✅ getSimilarResults implementation correct
✅ Uses vector similarity search
✅ Filters by userId and selectedFileIds
✅ Returns top 5 results

## Next Steps

1. **User: Hard refresh browser** (Cmd+Shift+R or Ctrl+Shift+R)
2. **User: Select a file** from knowledge base
3. **User: Check browser console** for debug logs
4. **User: Send message** about the document
5. **User: Check server logs** for selectedFileIds

If still empty after hard refresh, we'll implement Option A (URL query params) as fallback.
