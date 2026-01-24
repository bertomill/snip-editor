'use client';

import React from 'react';
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

  const currentTimeInSeconds = currentFrame / fps;
  const playheadPosition = (currentTimeInSeconds / viewportDuration) * 100;

  const handleItemSelect = (itemId: string) => {
    onItemSelect?.(itemId);
    onSelectedItemsChange?.([itemId]);
  };

  const contentStyles = getTimelineContentStyles(zoomScale);

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
      />

      {/* Tracks container with scroll */}
      <div
        ref={timelineRef}
        className="timeline-tracks-scroll-container flex-1 overflow-x-auto overflow-y-auto relative"
      >
        <div
          className="relative"
          style={contentStyles}
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
