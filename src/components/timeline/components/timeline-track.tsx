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
  onDragStart: (item: TimelineItemType, clientX: number, clientY: number, action: "move" | "resize-start" | "resize-end") => void;
  onDrag: (clientX: number, clientY: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  track,
  totalDuration,
  selectedItemIds,
  onItemSelect,
  onDragStart,
  onDrag,
  onDragEnd,
  isDragging,
}) => {
  return (
    <div
      className="relative border-b border-[#282828] bg-[#181818]"
      style={{ height: `${TIMELINE_CONSTANTS.TRACK_HEIGHT}px` }}
    >
      {track.items.map((item) => (
        <TimelineItem
          key={item.id}
          item={item}
          totalDuration={totalDuration}
          isSelected={selectedItemIds.includes(item.id)}
          onSelect={() => onItemSelect(item.id)}
          onDragStart={onDragStart}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
          isDragging={isDragging}
        />
      ))}
    </div>
  );
};

export default TimelineTrack;
