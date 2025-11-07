/**
 * MCP Client Factory
 * Creates MCP clients that work in both local development (stdio) and production (HTTP)
 *
 * Note: experimental_createMCPClient is not available in current AI SDK version.
 * This is a custom implementation using the MCP SDK directly.
 */

// import { experimental_createMCPClient } from 'ai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export type MCPTransportType = 'stdio' | 'http';

interface MCPClientConfig {
  transportType?: MCPTransportType;
  httpUrl?: string;
  httpHeaders?: Record<string, string>;
}

/**
 * Create an MCP client that works in both development and production
 *
 * Development (local): Uses stdio transport to spawn MCP server as subprocess
 * Production (Vercel): Uses HTTP transport to connect to deployed MCP server
 */
export async function createFilesystemMCPClient(config?: MCPClientConfig) {
  const isProduction = process.env.NODE_ENV === 'production';
  const transportType = config?.transportType || (isProduction ? 'http' : 'stdio');

  if (transportType === 'http') {
    // Production: HTTP transport to remote MCP server
    const httpUrl = config?.httpUrl || process.env.MCP_SERVER_URL;

    if (!httpUrl) {
      throw new Error(
        'MCP_SERVER_URL environment variable required for production deployment. ' +
        'See WORKFLOW_INTEGRATION.md for setup instructions.'
      );
    }

    console.log(`Connecting to MCP server via HTTP: ${httpUrl}`);

    // TODO: Implement HTTP transport when available
    throw new Error('HTTP transport not yet implemented for MCP client');
  } else {
    // Development: Stdio transport (local subprocess)
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

    console.log('Connecting to MCP server via stdio (local)');

    const transport = new StdioClientTransport({
      command: 'node',
      args: ['./lib/mcp-servers/dist/filesystem-server.js'],
      env: {
        WINDOWS_SERVER: process.env.WINDOWS_SERVER || '',
        WINDOWS_SHARE: process.env.WINDOWS_SHARE || '',
        WINDOWS_USERNAME: process.env.WINDOWS_USERNAME || '',
        WINDOWS_PASSWORD: process.env.WINDOWS_PASSWORD || '',
        MOUNT_POINT: process.env.MOUNT_POINT || '/mnt/windows-share',
      },
    });

    const client = new Client({
      name: 'filesystem-mcp-client',
      version: '1.0.0',
    }, {
      capabilities: {},
    });

    await client.connect(transport);

    // Wrap client to provide tools() method for AI SDK compatibility
    return {
      ...client,
      async tools() {
        const toolsList = await client.listTools();
        const toolsMap: Record<string, Function> = {};

        for (const tool of toolsList.tools) {
          toolsMap[tool.name] = async (params: any) => {
            const result = await client.callTool({ name: tool.name, arguments: params });
            return result;
          };
        }

        return toolsMap;
      },
      async close() {
        await client.close();
      },
    };
  }
}

/**
 * Example usage:
 *
 * // Automatic detection (stdio in dev, HTTP in production)
 * const client = await createFilesystemMCPClient();
 *
 * // Force HTTP transport
 * const client = await createFilesystemMCPClient({
 *   transportType: 'http',
 *   httpUrl: 'https://your-mcp-server.vercel.app/api/mcp'
 * });
 *
 * // Force stdio (local development)
 * const client = await createFilesystemMCPClient({
 *   transportType: 'stdio'
 * });
 */
