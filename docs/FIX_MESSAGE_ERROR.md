# Fixing "Cannot read properties of undefined (reading 'map')" Error

## The Problem

You're seeing this error when enabling document tools:
```
TypeError: Cannot read properties of undefined (reading 'map')
at convertToModelMessages
```

**Root Cause:** Your database has messages from previous versions with malformed `content` fields (null, undefined, or invalid format). The AI SDK v5 message converter can't handle these.

## Quick Solutions (Pick One)

### ✅ Solution 1: Start a New Chat (Easiest - 30 seconds)

1. Click the "+" button to start a **new chat**
2. Enable "Create Document" tool
3. Try again: "Write a document about React hooks"

**Why this works:** New chats don't have the corrupted message history.

---

### 🔧 Solution 2: Run the Auto-Fix Script (Recommended - 2 minutes)

I've created a script to clean up your database:

```bash
# 1. Preview what will be fixed (safe, no changes)
npx tsx scripts/fix-messages.ts --dry-run

# 2. Fix by setting empty content (safer option)
npx tsx scripts/fix-messages.ts --fix

# 3. OR delete problematic messages completely
npx tsx scripts/fix-messages.ts --delete
```

**What it does:**
- Finds messages with null/undefined content
- Either fixes them (empty string) or deletes them
- Your chats will remain intact

---

### 🗄️ Solution 3: Manual Database Cleanup (Advanced - 5 minutes)

If you prefer SQL, I've created a script:

```bash
# 1. Connect to your database
psql <your-connection-string>

# 2. Run the SQL file
\i scripts/fix-message-content.sql
```

Follow the instructions in the SQL file to:
- View problematic messages
- Delete or fix them
- Or delete entire problematic chats

---

### 🔥 Solution 4: Nuclear Option - Clear All History (1 minute)

If you don't care about old chats:

```sql
-- Clear everything (WARNING: IRREVERSIBLE)
TRUNCATE TABLE "Vote" CASCADE;
TRUNCATE TABLE "Message" CASCADE;
TRUNCATE TABLE "Chat" CASCADE;
TRUNCATE TABLE "Document" CASCADE;
```

Or use the UI:
1. Delete all chats from sidebar
2. Start fresh

---

## Why This Happened

During the AI SDK v4 → v5 migration:
- Message format changed significantly
- Old messages with tool invocations were saved in v4 format
- v5's `convertToCoreMessages` expects a different structure
- Result: conversion fails on old messages

## Prevention

The fix I just deployed adds:
- **Message validation** before conversion
- **Better error messages** with hints
- **Graceful handling** of malformed content
- **Detailed logging** to catch issues early

After applying one of the fixes above, this shouldn't happen again.

## Testing After Fix

1. Start a new chat
2. Enable "Create Document" tool  
3. Send: "Write a short document about TypeScript"
4. Should work without errors ✅

## Still Having Issues?

If you still see errors after trying the above:

1. **Check the logs** - Look for the new validation warnings:
   ```
   [Chat API] Message with undefined content: <id>
   ```

2. **Inspect a specific chat** in your database:
   ```sql
   SELECT id, role, content 
   FROM "Message" 
   WHERE "chatId" = '<your-chat-id>'
   ORDER BY "createdAt" ASC;
   ```

3. **Check message structure** - content should be:
   - A string: `"Hello world"`
   - Or an array: `[{ type: "text", text: "Hello" }]`
   - Not: `null`, `undefined`, `"null"`, `"undefined"`

## Related Files

- `/app/api/chat/route.ts` - Now has validation logic (lines 81-127)
- `/scripts/fix-messages.ts` - Automated cleanup script  
- `/scripts/fix-message-content.sql` - Manual SQL cleanup
- `/docs/AI_SDK_V5_MIGRATION_SUMMARY.md` - Why this happened

## Technical Details

The error occurs in this flow:

```
1. Load messages from database
2. Clean messages (remove toolInvocations)
3. convertToCoreMessages() ← FAILS HERE
4. AI SDK tries to .map() over undefined content
```

The fix adds validation at step 2:

```typescript
// Before (broken):
const cleanMessages = messages.map(msg => {
  const { toolInvocations, ...rest } = msg;
  return rest; // content might be undefined!
});

// After (fixed):
const cleanMessages = messages.map(msg => {
  const { toolInvocations, ...rest } = msg;
  if (rest.content === undefined) {
    return { ...rest, content: '' }; // Set safe default
  }
  return rest;
});
```

