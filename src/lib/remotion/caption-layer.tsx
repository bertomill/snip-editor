import React from "react";
import { SnipCaption, CaptionStyles, CaptionWord } from "../types/composition";

interface CaptionLayerProps {
  captions: SnipCaption[];
  styles: CaptionStyles;
  fps: number;
  currentFrame: number;
}

/**
 * Default caption styles if none provided
 */
const defaultStyles: CaptionStyles = {
  fontFamily: "Inter, sans-serif",
  fontSize: "2rem",
  lineHeight: 1.4,
  textAlign: "center",
  color: "#FFFFFF",
  textShadow: "2px 2px 4px rgba(0,0,0,0.6)",
  fontWeight: 500,
  highlightStyle: {
    backgroundColor: "rgba(59, 130, 246, 0.9)",
    color: "#FFFFFF",
    scale: 1.06,
    fontWeight: 600,
    borderRadius: "6px",
    padding: "2px 8px",
  },
};

/**
 * CaptionLayer Component
 * Renders animated captions with word-by-word highlighting
 */
export const CaptionLayer: React.FC<CaptionLayerProps> = ({
  captions,
  styles,
  fps,
  currentFrame,
}) => {
  const frameMs = (currentFrame / fps) * 1000;
  const mergedStyles = { ...defaultStyles, ...styles };
  const highlightStyle = mergedStyles.highlightStyle || defaultStyles.highlightStyle!;

  // Find the current caption based on frame timestamp
  const currentCaption = captions.find(
    (caption) => frameMs >= caption.startMs && frameMs <= caption.endMs
  );

  if (!currentCaption) return null;

  /**
   * Render individual words with highlight animations
   */
  const renderWords = (caption: SnipCaption) => {
    return caption.words.map((word: CaptionWord, index: number) => {
      const isHighlighted = frameMs >= word.startMs && frameMs <= word.endMs;

      // Calculate animation progress (0 to 1 over 300ms)
      const progress = isHighlighted
        ? Math.min((frameMs - word.startMs) / 300, 1)
        : 0;

      // Calculate scale with easing
      const targetScale = highlightStyle?.scale || 1.06;
      const scale = isHighlighted ? 1 + (targetScale - 1) * progress : 1;

      return (
        <span
          key={`${word.word}-${index}`}
          style={{
            display: "inline-block",
            color: isHighlighted ? highlightStyle?.color : mergedStyles.color,
            backgroundColor: isHighlighted
              ? highlightStyle?.backgroundColor
              : "transparent",
            opacity: isHighlighted ? 1 : 0.85,
            transform: `scale(${scale})`,
            fontWeight: isHighlighted
              ? highlightStyle?.fontWeight || 600
              : mergedStyles.fontWeight || 400,
            textShadow: isHighlighted
              ? highlightStyle?.textShadow
              : mergedStyles.textShadow,
            padding: highlightStyle?.padding || "4px 8px",
            borderRadius: highlightStyle?.borderRadius || "4px",
            margin: "0 2px",
            fontFamily: mergedStyles.fontFamily,
            transition: "all 0.2s ease-out",
          }}
        >
          {word.word}
        </span>
      );
    });
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: mergedStyles.padding || "12px",
        fontFamily: mergedStyles.fontFamily,
        fontSize: mergedStyles.fontSize,
        lineHeight: mergedStyles.lineHeight,
      }}
    >
      <div
        style={{
          whiteSpace: "pre-wrap",
          width: "100%",
          textAlign: "center",
          wordBreak: "break-word",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "2px",
        }}
      >
        {renderWords(currentCaption)}
      </div>
    </div>
  );
};
