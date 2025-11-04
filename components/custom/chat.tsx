'use client';

import { ChatHeader } from '@/components/custom/chat-header';
import { Files } from '@/components/custom/files';
import { PreviewMessage, ThinkingMessage } from '@/components/custom/message';
import { useScrollToBottom } from '@/components/custom/use-scroll-to-bottom';
import { ToolToggle } from '@/components/custom/tool-toggle';
import { Vote } from '@/db/schema';
import { fetcher } from '@/lib/utils';
import { type ToolConfig } from '@/ai/tools';
import { Attachment, Message } from 'ai';
import { useChat } from '@ai-sdk/react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useWindowSize } from 'usehooks-ts';
import { Block, UIBlock } from './block';
import { BlockStreamHandler } from './block-stream-handler';
import { MultimodalInput } from './multimodal-input';
import { Overview } from './overview';

export function Chat({
  id,
  initialMessages,
  selectedModelId,
}: {
  id: string;
  initialMessages: Array<Message>;
  selectedModelId: string;
}) {
  const { mutate } = useSWRConfig();
  const [isFilesVisible, setIsFilesVisible] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Array<string>>([]);
  const [toolConfig, setToolConfig] = useState<ToolConfig>({
    webSearch: false,
    rag: false,
    calculator: false,
    weather: false,
  });

  // v5: Manage input state manually
  const [input, setInput] = useState('');

  const {
    messages,
    setMessages,
    sendMessage,
    append: originalAppend,
    status,
    stop,
    data: streamingData,
  } = useChat({
    id, // v5: Set chat ID here, not in body
    api: '/api/chat',
    body: { id, modelId: selectedModelId }, // Also pass in body for server-side logic
    initialMessages,
    onFinish: () => {
      mutate('/api/history');
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // v5: Reset messages when chat ID changes to prevent mixed format issues
  // This ensures messages from DB are loaded fresh when navigating between chats
  useEffect(() => {
    // Only reset if we have valid initialMessages
    if (initialMessages && Array.isArray(initialMessages)) {
      setMessages(initialMessages);
    }
  }, [id]); // Only depend on id, not initialMessages or setMessages

  // v5: Create handleSubmit wrapper that uses sendMessage
  const handleSubmit = (
    event?: { preventDefault?: () => void },
    chatRequestOptions?: any
  ) => {
    event?.preventDefault?.();

    if (!input.trim()) return;

    // v5: sendMessage expects { text: string } format
    sendMessage(
      {
        text: input,
        ...(chatRequestOptions?.experimental_attachments && {
          experimental_attachments: chatRequestOptions.experimental_attachments,
        }),
      },
      {
        body: {
          id,
          modelId: selectedModelId,
          selectedFileIds,
          toolConfig, // Dynamic value captured at submit time
        },
      }
    );

    setInput(''); // Clear input after sending
  };

  // Wrapper for append to include dynamic values
  const append = (message: any, chatRequestOptions?: any) => {
    return originalAppend(message, {
      ...chatRequestOptions,
      body: {
        id,
        modelId: selectedModelId,
        selectedFileIds,
        toolConfig, // Dynamic value captured at append time
      },
    });
  };

  const { width: windowWidth = 1920, height: windowHeight = 1080 } =
    useWindowSize();

  const [block, setBlock] = useState<UIBlock>({
    documentId: 'init',
    content: '',
    title: '',
    status: 'idle',
    isVisible: false,
    boundingBox: {
      top: windowHeight / 4,
      left: windowWidth / 4,
      width: 250,
      height: 50,
    },
  });

  const { data: votes } = useSWR<Array<Vote>>(
    `/api/vote?chatId=${id}`,
    fetcher
  );

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader selectedModelId={selectedModelId} />
        <div
          ref={messagesContainerRef}
          className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
        >
          {messages.length === 0 && <Overview />}

          {messages.map((message, index) => (
            <PreviewMessage
              key={message.id}
              chatId={id}
              message={message}
              block={block}
              setBlock={setBlock}
              isLoading={isLoading && messages.length - 1 === index}
              vote={
                votes
                  ? votes.find((vote) => vote.messageId === message.id)
                  : undefined
              }
            />
          ))}

          {isLoading &&
            messages.length > 0 &&
            messages[messages.length - 1].role === 'user' && (
              <ThinkingMessage />
            )}

          <div
            ref={messagesEndRef}
            className="shrink-0 min-w-[24px] min-h-[24px]"
          />
        </div>
        <div className="mx-auto px-4 bg-background w-full md:max-w-3xl">
          <ToolToggle toolConfig={toolConfig} setToolConfig={setToolConfig} />
          <form className="flex pb-4 md:pb-6 gap-2">
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
            />
            <div className="flex flex-row gap-2 pb-1 items-end">
              <div
                className="relative text-sm bg-zinc-100 rounded-lg size-9 shrink-0 flex flex-row items-center justify-center cursor-pointer hover:bg-zinc-200 dark:text-zinc-50 dark:bg-zinc-700 dark:hover:bg-zinc-800"
                onClick={() => {
                  setIsFilesVisible(!isFilesVisible);
                }}
              >
                <FileIcon />
                <motion.div
                  className="absolute text-xs -top-2 -right-2 bg-blue-500 size-5 rounded-full flex flex-row justify-center items-center border-2 dark:border-zinc-900 border-white text-blue-50"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {selectedFileIds?.length}
                </motion.div>
              </div>
            </div>
          </form>
        </div>
      </div>

      <AnimatePresence>
        {block && block.isVisible && (
          <Block
            chatId={id}
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            stop={stop}
            attachments={attachments}
            setAttachments={setAttachments}
            append={append}
            block={block}
            setBlock={setBlock}
            messages={messages}
            setMessages={setMessages}
            votes={votes}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFilesVisible && (
          <Files
            setIsFilesVisible={setIsFilesVisible}
            selectedFileIds={selectedFileIds}
            setSelectedFileIds={setSelectedFileIds}
          />
        )}
      </AnimatePresence>

      <BlockStreamHandler streamingData={streamingData} setBlock={setBlock} />
    </>
  );
}
