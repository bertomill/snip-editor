'use client';

import React, { useState, useCallback, useRef } from 'react';
import { TimelineTrack } from '../types';
import { TIMELINE_CONSTANTS } from '../constants';

interface TimelineTrackHandlesProps {
  tracks: TimelineTrack[];
  onTrackReorder?: (fromIndex: number, toIndex: number) => void;
}

export const TimelineTrackHandles: React.FC<TimelineTrackHandlesProps> = ({
  tracks,
  onTrackReorder,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const handleDragStart = useCallback((index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    dragIndexRef.current = index;
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndexRef.current !== index) {
      setDropTargetIndex(index);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTargetIndex(null);
  }, []);

  const handleDrop = useCallback((toIndex: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fromIndex = dragIndexRef.current ?? parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!Number.isNaN(fromIndex) && fromIndex !== toIndex) {
      onTrackReorder?.(fromIndex, toIndex);
    }
    setDragIndex(null);
    setDropTargetIndex(null);
    dragIndexRef.current = null;
  }, [onTrackReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropTargetIndex(null);
    dragIndexRef.current = null;
  }, []);

  return (
    <div
      className="track-handles-scroll overflow-hidden bg-[var(--background)] border-r border-[var(--border)]"
      style={{ width: `${TIMELINE_CONSTANTS.HANDLE_WIDTH}px` }}
    >
      {/* Header spacer */}
      <div
        className="border-b border-[#282828]"
        style={{ height: `${TIMELINE_CONSTANTS.MARKERS_HEIGHT}px` }}
      />

      {/* Track labels with drag handles */}
      {tracks.map((track, index) => {
        const isDragging = dragIndex === index;
        const isDropTarget = dropTargetIndex === index;
        const isDragActive = dragIndex !== null;

        return (
          <div
            key={track.id}
            draggable
            onDragStart={handleDragStart(index)}
            onDragOver={handleDragOver(index)}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={`
              flex items-center gap-1 px-2 border-b border-[#282828] text-xs text-[#888]
              transition-all duration-150 select-none
              ${isDragging ? 'opacity-50 scale-95 z-50' : ''}
              ${isDropTarget ? 'bg-blue-500/20 border-l-2 border-l-blue-500' : ''}
              ${isDragActive && !isDragging ? 'opacity-70' : ''}
            `}
            style={{ height: `${TIMELINE_CONSTANTS.TRACK_HEIGHT}px` }}
          >
            {/* Drag handle - 6 dots grid */}
            <div
              className={`flex-shrink-0 flex flex-col gap-[2px] p-1 rounded hover:bg-white/10 transition-colors ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
              <div className="flex gap-[2px]">
                <div className="w-1 h-1 rounded-full bg-[#666]" />
                <div className="w-1 h-1 rounded-full bg-[#666]" />
              </div>
              <div className="flex gap-[2px]">
                <div className="w-1 h-1 rounded-full bg-[#666]" />
                <div className="w-1 h-1 rounded-full bg-[#666]" />
              </div>
              <div className="flex gap-[2px]">
                <div className="w-1 h-1 rounded-full bg-[#666]" />
                <div className="w-1 h-1 rounded-full bg-[#666]" />
              </div>
            </div>

            {/* Track name */}
            <span className="truncate flex-1">
              {track.name || `Track ${index + 1}`}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default TimelineTrackHandles;
