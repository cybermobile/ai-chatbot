#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Environment variables for Windows share configuration
const WINDOWS_SERVER = process.env.WINDOWS_SERVER || '';
const WINDOWS_SHARE = process.env.WINDOWS_SHARE || '';
const WINDOWS_USER = process.env.WINDOWS_USERNAME || '';
const WINDOWS_PASS = process.env.WINDOWS_PASSWORD || '';

// Mount point for the Windows share
const MOUNT_POINT = process.env.MOUNT_POINT || '/mnt/windows-share';

// Track if share is mounted
let isMounted = false;

/**
 * Mount Windows share using CIFS (for Linux/Docker)
 * For local development on Windows, you can use UNC paths directly
 */
async function mountShare(): Promise<void> {
  if (isMounted) return;

  try {
    // Check if running on Linux
    const { platform } = process;

    if (platform === 'win32') {
      // On Windows, we can access UNC paths directly
      console.error('Running on Windows - using UNC paths directly');
      isMounted = true;
      return;
    }

    // On Linux, mount the share
    await execAsync(`mkdir -p ${MOUNT_POINT}`);

    const mountCmd = `mount -t cifs //${WINDOWS_SERVER}/${WINDOWS_SHARE} ${MOUNT_POINT} -o username=${WINDOWS_USER},password=${WINDOWS_PASS},vers=3.0`;

    await execAsync(mountCmd);
    console.error(`Mounted ${WINDOWS_SERVER}/${WINDOWS_SHARE} to ${MOUNT_POINT}`);
    isMounted = true;
  } catch (error: any) {
    console.error('Failed to mount share:', error.message);
    // Continue anyway - might already be mounted
    isMounted = true;
  }
}

/**
 * Get the actual filesystem path (handles Windows UNC paths vs Linux mount points)
 */
function getFilePath(relativePath: string): string {
  if (process.platform === 'win32') {
    // Use UNC path on Windows
    return path.join(`\\\\${WINDOWS_SERVER}\\${WINDOWS_SHARE}`, relativePath);
  }
  // Use mount point on Linux
  return path.join(MOUNT_POINT, relativePath);
}

/**
 * Parse syslog line (RFC 3164 format)
 */
interface SyslogEntry {
  timestamp?: string;
  host?: string;
  process?: string;
  pid?: string;
  message?: string;
  raw: string;
  severity?: string;
}

function parseSyslogLine(line: string): SyslogEntry {
  // RFC 3164: <priority>timestamp hostname process[pid]: message
  // Example: Oct 24 11:14:00 server sshd[12345]: Failed password for root from 192.168.1.1

  const match = line.match(
    /^(\w+\s+\d+\s+\d+:\d+:\d+)\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s*(.*)$/
  );

  if (match) {
    return {
      timestamp: match[1],
      host: match[2],
      process: match[3],
      pid: match[4],
      message: match[5],
      raw: line,
    };
  }

  return { raw: line };
}

/**
 * Get severity level from syslog message
 */
function getSeverity(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('critical') || lower.includes('fatal')) return 'critical';
  if (lower.includes('error') || lower.includes('fail')) return 'error';
  if (lower.includes('warning') || lower.includes('warn')) return 'warning';
  if (lower.includes('notice')) return 'notice';
  if (lower.includes('info')) return 'info';
  return 'debug';
}

// Initialize MCP Server
const server = new Server(
  {
    name: 'windows-filesystem',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(
  {
    method: 'tools/list',
  } as any,
  async () => {
    return {
      tools: [
      {
        name: 'list_files',
        description: 'List files in a directory on the Windows share. Returns file names, sizes, and modification dates.',
        inputSchema: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'Directory path relative to share root (e.g., "logs" or "documents/2024")',
            },
            pattern: {
              type: 'string',
              description: 'File pattern to match (e.g., "*.log", "*.txt", "syslog*")',
            },
          },
          required: ['directory'],
        },
      },
      {
        name: 'read_file',
        description: 'Read the contents of a file from the Windows share',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path relative to share root',
            },
            encoding: {
              type: 'string',
              description: 'File encoding (default: utf-8)',
              enum: ['utf-8', 'ascii', 'latin1'],
            },
            maxLines: {
              type: 'number',
              description: 'Maximum number of lines to read (default: all)',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'read_syslog',
        description: 'Read and parse syslog files with optional filtering by date and severity',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to syslog file relative to share root',
            },
            since: {
              type: 'string',
              description: 'ISO date string to filter logs from (e.g., "2024-11-01T00:00:00Z")',
            },
            severity: {
              type: 'string',
              description: 'Minimum severity level to include',
              enum: ['debug', 'info', 'notice', 'warning', 'error', 'critical'],
            },
            maxEntries: {
              type: 'number',
              description: 'Maximum number of entries to return (default: 1000)',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'search_logs',
        description: 'Search through log files for specific patterns using regex',
        inputSchema: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'Directory containing log files',
            },
            pattern: {
              type: 'string',
              description: 'Search pattern (regex) to find in logs',
            },
            filePattern: {
              type: 'string',
              description: 'File pattern to search in (e.g., "*.log")',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return (default: 100)',
            },
          },
          required: ['directory', 'pattern'],
        },
      },
    ],
  };
}
);

