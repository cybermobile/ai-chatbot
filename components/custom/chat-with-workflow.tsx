'use client';

import { Chat } from './chat';
import { WorkflowCanvas } from '@/components/workflow/workflow-canvas';
import { useWorkflowSteps } from '@/hooks/use-workflow-steps';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Workflow, X } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import type { UIMessage as Message } from 'ai';

export function ChatWithWorkflow({
  id,
  initialMessages,
  selectedModelId,
}: {
  id: string;
  initialMessages: Array<Message>;
  selectedModelId: string;
}) {
  const [showWorkflow, setShowWorkflow] = useState(false);

  return (
    <div className="flex h-full">
      {/* Main Chat Area */}
      <div className={`flex-1 ${showWorkflow ? 'lg:w-2/3' : 'w-full'} transition-all duration-300`}>
        <Chat
          id={id}
          initialMessages={initialMessages}
          selectedModelId={selectedModelId}
        />
      </div>

      {/* Workflow Toggle Button */}
      {!showWorkflow && (
        <Button
          onClick={() => setShowWorkflow(true)}
          className="fixed bottom-20 right-4 z-50 rounded-full size-12 p-0 shadow-lg"
          variant="default"
          title="Show Workflow"
        >
          <Workflow className="h-5 w-5" />
        </Button>
      )}

      {/* Workflow Panel */}
      {showWorkflow && (
        <div className="hidden lg:flex lg:w-1/3 border-l border-border bg-muted/30 flex-col">
          {/* Workflow Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Workflow className="h-5 w-5" />
              <h2 className="font-semibold">AI Workflow</h2>
            </div>
            <Button
              onClick={() => setShowWorkflow(false)}
              variant="ghost"
              size="sm"
              className="size-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Workflow Canvas */}
          <div className="flex-1 overflow-hidden">
            <WorkflowCanvasWrapper
              chatId={id}
              initialMessages={initialMessages}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Separate component to use useChat hook
function WorkflowCanvasWrapper({
  chatId,
  initialMessages,
}: {
  chatId: string;
  initialMessages: Array<Message>;
}) {
  const { messages, status } = useChat({
    id: chatId,
    api: '/api/chat',
    initialMessages,
  } as any);

  const { steps } = useWorkflowSteps({
    messages,
    isStreaming: status === 'streaming',
  });

  return <WorkflowCanvas steps={steps} className="h-full" />;
}
