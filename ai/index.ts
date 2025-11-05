import { createOpenAI } from '@ai-sdk/openai';
import { ollama } from 'ollama-ai-provider-v2';

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama';
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://127.0.0.1:11434';

// Create vLLM provider (OpenAI-compatible)
const vllmProvider = createOpenAI({
  baseURL: `${LLM_BASE_URL}/v1`,
  apiKey: 'sk-vllm-placeholder-key-not-required',
  compatibility: 'compatible', // Use compatible mode for non-OpenAI servers
});

export const customModel = (apiIdentifier: string) => {
  if (LLM_PROVIDER === 'vllm') {
    // vLLM uses OpenAI-compatible Chat Completions API (not Responses API)
    // Use .chat() to explicitly use /v1/chat/completions endpoint
    return vllmProvider.chat(apiIdentifier);
  }

  // Default to Ollama
  return ollama(apiIdentifier);
};
