'use client';

import { Message } from 'ai';
import cx from 'classnames';
import { motion } from 'framer-motion';
import { Dispatch, SetStateAction } from 'react';

import { Vote } from '@/db/schema';

import { UIBlock } from './block';
import { DocumentToolCall, DocumentToolResult } from './document';
import { SparklesIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';

export const PreviewMessage = ({
  chatId,
  message,
  block,
  setBlock,
  vote,
  isLoading,
}: {
  chatId: string;
  message: Message;
  block: UIBlock;
  setBlock: Dispatch<SetStateAction<UIBlock>>;
  vote: Vote | undefined;
  isLoading: boolean;
}) => {
  // Debug logging
  console.log('[PreviewMessage] Rendering message:', {
    id: message.id,
    role: message.role,
    contentType: typeof message.content,
    contentIsArray: Array.isArray(message.content),
    content: message.content,
  });

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-role={message.role}
    >
      <div
        className={cx(
          'group-data-[role=user]/message:bg-primary group-data-[role=user]/message:text-primary-foreground flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl'
        )}
      >
        {message.role === 'assistant' && (
          <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
            <SparklesIcon size={14} />
          </div>
        )}

        <div className="flex flex-col gap-2 w-full">
          {/* v5: Handle parts array (new format) */}
          {(message as any).parts && Array.isArray((message as any).parts) && (
            <div className="flex flex-col gap-4">
              {(message as any).parts.map((part: any, index: number) => {
                if (part.type === 'text' && part.text) {
                  return <Markdown key={index}>{part.text}</Markdown>;
                }
                return null;
              })}
            </div>
          )}

          {/* Legacy: Handle string content */}
          {!((message as any).parts) && message.content && typeof message.content === 'string' && (
            <div className="flex flex-col gap-4">
              <Markdown>{message.content}</Markdown>
            </div>
          )}

          {/* Legacy: Handle array content */}
          {!((message as any).parts) && Array.isArray(message.content) && message.content.length > 0 && (
            <div className="flex flex-col gap-4">
              {message.content.map((part: any, index: number) => {
                if (part.type === 'text' && part.text) {
                  return <Markdown key={index}>{part.text}</Markdown>;
                }
                return null;
              })}
            </div>
          )}

          {message.toolInvocations && message.toolInvocations.length > 0 && (
            <div className="flex flex-col gap-4">
              {message.toolInvocations.map((toolInvocation) => {
                const { toolName, toolCallId, state, args } = toolInvocation;

                console.log('[Message] Tool invocation:', { toolName, state, hasResult: !!toolInvocation.result });

                if (state === 'result') {
                  const { result } = toolInvocation;

                  return (
                    <div key={toolCallId}>
                      {toolName === 'getWeather' ? (
                        result?.error ? (
                          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg">
                            <div className="text-xs font-medium mb-1">⚠️ Weather Error</div>
                            <div className="text-sm">{result.error}</div>
                          </div>
                        ) : result ? (
                          <Weather weatherAtLocation={result} />
                        ) : null
                      ) : toolName === 'createDocument' ? (
                        <DocumentToolResult
                          type="create"
                          result={result}
                          block={block}
                          setBlock={setBlock}
                        />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolResult
                          type="update"
                          result={result}
                          block={block}
                          setBlock={setBlock}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolResult
                          type="request-suggestions"
                          result={result}
                          block={block}
                          setBlock={setBlock}
                        />
                      ) : toolName === 'getContext' ? (
                        <Markdown>Retrieved context</Markdown>
                      ) : toolName === 'webSearch' ? (
                        <div className="bg-muted p-3 rounded-lg border">
                          <div className="text-xs font-medium mb-2 text-muted-foreground">
                            🔍 Web Search Results
                          </div>
                          <pre className="text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
                        </div>
                      ) : toolName === 'rag' ? (
                        <div className="bg-muted p-3 rounded-lg border">
                          <div className="text-xs font-medium mb-2 text-muted-foreground">
                            📚 Knowledge Base Results
                          </div>
                          <pre className="text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
                        </div>
                      ) : toolName === 'calculator' ? (
                        <div className="bg-muted p-3 rounded-lg border">
                          <div className="text-xs font-medium mb-2 text-muted-foreground">
                            🧮 Calculation
                          </div>
                          <pre className="text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
                        </div>
                      ) : (
                        <div className="bg-muted p-3 rounded-lg border">
                          <div className="text-xs font-medium mb-2 text-muted-foreground">
                            🔧 Tool: {toolName}
                          </div>
                          <pre className="text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  );
                } else {
                  return (
                    <div
                      key={toolCallId}
                      className={cx({
                        skeleton: ['getWeather', 'webSearch', 'rag', 'calculator'].includes(toolName),
                      })}
                    >
                      {toolName === 'getWeather' ? (
                        <Weather />
                      ) : toolName === 'createDocument' ? (
                        <DocumentToolCall type="create" args={args} />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolCall type="update" args={args} />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolCall
                          type="request-suggestions"
                          args={args}
                        />
                      ) : toolName === 'webSearch' ? (
                        <div className="bg-muted p-3 rounded-lg border animate-pulse">
                          <div className="text-xs font-medium text-muted-foreground">
                            🔍 Searching the web for: {args.query}...
                          </div>
                        </div>
                      ) : toolName === 'rag' ? (
                        <div className="bg-muted p-3 rounded-lg border animate-pulse">
                          <div className="text-xs font-medium text-muted-foreground">
                            📚 Searching knowledge base for: {args.query}...
                          </div>
                        </div>
                      ) : toolName === 'calculator' ? (
                        <div className="bg-muted p-3 rounded-lg border animate-pulse">
                          <div className="text-xs font-medium text-muted-foreground">
                            🧮 Calculating: {args.expression}...
                          </div>
                        </div>
                      ) : (
                        <div className="bg-muted p-3 rounded-lg border animate-pulse">
                          <div className="text-xs font-medium text-muted-foreground">
                            ⏳ Running {toolName}...
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
              })}
            </div>
          )}

          {message.experimental_attachments && (
            <div className="flex flex-row gap-2">
              {message.experimental_attachments.map((attachment) => (
                <PreviewAttachment
                  key={attachment.url}
                  attachment={attachment}
                />
              ))}
            </div>
          )}

          <MessageActions
            key={`action-${message.id}`}
            chatId={chatId}
            message={message}
            vote={vote}
            isLoading={isLoading}
          />
        </div>
      </div>
    </motion.div>
  );
};

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          }
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Thinking...
          </div>
        </div>
      </div>
    </motion.div>
  );
};
