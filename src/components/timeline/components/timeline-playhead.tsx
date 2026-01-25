'use client';

import React, { useCallback, useRef } from 'react';

interface TimelinePlayheadProps {
  position: number; // Position as percentage 0-100
  onDragStart?: () => void;
  onDrag?: (deltaX: number) => void;
  onDragEnd?: () => void;
}

export const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({
  position,
  onDragStart,
  onDrag,
  onDragEnd,
}) => {
  const isDragging = useRef(false);
  const lastX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    lastX.current = e.clientX;
    onDragStart?.();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaX = moveEvent.clientX - lastX.current;
      lastX.current = moveEvent.clientX;
      onDrag?.(deltaX);
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
    lastX.current = e.touches[0].clientX;
    onDragStart?.();

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!isDragging.current) return;
      const deltaX = moveEvent.touches[0].clientX - lastX.current;
      lastX.current = moveEvent.touches[0].clientX;
      onDrag?.(deltaX);
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
      className="absolute top-0 bottom-0 z-20 pointer-events-none"
      style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
    >
      {/* Playhead handle - draggable area */}
      <div
        className="absolute -top-1 left-1/2 -translate-x-1/2 pointer-events-auto cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ padding: '4px' }} // Larger hit area
      >
        <div
          className="w-3 h-3 bg-[#4A8FE7] rounded-sm"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)',
          }}
        />
      </div>
      {/* Playhead line - also draggable */}
      <div
        className="absolute top-1 bottom-0 left-1/2 -translate-x-1/2 w-2 flex justify-center pointer-events-auto cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="w-0.5 h-full bg-[#4A8FE7]" />
      </div>
    </div>
  );
};

export default TimelinePlayhead;
