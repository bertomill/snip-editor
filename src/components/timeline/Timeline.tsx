'use client';

import React, { useRef, useEffect, useCallback, RefObject } from 'react';
import { TimelineProps, TimelineTrack } from './types';
import { TimelineHeader, TimelineContent, TimelineTrackHandles } from './components';
import {
  useTimelineZoom,
  useTimelineInteractions,
  useTimelineTracks,
  useTimelineComposition,
  useTimelineDragAndDrop,
} from './hooks';

export type { TimelineItem, TimelineTrack, TimelineProps } from './types';

export const Timeline: React.FC<TimelineProps> = ({
  tracks: initialTracks,
  totalDuration,
  currentFrame = 0,
  fps = 30,
  onFrameChange,
  onItemMove,
  onItemResize,
  onItemSelect,
  onDeleteItems,
  selectedItemIds = [],
  onSelectedItemsChange,
  onTracksChange,
  showZoomControls = false,
  isPlaying = false,
  onPlay,
  onPause,
  showPlaybackControls = false,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);

  // Initialize zoom hook
  const {
    zoomScale,
    setZoomScale,
    handleWheelZoom,
    resetZoom,
  } = useTimelineZoom(timelineRef, currentFrame, fps, totalDuration);

  // Initialize interactions hook
  const {
    ghostMarkerPosition,
    isDragging,
    handleMouseMove,
    handleMouseLeave,
  } = useTimelineInteractions(timelineRef, zoomScale);

  // Initialize tracks hook
  const {
    tracks,
    setTracks,
    handleItemMove: internalItemMove,
    handleItemResize: internalItemResize,
    handleItemsDelete: internalItemsDelete,
  } = useTimelineTracks({
    initialTracks,
    onTracksChange,
    selectedItemIds,
    onSelectedItemsChange,
  });

  // Get composition data
  const { compositionDuration, viewportDuration, currentTime } = useTimelineComposition({
    tracks,
    totalDuration,
    currentFrame,
    fps,
    zoomScale,
  });

  // Initialize drag and drop
  const {
    handleDragStart,
    handleDrag,
    handleDragEnd,
  } = useTimelineDragAndDrop({
    totalDuration: compositionDuration,
    tracks,
    onItemMove: (itemId, newStart, newEnd, newTrackId) => {
      internalItemMove(itemId, newStart, newEnd, newTrackId);
      onItemMove?.(itemId, newStart, newEnd, newTrackId);
    },
    onItemResize: (itemId, newStart, newEnd) => {
      internalItemResize(itemId, newStart, newEnd);
      onItemResize?.(itemId, newStart, newEnd);
    },
    timelineRef,
    selectedItemIds,
  });

  // Add wheel zoom event listener
  useEffect(() => {
    const element = timelineRef?.current;
    if (!element) return;

    element.addEventListener("wheel", handleWheelZoom, { passive: false });
    return () => element.removeEventListener("wheel", handleWheelZoom);
  }, [handleWheelZoom]);

  // Handle keyboard shortcuts for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemIds.length > 0) {
        // Don't delete if user is typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }

        e.preventDefault();
        internalItemsDelete(selectedItemIds);
        onDeleteItems?.(selectedItemIds);
        onSelectedItemsChange?.([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemIds, internalItemsDelete, onDeleteItems, onSelectedItemsChange]);

  return (
    <div className="timeline-container bg-[#0A0A0A] flex flex-col h-full overflow-hidden rounded-lg border border-[#282828]">
      <TimelineHeader
        totalDuration={compositionDuration}
        currentTime={currentTime}
        showZoomControls={showZoomControls}
        zoomScale={zoomScale}
        setZoomScale={setZoomScale}
        resetZoom={resetZoom}
        isPlaying={isPlaying}
        onPlay={onPlay}
        onPause={onPause}
        showPlaybackControls={showPlaybackControls}
      />

      {/* Tracks container - flex layout */}
      <div className="timeline-tracks-wrapper flex flex-1 overflow-hidden">
        {/* Track handles/labels */}
        <div className="hidden md:block overflow-hidden">
          <TimelineTrackHandles tracks={tracks} />
        </div>

        {/* Main timeline content */}
        <div className="timeline-content flex-1 relative bg-[#181818] overflow-hidden">
          <TimelineContent
            tracks={tracks}
            totalDuration={compositionDuration}
            viewportDuration={viewportDuration}
            currentFrame={currentFrame}
            fps={fps}
            zoomScale={zoomScale}
            onFrameChange={onFrameChange}
            onItemSelect={onItemSelect}
            selectedItemIds={selectedItemIds}
            onSelectedItemsChange={onSelectedItemsChange}
            timelineRef={timelineRef}
            onDragStart={handleDragStart}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
          />
        </div>
      </div>
    </div>
  );
};

export default Timeline;
