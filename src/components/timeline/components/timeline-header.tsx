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
  onOpenTranscript?: () => void;
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
  onOpenTranscript,
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

        {/* Transcript button */}
        {onOpenTranscript && (
          <button
            onClick={onOpenTranscript}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#282828] hover:bg-[#333] text-white text-xs font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Transcript
          </button>
        )}
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
