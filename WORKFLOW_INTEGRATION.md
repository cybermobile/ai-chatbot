# Vercel Workflow + MCP Integration Guide

This project now includes **Vercel Workflow** and **Model Context Protocol (MCP)** integration for:
- 🛡️ **Automated security monitoring** of Windows file shares
- 📚 **Document ingestion** from network shares for RAG
- 📧 **Email alerts** for security issues
- ⏰ **Scheduled workflows** via Vercel Cron

## ⚠️ Important: AI SDK v5 & Production Deployment

This project uses **AI SDK v5.0.87**. The MCP integration works differently in local vs. production:

- ✅ **Local Development**: Fully functional with stdio transport (subprocess)
- ⏳ **Production Deployment**: Requires HTTP transport (see [MCP_PRODUCTION_DEPLOYMENT.md](./MCP_PRODUCTION_DEPLOYMENT.md))

**You can use all features immediately in local development!** Production deployment requires additional MCP server setup.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│              Vercel Workflow (Scheduled via Cron)            │
│                                                              │
│  experimental_createMCPClient → streamText → Resend Email   │
└─────────────────────────────────────────────────────────────┘
         ↓                              ↓              ↓
  ┌─────────────┐              ┌─────────────┐  ┌──────────┐
  │  MCP Server │              │  AI Model   │  │  Resend  │
  │ (Filesystem)│      →       │  (vLLM)     │→ │  Email   │
  └─────────────┘              └─────────────┘  └──────────┘
         ↓
  Windows File Share
  (Syslog, Documents)
```

## Features

### 1. Security Monitoring Workflow
- **Automated analysis** of syslog files from Windows shares
- **AI-powered detection** of security threats:
  - Brute force attacks
  - Privilege escalation attempts
  - Suspicious commands
  - Port scans
  - File integrity changes
- **Email alerts** when issues are detected
- **Scheduled execution** every hour

### 2. RAG Document Ingestion Workflow
- **Collect documents** from Windows file shares
- **Generate embeddings** using your AI model
- **Store in vector database** for semantic search
- **Scheduled execution** daily at 2 AM

### 3. MCP Filesystem Server
- **Secure access** to Windows file shares
- **Tools for AI**:
  - `list_files` - List files in a directory
  - `read_file` - Read file contents
  - `read_syslog` - Parse and filter syslog entries
  - `search_logs` - Search logs with regex patterns

## Installation & Setup

### 1. Install Dependencies

Already completed! The following packages have been installed:
- `workflow@4.0.1-beta.9` - Vercel Workflow Development Kit
- `@modelcontextprotocol/sdk@1.21.0` - MCP SDK
- `resend@6.4.1` - Email service

### 2. Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Windows File Share Access
WINDOWS_SERVER=192.168.1.100
WINDOWS_SHARE=Logs
WINDOWS_USERNAME=admin
WINDOWS_PASSWORD=your_secure_password
MOUNT_POINT=/mnt/windows-share

# Email Configuration (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=Security Monitor <security@yourdomain.com>
SECURITY_ALERT_RECIPIENTS=security@company.com,admin@company.com

# Embedding Model
EMBEDDING_MODEL=nomic-embed-text  # or BAAI/bge-small-en-v1.5 for vLLM
```

### 3. Set Up Resend Email

1. Sign up at https://resend.com
2. Get your API key
3. Add the Resend integration to your Vercel project: https://vercel.com/integrations/resend
4. Verify your domain (or use Resend's test domain for development)

### 4. Run Database Migration

```bash
# Make sure DATABASE_URL is set in .env.local
npm run migrate:db
```

This creates the following tables:
- `SecurityScans` - Security scan results
- `RagIngestions` - Document ingestion records
- `Workflows` - Workflow definitions

### 5. Build MCP Server

```bash
npm run build:mcp
```

This compiles the TypeScript MCP filesystem server to JavaScript.

## Usage

### Viewing Workflow Executions

Visit `/workflows` in your application to see:
- Recent security scans with severity levels
- Document ingestion history
- Execution status and errors

### Scheduled Execution

Workflows run automatically via Vercel Cron:
- **Security Monitor**: Every hour (`0 * * * *`)
- **RAG Ingest**: Daily at 2 AM (`0 2 * * *`)

Schedule configured in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/workflows/security-monitor", "schedule": "0 * * * *" },
    { "path": "/api/workflows/rag-ingest", "schedule": "0 2 * * *" }
  ]
}
```

### Manual Execution

You can also trigger workflows manually via API:

**Security Monitoring:**
```bash
curl -X POST http://localhost:3000/api/workflows/security-monitor \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "logDirectory": "logs",
    "severity": "medium"
  }'
```

**RAG Ingestion:**
```bash
curl -X POST http://localhost:3000/api/workflows/rag-ingest \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "documentDirectory": "documents",
    "filePattern": "*.txt"
  }'
