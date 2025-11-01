import { customModel } from '@/ai';
import { models } from '@/ai/models';
import { systemPrompt } from '@/ai/prompts';
import { auth } from '@/app/(auth)/auth';
import {
  deleteChatById,
  getChatById,
  getDocumentById,
  getSimilarResults,
  saveChat,
  saveMessages,
  saveSuggestions,
} from '@/db/queries';
import { Suggestion } from '@/db/schema';
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils';
import {
  convertToCoreMessages,
  Message,
  streamObject,
  streamText,
  createUIMessageStreamResponse,
} from 'ai';
import { z } from 'zod';

import { createDocument } from '@/lib/tools/createDocument';
import { updateDocument } from '@/lib/tools/updateDocument';
import { generateTitleFromUserMessage } from '@/app/(chat)/actions';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

type AllowedTools =
  | 'createDocument'
  | 'updateDocument'
  | 'requestSuggestions'
  | 'getContext';

const blocksTools: AllowedTools[] = [
  'createDocument',
  'updateDocument',
  'requestSuggestions',
  'getContext',
];

export async function POST(request: Request) {
  const requestBody = await request.json();

  const {
    id,
    messages,
    modelId,
    selectedFileIds = [],
  } = requestBody as {
    id: string;
    messages: Array<Message>;
    modelId?: string;
    selectedFileIds?: string[];
  };

  console.log('[DEBUG] Request body selectedFileIds:', selectedFileIds);

  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Get model from request body, cookies, or use default
  const { cookies } = await import('next/headers');
  const { fetchModelsFromOllama } = await import('@/ai/models');
  
  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('model-id')?.value;
  
  // Fetch available models from Ollama
  const availableModels = await fetchModelsFromOllama();
  const finalModelId = modelId || modelIdFromCookie || availableModels[0]?.id;
  
  const model = availableModels.find((model) => model.id === finalModelId);

  if (!model) {
    return new Response('Model not found', { status: 404 });
  }

  const coreMessages = convertToCoreMessages(messages);
  const userMessage = getMostRecentUserMessage(coreMessages);

  if (!userMessage) {
    return new Response('No user message found', { status: 400 });
  }

  const chat = await getChatById({ id });

  if (!chat) {
    const title = await generateTitleFromUserMessage({ message: userMessage });
    await saveChat({ id, userId: session.user.id, title });
  }

  await saveMessages({
    messages: [
      { 
        ...userMessage, 
        // Use the message ID from the request if available, otherwise generate one
        id: (messages[messages.length - 1] as any)?.id || generateUUID(), 
        createdAt: new Date(), 
        chatId: id 
      },
    ],
  });

  // TODO: Refactor custom data streaming for v5
  // StreamData is removed in v5 - need to use UI message streams
  const streamingData = null as any;

  // Only enable getContext tool when files are selected
  const enabledTools: AllowedTools[] = selectedFileIds.length > 0 ? ['getContext'] : [];

  const result = await streamText({
    model: customModel(model.apiIdentifier),
    system: systemPrompt,
    messages: coreMessages,
    maxSteps: 5,
    activeTools: enabledTools,
    tools: {
      createDocument: {
        description: 'Create a document for a writing activity',
        parameters: z.object({
          title: z.string(),
        }),
        execute: async ({ title }) =>
          createDocument({
            title,
            stream: streamingData,
            modelId: model.apiIdentifier,
            session,
          }),
      },
      updateDocument: {
        description: 'Update a document with the given description',
        parameters: z.object({
          id: z.string().describe('The ID of the document to update'),
          description: z
            .string()
            .describe('The description of changes that need to be made'),
        }),
        execute: async ({ id, description }) =>
          updateDocument({
            id,
            description,
            stream: streamingData,
            modelId: model.apiIdentifier,
            session,
          }),
      },
      requestSuggestions: {
        description: 'Request suggestions for a document',
        parameters: z.object({
          documentId: z
            .string()
            .describe('The ID of the document to request edits'),
        }),
        execute: async ({ documentId }) => {
          const document = await getDocumentById({ id: documentId });

          if (!document || !document.content) {
            return {
              error: 'Document not found',
            };
          }

          let suggestions: Array<
            Omit<Suggestion, 'userId' | 'createdAt' | 'documentCreatedAt'>
          > = [];

          const { elementStream } = await streamObject({
            model: customModel(model.apiIdentifier),
            system:
              'You are a help writing assistant. Given a piece of writing, please offer suggestions to improve the piece of writing and describe the change. It is very important for the edits to contain full sentences instead of just words. Max 5 suggestions.',
            prompt: document.content,
            output: 'array',
            schema: z.object({
              originalSentence: z.string().describe('The original sentence'),
              suggestedSentence: z.string().describe('The suggested sentence'),
              description: z
                .string()
                .describe('The description of the suggestion'),
            }),
          });

          for await (const element of elementStream) {
            const suggestion = {
              originalText: element.originalSentence,
              suggestedText: element.suggestedSentence,
              description: element.description,
              id: generateUUID(),
              documentId: documentId,
              isResolved: false,
            };

            // TODO v5: Restore with UI message streams
            // streamingData.append({
            //   type: 'suggestion',
            //   content: suggestion,
            // });

            suggestions.push(suggestion);
          }

          if (session.user && session.user.id) {
            const userId = session.user.id;

            await saveSuggestions({
              suggestions: suggestions.map((suggestion) => ({
                ...suggestion,
                userId,
                createdAt: new Date(),
                documentCreatedAt: document.createdAt,
              })),
            });
          }

          return {
            id: documentId,
            title: document.title,
            message: 'Suggestions have been added to the document',
          };
        },
      },
      getContext: {
        description: `Retrieve relevant information from the user's uploaded PDF documents. Use this tool when the user asks about their uploaded files.`,
        parameters: z.object({
          question: z.string().describe('the users question about the document'),
        }),
        execute: async ({ question }) => {
          console.log('[getContext] Called with question:', question);
          console.log('[getContext] Selected file IDs:', selectedFileIds);
          
          if (selectedFileIds.length === 0) {
            return {
              error: 'No files selected. Please select files from the knowledge base first.',
            };
          }
          
          const results = await getSimilarResults(question, session.user!.id!, selectedFileIds);
          console.log('[getContext] Found results:', results.length);
          
          if (results.length === 0) {
            return {
              message: 'No relevant information found in the selected documents.',
            };
          }
          
          // Format results as a readable string for the AI
          const context = results
            .map((r, i) => `[Chunk ${i + 1} from ${r.source}]:\n${r.content}`)
            .join('\n\n');
          
          return {
            context,
            source_count: results.length,
          };
        },
      },
    },
    onFinish: async ({ response }) => {
      // Messages are automatically handled by the UI stream
      // We'll save them through a different mechanism
    },
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'stream-text',
    },
  });

  // Return UI message stream response for AI SDK v5  
  return result.toUIMessageStreamResponse();
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
