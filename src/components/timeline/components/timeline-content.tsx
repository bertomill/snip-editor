'use client';

import React, { useCallback, useRef, useEffect } from 'react';
import { TimelineTrack as TimelineTrackType, TimelineItem as TimelineItemType } from '../types';
import { TIMELINE_CONSTANTS } from '../constants';
import { getTimelineContentStyles } from '../utils';
import TimelineTrack from './timeline-track';
import TimelineMarkers from './timeline-markers';
import TimelineGhostElement from './timeline-ghost-element';
import TimelinePlayhead from './timeline-playhead';
import useTimelineStore from '../stores/use-timeline-store';

interface TimelineContentProps {
  tracks: TimelineTrackType[];
  totalDuration: number;
  viewportDuration: number;
  currentFrame: number;
  fps: number;
  zoomScale: number;
  onFrameChange?: (frame: number) => void;
  onItemSelect?: (itemId: string) => void;
  selectedItemIds: string[];
  onSelectedItemsChange?: (itemIds: string[]) => void;
  timelineRef: React.RefObject<HTMLDivElement> | React.RefObject<HTMLDivElement | null>;
  onDragStart: (item: TimelineItemType, clientX: number, clientY: number, action: "move" | "resize-start" | "resize-end") => void;
  onDrag: (clientX: number, clientY: number) => void;
  onDragEnd: () => void;
  onAddContent?: () => void;
  onAddText?: () => void;
  onAddSticker?: () => void;
  onAddMedia?: () => void;
}

