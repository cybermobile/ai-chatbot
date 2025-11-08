'use client';

import * as React from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';

export interface NodeProps extends React.HTMLAttributes<HTMLDivElement> {
  handles?: {
    target?: boolean;
    source?: boolean;
  };
}

export const Node = React.forwardRef<HTMLDivElement, NodeProps>(
  ({ className, children, handles = { target: true, source: true }, ...props }, ref) => {
    return (
      <>
        {handles.target && (
          <Handle
            type="target"
            position={Position.Top}
            className="!bg-primary !border-2 !border-background !w-3 !h-3"
          />
        )}
        <div
          ref={ref}
          className={cn(
            'rounded-lg border bg-card text-card-foreground shadow-sm',
            'min-w-[200px] max-w-[400px]',
            className
          )}
          {...props}
        >
          {children}
        </div>
        {handles.source && (
          <Handle
            type="source"
            position={Position.Bottom}
            className="!bg-primary !border-2 !border-background !w-3 !h-3"
          />
        )}
      </>
    );
  }
);
Node.displayName = 'Node';

export const NodeHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-4 pb-3', className)}
    {...props}
  />
));
NodeHeader.displayName = 'NodeHeader';

export const NodeTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-sm font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
NodeTitle.displayName = 'NodeTitle';

export const NodeDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-xs text-muted-foreground', className)}
    {...props}
  />
));
NodeDescription.displayName = 'NodeDescription';

export const NodeContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-4 pt-0 text-sm', className)} {...props} />
));
NodeContent.displayName = 'NodeContent';

export const NodeFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-4 pt-0 text-xs text-muted-foreground', className)}
    {...props}
  />
));
NodeFooter.displayName = 'NodeFooter';
