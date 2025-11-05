import { auth } from '@/app/(auth)/auth';
import { db } from '@/db/drizzle';
import { securityScans, ragIngestions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export default async function WorkflowsPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  // Fetch security scans
  const scans = await db
    .select()
    .from(securityScans)
    .where(eq(securityScans.userId, session.user.id!))
    .orderBy(desc(securityScans.createdAt))
    .limit(20);

  // Fetch RAG ingestions
  const ingestions = await db
    .select()
    .from(ragIngestions)
    .where(eq(ragIngestions.userId, session.user.id!))
    .orderBy(desc(ragIngestions.createdAt))
    .limit(20);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Workflow Executions</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor your security scans and document ingestion workflows
        </p>
      </div>

      {/* Security Scans Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <span>🛡️</span> Security Scans
        </h2>

        {scans.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-900 p-8 rounded-lg text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No security scans yet. Scans run automatically every hour via Vercel Cron.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Configure your Windows share credentials in environment variables to enable scanning.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {scans.map((scan) => (
              <div
                key={scan.id}
                className="border dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(
                          scan.severity || 'none'
                        )}`}
                      >
                        {(scan.severity || 'none').toUpperCase()}
                      </span>
                      {scan.emailSent && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <span>📧</span> Alert sent
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>Source:</strong> {scan.source}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>Scanned:</strong>{' '}
                      {new Date(scan.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {typeof scan.issuesFound === 'number' ? scan.issuesFound : 0}
                    </p>
                    <p className="text-xs text-gray-500">issues found</p>
                  </div>
                </div>

                {scan.analysis && typeof scan.analysis === 'object' && 'summary' in scan.analysis && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {(scan.analysis as any).summary}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RAG Ingestions Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <span>📚</span> Document Ingestions
        </h2>

        {ingestions.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-900 p-8 rounded-lg text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No document ingestions yet. Ingestions run daily at 2 AM via Vercel Cron.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Documents from your Windows share will be indexed for RAG search.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {ingestions.map((ingestion) => (
              <div
                key={ingestion.id}
                className="border dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                          ingestion.status || 'unknown'
                        )}`}
                      >
                        {(ingestion.status || 'unknown').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>Source:</strong> {ingestion.source}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>Started:</strong>{' '}
                      {new Date(ingestion.createdAt).toLocaleString()}
                    </p>
                    {ingestion.completedAt && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>Completed:</strong>{' '}
                        {new Date(ingestion.completedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right space-y-2">
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {typeof ingestion.documentsProcessed === 'number'
                          ? ingestion.documentsProcessed
                          : 0}
                      </p>
                      <p className="text-xs text-gray-500">documents</p>
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">
                        {typeof ingestion.embeddingsCreated === 'number'
                          ? ingestion.embeddingsCreated
                          : 0}
                      </p>
                      <p className="text-xs text-gray-500">embeddings</p>
                    </div>
                  </div>
                </div>

                {ingestion.error && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                      Error:
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                      {ingestion.error}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Trigger Section */}
      <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold mb-2 text-blue-900 dark:text-blue-100">
          Manual Workflow Triggers
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
          Workflows run automatically via Vercel Cron, but you can also trigger them manually via
          API:
        </p>
        <div className="space-y-2 font-mono text-xs">
          <div className="bg-white dark:bg-gray-800 p-3 rounded border border-blue-200 dark:border-gray-700">
            <code className="text-gray-800 dark:text-gray-200">
              POST /api/workflows/security-monitor
            </code>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Body: {JSON.stringify({ logDirectory: 'logs', severity: 'medium' })}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded border border-blue-200 dark:border-gray-700">
            <code className="text-gray-800 dark:text-gray-200">
              POST /api/workflows/rag-ingest
            </code>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Body:{' '}
              {JSON.stringify({ documentDirectory: 'documents', filePattern: '*.txt' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