export const TimelineContent: React.FC<TimelineContentProps> = ({
  tracks,
  totalDuration,
  viewportDuration,
  currentFrame,
  fps,
  zoomScale,
  onFrameChange,
  onItemSelect,
  selectedItemIds,
  onSelectedItemsChange,
  timelineRef,
  onDragStart,
  onDrag,
  onDragEnd,
  onAddContent,
  onAddText,
  onAddSticker,
  onAddMedia,
}) => {
  const { ghostElement, isValidDrop, isDragging } = useTimelineStore();
  const isScrubbing = useRef(false);
  const autoScrollRef = useRef<number | null>(null);
  const scrubRafRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currentTimeInSeconds = currentFrame / fps;
  const playheadPosition = (currentTimeInSeconds / viewportDuration) * 100;
  const isPlayheadDragging = useRef(false);

  // Playhead drag handlers
  const handlePlayheadDragStart = useCallback(() => {
    isPlayheadDragging.current = true;
  }, []);

  const handlePlayheadDrag = useCallback((clientX: number) => {
    if (!onFrameChange || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const totalWidth = container.scrollWidth;

    // Calculate position relative to the scrollable content
    const relativeX = clientX - rect.left + scrollLeft;
    const percentage = Math.max(0, Math.min(1, relativeX / totalWidth));

    // Convert percentage to frame
    const newTime = percentage * viewportDuration;
    const maxFrame = Math.floor(totalDuration * fps);
    const newFrame = Math.max(0, Math.min(maxFrame, Math.round(newTime * fps)));

    onFrameChange(newFrame);
  }, [fps, totalDuration, viewportDuration, onFrameChange]);

  const handlePlayheadDragEnd = useCallback(() => {
    isPlayheadDragging.current = false;
  }, []);

  const handleItemSelect = (itemId: string) => {
    onItemSelect?.(itemId);
    onSelectedItemsChange?.([itemId]);
  };

  // Handle seeking to a specific time (from clicking on items)
  const handleSeek = useCallback((time: number) => {
    if (!onFrameChange) return;
    const frame = Math.round(time * fps);
    onFrameChange(frame);
  }, [fps, onFrameChange]);

  const contentStyles = getTimelineContentStyles(zoomScale);

  // Auto-scroll when scrubbing near edges
  const startAutoScroll = useCallback((direction: 'left' | 'right') => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const scroll = () => {
      const scrollSpeed = 8;
      if (direction === 'left') {
        scrollContainer.scrollLeft = Math.max(0, scrollContainer.scrollLeft - scrollSpeed);
      } else {
        scrollContainer.scrollLeft = scrollContainer.scrollLeft + scrollSpeed;
      }
      autoScrollRef.current = requestAnimationFrame(scroll);
    };

    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current);
    }
    autoScrollRef.current = requestAnimationFrame(scroll);
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  // Handle click-to-seek on tracks area
  const handleTracksMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Don't interfere with item or playhead interactions
    if ((e.target as HTMLElement).closest('.timeline-item')) return;
    if ((e.target as HTMLElement).closest('[class*="cursor-grab"]')) return;
    if (!onFrameChange) return;

    e.preventDefault();
    isScrubbing.current = true;

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const scrollContainer = scrollContainerRef.current;
    const scrollLeft = scrollContainer?.scrollLeft || 0;

    // Calculate position accounting for scroll
    const clickX = e.clientX - rect.left + scrollLeft;
    const totalWidth = container.scrollWidth;
    const percentage = Math.max(0, Math.min(1, clickX / totalWidth));
    const newTime = percentage * viewportDuration;
    const newFrame = Math.round(newTime * fps);
    onFrameChange(newFrame);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isScrubbing.current) return;

      // Cancel any pending frame update
      if (scrubRafRef.current) {
        cancelAnimationFrame(scrubRafRef.current);
      }

      // Get fresh measurements to avoid stale closure issues
      const freshRect = container.getBoundingClientRect();
      const freshTotalWidth = container.scrollWidth;
      const clientX = moveEvent.clientX;

      // Throttle frame changes to animation frame rate
      scrubRafRef.current = requestAnimationFrame(() => {
        const currentScrollLeft = scrollContainer?.scrollLeft || 0;
        const x = clientX - freshRect.left + currentScrollLeft;
        const dragPercentage = Math.max(0, Math.min(1, x / freshTotalWidth));
        const dragTime = dragPercentage * viewportDuration;
        const dragFrame = Math.round(dragTime * fps);
        onFrameChange(dragFrame);
      });

      // Auto-scroll near edges
      const edgeThreshold = 50;
      const containerRect = scrollContainer?.getBoundingClientRect();
      if (containerRect) {
        const relativeX = moveEvent.clientX - containerRect.left;
        if (relativeX < edgeThreshold) {
          startAutoScroll('left');
        } else if (relativeX > containerRect.width - edgeThreshold) {
          startAutoScroll('right');
        } else {
          stopAutoScroll();
        }
      }
    };

    const handleMouseUp = () => {
      isScrubbing.current = false;
      stopAutoScroll();
      if (scrubRafRef.current) {
        cancelAnimationFrame(scrubRafRef.current);
        scrubRafRef.current = null;
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [viewportDuration, fps, onFrameChange, startAutoScroll, stopAutoScroll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current);
      }
      if (scrubRafRef.current) {
        cancelAnimationFrame(scrubRafRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Single scroll container for both markers and tracks */}
      <div
        ref={(el) => {
          // Assign to both refs
          (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          if (typeof timelineRef === 'object' && timelineRef !== null) {
            (timelineRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          }
        }}
        className={`timeline-tracks-scroll-container flex-1 overflow-x-auto overflow-y-auto relative ${isScrubbing.current ? 'cursor-grabbing' : ''}`}
      >
        <div
          className="relative cursor-pointer"
          style={contentStyles}
        >
          {/* Markers - now inside the scrollable zoomed content */}
          <TimelineMarkers
            totalDuration={totalDuration}
            viewportDuration={viewportDuration}
            currentFrame={currentFrame}
            fps={fps}
            zoomScale={zoomScale}
            onFrameChange={onFrameChange}
            scrollContainerRef={scrollContainerRef}
          />

          {/* Tracks area */}
          <div onMouseDown={handleTracksMouseDown}>
            {/* Tracks */}
            {tracks.map((track) => (
              <TimelineTrack
                key={track.id}
                track={track}
                totalDuration={viewportDuration}
                selectedItemIds={selectedItemIds}
                onItemSelect={handleItemSelect}
                onSeek={handleSeek}
                onDragStart={onDragStart}
                onDrag={onDrag}
                onDragEnd={onDragEnd}
                isDragging={isDragging}
                onAddContent={track.id === 'video-track' ? onAddContent : undefined}
              />
            ))}
          </div>

          {/* Add overlay buttons */}
          {(onAddText || onAddSticker || onAddMedia) && (
            <div className="flex items-center gap-2 px-3 py-2 border-t border-[#282828]">
              {onAddText && (
                <button
                  onClick={onAddText}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#282828] hover:bg-[#333] text-white/70 hover:text-white text-xs font-medium transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Text
                </button>
              )}
              {onAddSticker && (
                <button
                  onClick={onAddSticker}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#282828] hover:bg-[#333] text-white/70 hover:text-white text-xs font-medium transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Stickers
                </button>
              )}
              {onAddMedia && (
                <button
                  onClick={onAddMedia}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#282828] hover:bg-[#333] text-white/70 hover:text-white text-xs font-medium transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Media
                </button>
              )}
            </div>
          )}

          {/* Playhead line that extends through tracks */}
          <TimelinePlayhead
            position={playheadPosition}
            onDragStart={handlePlayheadDragStart}
            onDrag={handlePlayheadDrag}
            onDragEnd={handlePlayheadDragEnd}
          />

          {/* Ghost element for drag preview */}
          {ghostElement && isDragging && (
            <TimelineGhostElement
              ghosts={ghostElement}
              isValid={isValidDrop}
              tracksCount={tracks.length}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default TimelineContent;