```

## How It Works

### Security Monitoring Workflow

1. **Connect to MCP Server** (`use step`)
   - Spawns MCP filesystem server as subprocess
   - Provides secure access to Windows share

2. **AI Analysis** (`use step`)
   - Gets MCP tools (`list_files`, `read_syslog`, `search_logs`)
   - AI model uses tools autonomously to analyze logs
   - Returns JSON analysis with severity and issues

3. **Send Email Alert** (`use step`)
   - If severity is medium/high/critical, sends email via Resend
   - Includes detailed findings and recommendations

4. **Save Results** (`use step`)
   - Stores scan results in `SecurityScans` table
   - Tracks severity, issues found, and email status

### RAG Ingestion Workflow

1. **Collect Documents** (`use step`)
   - Lists files matching pattern from Windows share
   - Reads file contents via MCP

2. **Generate Embeddings** (`use step`)
   - Splits documents into chunks
   - Generates embeddings using your AI model
   - Uses `nomic-embed-text` (Ollama) or `BAAI/bge-small-en-v1.5` (vLLM)

3. **Store in Database** (`use step`)
   - Creates resource record
   - Inserts embeddings in batches
   - Uses pgvector for semantic search

4. **Save Ingestion Record** (`use step`)
   - Tracks documents processed and embeddings created
   - Stores status and errors

## Windows Share Access

### On Linux (Docker/Vercel)

The MCP server mounts the Windows share using CIFS:
```bash
mount -t cifs //SERVER/SHARE /mnt/windows-share \
  -o username=USER,password=PASS,vers=3.0
```

### On Windows (Local Development)

The MCP server uses UNC paths directly:
```
\\SERVER\SHARE\path\to\file
```

### Permissions Required

Your Windows user needs:
- Read access to log files
- Read access to document directories
- Network file share permissions

## Vercel Workflow Features

### Durability
- Workflows automatically resume after failures
- Each step's progress is persisted
- No data loss on crashes

### Observability
- Every step is tracked
- Inputs and outputs logged
- Errors captured with context

### Use Step Directive
```typescript
export async function POST(req: Request) {
  'use workflow';  // Enable workflow durability

  async function myStep() {
    'use step';  // Mark as durable step
    // Your code here
  }

  await myStep();
}
```

## MCP + AI SDK Integration

### How AI Uses MCP Tools

```typescript
// AI SDK 4.2 native MCP support
const mcpClient = await experimental_createMCPClient({
  transport: new StdioClientTransport({ ... })
});

const tools = await mcpClient.tools();

// Tools work directly with streamText!
const result = await streamText({
  model: customModel('llama3.1:latest'),
  tools,  // MCP tools automatically available
  maxSteps: 15,
  messages: [{ role: 'user', content: 'Analyze logs...' }]
});
```

### AI Autonomy

The AI model decides:
- **When** to use tools
- **Which** tools to use
- **How many times** to call them
- **What parameters** to pass

Example flow:
1. AI calls `list_files` to see available logs
2. AI calls `read_syslog` on recent files
3. AI calls `search_logs` for suspicious patterns
4. AI returns analysis

## Troubleshooting

### MCP Server Won't Start
- Check `lib/mcp-servers/dist/filesystem-server.js` exists
- Run `npm run build:mcp` to compile TypeScript
- Verify Windows credentials in environment variables

### Can't Access Windows Share
- Test connectivity: `ping WINDOWS_SERVER`
- Verify credentials with `smbclient` (Linux) or file explorer (Windows)
- Check firewall rules for SMB/CIFS (port 445)

### Database Migration Fails
- Ensure `POSTGRES_URL` is set in `.env.local`
- Check database has pgvector extension enabled
- Run manually: `npm run migrate:db`

### Email Not Sending
- Verify `RESEND_API_KEY` is correct
- Check Resend dashboard for errors
- Ensure sender email is verified
- Note: Vercel blocks SMTP, use Resend API instead

### Workflows Not Running on Schedule
- Cron jobs only work on Vercel production deployment
- For local development, trigger manually via API
- Check Vercel dashboard → Cron for execution logs

## File Structure

```
ai-chatbot/
├── lib/
│   └── mcp-servers/
│       ├── filesystem-server.ts      # MCP filesystem server
│       ├── tsconfig.json              # TypeScript config
│       └── dist/
│           └── filesystem-server.js   # Compiled server
├── app/
│   ├── api/
│   │   └── workflows/
│   │       ├── security-monitor/
│   │       │   └── route.ts          # Security workflow
│   │       └── rag-ingest/
│   │           └── route.ts          # RAG workflow
│   └── (chat)/
│       └── workflows/
│           └── page.tsx               # Workflow UI
├── db/
│   ├── schema.ts                      # Database schema (updated)
│   └── drizzle/
│       └── 0002_little_penance.sql   # Migration
├── vercel.json                        # Cron configuration
├── next.config.mjs                    # Workflow integration
└── .env.example                       # Environment variables template
```

## Key Benefits

✅ **AI-Powered Security** - Automated threat detection using LLMs
✅ **Scalable** - Workflows handle long-running operations
✅ **Reliable** - Built-in retries and error handling
✅ **Observable** - Full execution tracking
✅ **No Polling** - Direct file access via MCP
✅ **Scheduled** - Automated execution via Vercel Cron
✅ **Email Alerts** - Instant notifications via Resend
✅ **RAG Integration** - Documents become searchable knowledge

## Next Steps

1. **Configure environment variables** in `.env.local`
2. **Run database migration**: `npm run migrate:db`
3. **Build MCP server**: `npm run build:mcp`
4. **Test locally**: Trigger workflows manually via API
5. **Deploy to Vercel**: Cron jobs activate automatically
6. **Set up Resend integration** for email alerts
7. **Configure Windows share** access

## Additional Resources

- Vercel Workflow Docs: https://vercel.com/docs/workflow
- MCP Documentation: https://modelcontextprotocol.io
- AI SDK MCP Integration: https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools
- Resend Docs: https://resend.com/docs

## Support

For issues or questions:
- Check workflow execution logs in `/workflows` page
- Review Vercel function logs in dashboard
- Test MCP server manually: `node lib/mcp-servers/dist/filesystem-server.js`
- Verify Windows share access with `smbclient` or Windows Explorer
