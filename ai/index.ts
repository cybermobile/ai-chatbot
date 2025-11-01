import { wrapLanguageModel } from 'ai';
import { ollama } from 'ai-sdk-ollama';
import { customMiddleware } from './custom-middleware';

export const customModel = (apiIdentifier: string) => {
  return wrapLanguageModel({
    model: ollama(apiIdentifier, {
      baseURL: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    }),
    middleware: customMiddleware,
  });
};
