/**
 * Types for Snip video composition with Remotion
 */

export interface CaptionWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface SnipCaption {
  text: string;
  startMs: number;
  endMs: number;
  words: CaptionWord[];
}

export interface CaptionHighlightStyle {
  backgroundColor?: string;
  color?: string;
  scale?: number;
  fontWeight?: number;
  textShadow?: string;
  borderRadius?: string;
  padding?: string;
}

export interface CaptionStyles {
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: number;
  textAlign?: string;
  color?: string;
  backgroundColor?: string;
  textShadow?: string;
  padding?: string;
  fontWeight?: number | string;
  letterSpacing?: string;
  highlightStyle?: CaptionHighlightStyle;
}

export interface VideoClipInput {
  filePath: string;  // Local file path for SSR rendering
  startMs: number;   // Start time in the composition
  endMs: number;     // End time in the composition
  originalDuration: number;  // Original clip duration in seconds
}

import { TextOverlay, StickerOverlay } from '@/types/overlays';

export interface SnipCompositionProps {
  clips: VideoClipInput[];
  captions: SnipCaption[];
  captionStyles: CaptionStyles;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  // Overlay support
  filterId?: string;
  textOverlays?: TextOverlay[];
  stickers?: StickerOverlay[];
}

export interface TranscriptSegment {
  text: string;
  start: number;  // seconds
  end: number;    // seconds
  clipIndex: number;
}

/**
 * Convert transcript segments to caption format
 * Distributes timing evenly across words within each segment
 */
export function transcriptToCaption(segment: TranscriptSegment): SnipCaption {
  const words = segment.text.split(/\s+/).filter(Boolean);
  const durationMs = (segment.end - segment.start) * 1000;
  const wordDuration = words.length > 0 ? durationMs / words.length : durationMs;

  return {
    text: segment.text,
    startMs: segment.start * 1000,
    endMs: segment.end * 1000,
    words: words.map((word, i) => ({
      word,
      startMs: segment.start * 1000 + i * wordDuration,
      endMs: segment.start * 1000 + (i + 1) * wordDuration,
    })),
  };
}
