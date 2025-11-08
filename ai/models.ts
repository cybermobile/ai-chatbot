// Define your models here.

export interface Model {
  id: string;
  label: string;
  apiIdentifier: string;
  description: string;
}

// Fallback model for vLLM
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'vllm';

export const models: Array<Model> = [
  {
    id: 'Qwen/Qwen2.5-7B-Instruct-AWQ',
    label: 'Qwen 2.5 7B Instruct (AWQ)',
    apiIdentifier: 'Qwen/Qwen2.5-7B-Instruct-AWQ',
    description: 'Qwen 2.5 7B with excellent tool calling and multilingual support (vLLM)',
  },
];

export const DEFAULT_MODEL_ID: string = 'Qwen/Qwen2.5-7B-Instruct-AWQ';

// Fetch models from vLLM
export async function fetchModelsFromOllama(): Promise<Array<Model>> {
  try {
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
        description: `vLLM Model • ${model.owned_by || 'huggingface'}`,
      }));

    return vllmModels.length > 0 ? vllmModels : models;
  } catch (error) {
    console.warn('Error fetching models from vLLM:', error);
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
