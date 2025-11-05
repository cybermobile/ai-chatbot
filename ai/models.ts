// Define your models here.

export interface Model {
  id: string;
  label: string;
  apiIdentifier: string;
  description: string;
}

// Fallback models based on provider
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama';

export const models: Array<Model> = LLM_PROVIDER === 'vllm'
  ? [
      {
        id: 'hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4',
        label: 'Llama 3.1 8B (AWQ Int4)',
        apiIdentifier: 'hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4',
        description: 'Llama 3.1 8B quantized with excellent tool calling (vLLM)',
      },
    ]
  : [
      {
        id: 'llama3.1:latest',
        label: 'LLAMA 3.1:LATEST',
        apiIdentifier: 'llama3.1:latest',
        description: 'State-of-the-art model from Meta',
      },
    ];

export const DEFAULT_MODEL_ID: string = LLM_PROVIDER === 'vllm'
  ? 'hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4'
  : 'llama3.1:latest';

// Fetch models from LLM provider (Ollama or vLLM)
export async function fetchModelsFromOllama(): Promise<Array<Model>> {
  try {
    const llmProvider = process.env.LLM_PROVIDER || 'ollama';

    // For vLLM, use the OpenAI-compatible /v1/models endpoint
    if (llmProvider === 'vllm') {
      const vllmBaseUrl = process.env.LLM_BASE_URL || 'http://127.0.0.1:11436';

      const response = await fetch(`${vllmBaseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        console.warn('Failed to fetch models from vLLM, using fallback');
        return models;
      }

      const data = await response.json();

      const vllmModels = data.data
        .filter((model: any) => !model.id.includes('embed')) // Filter out embedding models
        .map((model: any) => ({
          id: model.id,
          label: model.id.split('/').pop()?.toUpperCase() || model.id.toUpperCase(),
          apiIdentifier: model.id,
          description: 'vLLM model',
        }));

      return vllmModels.length > 0 ? vllmModels : models;
    }

    // For Ollama, use the /api/tags endpoint
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

    const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('Failed to fetch models from Ollama, using fallback');
      return models;
    }

    const data = await response.json();

    const ollamaModels = data.models
      .filter((model: any) => !model.name.includes('embed')) // Filter out embedding models
      .map((model: any) => ({
        id: model.name,
        label: model.name.toUpperCase(),
        apiIdentifier: model.name,
        description: `${formatBytes(model.size)}`,
      }));

    return ollamaModels.length > 0 ? ollamaModels : models;
  } catch (error) {
    console.warn('Error fetching models:', error);
    return models;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
