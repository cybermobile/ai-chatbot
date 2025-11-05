import { auth } from '@/app/(auth)/auth';
import { customModel } from '@/ai/models';
import { streamText } from 'ai';
import { Resend } from 'resend';

// Vercel Workflow support
export const maxDuration = 300; // 5 minutes for long-running workflow

const resend = new Resend(process.env.RESEND_API_KEY);

interface SecurityAnalysis {
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  issues: Array<{
    type: string;
    description: string;
    evidence: string[];
    affected_hosts?: string[];
  }>;
  summary: string;
  recommendations?: string[];
  logsAnalyzed: number;
}

export async function POST(req: Request) {
  'use workflow';

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    logDirectory = 'logs',
    recipients = process.env.SECURITY_ALERT_RECIPIENTS?.split(',') || [],
    severity = 'medium',
  } = body;

  // Step 1: Connect to MCP Filesystem Server and get tools
  async function getMCPTools() {
    'use step';

    console.log('Connecting to MCP filesystem server...');

    // Import MCP client
    const { experimental_createMCPClient } = await import('ai');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

    const client = await experimental_createMCPClient({
      transport: new StdioClientTransport({
        command: 'node',
        args: ['./lib/mcp-servers/dist/filesystem-server.js'],
        env: {
          WINDOWS_SERVER: process.env.WINDOWS_SERVER || '',
          WINDOWS_SHARE: process.env.WINDOWS_SHARE || '',
          WINDOWS_USERNAME: process.env.WINDOWS_USERNAME || '',
          WINDOWS_PASSWORD: process.env.WINDOWS_PASSWORD || '',
          MOUNT_POINT: process.env.MOUNT_POINT || '/mnt/windows-share',
        },
      }),
    });

    console.log('MCP client connected');
    return client;
  }

  // Step 2: Analyze logs with AI using MCP tools
  async function analyzeLogsWithAI(mcpClient: any): Promise<SecurityAnalysis> {
    'use step';

    console.log('Getting MCP tools...');
    const tools = await mcpClient.tools();

    console.log('Available MCP tools:', Object.keys(tools));

    // Use AI with MCP tools to analyze security logs
    console.log('Starting AI analysis of security logs...');

    const systemPrompt = `You are a security analyst AI. Your task is to analyze system logs for security threats and anomalies.

Use the available MCP filesystem tools to:
1. List log files in the "${logDirectory}" directory
2. Read syslog files from the last 24 hours
3. Search for suspicious patterns like:
   - Failed login attempts (brute force indicators)
   - Privilege escalation attempts
   - Unusual sudo commands
   - SSH authentication failures
   - Port scans or network anomalies
   - File integrity changes
   - Suspicious process executions

After analyzing the logs, return your findings in VALID JSON format:

{
  "severity": "none" | "low" | "medium" | "high" | "critical",
  "issues": [
    {
      "type": "string (e.g., 'Brute Force Attack', 'Privilege Escalation')",
      "description": "string (detailed description)",
      "evidence": ["string array of log entries"],
      "affected_hosts": ["string array of hostnames"]
    }
  ],
  "summary": "string (overall security summary)",
  "recommendations": ["string array of recommended actions"],
  "logsAnalyzed": number
}

IMPORTANT: Return ONLY the JSON object, no additional text or markdown formatting.`;

    const result = await streamText({
      model: customModel('llama3.1:latest'),
      tools,
      maxSteps: 15, // Allow AI to use tools multiple times
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Analyze security logs in directory: ${logDirectory}. Focus on ${severity} severity and above issues. Use the MCP tools to access the log files.`,
        },
      ],
    });

    // Collect streamed response
    let analysisText = '';
    for await (const chunk of result.textStream) {
      analysisText += chunk;
    }

    console.log('AI analysis complete:', analysisText.substring(0, 200));

    // Parse JSON from response
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch =
        analysisText.match(/```json\n([\s\S]*?)\n```/) ||
        analysisText.match(/```\n([\s\S]*?)\n```/) ||
        analysisText.match(/(\{[\s\S]*\})/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr);
      }

      // Try parsing directly
      return JSON.parse(analysisText);
    } catch (error) {
      console.error('Failed to parse AI response as JSON:', error);

      // Return a fallback analysis
      return {
        severity: 'low',
        issues: [],
        summary: `Analysis completed but response was not in expected JSON format. Raw response: ${analysisText.substring(0, 500)}`,
        logsAnalyzed: 0,
      };
    }
  }

  // Step 3: Send email alert if issues found
  async function sendSecurityAlert(analysis: SecurityAnalysis) {
    'use step';

    if (analysis.severity === 'none' || analysis.severity === 'low') {
      console.log('No critical issues found, skipping email');
      return { sent: false, reason: 'Low severity' };
    }

    if (recipients.length === 0) {
      console.log('No recipients configured, skipping email');
      return { sent: false, reason: 'No recipients' };
    }

    console.log(`Sending alert to: ${recipients.join(', ')}`);

    const severityColors: Record<string, string> = {
      medium: '#f59e0b',
      high: '#ef4444',
      critical: '#dc2626',
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; }
    .header {
      background: ${severityColors[analysis.severity] || '#f59e0b'};
      color: white;
      padding: 20px;
      border-radius: 8px 8px 0 0;
    }
    .content { padding: 20px; background: #f9fafb; }
    .issue {
      margin: 20px 0;
      padding: 15px;
      background: white;
      border-left: 4px solid ${severityColors[analysis.severity] || '#f59e0b'};
      border-radius: 4px;
    }
    .evidence {
      background: #f3f4f6;
      padding: 10px;
      margin: 10px 0;
      font-family: monospace;
      font-size: 12px;
      overflow-x: auto;
    }
    .recommendations {
      background: #e0f2fe;
      padding: 15px;
      border-radius: 4px;
      margin-top: 20px;
    }
    h1 { margin: 0; }
    h2 { color: #1f2937; }
    h3 { color: #374151; margin-top: 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚨 Security Alert: ${analysis.severity.toUpperCase()}</h1>
    <p>${new Date().toLocaleString()}</p>
  </div>

  <div class="content">
    <h2>Summary</h2>
    <p>${analysis.summary}</p>

    <p><strong>Logs Analyzed:</strong> ${analysis.logsAnalyzed}</p>

    <h2>Issues Detected (${analysis.issues.length})</h2>
    ${
      analysis.issues.length === 0
        ? '<p>No specific issues detected.</p>'
        : analysis.issues
            .map(
              (issue) => `
      <div class="issue">
        <h3>⚠️ ${issue.type}</h3>
        <p><strong>Description:</strong> ${issue.description}</p>

        ${
          issue.affected_hosts && issue.affected_hosts.length > 0
            ? `<p><strong>Affected Hosts:</strong> ${issue.affected_hosts.join(', ')}</p>`
            : ''
        }

        <h4>Evidence:</h4>
        ${issue.evidence
          .map(
            (e) => `
          <div class="evidence">${e}</div>
        `
          )
          .join('')}
      </div>
    `
            )
            .join('')
    }

    ${
      analysis.recommendations && analysis.recommendations.length > 0
        ? `
      <div class="recommendations">
        <h2>🛡️ Recommendations</h2>
        <ul>
          ${analysis.recommendations.map((r) => `<li>${r}</li>`).join('')}
        </ul>
      </div>
    `
        : ''
    }

    <hr style="margin: 30px 0;">
    <p style="color: #6b7280; font-size: 12px;">
      This is an automated security alert from your AI-powered monitoring system.<br>
      Log directory: ${logDirectory}<br>
      Server: ${process.env.WINDOWS_SERVER}/${process.env.WINDOWS_SHARE}
    </p>
  </div>
</body>
</html>
    `;

    try {
      const result = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Security Monitor <security@yourdomain.com>',
        to: recipients,
        subject: `[${analysis.severity.toUpperCase()}] Security Alert - ${analysis.issues.length} Issues Detected`,
        html,
      });

      console.log('Email sent successfully:', result);
      return { sent: true, id: result.data?.id };
    } catch (error: any) {
      console.error('Failed to send email:', error);
      return { sent: false, error: error.message };
    }
  }

  // Step 4: Save scan results to database
  async function saveScanResults(analysis: SecurityAnalysis, emailResult: any) {
    'use step';

    const { db } = await import('@/db/drizzle');
    const { securityScans } = await import('@/db/schema');

    await db.insert(securityScans).values({
      userId: session.user!.id!,
      source: `${process.env.WINDOWS_SERVER}/${process.env.WINDOWS_SHARE}/${logDirectory}`,
      severity: analysis.severity,
      issuesFound: analysis.issues.length,
      logsAnalyzed: analysis.logsAnalyzed || 0,
      analysis: analysis as any,
      emailSent: emailResult.sent === true,
    });

    console.log('Scan results saved to database');
  }

  // Execute workflow
  let mcpClient: any;
  try {
    mcpClient = await getMCPTools();
    const analysis = await analyzeLogsWithAI(mcpClient);
    const emailResult = await sendSecurityAlert(analysis);
    await saveScanResults(analysis, emailResult);

    return Response.json({
      success: true,
      severity: analysis.severity,
      issuesFound: analysis.issues.length,
      logsAnalyzed: analysis.logsAnalyzed,
      emailSent: emailResult.sent === true,
      summary: analysis.summary,
    });
  } catch (error: any) {
    console.error('Security monitoring workflow error:', error);

    return Response.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  } finally {
    if (mcpClient) {
      try {
        await mcpClient.close();
        console.log('MCP client closed');
      } catch (error) {
        console.error('Error closing MCP client:', error);
      }
    }
  }
}
