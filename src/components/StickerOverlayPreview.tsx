"use client";

import React, { useCallback, useRef, useState } from 'react';
import { StickerOverlay } from '@/types/overlays';
import { getStickerById } from '@/lib/templates/sticker-templates';

interface StickerOverlayPreviewProps {
  stickers: StickerOverlay[];
  currentTimeMs: number;
  onUpdatePosition?: (id: string, position: { x: number; y: number }) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * Renders active sticker overlays on the video preview
 * Shows stickers based on current playback time and overlay timing
 * Stickers can be dragged to reposition
 */
export function StickerOverlayPreview({
  stickers,
  currentTimeMs,
  onUpdatePosition,
  containerRef,
}: StickerOverlayPreviewProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  // Filter to only show stickers that are active at current time
  const activeStickers = stickers.filter(sticker => {
    const endMs = sticker.startMs + sticker.durationMs;
    return currentTimeMs >= sticker.startMs && currentTimeMs < endMs;
  });

  const handleMouseDown = useCallback((e: React.MouseEvent, sticker: StickerOverlay) => {
    if (!onUpdatePosition) return;
    e.preventDefault();
    e.stopPropagation();

    setDraggingId(sticker.id);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: sticker.position.x,
      startY: sticker.position.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current || !containerRef?.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();

      // Calculate delta as percentage of container
      const deltaX = ((moveEvent.clientX - dragStartRef.current.x) / rect.width) * 100;
      const deltaY = ((moveEvent.clientY - dragStartRef.current.y) / rect.height) * 100;

      // Calculate new position, clamping to bounds
      const newX = Math.max(5, Math.min(95, dragStartRef.current.startX + deltaX));
      const newY = Math.max(5, Math.min(95, dragStartRef.current.startY + deltaY));

      onUpdatePosition(sticker.id, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setDraggingId(null);
      dragStartRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onUpdatePosition, containerRef]);

  // Touch support for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent, sticker: StickerOverlay) => {
    if (!onUpdatePosition) return;
    e.stopPropagation();

    const touch = e.touches[0];
    setDraggingId(sticker.id);
    dragStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      startX: sticker.position.x,
      startY: sticker.position.y,
    };

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!dragStartRef.current || !containerRef?.current) return;
      moveEvent.preventDefault();

      const touch = moveEvent.touches[0];
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();

      const deltaX = ((touch.clientX - dragStartRef.current.x) / rect.width) * 100;
      const deltaY = ((touch.clientY - dragStartRef.current.y) / rect.height) * 100;

      const newX = Math.max(5, Math.min(95, dragStartRef.current.startX + deltaX));
      const newY = Math.max(5, Math.min(95, dragStartRef.current.startY + deltaY));

      onUpdatePosition(sticker.id, { x: newX, y: newY });
    };

    const handleTouchEnd = () => {
      setDraggingId(null);
      dragStartRef.current = null;
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, [onUpdatePosition, containerRef]);

  if (activeStickers.length === 0) return null;

  return (
    <>
      {activeStickers.map(sticker => {
        const template = getStickerById(sticker.stickerId);
        if (!template) return null;

        const isDragging = draggingId === sticker.id;
        const isInteractive = !!onUpdatePosition;

        return (
          <div
            key={sticker.id}
            className={`absolute select-none ${isInteractive ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'z-30' : 'z-20'}`}
            style={{
              left: `${sticker.position.x}%`,
              top: `${sticker.position.y}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: `${3 * sticker.scale}rem`,
              lineHeight: 1,
            }}
            onMouseDown={isInteractive ? (e) => handleMouseDown(e, sticker) : undefined}
            onTouchStart={isInteractive ? (e) => handleTouchStart(e, sticker) : undefined}
          >
            {/* Selection ring when dragging */}
            {isDragging && (
              <div className="absolute inset-0 -m-2 border-2 border-[#4A8FE7] rounded-lg pointer-events-none" />
            )}
            <span role="img" aria-label={template.name}>
              {template.emoji}
            </span>
          </div>
        );
      })}
    </>
  );
}
