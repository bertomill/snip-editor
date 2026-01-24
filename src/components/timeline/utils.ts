// Timeline utility functions

import { TimelineItem } from './types';

/**
 * Calculate viewport duration based on zoom scale and content duration
 */
export const calculateViewportDuration = (contentDuration: number, zoomScale: number): number => {
  if (zoomScale >= 1) {
    return contentDuration;
  }
  const expansionFactor = 1 / Math.max(zoomScale, 0.0001);
  return contentDuration * expansionFactor;
};

/**
 * Convert frame number to time in seconds with high precision
 */
export const frameToTime = (frame: number, fps: number): number => {
  const timeInSeconds = frame / fps;
  return Math.round(timeInSeconds * 1000) / 1000;
};

/**
 * Convert time in seconds to frame number with proper rounding
 */
export const timeToFrame = (timeInSeconds: number, fps: number): number => {
  const preciseTime = Math.round(timeInSeconds * 1000) / 1000;
  return Math.round(preciseTime * fps);
};

/**
 * Calculate mouse position as percentage within timeline bounds
 */
export const calculateMousePosition = (
  clientX: number,
  timelineRect: DOMRect
): number => {
  const position = ((clientX - timelineRect.left) / timelineRect.width) * 100;
  return Math.max(0, Math.min(100, position));
};

/**
 * Calculate timeline content styles for zooming
 */
export const getTimelineContentStyles = (zoomScale: number) => ({
  width: `${Math.max(100, 100 * zoomScale)}%`,
  minWidth: "100%",
  willChange: "width, transform" as const,
  transform: `translateZ(0)`,
});

/**
 * Finds gaps between timeline items in a single track.
 */
export const findGapsInTrack = (
  trackItems: TimelineItem[]
): { start: number; end: number }[] => {
  if (trackItems.length === 0) return [];

  const sortedItems = [...trackItems].sort((a, b) => a.start - b.start);
  const gaps: { start: number; end: number }[] = [];

  const firstItem = sortedItems[0];
  if (firstItem.start > 0) {
    gaps.push({ start: 0, end: firstItem.start });
  }

  for (let i = 0; i < sortedItems.length - 1; i++) {
    const currentItem = sortedItems[i];
    const nextItem = sortedItems[i + 1];

    if (currentItem.end < nextItem.start) {
      gaps.push({ start: currentItem.end, end: nextItem.start });
    }
  }

  return gaps;
};

/**
 * Format time for display (e.g., "1:30" or "0:05")
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
