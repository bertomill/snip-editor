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

  // Check if this is a script/pause item (non-draggable)
  const isScriptItem = item.type === TrackItemType.SCRIPT || item.type === TrackItemType.PAUSE;
  const isDeleted = item.type === TrackItemType.SCRIPT && item.data?.isDeleted;

  // Get color based on item type - liquid glass style
  const getItemStyles = () => {
    const baseGlass = 'backdrop-blur-md border border-white/20 shadow-lg';
    switch (item.type) {
      case TrackItemType.VIDEO:
        return `${baseGlass} bg-gradient-to-r from-blue-500/70 to-blue-600/60`;
      case TrackItemType.TEXT:
        return `${baseGlass} bg-gradient-to-r from-purple-500/70 to-purple-600/60`;
      case TrackItemType.STICKER:
        return `${baseGlass} bg-gradient-to-r from-amber-500/70 to-yellow-500/60`;
      case TrackItemType.SCRIPT:
        return isDeleted
          ? `${baseGlass} bg-gradient-to-r from-red-800/50 to-red-900/40`
          : `${baseGlass} bg-gradient-to-r from-sky-600/70 to-sky-700/60`;
      case TrackItemType.PAUSE:
        return 'bg-gray-700/30 border border-gray-600/30';
      default:
        return `${baseGlass} bg-gradient-to-r from-gray-500/70 to-gray-600/60`;
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
      case TrackItemType.SCRIPT:
        return null; // No icon for script words
      case TrackItemType.PAUSE:
        return null; // No icon for pauses
      default:
        return '📦';
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();

    // Script and pause items are not draggable/resizable
    if (isScriptItem) {
      return;
    }

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
  }, [item, onSelect, onDragStart, isScriptItem]);

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

  const icon = getItemIcon();

  return (
    <div
      ref={itemRef}
      className={`
        absolute top-1 bottom-1 rounded-lg
        ${isScriptItem ? 'cursor-pointer' : 'cursor-grab'}
        ${getItemStyles()}
        ${isSelected ? 'ring-2 ring-white/80 ring-offset-1 ring-offset-transparent shadow-[0_0_15px_rgba(255,255,255,0.3)]' : ''}
        ${isDeleted ? 'opacity-50' : ''}
        transition-all duration-150
        hover:brightness-110 hover:shadow-xl
        group
      `}
      style={{
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        minWidth: isScriptItem ? '8px' : '20px',
        height: `${TIMELINE_CONSTANTS.TRACK_ITEM_HEIGHT}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Left resize handle - only for non-script items */}
      {!isScriptItem && (
        <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-l" />
      )}

      {/* Content */}
      <div className="flex items-center h-full px-2.5 overflow-hidden">
        <span className={`text-sm font-medium truncate drop-shadow-sm ${isDeleted ? 'line-through text-gray-400' : 'text-white'}`}>
          {icon && `${icon} `}{item.label || item.type || 'Item'}
        </span>
      </div>

      {/* Right resize handle - only for non-script items */}
      {!isScriptItem && (
        <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-r" />
      )}
    </div>
  );
};

export default TimelineItem;
