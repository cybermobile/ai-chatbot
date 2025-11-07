import {
  CoreAssistantMessage,
  CoreMessage,
  CoreToolMessage,
  UIMessage as Message,
  UIToolInvocation as ToolInvocation,
} from 'ai';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { Message as DBMessage, Document } from '@/db/schema';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ApplicationError extends Error {
  info: string;
  status: number;
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error(
      'An error occurred while fetching the data.'
    ) as ApplicationError;

    error.info = await res.json();
    error.status = res.status;

    throw error;
  }

  return res.json();
};

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function addToolMessageToChat({
  toolMessage,
  messages,
}: {
  toolMessage: CoreToolMessage;
  messages: Array<Message>;
}): Array<Message> {
  return messages.map((message) => {
    if ((message as any).toolInvocations) {
      return {
        ...message,
        toolInvocations: (message as any).toolInvocations.map((toolInvocation: any) => {
          const toolResult = toolMessage.content.find(
            (tool) => tool.toolCallId === toolInvocation.toolCallId
          );

          if (toolResult) {
            // v5: tool results use 'output' not 'result'
            // The output can be either { type: 'json', value: ... } or a direct value
            const output = (toolResult as any).output || (toolResult as any).result;
            const resultValue = output?.type === 'json' ? output.value : output;

            return {
              ...toolInvocation,
              state: 'result',
              result: resultValue,
            };
          }

          return toolInvocation;
        }),
      };
    }

    return message;
  });
}

export function convertToUIMessages(
  messages: Array<DBMessage>
): Array<Message> {
  return messages.reduce((chatMessages: Array<Message>, message) => {
    if (message.role === 'tool') {
      return addToolMessageToChat({
        toolMessage: message as CoreToolMessage,
        messages: chatMessages,
      });
    }

    let textContent = '';
    let toolInvocations: Array<any> = [];

    if (typeof (message as any).content === 'string') {
      textContent = (message as any).content;
    } else if (Array.isArray((message as any).content)) {
      for (const content of (message as any).content) {
        if (content.type === 'text') {
          textContent += content.text;
        } else if (content.type === 'tool-call') {
          toolInvocations.push({
            state: 'call',
            toolCallId: content.toolCallId,
            toolName: content.toolName,
            args: content.args,
          });
        }
      }
    }

    chatMessages.push({
      id: message.id,
      role: message.role as Message['role'],
      content: textContent,
      toolInvocations,
    } as any);

    return chatMessages;
  }, []);
}

export function sanitizeResponseMessages(
  messages: Array<CoreToolMessage | CoreAssistantMessage>
): Array<CoreToolMessage | CoreAssistantMessage> {
  let toolResultIds: Array<string> = [];

  for (const message of messages) {
    if (message.role === 'tool') {
      for (const content of (message as any).content) {
        if (content.type === 'tool-result') {
          toolResultIds.push(content.toolCallId);
        }
      }
    }
  }

  const messagesBySanitizedContent = messages.map((message) => {
    if (message.role !== 'assistant') return message;

    if (typeof (message as any).content === 'string') return message;

    const sanitizedContent = (message as any).content.filter((content: any) =>
      content.type === 'tool-call'
        ? toolResultIds.includes(content.toolCallId)
        : content.type === 'text'
          ? content.text.length > 0
          : true
    );

    return {
      ...message,
      content: sanitizedContent,
    };
  });

  return messagesBySanitizedContent.filter(
    (message) => (message as any).content.length > 0
  );
}

export function sanitizeUIMessages(messages: Array<Message>): Array<Message> {
  const messagesBySanitizedToolInvocations = messages.map((message) => {
    if (message.role !== 'assistant') return message;

    if (!(message as any).toolInvocations) return message;

    let toolResultIds: Array<string> = [];

    for (const toolInvocation of (message as any).toolInvocations) {
      if (toolInvocation.state === 'result') {
        toolResultIds.push(toolInvocation.toolCallId);
      }
    }

    const sanitizedToolInvocations = (message as any).toolInvocations.filter(
      (toolInvocation: any) =>
        toolInvocation.state === 'result' ||
        toolResultIds.includes(toolInvocation.toolCallId)
    );

    return {
      ...message,
      toolInvocations: sanitizedToolInvocations,
    };
  });

  return messagesBySanitizedToolInvocations.filter(
    (message) =>
      (message as any).content.length > 0 ||
      ((message as any).toolInvocations && (message as any).toolInvocations.length > 0)
  );
}

export function getMostRecentUserMessage(messages: Array<CoreMessage>) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Array<Document>,
  index: number
) {
  if (!documents) return new Date();
  if (index > documents.length) return new Date();

  return documents[index].createdAt;
}

export function getMessageIdFromAnnotations(message: Message) {
  if (!(message as any).annotations) return message.id;

  const [annotation] = (message as any).annotations;
  if (!annotation) return message.id;

  return (annotation as any).messageIdFromServer;
}
