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
    // Using vLLM with OpenAI-compatible endpoint
    const baseUrl = process.env.LLM_BASE_URL || 'http://127.0.0.1:11436';

    try {
      // vLLM OpenAI-compatible endpoint
      const response = await fetch(`${baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`vLLM API returned ${response.status}`);
      }

      const data = await response.json();

      // Transform vLLM models (OpenAI format) to our format
      const models = data.data
        .filter((model: any) => !model.id.includes('embed')) // Filter out embedding models
        .map((model: any) => ({
          id: model.id,
          label: model.id.split('/').pop()?.toUpperCase() || model.id.toUpperCase(),
          apiIdentifier: model.id,
          description: `vLLM Model • ${model.owned_by || 'huggingface'}`,
        }));

      return NextResponse.json({ models });
    } catch (fetchError) {
      console.error('Failed to fetch from vLLM:', fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error('Error fetching models:', error);

    // Return fallback model
    return NextResponse.json({
      models: [
        {
          id: 'Qwen/Qwen2.5-7B-Instruct-AWQ',
          label: 'Qwen 2.5 7B Instruct (AWQ)',
          apiIdentifier: 'Qwen/Qwen2.5-7B-Instruct-AWQ',
          description: 'Fallback model (vLLM server not connected)',
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

