"use client";

import React, { useMemo } from "react";
import { TranscriptWord, SnipCaption } from "@/lib/types/composition";
import { captionTemplates } from "@/lib/caption-templates";

interface CaptionPreviewProps {
  words: TranscriptWord[];
  deletedWordIds: Set<string>;
  currentTime: number; // seconds
  templateId?: string;
  showCaptions?: boolean;
}

/**
 * Real-time caption preview for the editor
 * Shows word-by-word highlighting synced with video playback
 */
export function CaptionPreview({
  words,
  deletedWordIds,
  currentTime,
  templateId = "classic",
  showCaptions = true,
}: CaptionPreviewProps) {
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
      className="absolute bottom-12 left-0 right-0 px-3 pointer-events-none z-10"
      style={{
        fontFamily: styles.fontFamily,
        fontSize: "clamp(0.9rem, 4vw, 1.1rem)",
        lineHeight: styles.lineHeight || 1.4,
      }}
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
