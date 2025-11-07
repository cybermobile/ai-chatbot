'use client';

import { useState, useEffect } from 'react';
import { WorkflowStep } from '@/components/workflow/workflow-canvas';
import { nanoid } from 'nanoid';

export type UseWorkflowStepsProps = {
  messages: any[];
  streamingData?: any;
  isStreaming?: boolean;
};

export function useWorkflowSteps({ messages, streamingData, isStreaming }: UseWorkflowStepsProps) {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);

  useEffect(() => {
    // Build workflow steps from messages
    const newSteps: WorkflowStep[] = [];

    messages.forEach((message) => {
      if (message.role === 'user') {
        // Add user input step
        newSteps.push({
          id: `user-${message.id || nanoid()}`,
          type: 'user',
          content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
          timestamp: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
        });
      } else if (message.role === 'assistant') {
        // Check if message has parts (AI SDK v5 structure)
        if (message.parts && Array.isArray(message.parts)) {
          message.parts.forEach((part: any, index: number) => {
            if (part.type === 'text') {
              // Add reasoning or response step
              newSteps.push({
                id: `assistant-${message.id}-${index}`,
                type: 'response',
                content: part.text,
                timestamp: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
              });
            } else if (part.type === 'tool-call') {
              // Add tool call step
              newSteps.push({
                id: `tool-call-${message.id}-${index}`,
                type: 'tool-call',
                content: `Calling tool: ${part.toolName}`,
                toolName: part.toolName,
                toolArgs: part.args,
                timestamp: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
              });
            } else if (part.type === 'tool-result') {
              // Add tool result step
              newSteps.push({
                id: `tool-result-${message.id}-${index}`,
                type: 'tool-result',
                content: `Tool result received`,
                toolName: part.toolName,
                toolResult: part.result,
                timestamp: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
              });
            }
          });
        } else {
          // Simple text response (legacy format or simple message)
          const content = typeof message.content === 'string'
            ? message.content
            : JSON.stringify(message.content);

          if (content && content.trim()) {
            newSteps.push({
              id: `assistant-${message.id || nanoid()}`,
              type: 'response',
              content,
              timestamp: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
            });
          }
        }
      }
    });

    setSteps(newSteps);
  }, [messages]);

  // Listen to streaming data for real-time updates
  useEffect(() => {
    if (isStreaming && streamingData) {
      // Handle streaming data updates
      // This would capture tool calls and results as they happen
      console.log('[Workflow] Streaming data:', streamingData);
    }
  }, [streamingData, isStreaming]);

  return { steps };
}
