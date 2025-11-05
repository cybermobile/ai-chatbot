import { auth } from '@/app/(auth)/auth';
import { customModel } from '@/ai';
import { systemPrompt } from '@/ai/prompts';
import { getEnabledTools, type ToolConfig } from '@/ai/tools';
import {
  getChatById,
  saveChat,
  saveMessages,
  deleteChatById,
} from '@/db/queries';
import { generateUUID, getMostRecentUserMessage } from '@/lib/utils';
import { convertToCoreMessages, generateText, streamText, type Message } from 'ai';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    // 1. Parse request
    const body = await request.json();

    // v5 format: { id, modelId, selectedFileIds, toolConfig, messages }
    // messages is the full conversation history from the client (Message[])
    const { id, messages, toolConfig, modelId: bodyModelId, selectedFileIds } = body as {
      id: string;
      messages?: Message[];
      toolConfig?: ToolConfig;
      modelId?: string;
      selectedFileIds?: string[];
    };

    console.log('[Chat API] Request received:', {
      id,
      messageCount: messages?.length,
      toolConfig,
      bodyModelId,
      selectedFileIds,
    });

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('[Chat API] Invalid messages:', messages);
      return new Response('Invalid messages array', { status: 400 });
    }

    console.log('[Chat API] Received messages:', JSON.stringify(messages, null, 2));

    // 2. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 3. Get model
    const { cookies } = await import('next/headers');
    const { fetchModelsFromOllama } = await import('@/ai/models');

    const cookieStore = await cookies();
    const modelIdFromCookie = cookieStore.get('model-id')?.value;
    const availableModels = await fetchModelsFromOllama();
    const modelId = bodyModelId || modelIdFromCookie || availableModels[0]?.id;
    const model = availableModels.find((m) => m.id === modelId);

    console.log('[Chat API] Model selection:', {
      fromBody: bodyModelId,
      fromCookie: modelIdFromCookie,
      fallback: availableModels[0]?.id,
      selected: modelId,
      availableCount: availableModels.length,
      availableModels: availableModels.map(m => m.id),
    });

    if (!model) {
      return new Response('Model not found', { status: 404 });
    }

    console.log('[Chat API] Using model:', model.apiIdentifier);

    // 4. Convert messages from Message[] to CoreMessage[] for model
    // Remove toolInvocations property if present (v4 format compatibility)
    // Also validate and sanitize message content
    const cleanMessages = messages.map(msg => {
      const { toolInvocations, ...rest } = msg as any;
      
      // Ensure content is valid - must be string or array, not undefined
      if (rest.content === undefined || rest.content === null) {
        console.warn('[Chat API] Message with undefined content:', rest.id);
        return { ...rest, content: '' };
      }
      
      // If content is an array, ensure it's not empty and has valid parts
      if (Array.isArray(rest.content)) {
        const validContent = rest.content.filter((part: any) => 
          part && (part.type === 'text' || part.type === 'image' || part.type === 'tool-call' || part.type === 'tool-result')
        );
        
        if (validContent.length === 0) {
          console.warn('[Chat API] Message with empty content array:', rest.id);
          return { ...rest, content: '' };
        }
        
        return { ...rest, content: validContent };
      }
      
      return rest;
    }).filter(msg => msg !== null); // Remove any null messages

    console.log('[Chat API] About to convert messages. Type check:', {
      isArray: Array.isArray(cleanMessages),
      length: cleanMessages?.length,
      firstMessage: cleanMessages?.[0],
    });

    let coreMessages;
    try {
      coreMessages = convertToCoreMessages(cleanMessages);
    } catch (error) {
      console.error('[Chat API] Failed to convert messages:', error);
      console.error('[Chat API] Problematic messages:', JSON.stringify(cleanMessages, null, 2));
      return new Response(JSON.stringify({ 
        error: 'Failed to process message history. This may be due to corrupted data from previous versions.',
        message: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Try starting a new chat or clearing your history.'
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    console.log('[Chat API] Successfully converted to core messages:', coreMessages.length);

    // OpenAI Chat Completions API requires alternating roles
    // Merge consecutive messages with the same role
    const mergedMessages = coreMessages.reduce((acc: any[], msg: any, idx: number) => {
      if (idx === 0 || msg.role !== acc[acc.length - 1].role) {
        acc.push(msg);
      } else {
        // Merge consecutive messages with same role
        const prev = acc[acc.length - 1];
        if (typeof prev.content === 'string' && typeof msg.content === 'string') {
          prev.content = prev.content + '\n\n' + msg.content;
        } else if (Array.isArray(prev.content) && Array.isArray(msg.content)) {
          prev.content = [...prev.content, ...msg.content];
        }
      }
      return acc;
    }, []);

    console.log('[Chat API] Merged consecutive messages:', {
      before: coreMessages.length,
      after: mergedMessages.length,
    });

    const userMessage = getMostRecentUserMessage(mergedMessages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    // 5. Create chat if it doesn't exist
    const chat = await getChatById({ id });
    if (!chat) {
      // Generate title
      const { text: title } = await generateText({
        model: customModel(model.apiIdentifier),
        system: 'Generate a short title (max 80 chars) for this conversation. No quotes or colons.',
        prompt: JSON.stringify(userMessage),
      });

      await saveChat({ id, userId: session.user.id, title });
      console.log('[Chat API] Created new chat:', { id, title });
    }

    // 6. Save user message
    await saveMessages({
      messages: [{
        ...userMessage,
        id: messages[messages.length - 1]?.id || generateUUID(),
        createdAt: new Date(),
        chatId: id,
      }],
    });

    // 7. Get enabled tools based on config
    const tools = toolConfig ? getEnabledTools(toolConfig) : {};
    const hasTools = Object.keys(tools).length > 0;

    console.log('[Chat API] Enabled tools:', Object.keys(tools));

    // 8. Stream response
    console.log('[Chat API] Starting stream with', mergedMessages.length, 'messages');
    console.log('[Chat API] Model:', model.apiIdentifier, '| Has tools:', hasTools);

    const result = await streamText({
      model: customModel(model.apiIdentifier),
      system: systemPrompt,
      messages: mergedMessages,
      temperature: 0.7, // Slightly higher to encourage text generation after tool calls
      ...(hasTools && {
        tools,
        maxSteps: 15, // More steps to ensure model generates response after tool use
        toolChoice: 'auto', // Let the model decide when to use tools
      }),
      onStepFinish: ({ text, toolCalls, toolResults, finishReason, stepType, response }) => {
        console.log('[Chat API] Step finished:', {
          stepType,
          hasText: !!text,
          textLength: text?.length || 0,
          textPreview: text && typeof text === 'string' ? text.substring(0, 100) : null,
          toolCallsCount: toolCalls?.length || 0,
          toolResultsCount: toolResults?.length || 0,
          finishReason,
          responseMessages: response?.messages?.length || 0,
        });

        // Debug: Log raw response to see what vLLM is returning
        if (response?.messages && response.messages.length > 0) {
          console.log('[Chat API] Step response messages:', JSON.stringify(response.messages, null, 2));
        }

        if (toolCalls && toolCalls.length > 0) {
          console.log('[Chat API] Tool calls:', toolCalls.map(tc => ({
            name: tc.toolName,
            args: tc.args,
          })));
        }
        if (toolResults && toolResults.length > 0) {
          console.log('[Chat API] Tool results preview:', toolResults.map(tr => {
            const resultStr = tr.result ? JSON.stringify(tr.result) : '';
            return {
              toolName: tr.toolName,
              resultPreview: resultStr.substring(0, 100),
            };
          }));
        }
      },
      onFinish: async ({ text, toolCalls, toolResults, finishReason, usage, response, rawResponse }) => {
        console.log('[Chat API] Stream finished:', {
          hasText: !!text,
          textLength: text?.length || 0,
          textPreview: text?.substring(0, 100),
          toolCallsCount: toolCalls?.length || 0,
          toolResultsCount: toolResults?.length || 0,
          finishReason,
          usage,
          responseMessages: response?.messages?.length || 0,
        });

        // DEBUG: Log raw response to see what we're actually getting
        console.log('[Chat API] Raw text value:', JSON.stringify(text));
        console.log('[Chat API] Response object keys:', response ? Object.keys(response) : 'no response');

        if (toolCalls && toolCalls.length > 0) {
          console.log('[Chat API] Final tool calls:', JSON.stringify(toolCalls, null, 2));
        }
        if (toolResults && toolResults.length > 0) {
          console.log('[Chat API] Final tool results:', JSON.stringify(toolResults, null, 2));
        }

        // DEBUG: Log full response to see what we're getting
        if (response?.messages) {
          console.log('[Chat API] Full response messages:', JSON.stringify(response.messages, null, 2));
        }

        // Save all response messages (assistant + tool results)
        // This ensures tool calls are persisted even when there's no text response
        // The content from response.messages is already in the correct CoreMessage format
        // which is compatible with our database schema
        if (response?.messages && response.messages.length > 0) {
          const messagesToSave = response.messages.map((msg: any) => ({
            id: generateUUID(),
            chatId: id,
            role: msg.role,
            content: msg.content, // This is already in CoreMessage format (string or content array)
            createdAt: new Date(),
          }));

          await saveMessages({ messages: messagesToSave });
          console.log('[Chat API] Saved', messagesToSave.length, 'messages (including tool calls/results)');
        } else if (text) {
          // Fallback: save just the text if response.messages is not available
          await saveMessages({
            messages: [{
              id: generateUUID(),
              role: 'assistant',
              content: text,
              chatId: id,
              createdAt: new Date(),
            }],
          });
          console.log('[Chat API] Saved assistant message:', text.substring(0, 50));
        } else {
          console.log('[Chat API] WARNING: No messages to save!');
        }
      },
    });

    console.log('[Chat API] Returning stream response');

    // Return the stream response
    // Messages are saved via the onFinish callback above
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return new Response('Not Found', { status: 404 });
    }

    const session = await auth();
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const chat = await getChatById({ id });
    if (!chat) {
      return new Response('Chat not found', { status: 404 });
    }

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });
    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    console.error('[Chat API DELETE] Error:', error);
    return new Response('An error occurred', { status: 500 });
  }
}
