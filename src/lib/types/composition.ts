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

import { TextOverlay, StickerOverlay, ClipTransition } from '@/types/overlays';

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
  // Caption position (percentage from top, 0-100)
  captionPositionY?: number;
  // Clip transitions
  clipTransitions?: ClipTransition[];
}

export interface TranscriptSegment {
  text: string;
  start: number;  // seconds
  end: number;    // seconds
  clipIndex: number;
  words?: TranscriptWord[];  // Word-level timestamps
}

/**
 * Word-level timestamp data for script-driven editing
 */
export interface TranscriptWord {
  id: string;           // Unique ID (e.g., "word-0", "word-1")
  text: string;         // The word
  start: number;        // Start time (seconds)
  end: number;          // End time (seconds)
  clipIndex: number;    // Which clip this belongs to
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

/**
 * Convert transcript words to captions with actual word timestamps
 * Groups consecutive words into caption segments (max ~10 words per caption)
 */
export function wordsToCaption(words: TranscriptWord[]): SnipCaption[] {
  if (words.length === 0) return [];

  const captions: SnipCaption[] = [];
  const WORDS_PER_CAPTION = 8;

  for (let i = 0; i < words.length; i += WORDS_PER_CAPTION) {
    const chunk = words.slice(i, i + WORDS_PER_CAPTION);
    if (chunk.length === 0) continue;

    const text = chunk.map(w => w.text).join(' ');
    const startMs = chunk[0].start * 1000;
    const endMs = chunk[chunk.length - 1].end * 1000;

    captions.push({
      text,
      startMs,
      endMs,
      words: chunk.map(w => ({
        word: w.text,
        startMs: w.start * 1000,
        endMs: w.end * 1000,
      })),
    });
  }

  return captions;
}
