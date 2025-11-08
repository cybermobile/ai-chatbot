'use client';

import { UIMessage as Message } from 'ai';
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
                // Handle text parts
                if (part.type === 'text' && part.text) {
                  return <Markdown key={index}>{part.text}</Markdown>;
                }

                // Handle tool call parts (AI SDK v5 format)
                if (part.type?.startsWith('tool-') && part.state === 'result') {
                  const toolName = part.type.replace('tool-', '');
                  // AI SDK may wrap results in { type: "json", value: {...} }
                  let result = part.output;
                  if (result && typeof result === 'object' && result.type === 'json' && result.value) {
                    result = result.value;
                  }

                  return (
                    <div key={index}>
                      {toolName === 'getWeather' || toolName === 'weather' ? (
                        result?.error ? (
                          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg">
                            <div className="text-xs font-medium mb-1">⚠️ Weather Error</div>
                            <div className="text-sm">{result.error}</div>
                          </div>
                        ) : result ? (
                          <Weather weatherAtLocation={result} />
                        ) : null
                      ) : toolName === 'calculator' ? (
                        <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="text-xs font-medium mb-2 text-blue-700 dark:text-blue-400 flex items-center gap-2">
                            🧮 Calculator
                          </div>
                          {result?.error ? (
                            <div className="text-sm text-red-600 dark:text-red-400">{result.error}</div>
                          ) : (
                            <div className="space-y-1">
                              <div className="text-sm text-muted-foreground">Expression: <code className="bg-muted px-1 rounded">{result?.expression || part.input?.expression}</code></div>
                              <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">Result: {result?.result}</div>
                            </div>
                          )}
                        </div>
                      ) : toolName === 'webSearch' ? (
                        <div className="bg-muted p-3 rounded-lg border">
                          <div className="text-xs font-medium mb-2 text-muted-foreground">
                            🔍 Web Search Results
                          </div>
                          <pre className="text-xs overflow-auto max-h-60">{JSON.stringify(result, null, 2)}</pre>
                        </div>
                      ) : toolName === 'rag' ? (
                        <div className="bg-muted p-3 rounded-lg border">
                          <div className="text-xs font-medium mb-2 text-muted-foreground">
                            📚 Knowledge Base Results
                          </div>
                          <pre className="text-xs overflow-auto max-h-60">{JSON.stringify(result, null, 2)}</pre>
                        </div>
                      ) : toolName === 'createDocument' ? (
                        <>
                          <DocumentToolResult
                            type="create"
                            result={result}
                            block={block}
                            setBlock={setBlock}
                          />
                          {result?.id && !result?.error && (
                            <div className="text-sm text-muted-foreground mt-2">
                              ✨ Document created! Click the card above to view and edit it.
                            </div>
                          )}
                        </>
                      ) : toolName === 'updateDocument' ? (
                        <>
                          <DocumentToolResult
                            type="update"
                            result={result}
                            block={block}
                            setBlock={setBlock}
                          />
                          {result?.id && !result?.error && (
                            <div className="text-sm text-muted-foreground mt-2">
                              ✨ Document updated! Click the card above to view changes.
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="bg-muted p-3 rounded-lg border">
                          <div className="text-xs font-medium mb-2 text-muted-foreground">
                            🔧 Tool: {toolName}
                          </div>
                          <pre className="text-xs overflow-auto max-h-60">{JSON.stringify(result, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  );
                }

                // Handle tool calls in progress
                if (part.type?.startsWith('tool-') && (part.state === 'input-available' || part.state === 'call')) {
                  const toolName = part.type.replace('tool-', '');
                  return (
                    <div key={index} className="bg-muted/50 p-3 rounded-lg border animate-pulse">
                      <div className="text-xs text-muted-foreground">
                        ⏳ Calling {toolName}...
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}

          {/* Legacy: Handle string content (for old DB messages) */}
          {!((message as any).parts) && (message as any).content && typeof (message as any).content === 'string' && (
            <div className="flex flex-col gap-4">
              <Markdown>{(message as any).content}</Markdown>
            </div>
          )}

          {/* Legacy: Handle array content (for old DB messages or CoreMessage format) */}
          {!((message as any).parts) && Array.isArray((message as any).content) && (message as any).content.length > 0 && (
            <div className="flex flex-col gap-4">
              {(message as any).content.map((part: any, index: number) => {
                // Handle text parts
                if (part.type === 'text' && part.text) {
                  return <Markdown key={index}>{part.text}</Markdown>;
                }

                // Handle tool-call parts (CoreMessage format from database)
                // Don't render tool-call parts in assistant messages - they're internal
                // The tool-result will be shown separately in a tool message
                if (part.type === 'tool-call') {
                  return null;
                }

                // Handle tool-result parts (CoreMessage format from database)
                if (part.type === 'tool-result') {
                  const toolName = part.toolName;
                  // AI SDK may wrap results in { type: "json", value: {...} }
                  // The result can be in either part.result or part.output
                  let result = (part as any).output || (part as any).result;
                  if (result && typeof result === 'object' && result.type === 'json' && result.value) {
                    result = result.value;
                  }

                  return (
                    <div key={index}>
                      {toolName === 'weather' ? (
                        result?.error ? (
                          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg">
                            <div className="text-xs font-medium mb-1">⚠️ Weather Error</div>
                            <div className="text-sm">{result.error}</div>
                          </div>
                        ) : result ? (
                          <Weather weatherAtLocation={result} />
                        ) : null
                      ) : toolName === 'calculator' ? (
                        <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="text-xs font-medium mb-2 text-blue-700 dark:text-blue-400 flex items-center gap-2">
                            🧮 Calculator
                          </div>
                          {result?.error ? (
                            <div className="text-sm text-red-600 dark:text-red-400">{result.error}</div>
                          ) : (
                            <div className="space-y-1">
                              <div className="text-sm text-muted-foreground">
                                Expression: <code className="bg-muted px-1 rounded">{result?.expression}</code>
                              </div>
                              <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                                Result: {result?.result}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : toolName === 'webSearch' ? (
                        <div className="bg-muted p-3 rounded-lg border">
                          <div className="text-xs font-medium mb-2 text-muted-foreground">
                            🔍 Web Search Results
                          </div>
                          <pre className="text-xs overflow-auto max-h-60">{JSON.stringify(result, null, 2)}</pre>
                        </div>
                      ) : toolName === 'rag' ? (
                        <div className="bg-muted p-3 rounded-lg border">
                          <div className="text-xs font-medium mb-2 text-muted-foreground">
                            📚 Knowledge Base Results
                          </div>
                          <pre className="text-xs overflow-auto max-h-60">{JSON.stringify(result, null, 2)}</pre>
                        </div>
                      ) : toolName === 'createDocument' ? (
                        <>
                          <DocumentToolResult
                            type="create"
                            result={result}
                            block={block}
                            setBlock={setBlock}
                          />
                          {result?.id && !result?.error && (
                            <div className="text-sm text-muted-foreground mt-2">
                              ✨ Document created! Click the card above to view and edit it.
                            </div>
                          )}
                        </>
                      ) : toolName === 'updateDocument' ? (
                        <>
                          <DocumentToolResult
                            type="update"
                            result={result}
                            block={block}
                            setBlock={setBlock}
                          />
                          {result?.id && !result?.error && (
                            <div className="text-sm text-muted-foreground mt-2">
                              ✨ Document updated! Click the card above to view changes.
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="bg-muted p-3 rounded-lg border">
                          <div className="text-xs font-medium mb-2 text-muted-foreground">
                            🔧 Tool Result: {toolName}
                          </div>
                          <pre className="text-xs overflow-auto max-h-60">{JSON.stringify(result, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}

          {(message as any).toolInvocations && (message as any).toolInvocations.length > 0 && (
            <div className="flex flex-col gap-4">
              {(message as any).toolInvocations.map((toolInvocation: any) => {
                const { toolName, toolCallId, state, args } = toolInvocation;

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
                        <>
                          <DocumentToolResult
                            type="create"
                            result={result}
                            block={block}
                            setBlock={setBlock}
                          />
                          {result.id && !result.error && (
                            <div className="text-sm text-muted-foreground mt-2">
                              ✨ Document created! Click the card above to view and edit it.
                            </div>
                          )}
                        </>
                      ) : toolName === 'updateDocument' ? (
                        <>
                          <DocumentToolResult
                            type="update"
                            result={result}
                            block={block}
                            setBlock={setBlock}
                          />
                          {result.id && !result.error && (
                            <div className="text-sm text-muted-foreground mt-2">
                              ✨ Document updated! Click the card above to view changes.
                            </div>
                          )}
                        </>
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

          {(message as any).experimental_attachments && (
            <div className="flex flex-row gap-2">
              {(message as any).experimental_attachments.map((attachment: any) => (
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
