# MCP Production Deployment Guide

## Important: AI SDK v5 Transport Limitations

⚠️ **The stdio transport used in local development CANNOT be deployed to Vercel production.**

Your project uses **AI SDK v5.0.87**, which requires different MCP transport mechanisms for local vs. production:

- **Local Development**: Stdio transport (spawns MCP server as subprocess) ✅
- **Production (Vercel)**: HTTP/SSE transport (connects to remote MCP server) ✅

## Current Implementation Status

✅ **Local Development**: Fully working with stdio transport
⚠️ **Production Deployment**: Requires MCP server deployment (options below)

## Production Deployment Options

### Option 1: Deploy MCP Server to Vercel (Recommended)

Deploy your MCP filesystem server as a separate Vercel Function that workflows can connect to via HTTP.

#### Steps:

1. **Create MCP Server API Route**

Create `app/api/mcp/filesystem/route.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Your MCP server logic here
// This will expose HTTP/SSE endpoints

export async function GET(req: NextRequest) {
  // Handle SSE connection
}

export async function POST(req: NextRequest) {
  // Handle HTTP requests
}
```

2. **Set Environment Variable**

```bash
MCP_SERVER_URL=https://your-app.vercel.app/api/mcp/filesystem
MCP_SERVER_API_KEY=your_secret_key
```

3. **Workflows Auto-Connect**

The workflows will automatically use HTTP transport in production:

```typescript
// Automatically detects environment and uses appropriate transport
const client = await createFilesystemMCPClient();
```

#### Challenges:

- MCP server needs access to Windows file shares from Vercel
- May require VPN or exposing file shares over internet
- Consider security implications

### Option 2: Self-Hosted MCP Server

Run the MCP server on your own infrastructure with access to Windows shares.

#### Steps:

1. **Deploy MCP Server to Your Server**

```bash
# On your server with access to Windows shares
git clone your-repo
cd ai-chatbot
npm install
npm run build:mcp

# Run MCP server with HTTP transport
node lib/mcp-servers/dist/filesystem-server-http.js
```

2. **Create HTTP Wrapper** (we'll provide this below)

3. **Set Environment Variable**

```bash
MCP_SERVER_URL=https://your-mcp-server.example.com
MCP_SERVER_API_KEY=your_secret_key
```

### Option 3: Hybrid Approach (Recommended for Initial Setup)

Use local development for testing, then deploy MCP server separately when ready.

#### Current Status:

- ✅ Works perfectly in local development
- ⏳ Production requires Option 1 or 2 above

## Updated Environment Variables

Add to your `.env.local` and Vercel:

```bash
# Local development (stdio transport)
WINDOWS_SERVER=192.168.1.100
WINDOWS_SHARE=Logs
WINDOWS_USERNAME=admin
WINDOWS_PASSWORD=your_password
MOUNT_POINT=/mnt/windows-share

# Production (HTTP transport)
MCP_SERVER_URL=https://your-mcp-server.vercel.app/api/mcp/filesystem
MCP_SERVER_API_KEY=your_secret_key_here

# The workflows automatically detect which to use
```

## Architecture Comparison

### Local Development (Stdio)
```
Workflow → Stdio Transport → MCP Server (subprocess) → Windows Share
```

### Production (HTTP)
```
Workflow → HTTP Transport → Remote MCP Server → Windows Share
           (via Internet)    (on your infra)     (on your network)
```

## Alternative: Local Execution Only

If production deployment is complex, you can:

1. **Disable Vercel Cron** - Remove `vercel.json` cron jobs
2. **Run Locally** - Execute workflows from your local machine/server
3. **Manual Triggers** - Use local scripts to trigger workflows

```bash
# Run locally on schedule (using cron on Linux/Mac)
# Add to crontab:
0 * * * * curl -X POST http://localhost:3000/api/workflows/security-monitor \
  -H "Content-Type: application/json" \
  -H "Cookie: $(cat ~/.auth-cookie)" \
  -d '{"logDirectory":"logs"}'
```

## AI SDK v5 MCP Features

Your AI SDK v5.0.87 includes:

- ✅ `experimental_createMCPClient` - Native MCP client
- ✅ Automatic tool conversion - MCP tools work with `streamText()`
- ✅ Both stdio and HTTP transports supported
- ✅ Tool schema validation
- ⚠️ **Experimental** - API may change in future versions

## What Works Now

### ✅ Local Development
```bash
npm run dev

# Workflows use stdio transport automatically
curl -X POST http://localhost:3000/api/workflows/security-monitor \
  -H "Content-Type: application/json" \
  -d '{"logDirectory":"logs"}'
```

### ⏳ Production Deployment
Requires deploying MCP server with HTTP transport (see options above).

## Testing Your Setup

### Test Local MCP Connection

```bash
# Start dev server
npm run dev

# Test security workflow
curl -X POST http://localhost:3000/api/workflows/security-monitor \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{"logDirectory":"logs","severity":"medium"}'

# Should see:
# ✅ "Connecting to MCP server via stdio (local)"
# ✅ "MCP client connected"
# ✅ "Available MCP tools: ..."
```

### Test Production HTTP Connection (when deployed)

```bash
# Deploy to Vercel
vercel deploy

# Set environment variable
vercel env add MCP_SERVER_URL

# Test workflow
curl -X POST https://your-app.vercel.app/api/workflows/security-monitor \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{"logDirectory":"logs"}'

# Should see:
# ✅ "Connecting to MCP server via HTTP: ..."
```

## Next Steps

**For immediate local testing:**
1. ✅ Everything is already set up!
2. Use `npm run dev` and test workflows locally
3. Workflows will use stdio transport automatically

**For production deployment:**
1. Choose deployment option (1, 2, or 3 above)
2. Deploy MCP server with HTTP transport
3. Set `MCP_SERVER_URL` environment variable
4. Workflows will automatically use HTTP transport

## Need Help?

The implementation now supports both local and production modes automatically:

```typescript
// lib/mcp-client.ts
export async function createFilesystemMCPClient(config?: MCPClientConfig) {
  const isProduction = process.env.NODE_ENV === 'production';
  const transportType = config?.transportType || (isProduction ? 'http' : 'stdio');

  if (transportType === 'http') {
    // Use HTTP for production
  } else {
    // Use stdio for local dev
  }
}
```

**The workflows will automatically work in local development now.** Production deployment requires additional setup (see options above).

## Summary

- ✅ **AI SDK v5 fully compatible** with MCP integration
- ✅ **Local development works** out of the box (stdio)
- ⏳ **Production requires** MCP server deployment (HTTP)
- ✅ **Automatic detection** of environment and transport
- ✅ **All workflows updated** to use new MCP client factory

You can start using the workflows immediately in local development!
