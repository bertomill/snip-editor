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
}) => {
  const { ghostElement, isValidDrop, isDragging } = useTimelineStore();
  const isScrubbing = useRef(false);
  const autoScrollRef = useRef<number | null>(null);
  const scrubRafRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currentTimeInSeconds = currentFrame / fps;
  const playheadPosition = (currentTimeInSeconds / viewportDuration) * 100;

  const handleItemSelect = (itemId: string) => {
    onItemSelect?.(itemId);
    onSelectedItemsChange?.([itemId]);
  };

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
    // Don't interfere with item interactions
    if ((e.target as HTMLElement).closest('.timeline-item')) return;
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
      {/* Markers */}
      <TimelineMarkers
        totalDuration={totalDuration}
        viewportDuration={viewportDuration}
        currentFrame={currentFrame}
        fps={fps}
        zoomScale={zoomScale}
        onFrameChange={onFrameChange}
        scrollContainerRef={scrollContainerRef}
      />

      {/* Tracks container with scroll */}
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
          onMouseDown={handleTracksMouseDown}
        >
          {/* Tracks */}
          {tracks.map((track) => (
            <TimelineTrack
              key={track.id}
              track={track}
              totalDuration={viewportDuration}
              selectedItemIds={selectedItemIds}
              onItemSelect={handleItemSelect}
              onDragStart={onDragStart}
              onDrag={onDrag}
              onDragEnd={onDragEnd}
              isDragging={isDragging}
            />
          ))}

          {/* Playhead line that extends through tracks */}
          <TimelinePlayhead position={playheadPosition} />

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
