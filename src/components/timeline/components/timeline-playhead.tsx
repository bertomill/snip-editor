'use client';

import React, { useCallback, useRef } from 'react';

interface TimelinePlayheadProps {
  position: number; // Position as percentage 0-100
  onDragStart?: () => void;
  onDrag?: (clientX: number) => void; // Now passes absolute clientX
  onDragEnd?: () => void;
}

export const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({
  position,
  onDragStart,
  onDrag,
  onDragEnd,
}) => {
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    onDragStart?.();
    // Immediately send the current position
    onDrag?.(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      onDrag?.(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      onDragEnd?.();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onDragStart, onDrag, onDragEnd]);

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    isDragging.current = true;
    onDragStart?.();
    // Immediately send the current position
    onDrag?.(e.touches[0].clientX);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!isDragging.current) return;
      onDrag?.(moveEvent.touches[0].clientX);
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
      onDragEnd?.();
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, [onDragStart, onDrag, onDragEnd]);

  return (
    <div
      className="absolute top-0 bottom-0 z-50 pointer-events-none"
      style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
    >
      {/* Playhead handle - draggable area with larger hit zone */}
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-auto cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ padding: '8px' }}
      >
        <div
          className="w-4 h-4 bg-[#4A8FE7] rounded-sm shadow-lg shadow-[#4A8FE7]/50"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)',
          }}
        />
      </div>
      {/* Playhead line - wider hit area for dragging */}
      <div
        className="absolute top-3 bottom-0 left-1/2 -translate-x-1/2 w-4 flex justify-center pointer-events-auto cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="w-0.5 h-full bg-[#4A8FE7] shadow-sm shadow-[#4A8FE7]/30" />
      </div>
    </div>
  );
};

export default TimelinePlayhead;
