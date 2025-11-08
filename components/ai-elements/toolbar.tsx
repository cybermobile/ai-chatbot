'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export const Toolbar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity',
      'flex items-center gap-1 bg-background border rounded-md shadow-sm p-1',
      className
    )}
    {...props}
  />
));
Toolbar.displayName = 'Toolbar';
