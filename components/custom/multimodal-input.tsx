'use client';

import { type Attachment } from '@ai-sdk/ui-utils';
import { ChatRequestOptions, type UIMessage as Message } from 'ai';
type CreateMessage = any; // AI SDK v5: CreateUIMessage is generic, using any for simplicity
import cx from 'classnames';
import { motion } from 'framer-motion';
import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { sanitizeUIMessages } from '@/lib/utils';
import { type ToolConfig } from '@/ai/tools';

import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { ArrowUpIcon, StopIcon } from './icons';

const suggestedActions = [
  {
    title: 'What is the weather',
    label: 'in San Francisco?',
    action: 'What is the weather in San Francisco?',
    enableTools: { weather: true } as Partial<ToolConfig>,
  },
  {
    title: 'Help me draft an essay',
    label: 'about Silicon Valley',
    action: 'Help me draft a short essay about Silicon Valley',
    enableTools: {} as Partial<ToolConfig>,
  },
];

export function MultimodalInput({
  chatId,
  input,
  setInput,
  isLoading,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  handleSubmit,
  toolConfig,
  setToolConfig,
  className,
  isBlockVisible,
}: {
  chatId: string;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions
  ) => void;
  toolConfig: ToolConfig;
  setToolConfig: Dispatch<SetStateAction<ToolConfig>>;
  className?: string;
  isBlockVisible?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    ''
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    handleSubmit(undefined, {
      experimental_attachments: attachments,
    } as any); // AI SDK v5: experimental_attachments type not in ChatRequestOptions

    setAttachments([]);
    setLocalStorageInput('');

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    attachments,
    handleSubmit,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
  ]);

  return (
    <div className="relative w-full flex flex-col gap-4">
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 &&
        !isBlockVisible && (
          <div className="grid sm:grid-cols-2 gap-2 w-full">
            {suggestedActions.map((suggestedAction, index) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.05 * index }}
                key={index}
                className={index > 1 ? 'hidden sm:block' : 'block'}
              >
                <Button
                  variant="ghost"
                  onClick={async () => {
                    window.history.replaceState({}, '', `/chat/${chatId}`);

                    // Enable tools specified in the suggested action
                    if (suggestedAction.enableTools && Object.keys(suggestedAction.enableTools).length > 0) {
                      setToolConfig(prev => ({
                        ...prev,
                        ...suggestedAction.enableTools,
                      } as ToolConfig));
                    }

                    // v5: Use text field instead of role/content
                    setInput(suggestedAction.action);
                    // Trigger submit after setting input
                    setTimeout(() => {
                      handleSubmit();
                    }, 0);
                  }}
                  className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
                >
                  <span className="font-medium">{suggestedAction.title}</span>
                  <span className="text-muted-foreground">
                    {suggestedAction.label}
                  </span>
                </Button>
              </motion.div>
            ))}
          </div>
        )}

      <Textarea
        ref={textareaRef}
        placeholder="Send a message..."
        value={input}
        onChange={handleInput}
        className={cx(
          'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-xl text-base bg-muted',
          className
        )}
        rows={3}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();

            if (isLoading) {
              toast.error('Please wait for the model to finish its response!');
            } else {
              submitForm();
            }
          }
        }}
      />

      {isLoading ? (
        <Button
          className="rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 border dark:border-zinc-600"
          onClick={(event) => {
            event.preventDefault();
            stop();
            setMessages((messages) => sanitizeUIMessages(messages));
          }}
        >
          <StopIcon size={14} />
        </Button>
      ) : (
        <Button
          className="rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 border dark:border-zinc-600"
          onClick={(event) => {
            event.preventDefault();
            submitForm();
          }}
          disabled={input.length === 0 || uploadQueue.length > 0}
        >
          <ArrowUpIcon size={14} />
        </Button>
      )}
    </div>
  );
}
