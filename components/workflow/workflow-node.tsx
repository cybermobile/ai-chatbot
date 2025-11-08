'use client';

import React from 'react';
import { MessageSquare, Brain, Wrench, CheckCircle, User, Copy, ExternalLink } from 'lucide-react';
import { WorkflowStep } from './workflow-canvas';
import {
  Node,
  NodeHeader,
  NodeTitle,
  NodeDescription,
  NodeContent,
  NodeFooter,
} from '@/components/ai-elements/node';
import { Toolbar } from '@/components/ai-elements/toolbar';
import { Button } from '@/components/ui/button';

const getNodeIcon = (type: WorkflowStep['type']) => {
  switch (type) {
    case 'user':
      return <User className="h-4 w-4" />;
    case 'reasoning':
      return <Brain className="h-4 w-4" />;
    case 'tool-call':
      return <Wrench className="h-4 w-4" />;
    case 'tool-result':
      return <CheckCircle className="h-4 w-4" />;
    case 'response':
      return <MessageSquare className="h-4 w-4" />;
    default:
      return <MessageSquare className="h-4 w-4" />;
  }
};

const getNodeColor = (type: WorkflowStep['type']) => {
  switch (type) {
    case 'user':
      return 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50';
    case 'reasoning':
      return 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/50';
    case 'tool-call':
      return 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/50';
    case 'tool-result':
      return 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/50';
    case 'response':
      return 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50';
    default:
      return 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50';
  }
};

const getNodeTitle = (type: WorkflowStep['type'], toolName?: string) => {
  switch (type) {
    case 'user':
      return 'User Input';
    case 'reasoning':
      return 'AI Reasoning';
    case 'tool-call':
      return toolName || 'Tool Call';
    case 'tool-result':
      return toolName ? `${toolName} Result` : 'Tool Result';
    case 'response':
      return 'AI Response';
    default:
      return 'Step';
  }
};

const getNodeDescription = (type: WorkflowStep['type'], timestamp: number) => {
  const time = new Date(timestamp).toLocaleTimeString();
  switch (type) {
    case 'user':
      return `User message at ${time}`;
    case 'reasoning':
      return `Thinking at ${time}`;
    case 'tool-call':
      return `Executed at ${time}`;
    case 'tool-result':
      return `Completed at ${time}`;
    case 'response':
      return `Generated at ${time}`;
    default:
      return time;
  }
};

export function WorkflowNode({ data }: any) {
  const { type, content, toolName, toolArgs, toolResult, timestamp } = data;

  const handleCopy = () => {
    const textToCopy = content || JSON.stringify(toolResult || toolArgs, null, 2);
    navigator.clipboard.writeText(textToCopy);
  };

  return (
    <Node
      handles={{
        target: type !== 'user',
        source: type !== 'response',
      }}
      className={`group ${getNodeColor(type)}`}
    >
      <NodeHeader>
        <div className="flex items-center gap-2">
          {getNodeIcon(type)}
          <NodeTitle>{getNodeTitle(type, toolName)}</NodeTitle>
        </div>
        <NodeDescription>{getNodeDescription(type, timestamp)}</NodeDescription>
      </NodeHeader>

      <NodeContent>
        {content && (
          <p className="text-sm line-clamp-4 whitespace-pre-wrap">{content}</p>
        )}

        {toolArgs && (
          <div className="mt-2 p-2 bg-muted rounded text-xs">
            <div className="font-medium mb-1">Arguments:</div>
            <pre className="overflow-x-auto max-h-32">
              {JSON.stringify(toolArgs, null, 2)}
            </pre>
          </div>
        )}

        {toolResult && (
          <div className="mt-2 p-2 bg-muted rounded text-xs">
            <div className="font-medium mb-1">Result:</div>
            <pre className="overflow-x-auto max-h-32">
              {typeof toolResult === 'string'
                ? toolResult
                : JSON.stringify(toolResult, null, 2)}
            </pre>
          </div>
        )}
      </NodeContent>

      {(content || toolResult) && (
        <NodeFooter>
          <span className="text-xs">
            {content
              ? `${content.length} characters`
              : toolResult
              ? 'Click to view full result'
              : ''}
          </span>
        </NodeFooter>
      )}

      <Toolbar>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="h-7 w-7 p-0"
          title="Copy content"
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          title="View details"
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      </Toolbar>
    </Node>
  );
}
