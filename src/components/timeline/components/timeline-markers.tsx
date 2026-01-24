'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { TIMELINE_CONSTANTS } from '../constants';
import { formatTime } from '../utils';

interface TimelineMarkersProps {
  totalDuration: number;
  viewportDuration: number;
  currentFrame: number;
  fps: number;
  zoomScale: number;
  onFrameChange?: (frame: number) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export const TimelineMarkers: React.FC<TimelineMarkersProps> = ({
  totalDuration,
  viewportDuration,
  currentFrame,
  fps,
  zoomScale,
  onFrameChange,
  scrollContainerRef,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const autoScrollRef = useRef<number | null>(null);
  const scrubRafRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTimeInSeconds = currentFrame / fps;
  const playheadPosition = (currentTimeInSeconds / viewportDuration) * 100;

  // Auto-scroll helpers
  const startAutoScroll = useCallback((direction: 'left' | 'right') => {
    const scrollContainer = scrollContainerRef?.current;
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
  }, [scrollContainerRef]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

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

  // Handle mouse down for both click and drag
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onFrameChange) return;

    e.preventDefault();
    e.stopPropagation();

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();

    // Immediately seek to clicked position
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * viewportDuration;
    const newFrame = Math.round(newTime * fps);
    onFrameChange(newFrame);

    const startX = e.clientX;
    let hasMoved = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = Math.abs(moveEvent.clientX - startX);

      // If mouse has moved more than 3 pixels, consider it a drag
      if (deltaX > 3 && !hasMoved) {
        hasMoved = true;
        setIsDragging(true);
      }

      // Cancel any pending frame update
      if (scrubRafRef.current) {
        cancelAnimationFrame(scrubRafRef.current);
      }

      // Throttle frame changes to animation frame rate
      scrubRafRef.current = requestAnimationFrame(() => {
        // Update position during drag
        const x = moveEvent.clientX - rect.left;
        const dragPercentage = Math.max(0, Math.min(1, x / rect.width));
        const dragTime = dragPercentage * viewportDuration;
        const dragFrame = Math.round(dragTime * fps);
        onFrameChange(dragFrame);
      });

      // Auto-scroll near edges (keep outside RAF for responsiveness)
      const x = moveEvent.clientX - rect.left;
      const edgeThreshold = 50;
      if (x < edgeThreshold) {
        startAutoScroll('left');
      } else if (x > rect.width - edgeThreshold) {
        startAutoScroll('right');
      } else {
        stopAutoScroll();
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setIsDragging(false);
      stopAutoScroll();
      if (scrubRafRef.current) {
        cancelAnimationFrame(scrubRafRef.current);
        scrubRafRef.current = null;
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [viewportDuration, fps, onFrameChange, startAutoScroll, stopAutoScroll]);

  // Touch support for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!onFrameChange) return;

    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    if (!touch) return;

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();

    // Immediately seek to touched position
    const touchX = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, touchX / rect.width));
    const newTime = percentage * viewportDuration;
    const newFrame = Math.round(newTime * fps);
    onFrameChange(newFrame);

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    setIsDragging(true);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      moveEvent.preventDefault();
      const moveTouch = moveEvent.touches[0];
      if (!moveTouch) return;

      // Cancel any pending frame update
      if (scrubRafRef.current) {
        cancelAnimationFrame(scrubRafRef.current);
      }

      const touchX = moveTouch.clientX;

      // Throttle frame changes to animation frame rate
      scrubRafRef.current = requestAnimationFrame(() => {
        const x = touchX - rect.left;
        const dragPercentage = Math.max(0, Math.min(1, x / rect.width));
        const dragTime = dragPercentage * viewportDuration;
        const dragFrame = Math.round(dragTime * fps);
        onFrameChange(dragFrame);
      });

      // Auto-scroll near edges (keep outside RAF for responsiveness)
      const x = moveTouch.clientX - rect.left;
      const edgeThreshold = 50;
      if (x < edgeThreshold) {
        startAutoScroll('left');
      } else if (x > rect.width - edgeThreshold) {
        startAutoScroll('right');
      } else {
        stopAutoScroll();
      }
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      setIsDragging(false);
      stopAutoScroll();
      if (scrubRafRef.current) {
        cancelAnimationFrame(scrubRafRef.current);
        scrubRafRef.current = null;
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, [viewportDuration, fps, onFrameChange, startAutoScroll, stopAutoScroll]);

  return (
    <div
      className={`timeline-markers-container relative bg-[var(--background)] border-b border-[var(--border)] cursor-pointer select-none ${isDragging ? 'cursor-grabbing' : ''}`}
      style={{ height: `${TIMELINE_CONSTANTS.MARKERS_HEIGHT}px` }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Time markers */}
      {markers.map((time) => {
        const position = (time / viewportDuration) * 100;
        return (
          <div
            key={time}
            className="absolute top-0 flex flex-col items-center pointer-events-none"
            style={{ left: `${position}%` }}
          >
            <div className="w-px h-3 bg-[#444]" />
            <span className="text-[10px] text-[#888] mt-0.5">
              {formatTime(time)}
            </span>
          </div>
        );
      })}

      {/* Playhead - draggable handle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
        style={{ left: `${playheadPosition}%`, pointerEvents: 'none' }}
      >
        <div
          className={`absolute -top-0 -translate-x-1/2 w-4 h-5 bg-red-500 rounded-sm hover:bg-red-400 transition-colors ${isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab'}`}
          style={{ pointerEvents: 'auto' }}
          onMouseDown={(e) => {
            e.stopPropagation();
            handleMouseDown(e as unknown as React.MouseEvent<HTMLDivElement>);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            handleTouchStart(e as unknown as React.TouchEvent<HTMLDivElement>);
          }}
        />
      </div>
    </div>
  );
};

export default TimelineMarkers;