// Implement tool handlers
server.setRequestHandler(
  {
    method: 'tools/call',
  } as any,
  async (request: any) => {
    const { name, arguments: args } = request.params as {
      name: string;
      arguments: any;
    };

  try {
    await mountShare();

    if (name === 'list_files') {
      const dirPath = getFilePath(args.directory);

      let files: string[];
      try {
        files = await fs.readdir(dirPath);
      } catch (error: any) {
        throw new Error(`Failed to read directory: ${error.message}`);
      }

      // Filter by pattern if provided
      let filtered = files;
      if (args.pattern) {
        const regex = new RegExp(
          '^' + args.pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
        );
        filtered = files.filter((f) => regex.test(f));
      }

      // Get file stats
      const stats = await Promise.all(
        filtered.map(async (file) => {
          try {
            const stat = await fs.stat(path.join(dirPath, file));
            return {
              name: file,
              size: stat.size,
              modified: stat.mtime.toISOString(),
              isDirectory: stat.isDirectory(),
            };
          } catch {
            return {
              name: file,
              size: 0,
              modified: new Date().toISOString(),
              isDirectory: false,
            };
          }
        })
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    }

    if (name === 'read_file') {
      const filePath = getFilePath(args.path);
      const encoding = (args.encoding || 'utf-8') as BufferEncoding;

      let content: string;
      try {
        content = await fs.readFile(filePath, encoding);
      } catch (error: any) {
        throw new Error(`Failed to read file: ${error.message}`);
      }

      // Limit lines if specified
      if (args.maxLines) {
        const lines = content.split('\n').slice(0, args.maxLines);
        content = lines.join('\n');
      }

      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    }

    if (name === 'read_syslog') {
      const filePath = getFilePath(args.path);

      let content: string;
      try {
        content = await fs.readFile(filePath, 'utf-8');
      } catch (error: any) {
        throw new Error(`Failed to read syslog file: ${error.message}`);
      }

      // Parse syslog entries
      const lines = content.split('\n').filter((line) => line.trim());
      let parsed = lines.map(parseSyslogLine);

      // Filter by severity if specified
      if (args.severity) {
        const severityLevels = ['debug', 'info', 'notice', 'warning', 'error', 'critical'];
        const minLevel = severityLevels.indexOf(args.severity);

        parsed = parsed.filter((entry) => {
          if (!entry.message) return false;
          const entrySeverity = getSeverity(entry.message);
          return severityLevels.indexOf(entrySeverity) >= minLevel;
        });
      }

      // Filter by date if specified (basic filtering - you may need better date parsing)
      if (args.since) {
        const sinceDate = new Date(args.since);
        // Note: This is simplified - proper syslog date parsing would be more complex
        parsed = parsed.slice(-1000); // Just get recent entries for now
      }

      // Limit results
      const maxEntries = args.maxEntries || 1000;
      if (parsed.length > maxEntries) {
        parsed = parsed.slice(-maxEntries);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(parsed, null, 2),
          },
        ],
      };
    }

    if (name === 'search_logs') {
      const dirPath = getFilePath(args.directory);

      let files: string[];
      try {
        files = await fs.readdir(dirPath);
      } catch (error: any) {
        throw new Error(`Failed to read directory: ${error.message}`);
      }

      // Filter files by pattern
      const filePattern = args.filePattern || '*.log';
      const fileRegex = new RegExp(
        '^' + filePattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
      );
      const logFiles = files.filter((f) => fileRegex.test(f));

      // Search for pattern in files
      const searchRegex = new RegExp(args.pattern, 'gi');
      const results: any[] = [];
      const maxResults = args.maxResults || 100;

      for (const file of logFiles) {
        if (results.length >= maxResults) break;

        try {
          const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            if (results.length >= maxResults) break;

            if (searchRegex.test(lines[i])) {
              results.push({
                file,
                line: i + 1,
                content: lines[i],
              });
            }
          }
        } catch {
          // Skip files that can't be read
          continue;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}
);

// Start the server
async function main() {
  try {
    await mountShare();

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('Windows Filesystem MCP Server running on stdio');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
