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

  // Calculate marker intervals to ensure minimum pixel spacing
  const getMarkerInterval = () => {
    // Target minimum spacing between markers in pixels
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const minPixelSpacing = isMobile ? 80 : 60;

    // Estimate container width (use a reasonable default if not available)
    const containerWidth = containerRef.current?.offsetWidth ||
      (typeof window !== 'undefined' ? window.innerWidth - 100 : 800);

    // Calculate how many seconds fit per pixel at current zoom
    const secondsPerPixel = viewportDuration / containerWidth;

    // Calculate minimum time interval needed to achieve minimum pixel spacing
    const minTimeInterval = secondsPerPixel * minPixelSpacing;

    // Round to nice intervals (1, 2, 5, 10, 15, 30, 60 seconds, etc.)
    const niceIntervals = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    let interval = niceIntervals.find(i => i >= minTimeInterval) || 600;

    // Ensure we don't have too few markers (at least 3-4 visible)
    const maxInterval = viewportDuration / 3;
    if (interval > maxInterval && maxInterval > 0.5) {
      interval = niceIntervals.filter(i => i <= maxInterval).pop() || 1;
    }

    return interval;
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
    const scrollContainer = scrollContainerRef?.current;
    const scrollLeft = scrollContainer?.scrollLeft || 0;

    // Use scrollWidth for the full zoomed content width
    const totalWidth = container.scrollWidth || rect.width;

    // Immediately seek to clicked position (accounting for scroll)
    const clickX = e.clientX - rect.left + scrollLeft;
    const percentage = Math.max(0, Math.min(1, clickX / totalWidth));
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

      // Get fresh rect to avoid stale closure issues
      const freshRect = container.getBoundingClientRect();
      const freshTotalWidth = container.scrollWidth || freshRect.width;
      const clientX = moveEvent.clientX;

      // Throttle frame changes to animation frame rate
      scrubRafRef.current = requestAnimationFrame(() => {
        // Update position during drag with fresh measurements (accounting for scroll)
        const currentScrollLeft = scrollContainer?.scrollLeft || 0;
        const x = clientX - freshRect.left + currentScrollLeft;
        const dragPercentage = Math.max(0, Math.min(1, x / freshTotalWidth));
        const dragTime = dragPercentage * viewportDuration;
        const dragFrame = Math.round(dragTime * fps);
        onFrameChange(dragFrame);
      });

      // Auto-scroll near edges (use visible rect for edge detection)
      const scrollRect = scrollContainer?.getBoundingClientRect();
      if (scrollRect) {
        const relativeX = moveEvent.clientX - scrollRect.left;
        const edgeThreshold = 50;
        if (relativeX < edgeThreshold) {
          startAutoScroll('left');
        } else if (relativeX > scrollRect.width - edgeThreshold) {
          startAutoScroll('right');
        } else {
          stopAutoScroll();
        }
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
    const scrollContainer = scrollContainerRef?.current;
    const scrollLeft = scrollContainer?.scrollLeft || 0;
    const totalWidth = container.scrollWidth || rect.width;

    // Immediately seek to touched position (accounting for scroll)
    const touchX = touch.clientX - rect.left + scrollLeft;
    const percentage = Math.max(0, Math.min(1, touchX / totalWidth));
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

      // Get fresh rect to avoid stale closure issues
      const freshRect = container.getBoundingClientRect();
      const freshTotalWidth = container.scrollWidth || freshRect.width;
      const touchClientX = moveTouch.clientX;

      // Throttle frame changes to animation frame rate
      scrubRafRef.current = requestAnimationFrame(() => {
        const currentScrollLeft = scrollContainer?.scrollLeft || 0;
        const x = touchClientX - freshRect.left + currentScrollLeft;
        const dragPercentage = Math.max(0, Math.min(1, x / freshTotalWidth));
        const dragTime = dragPercentage * viewportDuration;
        const dragFrame = Math.round(dragTime * fps);
        onFrameChange(dragFrame);
      });

      // Auto-scroll near edges (use scroll container for edge detection)
      const scrollRect = scrollContainer?.getBoundingClientRect();
      if (scrollRect) {
        const relativeX = moveTouch.clientX - scrollRect.left;
        const edgeThreshold = 50;
        if (relativeX < edgeThreshold) {
          startAutoScroll('left');
        } else if (relativeX > scrollRect.width - edgeThreshold) {
          startAutoScroll('right');
        } else {
          stopAutoScroll();
        }
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
      ref={containerRef}
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
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          >
            <div className="w-px h-3 bg-[#444]" />
            <span className="text-[10px] text-[#888] mt-0.5 whitespace-nowrap">
              {formatTime(time)}
            </span>
          </div>
        );
      })}

      {/* Playhead - draggable handle (Descript-style blue) */}
      <div
        className="absolute top-0 bottom-0 z-10"
        style={{ left: `${playheadPosition}%`, pointerEvents: 'none', transform: 'translateX(-50%)' }}
      >
        {/* Playhead handle - pentagon shape pointing down */}
        <div
          className={`absolute -top-0.5 left-1/2 -translate-x-1/2 w-4 h-5 bg-[#4A8FE7] hover:bg-[#5A9FF7] transition-colors ${isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab'}`}
          style={{
            pointerEvents: 'auto',
            clipPath: 'polygon(0 0, 100% 0, 100% 65%, 50% 100%, 0 65%)',
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            handleMouseDown(e as unknown as React.MouseEvent<HTMLDivElement>);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            handleTouchStart(e as unknown as React.TouchEvent<HTMLDivElement>);
          }}
        />
        {/* Playhead line */}
        <div className="absolute top-4 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-[#4A8FE7]" />
      </div>
    </div>
  );
};

export default TimelineMarkers;
