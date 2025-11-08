'use client';

import * as React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

export const Edge = {
  Animated: (props: EdgeProps) => {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      sourcePosition: props.sourcePosition,
      targetX: props.targetX,
      targetY: props.targetY,
      targetPosition: props.targetPosition,
    });

    return (
      <>
        <BaseEdge
          path={edgePath}
          markerEnd={props.markerEnd}
          style={{
            stroke: 'hsl(var(--primary))',
            strokeWidth: 2,
            animation: 'dashdraw 0.5s linear infinite',
            strokeDasharray: '5,5',
          }}
        />
      </>
    );
  },

  Temporary: (props: EdgeProps) => {
    const [edgePath] = getBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      sourcePosition: props.sourcePosition,
      targetX: props.targetX,
      targetY: props.targetY,
      targetPosition: props.targetPosition,
    });

    return (
      <BaseEdge
        path={edgePath}
        markerEnd={props.markerEnd}
        style={{
          stroke: 'hsl(var(--muted-foreground))',
          strokeWidth: 2,
          strokeDasharray: '5,5',
          opacity: 0.5,
        }}
      />
    );
  },

  Default: (props: EdgeProps) => {
    const [edgePath] = getBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      sourcePosition: props.sourcePosition,
      targetX: props.targetX,
      targetY: props.targetY,
      targetPosition: props.targetPosition,
    });

    return (
      <BaseEdge
        path={edgePath}
        markerEnd={props.markerEnd}
        style={{
          stroke: 'hsl(var(--border))',
          strokeWidth: 2,
        }}
      />
    );
  },
};
