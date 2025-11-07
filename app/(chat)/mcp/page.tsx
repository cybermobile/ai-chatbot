import { auth } from '@/app/(auth)/auth';
import { db } from '@/db/drizzle';
import { securityScans, ragIngestions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Shield, Server, Wrench, Activity, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';

export default async function MCPPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  // Fetch recent workflow executions
  const recentScans = await db
    .select()
    .from(securityScans)
    .where(eq(securityScans.userId, session.user.id!))
    .orderBy(desc(securityScans.createdAt))
    .limit(5);

  const recentIngestions = await db
    .select()
    .from(ragIngestions)
    .where(eq(ragIngestions.userId, session.user.id!))
    .orderBy(desc(ragIngestions.createdAt))
    .limit(5);

  // MCP Server configuration (from env)
  const mcpConfig = {
    server: process.env.WINDOWS_SERVER || 'Not configured',
    share: process.env.WINDOWS_SHARE || 'Not configured',
    transport: process.env.MCP_SERVER_URL ? 'HTTP' : 'stdio',
    version: '1.0.0',
  };

  // Available tools
  const tools = [
    {
      name: 'list_files',
      description: 'Lists files in a directory on Windows share',
      params: ['directory', 'pattern (optional)'],
    },
    {
      name: 'read_file',
      description: 'Reads file contents from Windows share',
      params: ['path', 'encoding', 'maxLines'],
    },
    {
      name: 'read_syslog',
      description: 'Parses syslog files with RFC 3164 format',
      params: ['path', 'since', 'severity', 'maxEntries'],
    },
    {
      name: 'search_logs',
      description: 'Regex search through log files',
      params: ['directory', 'pattern', 'filePattern', 'maxResults'],
    },
  ];

  return (
    <div className="flex flex-col min-h-screen p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Shield className="h-8 w-8" />
          MCP Servers
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Model Context Protocol server management and monitoring
        </p>
      </div>

      {/* Server Status Section */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connection Status */}
        <div className="border dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Server className="h-5 w-5" />
            Server Status
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-600 dark:text-green-400">Connected</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Transport</span>
              <span className="text-sm font-medium">{mcpConfig.transport}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Version</span>
              <span className="text-sm font-medium">{mcpConfig.version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Available Tools</span>
              <span className="text-sm font-medium">{tools.length}</span>
            </div>
          </div>
        </div>

        {/* Windows Share Config */}
        <div className="border dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Windows Share
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Server</span>
              <span className="text-sm font-medium">{mcpConfig.server}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Share</span>
              <span className="text-sm font-medium">{mcpConfig.share}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Mount Status</span>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-600 dark:text-green-400">Mounted</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Available Tools Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Wrench className="h-6 w-6" />
          Available Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tools.map((tool) => (
            <div
              key={tool.name}
              className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold mb-2">{tool.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {tool.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {tool.params.map((param) => (
                  <span
                    key={param}
                    className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                  >
                    {param}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-6 w-6" />
          Recent Workflow Executions
        </h2>

        {/* Recent Security Scans */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Security Scans</h3>
          {recentScans.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-sm">No recent scans</p>
          ) : (
            <div className="space-y-2">
              {recentScans.map((scan) => (
                <div
                  key={scan.id}
                  className="flex items-center justify-between p-3 border dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">{scan.source}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {new Date(scan.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">
                      <span className="font-medium">{Number(scan.issuesFound) || 0}</span> issues
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        scan.severity === 'critical'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : scan.severity === 'high'
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      }`}
                    >
                      {scan.severity || 'low'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent RAG Ingestions */}
        <div>
          <h3 className="text-lg font-medium mb-3">Document Ingestions</h3>
          {recentIngestions.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-sm">No recent ingestions</p>
          ) : (
            <div className="space-y-2">
              {recentIngestions.map((ingestion) => (
                <div
                  key={ingestion.id}
                  className="flex items-center justify-between p-3 border dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">{ingestion.source}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {new Date(ingestion.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">
                      <span className="font-medium">{Number(ingestion.documentsProcessed) || 0}</span> docs
                    </span>
                    <span className="text-sm">
                      <span className="font-medium">{Number(ingestion.embeddingsCreated) || 0}</span> embeddings
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        ingestion.status === 'completed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}
                    >
                      {ingestion.status || 'unknown'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
