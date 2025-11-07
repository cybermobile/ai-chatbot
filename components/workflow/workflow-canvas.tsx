'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  Panel,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkflowNode } from './workflow-node';
import { Button } from '@/components/ui/button';
import { Download, ZoomIn, ZoomOut, Maximize2, Filter } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type WorkflowStep = {
  id: string;
  type: 'user' | 'reasoning' | 'tool-call' | 'tool-result' | 'response';
  content: string;
  toolName?: string;
  toolArgs?: any;
  toolResult?: any;
  timestamp: number;
};

export type WorkflowCanvasProps = {
  steps: WorkflowStep[];
  className?: string;
};

const nodeTypes = {
  workflow: WorkflowNode,
} as any; // ReactFlow NodeTypes type compatibility

export function WorkflowCanvas({ steps, className }: WorkflowCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    user: true,
    reasoning: true,
    'tool-call': true,
    'tool-result': true,
    response: true,
  });

  // Filter steps based on active filters
  const filteredSteps = useMemo(() => {
    return steps.filter((step) => filters[step.type]);
  }, [steps, filters]);

  // Convert steps to nodes
  const initialNodes: Node[] = useMemo(() => {
    return filteredSteps.map((step, index) => ({
      id: step.id,
      type: 'workflow',
      position: { x: 250, y: index * 150 },
      data: step,
      selected: selectedNode === step.id,
    }));
  }, [filteredSteps, selectedNode]);

  // Create edges connecting sequential steps
  const initialEdges: Edge[] = useMemo(() => {
    return filteredSteps.slice(0, -1).map((step, index) => ({
      id: `edge-${step.id}-${filteredSteps[index + 1].id}`,
      source: step.id,
      target: filteredSteps[index + 1].id,
      type: 'smoothstep',
      animated: index === filteredSteps.length - 2, // Animate the last edge
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
    }));
  }, [filteredSteps]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Update nodes when steps or selection changes
  React.useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // Update edges when filtered steps change
  React.useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Handle node click
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
  }, []);

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Toggle filter
  const toggleFilter = (type: keyof typeof filters) => {
    setFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  if (steps.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <p className="text-muted-foreground">No workflow steps yet</p>
      </div>
    );
  }

  return (
    <div className={`h-full w-full relative ${className}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const step = node.data as WorkflowStep;
            switch (step.type) {
              case 'user':
                return '#3b82f6';
              case 'reasoning':
                return '#a855f7';
              case 'tool-call':
                return '#f97316';
              case 'tool-result':
                return '#22c55e';
              case 'response':
                return '#6b7280';
              default:
                return '#6b7280';
            }
          }}
        />

        {/* Interactive Controls Panel */}
        <Panel position="top-right" className="space-y-2">
          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-background">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={filters.user}
                onCheckedChange={() => toggleFilter('user')}
              >
                <span className="w-3 h-3 rounded-full bg-blue-500 mr-2 inline-block" />
                User Input
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.reasoning}
                onCheckedChange={() => toggleFilter('reasoning')}
              >
                <span className="w-3 h-3 rounded-full bg-purple-500 mr-2 inline-block" />
                AI Reasoning
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters['tool-call']}
                onCheckedChange={() => toggleFilter('tool-call')}
              >
                <span className="w-3 h-3 rounded-full bg-orange-500 mr-2 inline-block" />
                Tool Calls
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters['tool-result']}
                onCheckedChange={() => toggleFilter('tool-result')}
              >
                <span className="w-3 h-3 rounded-full bg-green-500 mr-2 inline-block" />
                Tool Results
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.response}
                onCheckedChange={() => toggleFilter('response')}
              >
                <span className="w-3 h-3 rounded-full bg-gray-500 mr-2 inline-block" />
                Responses
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Panel>

        {/* Stats Panel */}
        <Panel position="top-left" className="bg-background/95 backdrop-blur rounded-lg p-3 border shadow-sm">
          <div className="space-y-1 text-xs">
            <div className="font-semibold mb-2">Workflow Stats</div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Total Steps:</span>
              <span className="font-medium">{steps.length}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Tool Calls:</span>
              <span className="font-medium">
                {steps.filter((s) => s.type === 'tool-call').length}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-medium">
                {steps.length > 1
                  ? `${((steps[steps.length - 1].timestamp - steps[0].timestamp) / 1000).toFixed(1)}s`
                  : '0s'}
              </span>
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 bg-background border rounded-lg p-4 shadow-lg max-h-48 overflow-y-auto">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold">Selected Step Details</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedNode(null)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
          {(() => {
            const step = steps.find((s) => s.id === selectedNode);
            if (!step) return null;
            return (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <span className="font-medium capitalize">{step.type.replace('-', ' ')}</span>
                </div>
                {step.toolName && (
                  <div>
                    <span className="text-muted-foreground">Tool:</span>{' '}
                    <span className="font-medium">{step.toolName}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Time:</span>{' '}
                  <span className="font-medium">{new Date(step.timestamp).toLocaleTimeString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Content:</span>
                  <p className="mt-1 text-xs bg-muted p-2 rounded max-h-20 overflow-y-auto">
                    {step.content}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
