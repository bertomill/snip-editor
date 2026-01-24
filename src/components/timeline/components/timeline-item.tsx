'use client';

import React, { useCallback, useRef, useEffect } from 'react';
import { TimelineItem as TimelineItemType, TrackItemType } from '../types';
import { TIMELINE_CONSTANTS } from '../constants';

interface TimelineItemProps {
  item: TimelineItemType;
  totalDuration: number;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (item: TimelineItemType, clientX: number, clientY: number, action: "move" | "resize-start" | "resize-end") => void;
  onDrag: (clientX: number, clientY: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({
  item,
  totalDuration,
  isSelected,
  onSelect,
  onDragStart,
  onDrag,
  onDragEnd,
  isDragging,
}) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const leftPercent = (item.start / totalDuration) * 100;
  const widthPercent = ((item.end - item.start) / totalDuration) * 100;

  // Get color based on item type
  const getItemColor = () => {
    switch (item.type) {
      case TrackItemType.VIDEO:
        return 'bg-blue-600';
      case TrackItemType.TEXT:
        return 'bg-purple-600';
      case TrackItemType.STICKER:
        return 'bg-yellow-600';
      default:
        return 'bg-gray-600';
    }
  };

  // Get icon based on item type
  const getItemIcon = () => {
    switch (item.type) {
      case TrackItemType.VIDEO:
        return '🎬';
      case TrackItemType.TEXT:
        return 'T';
      case TrackItemType.STICKER:
        return '😀';
      default:
        return '📦';
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();

    // Determine if clicking on resize handles
    const rect = itemRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const handleWidth = 8;

    let action: "move" | "resize-start" | "resize-end" = "move";
    if (clickX <= handleWidth) {
      action = "resize-start";
    } else if (clickX >= rect.width - handleWidth) {
      action = "resize-end";
    }

    isDraggingRef.current = true;
    onDragStart(item, e.clientX, e.clientY, action);
  }, [item, onSelect, onDragStart]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        onDrag(e.clientX, e.clientY);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        onDragEnd();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onDrag, onDragEnd]);

  return (
    <div
      ref={itemRef}
      className={`
        absolute top-1 bottom-1 rounded cursor-pointer
        ${getItemColor()}
        ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent' : ''}
        transition-shadow duration-150
        hover:brightness-110
        group
      `}
      style={{
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        minWidth: '20px',
        height: `${TIMELINE_CONSTANTS.TRACK_ITEM_HEIGHT}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Left resize handle */}
      <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-l" />

      {/* Content */}
      <div className="flex items-center h-full px-3 overflow-hidden">
        <span className="text-xs font-medium text-white truncate">
          {getItemIcon()} {item.label || item.type || 'Item'}
        </span>
      </div>

      {/* Right resize handle */}
      <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-r" />
    </div>
  );
};

export default TimelineItem;
