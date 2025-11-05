-- Fix messages with undefined or null content
-- Run this SQL script to clean up problematic messages

-- Option 1: View problematic messages first
SELECT id, role, content, "chatId", "createdAt"
FROM "Message"
WHERE content IS NULL 
   OR content = 'null'
   OR content = 'undefined'
ORDER BY "createdAt" DESC
LIMIT 50;

-- Option 2: Delete messages with null/undefined content
-- UNCOMMENT TO RUN:
-- DELETE FROM "Message"
-- WHERE content IS NULL 
--    OR content = 'null'
--    OR content = 'undefined';

-- Option 3: Fix messages by setting empty content
-- UNCOMMENT TO RUN:
-- UPDATE "Message"
-- SET content = ''
-- WHERE content IS NULL 
--    OR content = 'null'
--    OR content = 'undefined';

-- Option 4: View recent chats to find the problematic one
SELECT c.id, c.title, c."createdAt", 
       COUNT(m.id) as message_count,
       SUM(CASE WHEN m.content IS NULL THEN 1 ELSE 0 END) as null_content_count
FROM "Chat" c
LEFT JOIN "Message" m ON c.id = m."chatId"
GROUP BY c.id, c.title, c."createdAt"
ORDER BY c."createdAt" DESC
LIMIT 10;

-- Option 5: Delete specific chat by ID
-- UNCOMMENT AND REPLACE <chat-id>:
-- DELETE FROM "Vote" WHERE "chatId" = '<chat-id>';
-- DELETE FROM "Message" WHERE "chatId" = '<chat-id>';
-- DELETE FROM "Chat" WHERE id = '<chat-id>';

