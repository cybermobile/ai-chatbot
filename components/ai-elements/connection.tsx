'use client';

import * as React from 'react';
import { getBezierPath, type ConnectionLineComponentProps } from '@xyflow/react';

export function Connection({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
}: ConnectionLineComponentProps) {
  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });

  return (
    <g>
      <path
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeDasharray="5,5"
        d={edgePath}
      />
      <circle
        cx={toX}
        cy={toY}
        fill="hsl(var(--primary))"
        r={3}
        stroke="hsl(var(--background))"
        strokeWidth={1.5}
      />
    </g>
  );
}
