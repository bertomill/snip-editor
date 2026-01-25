"use client";

import React, { useCallback, useRef, useState } from 'react';
import { TextOverlay } from '@/types/overlays';
import { getTextStyleById } from '@/lib/templates/text-templates';

interface TextOverlayPreviewProps {
  textOverlays: TextOverlay[];
  currentTimeMs: number;
  onUpdatePosition?: (id: string, position: { x: number; y: number }) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
}

/**
 * Renders active text overlays on the video preview
 * Shows text based on current playback time and overlay timing
 * Text can be dragged to reposition
 */
export function TextOverlayPreview({
  textOverlays,
  currentTimeMs,
  onUpdatePosition,
  containerRef,
}: TextOverlayPreviewProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  // Filter to only show overlays that are active at current time
  const activeOverlays = textOverlays.filter(overlay => {
    const endMs = overlay.startMs + overlay.durationMs;
    return currentTimeMs >= overlay.startMs && currentTimeMs < endMs;
  });

  const handleMouseDown = useCallback((e: React.MouseEvent, overlay: TextOverlay) => {
    if (!onUpdatePosition) return;
    e.preventDefault();
    e.stopPropagation();

    setDraggingId(overlay.id);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: overlay.position.x,
      startY: overlay.position.y,
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

      onUpdatePosition(overlay.id, { x: newX, y: newY });
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
  const handleTouchStart = useCallback((e: React.TouchEvent, overlay: TextOverlay) => {
    if (!onUpdatePosition) return;
    e.stopPropagation();

    const touch = e.touches[0];
    setDraggingId(overlay.id);
    dragStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      startX: overlay.position.x,
      startY: overlay.position.y,
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

      onUpdatePosition(overlay.id, { x: newX, y: newY });
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

  if (activeOverlays.length === 0) return null;

  return (
    <>
      {activeOverlays.map(overlay => {
        const style = getTextStyleById(overlay.templateId);
        if (!style) return null;

        // Check if backgroundColor is a gradient
        const isGradient = style.backgroundColor?.includes('gradient');
        const isDragging = draggingId === overlay.id;
        const isInteractive = !!onUpdatePosition;

        return (
          <div
            key={overlay.id}
            className={`absolute ${isInteractive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'} ${isDragging ? 'z-30' : 'z-20'}`}
            style={{
              left: `${overlay.position.x}%`,
              top: `${overlay.position.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onMouseDown={isInteractive ? (e) => handleMouseDown(e, overlay) : undefined}
            onTouchStart={isInteractive ? (e) => handleTouchStart(e, overlay) : undefined}
          >
            {/* Selection ring when dragging */}
            {isDragging && (
              <div className="absolute inset-0 -m-1 border-2 border-[#4A8FE7] rounded-lg pointer-events-none" />
            )}
            <div
              style={{
                fontFamily: style.fontFamily,
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
                color: style.color,
                textShadow: style.textShadow,
                letterSpacing: style.letterSpacing,
                padding: style.padding,
                borderRadius: style.borderRadius,
                // Handle both solid colors and gradients
                ...(style.backgroundColor && !isGradient && {
                  backgroundColor: style.backgroundColor,
                }),
                ...(isGradient && {
                  background: style.backgroundColor,
                }),
                whiteSpace: 'nowrap',
                textAlign: 'center',
              }}
            >
              {overlay.content}
            </div>
          </div>
        );
      })}
    </>
  );
}
