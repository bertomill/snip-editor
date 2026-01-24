'use client';

import React from 'react';
import { TimelineTrack } from '../types';
import { TIMELINE_CONSTANTS } from '../constants';

interface TimelineTrackHandlesProps {
  tracks: TimelineTrack[];
}

export const TimelineTrackHandles: React.FC<TimelineTrackHandlesProps> = ({
  tracks,
}) => {
  return (
    <div
      className="track-handles-scroll overflow-hidden bg-[#0A0A0A] border-r border-[#282828]"
      style={{ width: `${TIMELINE_CONSTANTS.HANDLE_WIDTH}px` }}
    >
      {/* Header spacer */}
      <div
        className="border-b border-[#282828]"
        style={{ height: `${TIMELINE_CONSTANTS.MARKERS_HEIGHT}px` }}
      />

      {/* Track labels */}
      {tracks.map((track, index) => (
        <div
          key={track.id}
          className="flex items-center px-2 border-b border-[#282828] text-xs text-[#888]"
          style={{ height: `${TIMELINE_CONSTANTS.TRACK_HEIGHT}px` }}
        >
          <span className="truncate">
            {track.name || `Track ${index + 1}`}
          </span>
        </div>
      ))}
    </div>
  );
};

export default TimelineTrackHandles;
