"use client";

import React, { useMemo, useRef, useCallback, useState } from "react";
import { TranscriptWord, SnipCaption } from "@/lib/types/composition";
import { captionTemplates } from "@/lib/caption-templates";

interface CaptionPreviewProps {
  words: TranscriptWord[];
  deletedWordIds: Set<string>;
  currentTime: number; // seconds
  templateId?: string;
  showCaptions?: boolean;
  positionY: number; // 0-100 percentage from top
  onPositionChange: (positionY: number) => void;
}

/**
 * Real-time caption preview for the editor
 * Shows word-by-word highlighting synced with video playback
 * Draggable vertically to reposition
 */
export function CaptionPreview({
  words,
  deletedWordIds,
  currentTime,
  templateId = "classic",
  showCaptions = true,
  positionY,
  onPositionChange,
}: CaptionPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartPosition = useRef<number>(0);

  // Get template styles
  const template = captionTemplates.find((t) => t.id === templateId) || captionTemplates[0];
  const styles = template.styles;

  // Filter out deleted words and group into captions
  const captions = useMemo(() => {
    const activeWords = words.filter((w) => !deletedWordIds.has(w.id));
    if (activeWords.length === 0) return [];

    const result: SnipCaption[] = [];
    const WORDS_PER_CAPTION = 8;

    for (let i = 0; i < activeWords.length; i += WORDS_PER_CAPTION) {
      const chunk = activeWords.slice(i, i + WORDS_PER_CAPTION);
      if (chunk.length === 0) continue;

      const text = chunk.map((w) => w.text).join(" ");
      const startMs = chunk[0].start * 1000;
      const endMs = chunk[chunk.length - 1].end * 1000;

      result.push({
        text,
        startMs,
        endMs,
        words: chunk.map((w) => ({
          word: w.text,
          startMs: w.start * 1000,
          endMs: w.end * 1000,
        })),
      });
    }

    return result;
  }, [words, deletedWordIds]);

  // Handle drag start
  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartPosition.current = positionY;
  }, [positionY]);

  // Handle drag move
  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging || !containerRef.current) return;

    const parent = containerRef.current.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const deltaY = clientY - dragStartY.current;
    const deltaPercent = (deltaY / parentRect.height) * 100;
    const newPosition = dragStartPosition.current + deltaPercent;

    onPositionChange(newPosition);
  }, [isDragging, onPositionChange]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientY);
  }, [handleDragStart]);

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientY);
    }
  }, [handleDragStart]);

  // Global event listeners for drag
  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleDragMove(e.touches[0].clientY);
      }
    };

    const handleEnd = () => {
      handleDragEnd();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Don't render if captions are hidden or no words
  if (!showCaptions || captions.length === 0) {
    return null;
  }

  const currentMs = currentTime * 1000;

  // Find current caption
  const currentCaption = captions.find(
    (caption) => currentMs >= caption.startMs && currentMs <= caption.endMs
  );

  if (!currentCaption) {
    return null;
  }

  const highlightStyle = styles.highlightStyle;

  return (
    <div
      ref={containerRef}
      className={`absolute left-0 right-0 px-3 z-10 select-none ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{
        top: `${positionY}%`,
        transform: "translateY(-50%)",
        fontFamily: styles.fontFamily,
        fontSize: "clamp(0.9rem, 4vw, 1.1rem)",
        lineHeight: styles.lineHeight || 1.4,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className="flex flex-wrap justify-center items-center gap-1">
        {currentCaption.words.map((word, index) => {
          const isHighlighted = currentMs >= word.startMs && currentMs <= word.endMs;

          return (
            <span
              key={`${word.word}-${index}`}
              className="transition-all duration-150"
              style={{
                display: "inline-block",
                color: isHighlighted ? highlightStyle?.color : styles.color,
                backgroundColor: isHighlighted
                  ? highlightStyle?.backgroundColor
                  : "transparent",
                opacity: isHighlighted ? 1 : 0.85,
                transform: isHighlighted ? `scale(${highlightStyle?.scale || 1.06})` : "scale(1)",
                fontWeight: isHighlighted
                  ? highlightStyle?.fontWeight || 600
                  : styles.fontWeight || 400,
                textShadow: isHighlighted
                  ? highlightStyle?.textShadow
                  : styles.textShadow,
                padding: highlightStyle?.padding || "2px 6px",
                borderRadius: highlightStyle?.borderRadius || "4px",
              }}
            >
              {word.word}
            </span>
          );
        })}
      </div>
    </div>
  );
}
