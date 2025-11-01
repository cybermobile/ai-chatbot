// Define your models here.

export interface Model {
  id: string;
  label: string;
  apiIdentifier: string;
  description: string;
}

// Fallback models if Ollama is not available
export const models: Array<Model> = [
  {
    id: 'llama3.1:latest',
    label: 'LLAMA 3.1:LATEST',
    apiIdentifier: 'llama3.1:latest',
    description: 'State-of-the-art model from Meta',
  },
];

export const DEFAULT_MODEL_ID: string = 'llama3.1:latest';

// Fetch models from Ollama
export async function fetchModelsFromOllama(): Promise<Array<Model>> {
  try {
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
    console.warn('Error fetching Ollama models:', error);
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
