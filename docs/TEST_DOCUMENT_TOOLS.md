# Testing Document Tools

## Quick Test Steps

### Test 1: Create a Document

1. **Start your dev server** (if not already running):
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

2. **Open the app** at http://localhost:3000

3. **Log in** (required for document creation)

4. **Enable the Create Document tool**:
   - Click "Tools" dropdown in the chat input
   - Toggle on "Create Document"
   - You should see a badge showing "1" enabled tool

5. **Test the tool**:
   ```
   User: "Create a document about React Server Components"
   ```

6. **Expected behavior**:
   - AI calls the `createDocument` tool
   - Loading indicator appears (15-30 seconds)
   - A clickable document card appears with title
   - Click the card → Full-screen canvas opens
   - Document content is displayed
   - You can edit, copy, or close

### Test 2: Update a Document

1. **With a document open in the canvas**:
   - Ensure "Update Document" tool is enabled
   
2. **Ask the AI to modify it**:
   ```
   User: "Add a section about performance optimization"
   ```

3. **Expected behavior**:
   - AI calls `updateDocument` with document ID
   - New version is created
   - Use undo/redo buttons to see version history
   - Toggle diff view to see what changed

### Test 3: Version History

1. **Open any document**
2. **Top toolbar buttons**:
   - ← (Undo): View previous version
   - → (Redo): View next version
   - Δ (Delta): Toggle diff view
   - 📋 (Copy): Copy content to clipboard

3. **Make multiple updates** and navigate between versions

### Test 4: Error Handling

Test these edge cases:

1. **Not logged in**:
   - Try creating a document without logging in
   - Should see error: "You must be logged in to create documents"

2. **Update non-existent document**:
   - Enable Update Document tool
   - Say: "Update document with ID 'invalid-id'"
   - Should see error: "Document not found"

## Expected Console Logs

When creating a document, you should see:

```
[Chat API] Tool calls: [ { name: 'createDocument', args: { title: 'React Server Components' } } ]
[Chat API] Tool results preview: [ { toolName: 'createDocument', resultPreview: '{"id":"...","title":"React Server Components","content":"..."}' } ]
```

## Troubleshooting

### Document card doesn't appear
- **Check console** for errors
- **Verify tool is enabled** (badge should show count)
- **Check model supports tools** (llama3.1+, mistral, etc.)

### Canvas doesn't open when clicking card
- **Check Block component** is rendered in chat.tsx
- **Inspect React DevTools** to see block state
- **Check browser console** for JavaScript errors

### Document generation is slow
- **Normal**: Generation takes 15-30 seconds
- **If >60 seconds**: Check model performance, may need GPU
- **If timeout**: Increase maxDuration in route.ts (currently 60s)

### "Model not found" error
- **Check your Ollama** is running: `ollama list`
- **Pull required model**: `ollama pull llama3.1`
- **Or use vLLM** (see VLLM_SETUP.md)

## Database Verification

Check documents were saved:

```sql
-- Connect to your database
psql <your_connection_string>

-- View all documents
SELECT id, title, "createdAt", "userId" 
FROM "Document" 
ORDER BY "createdAt" DESC 
LIMIT 10;

-- View document versions
SELECT id, title, "createdAt"
FROM "Document"
WHERE title = 'Your Document Title'
ORDER BY "createdAt" ASC;
```

## API Endpoint Tests

You can also test the underlying API directly:

### Get document by ID
```bash
curl http://localhost:3000/api/document?id=<document-id>
```

### Get all versions of a document
```bash
curl http://localhost:3000/api/document?id=<document-id>
```

## Performance Benchmarks

Typical generation times (on M1 Mac / RTX 3080):

| Model | Tokens | Time |
|-------|--------|------|
| llama3.1:8b | ~500 | 15-20s |
| mistral:7b | ~500 | 12-18s |
| llama3.1:70b | ~500 | 45-90s |

## Next Steps

Once basic functionality works:

1. ✅ Document creation works
2. ✅ Document updates work
3. ✅ Version history works
4. ✅ UI displays correctly

Then consider enhancements:

- [ ] Real-time streaming (see DOCUMENT_TOOLS_STATUS.md)
- [ ] Progress indicators
- [ ] Document templates
- [ ] Export options
- [ ] Search/filters

## Common Issues

### Issue: "StreamData is not defined"
**Solution**: The old streaming code was removed. Make sure you're using the new implementation from this commit.

### Issue: Block canvas shows old/empty content
**Solution**: The BlockStreamHandler expects streaming data. With the new non-streaming approach, the document loads from database when you click the card.

### Issue: Tool not being called
**Solution**: 
1. Enable the tool in UI
2. Be explicit: "Use the createDocument tool to write about X"
3. Check model supports tool calling (llama3.1+)
4. Lower temperature in route.ts (currently 0.5)

## Validation Checklist

Before deploying:

- [ ] Create document works
- [ ] Update document works
- [ ] Version history navigation works
- [ ] Diff view works
- [ ] Documents persist in database
- [ ] Error messages display properly
- [ ] Works with multiple users
- [ ] Mobile responsive (canvas adapts)
- [ ] No console errors
- [ ] Lint passes

