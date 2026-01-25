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
      className="absolute top-0 bottom-0 z-20 pointer-events-none"
      style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
    >
      {/* Playhead handle - triangular top like Descript */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2">
        <div
          className="w-3 h-3 bg-[#4A8FE7] rounded-sm"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)',
          }}
        />
      </div>
      {/* Playhead line */}
      <div className="absolute top-1 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-[#4A8FE7]" />
    </div>
  );
};

export default TimelinePlayhead;
