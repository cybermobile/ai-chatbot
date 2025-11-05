'use client';

import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { type ToolConfig } from '@/ai/tools';
import { ChevronDown, Search, Database, Calculator, Cloud, FileText, FilePenLine } from 'lucide-react';
import { useState } from 'react';

interface ToolToggleProps {
  toolConfig: ToolConfig;
  setToolConfig: (config: ToolConfig) => void;
}

export function ToolToggle({ toolConfig, setToolConfig }: ToolToggleProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleTool = (tool: keyof ToolConfig) => {
    setToolConfig({
      ...toolConfig,
      [tool]: !toolConfig[tool],
    });
  };

  const enabledCount = Object.values(toolConfig).filter(Boolean).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <span>Tools</span>
        {enabledCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {enabledCount}
          </Badge>
        )}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 py-2 space-y-2">
        <ToolItem
          icon={Search}
          label="Web Search"
          description="Search the web for current information"
          enabled={toolConfig.webSearch || false}
          onToggle={() => toggleTool('webSearch')}
        />
        <ToolItem
          icon={Database}
          label="RAG Search"
          description="Search your knowledge base"
          enabled={toolConfig.rag || false}
          onToggle={() => toggleTool('rag')}
        />
        <ToolItem
          icon={Calculator}
          label="Calculator"
          description="Perform mathematical calculations"
          enabled={toolConfig.calculator || false}
          onToggle={() => toggleTool('calculator')}
        />
        <ToolItem
          icon={Cloud}
          label="Weather"
          description="Get weather forecasts and conditions"
          enabled={toolConfig.weather || false}
          onToggle={() => toggleTool('weather')}
        />
        <ToolItem
          icon={FileText}
          label="Create Document"
          description="Create AI-generated documents in a canvas"
          enabled={toolConfig.createDocument || false}
          onToggle={() => toggleTool('createDocument')}
        />
        <ToolItem
          icon={FilePenLine}
          label="Update Document"
          description="Modify existing documents"
          enabled={toolConfig.updateDocument || false}
          onToggle={() => toggleTool('updateDocument')}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolItem({
  icon: Icon,
  label,
  description,
  enabled,
  onToggle,
}: {
  icon: any;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-start gap-3 p-2 rounded-md transition-colors ${
        enabled
          ? 'bg-primary/10 hover:bg-primary/20'
          : 'hover:bg-muted'
      }`}
    >
      <Icon className={`h-4 w-4 mt-0.5 ${enabled ? 'text-primary' : 'text-muted-foreground'}`} />
      <div className="flex-1 text-left">
        <div className={`text-sm font-medium ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
          {label}
        </div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div
        className={`h-4 w-4 rounded-sm border mt-0.5 ${
          enabled ? 'bg-primary border-primary' : 'border-muted-foreground'
        }`}
      >
        {enabled && (
          <svg
            className="h-full w-full text-primary-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </button>
  );
}
