'use client';

import React, { useCallback } from 'react';
import { TIMELINE_CONSTANTS } from '../constants';
import { formatTime } from '../utils';

interface TimelineMarkersProps {
  totalDuration: number;
  viewportDuration: number;
  currentFrame: number;
  fps: number;
  zoomScale: number;
  onFrameChange?: (frame: number) => void;
}

export const TimelineMarkers: React.FC<TimelineMarkersProps> = ({
  totalDuration,
  viewportDuration,
  currentFrame,
  fps,
  zoomScale,
  onFrameChange,
}) => {
  const currentTimeInSeconds = currentFrame / fps;
  const playheadPosition = (currentTimeInSeconds / viewportDuration) * 100;

  // Calculate marker intervals based on zoom
  const getMarkerInterval = () => {
    if (zoomScale < 1) return 5;
    if (zoomScale < 2) return 2;
    if (zoomScale < 5) return 1;
    return 0.5;
  };

  const markerInterval = getMarkerInterval();
  const markers: number[] = [];
  for (let t = 0; t <= viewportDuration; t += markerInterval) {
    markers.push(t);
  }

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onFrameChange) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * viewportDuration;
    const newFrame = Math.round(newTime * fps);
    onFrameChange(newFrame);
  }, [viewportDuration, fps, onFrameChange]);

  return (
    <div
      className="timeline-markers-container relative bg-[#0A0A0A] border-b border-[#282828] cursor-pointer"
      style={{ height: `${TIMELINE_CONSTANTS.MARKERS_HEIGHT}px` }}
      onClick={handleClick}
    >
      {/* Time markers */}
      {markers.map((time) => {
        const position = (time / viewportDuration) * 100;
        return (
          <div
            key={time}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${position}%` }}
          >
            <div className="w-px h-3 bg-[#444]" />
            <span className="text-[10px] text-[#888] mt-0.5">
              {formatTime(time)}
            </span>
          </div>
        );
      })}

      {/* Playhead */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
        style={{ left: `${playheadPosition}%` }}
      >
        <div className="absolute -top-0 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-sm" />
      </div>
    </div>
  );
};

export default TimelineMarkers;
