'use client';

import React from 'react';
import { GhostInstanceData } from '../stores/use-timeline-store';
import { TIMELINE_CONSTANTS } from '../constants';

interface TimelineGhostElementProps {
  ghosts: GhostInstanceData[];
  isValid: boolean;
  tracksCount: number;
}

export const TimelineGhostElement: React.FC<TimelineGhostElementProps> = ({
  ghosts,
  isValid,
  tracksCount,
}) => {
  if (!ghosts || ghosts.length === 0) return null;

  return (
    <>
      {ghosts.map((ghost, index) => {
        const trackIndex = Math.round(ghost.top * tracksCount / 100);
        const top = trackIndex * TIMELINE_CONSTANTS.TRACK_HEIGHT;

        return (
          <div
            key={`ghost-${index}`}
            className={`
              absolute pointer-events-none z-50
              ${isValid ? 'bg-blue-500/40 border-blue-500' : 'bg-red-500/40 border-red-500'}
              border-2 border-dashed rounded
            `}
            style={{
              left: `${ghost.left}%`,
              width: `${ghost.width}%`,
              top: `${top}px`,
              height: `${TIMELINE_CONSTANTS.TRACK_ITEM_HEIGHT}px`,
            }}
          />
        );
      })}
    </>
  );
};

export default TimelineGhostElement;
