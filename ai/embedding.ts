import { embed, embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { ollama } from 'ollama-ai-provider-v2';
import { removeStopwords } from 'stopword';

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama';
const VLLM_EMBEDDING_URL = process.env.VLLM_EMBEDDING_URL || 'http://127.0.0.1:11435';
const VLLM_EMBEDDING_MODEL = process.env.VLLM_EMBEDDING_MODEL || 'BAAI/bge-small-en-v1.5';
const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';

// Create vLLM embedding provider (OpenAI-compatible)
const vllmEmbeddingProvider = createOpenAI({
  baseURL: `${VLLM_EMBEDDING_URL}/v1`,
  apiKey: 'sk-vllm-placeholder-key-not-required',
});

export const embeddingModel = LLM_PROVIDER === 'vllm'
  ? vllmEmbeddingProvider.textEmbeddingModel(VLLM_EMBEDDING_MODEL)
  : ollama.textEmbeddingModel(OLLAMA_EMBEDDING_MODEL);

// Clean text
const cleanText = (text: string): string => {
  // Validate input
  if (!text || typeof text !== 'string') {
    console.error('[Embedding] cleanText received invalid input:', text);
    return '';
  }

  return removeStopwords(
    text
      .replace(/https?:\/\/\S+/g, '') // Remove URLs
      .replace(/[^a-zA-Z0-9\s.,!?-]/g, ' ') // Remove special chars
      .replace(/\s+/g, ' ') // Remove extra whitespace
      .toLowerCase() // Convert to lowercase
      .trim()
      .split(' ')
  ).join(' ');
};

// Create chunks
const createChunks = async (
  text: string,
  options = {
    chunkSize: 1000,
    chunkOverlap: 200,
  }
): Promise<string[]> => {
  const splitter = new RecursiveCharacterTextSplitter(options);
  const chunks = await splitter.createDocuments([text]);
  return chunks.map((chunk) => chunk.pageContent);
};

// Generate embeddings
export const generateEmbeddings = async (value: string) => {
  const cleaned = cleanText(value);
  const chunks = await createChunks(cleaned);

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });

  return embeddings.map((e, i) => ({
    content: chunks[i],
    embedding: e,
  }));
};

export const generateEmbedding = async (value: string) => {
  const cleaned = cleanText(value);

  const { embedding } = await embed({
    model: embeddingModel,
    value: cleaned,
  });

  return embedding;
};
