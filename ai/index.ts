import { ollama } from 'ollama-ai-provider-v2';

export const customModel = (apiIdentifier: string) => {
  return ollama(apiIdentifier);
};
