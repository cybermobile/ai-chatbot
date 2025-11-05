# Known Issues

## Vercel Workflow Build Error with Database Imports

### Issue

When running `npm run build`, the Vercel Workflow builder (esbuild) cannot resolve database imports within "use step" functions:

```
ERROR: Could not resolve "@/db/drizzle"
ERROR: Could not resolve "@/db/schema"
```

### Root Cause

The Vercel Workflow Development Kit bundles workflow files separately using esbuild. Database modules (`@/db/drizzle`) depend on runtime environment variables (`DATABASE_URL`) and cannot be statically bundled at build time.

### Current Status

- ✅ **Local Development**: Works perfectly with `npm run dev`
- ⚠️ **Production Build**: Fails during `npm run build`
- ✅ **Runtime**: Would work in production if build succeeds

### Workarounds

#### Option 1: Remove Database Steps from Workflows (Recommended for now)

Move database operations outside of "use step" functions:

```typescript
export async function POST(req: Request) {
  'use workflow';

  // Workflow steps WITHOUT database access
  async function processData() {
    'use step';
    // Process data, return results
    return results;
  }

  const results = await processData();

  // Database operations OUTSIDE workflow steps (not durable)
  const { db } = await import('@/db/drizzle');
  await db.insert(table).values(results);
}
```

**Tradeoffs**:
- ✅ Builds successfully
- ✅ Workflows remain durable for processing steps
- ❌ Database operations are not durable (won't retry on failure)

#### Option 2: Use External Database API

Create API routes for database operations and call them from workflows:

```typescript
async function saveResults(data: any) {
  'use step';

  // Call API instead of direct database access
  await fetch('/api/internal/save-results', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}
```

**Tradeoffs**:
- ✅ Builds successfully
- ✅ Database operations are durable
- ❌ Requires additional API routes
- ❌ More network overhead

#### Option 3: Skip Workflow for Database Operations

Don't use "use step" for database operations:

```typescript
export async function POST(req: Request) {
  'use workflow';

  async function getMCPData() {
    'use step'; // Durable
    return data;
  }

  async function analyzeWithAI(data: any) {
    'use step'; // Durable
    return analysis;
  }

  // Not wrapped in "use step" - not durable but doesn't break build
  async function saveToDatabase(analysis: any) {
    const { db } = await import('@/db/drizzle');
    await db.insert(table).values(analysis);
  }

  const data = await getMCPData();
  const analysis = await analyzeWithAI(data);
  await saveToDatabase(analysis); // Runs but not durable
}
```

**Tradeoffs**:
- ✅ Builds successfully
- ✅ Most operations are durable
- ❌ Final database save is not durable

### Recommended Solution

Use **Option 3** for now:
1. Keep MCP and AI operations in "use step" (most important to be durable)
2. Remove "use step" from database operations
3. Database saves happen after workflow completes

This provides:
- ✅ Durable file collection and AI analysis
- ✅ Builds successfully
- ❌ Database saves aren't retried (acceptable tradeoff)

### Future Fix

Waiting for Vercel Workflow to support:
1. Runtime-only imports in workflows
2. Better esbuild configuration for external dependencies
3. Or official guidance on database access patterns

### Testing Locally

Workflows work perfectly in local development:

```bash
npm run dev

# Test security workflow
curl -X POST http://localhost:3000/api/workflows/security-monitor \
  -H "Content-Type: application/json" \
  -d '{"logDirectory":"logs"}'
```

The build error only affects production deployment, not local functionality.

## Status: Active Development

This is a known limitation of the Vercel Workflow beta. The team is aware and investigating solutions.

**Last Updated**: 2025-11-05
