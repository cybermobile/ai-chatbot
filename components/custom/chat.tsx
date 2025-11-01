'use client';

import { ChatHeader } from '@/components/custom/chat-header';
import { Files } from '@/components/custom/files';
import { PreviewMessage, ThinkingMessage } from '@/components/custom/message';
import { useScrollToBottom } from '@/components/custom/use-scroll-to-bottom';
import { Vote } from '@/db/schema';
import { fetcher } from '@/lib/utils';
import { Attachment, Message } from 'ai';
import { useChat } from '@ai-sdk/react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
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
  const [localInput, setLocalInput] = useState('');
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  // Use ref to always get the latest selectedFileIds value
  const selectedFileIdsRef = useRef<Array<string>>([]);
  
  // Keep ref in sync with state
  useEffect(() => {
    selectedFileIdsRef.current = selectedFileIds;
    console.log('[DEBUG] selectedFileIds updated:', selectedFileIds);
  }, [selectedFileIds]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
  } = useChat({
    id,
    initialMessages,
    api: '/api/chat',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      modelId: selectedModelId,
    },
    onFinish: () => {
      mutate('/api/history');
      // Assistant messages are saved automatically via useEffect
      // Update URL to chat page after first message is successfully sent
      if (window.location.pathname === '/') {
        window.history.replaceState({}, '', `/chat/${id}`);
      }
    },
    fetch: async (input, init) => {
      // Inject selectedFileIds into the request body using ref to get latest value
      const body = JSON.parse(init?.body as string || '{}');
      body.selectedFileIds = selectedFileIdsRef.current;
      
      console.log('[DEBUG Client] Fetch with selectedFileIds:', selectedFileIdsRef.current);
      
      return fetch(input, {
        ...init,
        body: JSON.stringify(body),
      });
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';
  const streamingData = undefined; // v5 handles streaming differently
  
  // Safety check for messages
  const safeMessages = messages || [];
  
  // Function to save assistant message to database with its client-side ID
  const saveAssistantMessage = async (messageId: string) => {
    try {
      // Find the message in the messages array
      const message = safeMessages.find(m => m.id === messageId && m.role === 'assistant');
      if (!message) {
        console.error('Could not find assistant message to save');
        return;
      }
      
      // Debug: Log the full message structure
      console.log('[DEBUG] Full message structure:', JSON.stringify(message, null, 2));
      console.log('[DEBUG] Message keys:', Object.keys(message));
      console.log('[DEBUG] Message content type:', typeof message.content, message.content);
      
      // Extract text content from the message (handles both content and parts formats)
      let messageContent = '';
      if (typeof message.content === 'string') {
        messageContent = message.content;
      } else if (Array.isArray(message.content)) {
        // Content is an array of parts
        messageContent = message.content
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('\n');
      } else if ((message as any).parts && Array.isArray((message as any).parts)) {
        // Parts property directly on the message
        messageContent = (message as any).parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('\n');
      }
      
      // If no text content but has tool invocations, create a summary
      if (!messageContent && (message as any).toolInvocations) {
        const toolInvocations = (message as any).toolInvocations;
        messageContent = `[Tool invocations: ${toolInvocations.map((t: any) => t.toolName).join(', ')}]`;
      }
      
      if (!messageContent || messageContent.trim().length === 0) {
        console.warn('Message has no text content to save, skipping:', message.id);
        return;
      }
      
      console.log('[DEBUG] Extracted content:', messageContent.substring(0, 100));
      
      await fetch('/api/messages/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chatId: id, 
          message: {
            id: message.id,
            role: message.role,
            content: messageContent,
          }
        }),
      });
    } catch (error) {
      console.error('Failed to save assistant message:', error);
    }
  };
  
  // Track saved assistant message IDs to avoid duplicates
  const [savedAssistantIds, setSavedAssistantIds] = useState<Set<string>>(new Set());
  
  // Watch for new assistant messages and save them
  // Only save when not streaming to ensure message is complete
  useEffect(() => {
    // Only process when not actively streaming
    if (status === 'streaming' || status === 'submitted') {
      return;
    }
    
    const assistantMessages = safeMessages.filter(m => {
      // Must be assistant role and have an ID
      if (m.role !== 'assistant' || !m.id) return false;
      
      // Must have some form of content
      const hasTextContent = typeof m.content === 'string' && m.content.length > 0;
      const hasArrayContent = Array.isArray(m.content) && m.content.length > 0;
      const hasParts = (m as any).parts && Array.isArray((m as any).parts) && (m as any).parts.length > 0;
      
      return hasTextContent || hasArrayContent || hasParts;
    });
    
    console.log('[DEBUG] Processing assistant messages:', assistantMessages.length, 'Status:', status);
    
    assistantMessages.forEach(async (msg) => {
      if (!savedAssistantIds.has(msg.id)) {
        console.log('[DEBUG] Saving new assistant message:', msg.id);
        setSavedAssistantIds(prev => new Set(prev).add(msg.id));
        await saveAssistantMessage(msg.id);
      }
    });
  }, [safeMessages, status, savedAssistantIds, id]);

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

  // Use local input for UI
  const input = localInput;
  const setInput = (value: string) => {
    setLocalInput(value);
  };

  // Create wrapper functions for compatibility
  const handleSubmit = async (e?: React.FormEvent | { preventDefault?: () => void }) => {
    if (e && 'preventDefault' in e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!input.trim()) return;

    const message = input.trim();
    setLocalInput('');

    console.log('[DEBUG Client] Sending message with selectedFileIds:', selectedFileIds);

    // Use sendMessage from AI SDK v5 - it expects { text: string } format
    await sendMessage({
      text: message,
    });
  };

  const append = async (message: Message) => {
    // sendMessage expects either { text: string } or CreateUIMessage format
    if (typeof message.content === 'string') {
      await sendMessage({
        text: message.content,
      });
    } else {
      await sendMessage(message);
    }
  };

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader selectedModelId={selectedModelId} />
        <div
          ref={messagesContainerRef}
          className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
        >
          {safeMessages.length === 0 && <Overview />}

          {safeMessages.map((message, index) => (
            <PreviewMessage
              key={message.id}
              chatId={id}
              message={message}
              block={block}
              setBlock={setBlock}
              isLoading={isLoading && safeMessages.length - 1 === index}
              vote={
                votes
                  ? votes.find((vote) => vote.messageId === message.id)
                  : undefined
              }
            />
          ))}

          {isLoading &&
            safeMessages.length > 0 &&
            safeMessages[safeMessages.length - 1].role === 'user' && (
              <ThinkingMessage />
            )}

          <div
            ref={messagesEndRef}
            className="shrink-0 min-w-[24px] min-h-[24px]"
          />
        </div>
        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          <MultimodalInput
            chatId={id}
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            stop={stop}
            attachments={attachments}
            setAttachments={setAttachments}
            messages={safeMessages}
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
            messages={safeMessages}
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
