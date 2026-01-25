'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ResizableBottomPanelProps {
  children: React.ReactNode;
  minHeight?: number;
  maxHeight?: number;
  defaultHeight?: number;
  className?: string;
}

/**
 * A bottom-fixed panel that can be resized by dragging the top edge.
 * Like Descript's timeline that slides up to reveal more tracks.
 */
export function ResizableBottomPanel({
  children,
  minHeight = 120,
  maxHeight = 500,
  defaultHeight = 280,
  className = '',
}: ResizableBottomPanelProps) {
  const [height, setHeight] = useState(defaultHeight);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startY.current = e.clientY;
    startHeight.current = height;
  }, [height]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaY = startY.current - e.clientY;
    const newHeight = Math.min(maxHeight, Math.max(minHeight, startHeight.current + deltaY));
    setHeight(newHeight);
  }, [isDragging, minHeight, maxHeight]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
    startHeight.current = height;
  }, [height]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;

    const deltaY = startY.current - e.touches[0].clientY;
    const newHeight = Math.min(maxHeight, Math.max(minHeight, startHeight.current + deltaY));
    setHeight(newHeight);
  }, [isDragging, minHeight, maxHeight]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  return (
    <div
      ref={panelRef}
      className={`fixed left-0 right-0 bg-[#0D0D0D] border-t border-[var(--border-subtle)] z-30 bottom-0 ${className}`}
      style={{ height }}
    >
      {/* Drag Handle */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`absolute top-0 left-0 right-0 h-3 cursor-ns-resize group flex items-center justify-center ${
          isDragging ? 'bg-[#4A8FE7]/20' : 'hover:bg-white/5'
        } transition-colors`}
      >
        {/* Visual indicator */}
        <div className={`w-12 h-1 rounded-full transition-colors ${
          isDragging ? 'bg-[#4A8FE7]' : 'bg-white/20 group-hover:bg-white/40'
        }`} />
      </div>

      {/* Content */}
      <div className="h-full pt-3 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export default ResizableBottomPanel;
