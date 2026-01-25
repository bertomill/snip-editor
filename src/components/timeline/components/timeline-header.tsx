'use client';

import React from 'react';
import { TIMELINE_CONSTANTS, ZOOM_CONSTRAINTS } from '../constants';
import { formatTime } from '../utils';

interface TimelineHeaderProps {
  totalDuration: number;
  currentTime: number;
  showZoomControls?: boolean;
  zoomScale: number;
  setZoomScale: (scale: number) => void;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  showPlaybackControls?: boolean;
}

export const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  totalDuration,
  currentTime,
  showZoomControls = false,
  zoomScale,
  setZoomScale,
  isPlaying = false,
  onPlay,
  onPause,
  showPlaybackControls = false,
}) => {
  const handlePlayPause = () => {
    if (isPlaying) {
      onPause?.();
    } else {
      onPlay?.();
    }
  };

  const handleZoomIn = () => {
    setZoomScale(Math.min(zoomScale + ZOOM_CONSTRAINTS.zoomStep, ZOOM_CONSTRAINTS.max));
  };

  const handleZoomOut = () => {
    setZoomScale(Math.max(zoomScale - ZOOM_CONSTRAINTS.zoomStep, ZOOM_CONSTRAINTS.min));
  };

  return (
    <div
      className="flex items-center justify-between px-3 bg-[var(--background)] border-b border-[var(--border)]"
      style={{ height: `${TIMELINE_CONSTANTS.HEADER_HEIGHT}px` }}
    >
      {/* Left: Playback controls */}
      <div className="flex items-center gap-2">
        {showPlaybackControls && (
          <button
            onClick={handlePlayPause}
            className="w-8 h-8 flex items-center justify-center rounded bg-[#282828] hover:bg-[#333] transition-colors"
          >
            {isPlaying ? (
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>
        )}

        {/* Time display */}
        <div className="text-sm font-mono text-white">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </div>
      </div>

      {/* Right: Zoom controls */}
      {showZoomControls && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="w-6 h-6 flex items-center justify-center rounded bg-[#282828] hover:bg-[#333] transition-colors text-white text-sm"
            disabled={zoomScale <= ZOOM_CONSTRAINTS.min}
          >
            −
          </button>

          <span className="text-xs text-[#888] min-w-[40px] text-center">
            {Math.round(zoomScale * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            className="w-6 h-6 flex items-center justify-center rounded bg-[#282828] hover:bg-[#333] transition-colors text-white text-sm"
            disabled={zoomScale >= ZOOM_CONSTRAINTS.max}
          >
            +
          </button>

        </div>
      )}
    </div>
  );
};

export default TimelineHeader;
