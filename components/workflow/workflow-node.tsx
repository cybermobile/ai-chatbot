'use client';

import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { MessageSquare, Brain, Wrench, CheckCircle, User } from 'lucide-react';
import { WorkflowStep } from './workflow-canvas';

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
      return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800';
    case 'reasoning':
      return 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800';
    case 'tool-call':
      return 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800';
    case 'tool-result':
      return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
    case 'response':
      return 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800';
    default:
      return 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800';
  }
};

const getNodeTitle = (type: WorkflowStep['type'], toolName?: string) => {
  switch (type) {
    case 'user':
      return 'User Input';
    case 'reasoning':
      return 'AI Reasoning';
    case 'tool-call':
      return `Tool: ${toolName || 'Unknown'}`;
    case 'tool-result':
      return `Result: ${toolName || 'Unknown'}`;
    case 'response':
      return 'AI Response';
    default:
      return 'Step';
  }
};

export function WorkflowNode({ data }: any) {
  const { type, content, toolName, toolArgs, toolResult, timestamp } = data;

  return (
    <div className={`px-4 py-3 shadow-md rounded-lg border-2 ${getNodeColor(type)} min-w-[200px] max-w-[300px]`}>
      <Handle type="target" position={Position.Top} className="w-2 h-2" />

      <div className="flex items-center gap-2 mb-2">
        {getNodeIcon(type)}
        <div className="font-semibold text-sm">{getNodeTitle(type, toolName)}</div>
      </div>

      <div className="text-xs text-muted-foreground mb-2">
        {new Date(timestamp).toLocaleTimeString()}
      </div>

      {content && (
        <div className="text-sm mb-2">
          <p className="line-clamp-3">{content}</p>
        </div>
      )}

      {toolArgs && (
        <div className="mt-2 p-2 bg-background/50 rounded text-xs">
          <div className="font-medium mb-1">Arguments:</div>
          <pre className="overflow-x-auto">
            {JSON.stringify(toolArgs, null, 2)}
          </pre>
        </div>
      )}

      {toolResult && (
        <div className="mt-2 p-2 bg-background/50 rounded text-xs">
          <div className="font-medium mb-1">Result:</div>
          <pre className="overflow-x-auto line-clamp-3">
            {typeof toolResult === 'string'
              ? toolResult
              : JSON.stringify(toolResult, null, 2)}
          </pre>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
    </div>
  );
}
