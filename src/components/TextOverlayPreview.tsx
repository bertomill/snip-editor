"use client";

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { TextOverlay } from '@/types/overlays';
import { getTextStyleById } from '@/lib/templates/text-templates';

interface TextOverlayPreviewProps {
  textOverlays: TextOverlay[];
  currentTimeMs: number;
  onUpdatePosition?: (id: string, position: { x: number; y: number }) => void;
  onUpdateContent?: (id: string, content: string) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
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
  onUpdateContent,
  containerRef,
}: TextOverlayPreviewProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleDoubleClick = useCallback((overlay: TextOverlay) => {
    if (!onUpdateContent) return;
    setEditingId(overlay.id);
    setEditValue(overlay.content);
  }, [onUpdateContent]);

  const handleEditSubmit = useCallback(() => {
    if (editingId && onUpdateContent && editValue.trim()) {
      onUpdateContent(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  }, [editingId, editValue, onUpdateContent]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditSubmit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditValue('');
    }
  }, [handleEditSubmit]);

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
        const isEditing = editingId === overlay.id;
        const isInteractive = !!onUpdatePosition;
        const canEdit = !!onUpdateContent;

        return (
          <div
            key={overlay.id}
            className={`absolute ${isInteractive && !isEditing ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'z-30' : 'z-20'} ${isEditing ? 'z-40' : ''}`}
            style={{
              left: `${overlay.position.x}%`,
              top: `${overlay.position.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onMouseDown={isInteractive && !isEditing ? (e) => handleMouseDown(e, overlay) : undefined}
            onTouchStart={isInteractive && !isEditing ? (e) => handleTouchStart(e, overlay) : undefined}
            onDoubleClick={canEdit ? () => handleDoubleClick(overlay) : undefined}
          >
            {/* Selection ring when dragging or editing */}
            {(isDragging || isEditing) && (
              <div className="absolute inset-0 -m-1 border-2 border-[#4A8FE7] rounded-lg pointer-events-none" />
            )}

            {isEditing ? (
              // Inline edit input
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleEditSubmit}
                onKeyDown={handleEditKeyDown}
                className="bg-transparent border-none outline-none text-center min-w-[100px]"
                style={{
                  fontFamily: style.fontFamily,
                  fontSize: style.fontSize,
                  fontWeight: style.fontWeight,
                  color: style.color,
                  textShadow: style.textShadow,
                  letterSpacing: style.letterSpacing,
                  padding: style.padding,
                  borderRadius: style.borderRadius,
                  ...(style.backgroundColor && !isGradient && {
                    backgroundColor: style.backgroundColor,
                  }),
                  ...(isGradient && {
                    background: style.backgroundColor,
                  }),
                }}
                maxLength={100}
              />
            ) : (
              // Display text
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
            )}
          </div>
        );
      })}
    </>
  );
}
