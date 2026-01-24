'use client';

import React from 'react';

interface TimelinePlayheadProps {
  position: number; // Position as percentage 0-100
}

export const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({
  position,
}) => {
  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
      style={{ left: `${position}%` }}
    />
  );
};

export default TimelinePlayhead;
