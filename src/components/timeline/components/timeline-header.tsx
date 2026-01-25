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
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
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
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
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

        {/* Undo/Redo buttons */}
        {(onUndo || onRedo) && (
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="w-8 h-8 flex items-center justify-center rounded bg-[#282828] hover:bg-[#333] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Undo (Cmd+Z)"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 0 1 5 5v2M3 10l4-4M3 10l4 4" />
              </svg>
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="w-8 h-8 flex items-center justify-center rounded bg-[#282828] hover:bg-[#333] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Redo (Cmd+Shift+Z)"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 0 0-5 5v2M21 10l-4-4M21 10l-4 4" />
              </svg>
            </button>
          </div>
        )}

        {/* Transcript button - only show on mobile, hidden on desktop where transcript panel is visible */}
        {onOpenTranscript && (
          <button
            onClick={onOpenTranscript}
            className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--background-card)] hover:bg-[var(--background-card-hover)] border border-[var(--border)] hover:border-[var(--accent)] text-white text-sm font-medium transition-all shadow-[0_2px_0_0_rgba(0,0,0,0.4)] hover:shadow-[0_1px_0_0_rgba(0,0,0,0.4)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px]"
          >
            <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
