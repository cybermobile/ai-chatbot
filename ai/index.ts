import { openai } from '@ai-sdk/openai';
import { ollama } from 'ollama-ai-provider-v2';

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama';
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://127.0.0.1:11434';

export const customModel = (apiIdentifier: string) => {
  if (LLM_PROVIDER === 'vllm') {
    // vLLM uses OpenAI-compatible API
    return openai(apiIdentifier, {
      baseURL: `${LLM_BASE_URL}/v1`,
      apiKey: 'vllm', // vLLM doesn't require a real key
    });
  }

  // Default to Ollama
  return ollama(apiIdentifier);
};
