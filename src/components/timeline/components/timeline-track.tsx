'use client';

import React from 'react';
import { TimelineTrack as TimelineTrackType, TimelineItem as TimelineItemType } from '../types';
import { TIMELINE_CONSTANTS } from '../constants';
import TimelineItem from './timeline-item';

interface TimelineTrackProps {
  track: TimelineTrackType;
  totalDuration: number;
  selectedItemIds: string[];
  onItemSelect: (itemId: string) => void;
  onSeek?: (time: number) => void;
  onDragStart: (item: TimelineItemType, clientX: number, clientY: number, action: "move" | "resize-start" | "resize-end") => void;
  onDrag: (clientX: number, clientY: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  onAddContent?: () => void;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  track,
  totalDuration,
  selectedItemIds,
  onItemSelect,
  onSeek,
  onDragStart,
  onDrag,
  onDragEnd,
  isDragging,
  onAddContent,
}) => {
  // Check if this is the script track (thinner styling)
  const isScriptTrack = track.id === 'script-track';
  const trackHeight = isScriptTrack
    ? TIMELINE_CONSTANTS.SCRIPT_TRACK_HEIGHT
    : TIMELINE_CONSTANTS.TRACK_HEIGHT;

  // Calculate position for add button (after last item)
  const lastItemEnd = track.items.length > 0
    ? Math.max(...track.items.map(item => item.end))
    : 0;
  const addButtonLeftPercent = (lastItemEnd / totalDuration) * 100;

  return (
    <div
      className="relative border-b border-[#282828] bg-[#181818]"
      style={{ height: `${trackHeight}px` }}
    >
      {track.items.map((item) => (
        <TimelineItem
          key={item.id}
          item={item}
          totalDuration={totalDuration}
          isSelected={selectedItemIds.includes(item.id)}
          onSelect={() => onItemSelect(item.id)}
          onSeek={onSeek}
          onDragStart={onDragStart}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
          isDragging={isDragging}
        />
      ))}

      {/* Add Video button at end of track */}
      {onAddContent && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddContent();
          }}
          className="absolute top-1 bottom-1 flex items-center justify-center gap-1.5 px-3 rounded-lg border-2 border-dashed border-white/30 bg-white/5 hover:bg-white/10 hover:border-white/50 transition-all cursor-pointer group"
          style={{
            left: `calc(${addButtonLeftPercent}% + 8px)`,
            height: `${TIMELINE_CONSTANTS.TRACK_ITEM_HEIGHT}px`,
          }}
          aria-label="Add video"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-white/60 group-hover:text-white/90"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="text-xs text-white/60 group-hover:text-white/90 whitespace-nowrap">Add Video</span>
        </button>
      )}
    </div>
  );
};

export default TimelineTrack;
