'use client';

import React, { useRef, useEffect, useCallback, RefObject } from 'react';
import { TimelineProps, TimelineTrack } from './types';
import { TimelineHeader, TimelineContent } from './components';
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
  onAddContent,
  onOpenTranscript,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);

  // Initialize zoom hook
  const {
    zoomScale,
    setZoomScale,
    handleWheelZoom,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleGestureStart,
    handleGestureChange,
    handleGestureEnd,
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

  // Add zoom and gesture event listeners
  useEffect(() => {
    const element = timelineRef?.current;
    if (!element) return;

    // Wheel zoom (Ctrl/Cmd + scroll)
    element.addEventListener("wheel", handleWheelZoom, { passive: false });

    // Touch events for pinch zoom and pan on touch devices
    element.addEventListener("touchstart", handleTouchStart, { passive: false });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    // Safari gesture events for smoother trackpad pinch
    element.addEventListener("gesturestart", handleGestureStart as EventListener, { passive: false });
    element.addEventListener("gesturechange", handleGestureChange as EventListener, { passive: false });
    element.addEventListener("gestureend", handleGestureEnd as EventListener, { passive: true });

    return () => {
      element.removeEventListener("wheel", handleWheelZoom);
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("gesturestart", handleGestureStart as EventListener);
      element.removeEventListener("gesturechange", handleGestureChange as EventListener);
      element.removeEventListener("gestureend", handleGestureEnd as EventListener);
    };
  }, [handleWheelZoom, handleTouchStart, handleTouchMove, handleTouchEnd, handleGestureStart, handleGestureChange, handleGestureEnd]);

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
    <div className="timeline-container bg-[var(--background)] flex flex-col h-full overflow-hidden">
      <TimelineHeader
        totalDuration={compositionDuration}
        currentTime={currentTime}
        showZoomControls={showZoomControls}
        zoomScale={zoomScale}
        setZoomScale={setZoomScale}
        isPlaying={isPlaying}
        onPlay={onPlay}
        onPause={onPause}
        showPlaybackControls={showPlaybackControls}
        onOpenTranscript={onOpenTranscript}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      {/* Tracks container - flex layout */}
      <div className="timeline-tracks-wrapper flex flex-1 overflow-hidden relative">
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
            onAddContent={onAddContent}
          />
        </div>
      </div>
    </div>
  );
};

export default Timeline;
