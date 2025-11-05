/**
 * Script to fix messages with malformed content in the database
 * 
 * Usage:
 *   npx tsx scripts/fix-messages.ts [--dry-run] [--delete] [--fix]
 * 
 * Options:
 *   --dry-run: Show what would be changed without making changes
 *   --delete: Delete messages with null/undefined content
 *   --fix: Set empty string for messages with null/undefined content
 */

import { db } from '@/db/queries';
import { message } from '@/db/schema';
import { eq, or, isNull } from 'drizzle-orm';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const shouldDelete = args.includes('--delete');
  const shouldFix = args.includes('--fix');

  console.log('🔍 Checking for messages with malformed content...\n');

  // Find problematic messages
  const problematicMessages = await db
    .select()
    .from(message)
    .where(
      or(
        isNull(message.content),
        eq(message.content, 'null'),
        eq(message.content, 'undefined')
      )
    );

  console.log(`Found ${problematicMessages.length} problematic messages\n`);

  if (problematicMessages.length === 0) {
    console.log('✅ No problematic messages found! Database is clean.');
    return;
  }

  // Show sample
  console.log('Sample of problematic messages:');
  problematicMessages.slice(0, 5).forEach((msg: any) => {
    console.log(`  - ID: ${msg.id}, Role: ${msg.role}, Content: ${msg.content}, Chat: ${msg.chatId}`);
  });
  console.log();

  if (dryRun) {
    console.log('🏃 Dry run mode - no changes will be made');
    console.log(`\nTo fix these issues, run:`);
    console.log(`  npx tsx scripts/fix-messages.ts --fix    # Set empty content`);
    console.log(`  npx tsx scripts/fix-messages.ts --delete # Delete messages`);
    return;
  }

  if (shouldDelete) {
    console.log('🗑️  Deleting problematic messages...');
    
    for (const msg of problematicMessages) {
      await db.delete(message).where(eq(message.id, msg.id));
    }
    
    console.log(`✅ Deleted ${problematicMessages.length} messages`);
  } else if (shouldFix) {
    console.log('🔧 Fixing problematic messages by setting empty content...');
    
    for (const msg of problematicMessages) {
      await db
        .update(message)
        .set({ content: '' })
        .where(eq(message.id, msg.id));
    }
    
    console.log(`✅ Fixed ${problematicMessages.length} messages`);
  } else {
    console.log('⚠️  No action specified. Use --fix or --delete');
    console.log(`\nRun with --dry-run to preview changes first`);
  }
}

main()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

