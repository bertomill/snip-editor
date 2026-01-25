'use client';

import React, { useCallback, useRef, useEffect } from 'react';
import { TimelineItem as TimelineItemType, TrackItemType } from '../types';
import { TIMELINE_CONSTANTS } from '../constants';
import VideoFilmstrip from './video-filmstrip';

interface TimelineItemProps {
  item: TimelineItemType;
  totalDuration: number;
  isSelected: boolean;
  onSelect: () => void;
  onSeek?: (time: number) => void;
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
  onSeek,
  onDragStart,
  onDrag,
  onDragEnd,
  isDragging,
}) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const leftPercent = (item.start / totalDuration) * 100;
  const widthPercent = ((item.end - item.start) / totalDuration) * 100;

  // Check if this is a video clip (not the first one) to add gap
  const isVideoClip = item.type === TrackItemType.VIDEO;
  const clipIndex = isVideoClip && item.data?.clipIndex !== undefined ? item.data.clipIndex : -1;
  const needsGap = isVideoClip && clipIndex > 0;

  // Check if this is a script/pause item (non-draggable)
  const isScriptItem = item.type === TrackItemType.SCRIPT || item.type === TrackItemType.PAUSE;
  const isDeleted = (item.type === TrackItemType.SCRIPT || item.type === TrackItemType.PAUSE) && item.data?.isDeleted;

  // Check if this is a video item with a source for filmstrip
  const isVideoWithFilmstrip = item.type === TrackItemType.VIDEO && item.data?.videoSrc;

  // Get color based on item type - liquid glass style
  const getItemStyles = () => {
    const baseGlass = 'backdrop-blur-md border border-white/20 shadow-lg';
    switch (item.type) {
      case TrackItemType.VIDEO:
        // For video with filmstrip, use minimal styling to show thumbnails
        // Added stronger border for clip separation visibility
        return isVideoWithFilmstrip
          ? 'border-2 border-white/40 shadow-lg overflow-hidden rounded-lg'
          : `${baseGlass} bg-gradient-to-r from-blue-500/70 to-blue-600/60`;
      case TrackItemType.TEXT:
        return `${baseGlass} bg-gradient-to-r from-purple-500/70 to-purple-600/60`;
      case TrackItemType.STICKER:
        return `${baseGlass} bg-gradient-to-r from-amber-500/70 to-yellow-500/60`;
      case TrackItemType.SCRIPT:
        // Grey styling for script items (more subtle than video track)
        return isDeleted
          ? 'bg-red-900/40 border border-red-500/30'
          : 'bg-[#3a3a3f] border border-[#4a4a4f]';
      case TrackItemType.PAUSE:
        return item.data?.isDeleted
          ? 'bg-red-900/40 border border-red-500/30'
          : 'bg-amber-700/30 border border-amber-500/40 border-dashed';
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

    // Calculate clicked time position and seek
    const rect = itemRef.current?.getBoundingClientRect();
    if (rect && onSeek) {
      const clickX = e.clientX - rect.left;
      const clickPercentage = clickX / rect.width;
      const itemDuration = item.end - item.start;
      const clickedTime = item.start + (clickPercentage * itemDuration);
      onSeek(Math.max(item.start, Math.min(item.end, clickedTime)));
    }

    // Script and pause items are not draggable/resizable
    if (isScriptItem) {
      return;
    }

    // Determine if clicking on resize handles
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
  }, [item, onSelect, onSeek, onDragStart, isScriptItem]);

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

  // Use smaller height for script items
  const itemHeight = isScriptItem
    ? TIMELINE_CONSTANTS.SCRIPT_TRACK_ITEM_HEIGHT
    : TIMELINE_CONSTANTS.TRACK_ITEM_HEIGHT;

  return (
    <div
      ref={itemRef}
      className={`
        absolute top-1 bottom-1 rounded-md
        ${isScriptItem ? 'cursor-pointer' : 'cursor-grab'}
        ${getItemStyles()}
        ${isSelected ? 'ring-2 ring-white/80 ring-offset-1 ring-offset-transparent shadow-[0_0_15px_rgba(255,255,255,0.3)]' : ''}
        ${isDeleted ? 'opacity-50' : ''}
        transition-all duration-150
        hover:brightness-110
        group
      `}
      style={{
        left: needsGap ? `calc(${leftPercent}% + 3px)` : `${leftPercent}%`,
        width: needsGap ? `calc(${widthPercent}% - 3px)` : `${widthPercent}%`,
        minWidth: isScriptItem ? '8px' : '20px',
        height: `${itemHeight}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Video filmstrip background */}
      {isVideoWithFilmstrip && (
        <VideoFilmstrip
          videoSrc={item.data.videoSrc}
          cacheKey={item.data.cacheKey || item.id}
        />
      )}

      {/* Left resize handle - only for non-script items */}
      {!isScriptItem && (
        <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-l z-10" />
      )}

      {/* Clip number badge for video clips */}
      {isVideoClip && clipIndex >= 0 && (
        <div className="absolute top-1 left-1 z-20 w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center shadow-lg">
          <span className="text-[10px] font-bold text-white">{clipIndex + 1}</span>
        </div>
      )}

      {/* Content */}
      <div className={`flex items-center h-full overflow-hidden relative z-10 ${isScriptItem ? 'px-1.5' : 'px-2.5'} ${isVideoClip && clipIndex >= 0 ? 'pl-7' : ''}`}>
        {/* Label with backdrop for filmstrip visibility */}
        {isVideoWithFilmstrip ? (
          <span className="truncate text-xs font-medium text-white px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm">
            {item.label || item.type || 'Item'}
          </span>
        ) : (
          <span className={`
            truncate
            ${isScriptItem
              ? `text-[10px] font-normal ${isDeleted ? 'line-through text-gray-500' : 'text-gray-300'}`
              : `text-sm font-medium drop-shadow-sm ${isDeleted ? 'line-through text-gray-400' : 'text-white'}`
            }
          `}>
            {icon && `${icon} `}{item.label || item.type || 'Item'}
          </span>
        )}
      </div>

      {/* Right resize handle - only for non-script items */}
      {!isScriptItem && (
        <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-r z-10" />
      )}
    </div>
  );
};

export default TimelineItem;
