import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OllamaListResponse {
  models: OllamaModel[];
}

export async function GET() {
  try {
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    
    const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Ollama API returned ${response.status}`);
    }

    const data: OllamaListResponse = await response.json();
    
    // Transform Ollama models to our format
    const models = data.models
      .filter(model => !model.name.includes('embed')) // Filter out embedding models
      .map(model => {
        const name = model.name;
        const [baseName, tag] = name.split(':');
        
        return {
          id: name,
          label: name.toUpperCase(),
          apiIdentifier: name,
          description: `${formatBytes(model.size)} • Modified ${new Date(model.modified_at).toLocaleDateString()}`,
        };
      });

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    
    // Return fallback model if Ollama is not available
    return NextResponse.json({
      models: [
        {
          id: 'llama3.1:latest',
          label: 'LLAMA 3.1:LATEST',
          apiIdentifier: 'llama3.1:latest',
          description: 'Fallback model (Ollama not connected)',
        },
      ],
    });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

