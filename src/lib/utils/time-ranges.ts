/**
 * Pure time range calculation utilities
 * These can be used on both client and server side
 */

export interface TimeSegment {
  start: number; // seconds
  end: number;   // seconds
}

/**
 * Merge overlapping or adjacent time ranges
 * Input: array of ranges (may overlap)
 * Output: merged non-overlapping ranges sorted by start time
 */
export function mergeTimeRanges(ranges: TimeSegment[]): TimeSegment[] {
  if (ranges.length === 0) return [];

  // Sort by start time
  const sorted = [...ranges].sort((a, b) => a.start - b.start);

  const merged: TimeSegment[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // If current overlaps or is adjacent to last, merge them
    if (current.start <= last.end + 0.001) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Invert time ranges to get "keep" segments
 * Given deleted ranges, returns the segments to keep
 */
export function invertTimeRanges(
  deletedRanges: TimeSegment[],
  totalDuration: number
): TimeSegment[] {
  if (deletedRanges.length === 0) {
    return [{ start: 0, end: totalDuration }];
  }

  const merged = mergeTimeRanges(deletedRanges);
  const keep: TimeSegment[] = [];

  let currentStart = 0;
  for (const deleted of merged) {
    if (deleted.start > currentStart) {
      keep.push({ start: currentStart, end: deleted.start });
    }
    currentStart = deleted.end;
  }

  // Add final segment if there's remaining time
  if (currentStart < totalDuration) {
    keep.push({ start: currentStart, end: totalDuration });
  }

  return keep;
}

/**
 * Calculate time offset for a given timestamp after cuts
 * Used to adjust caption timestamps to match the cut video
 */
export function calculateAdjustedTime(
  originalTime: number,
  deletedRanges: TimeSegment[]
): number {
  const merged = mergeTimeRanges(deletedRanges);
  let offset = 0;

  for (const deleted of merged) {
    if (deleted.end <= originalTime) {
      // This deleted range is entirely before our time, subtract its duration
      offset += deleted.end - deleted.start;
    } else if (deleted.start < originalTime) {
      // We're inside a deleted range (shouldn't happen for active words)
      offset += originalTime - deleted.start;
    }
  }

  return originalTime - offset;
}

/**
 * Sum total duration of segments
 */
export function sumSegmentDurations(segments: TimeSegment[]): number {
  return segments.reduce((acc, seg) => acc + (seg.end - seg.start), 0);
}
