/**
 * Silence merger algorithm
 * Combines FFmpeg silence detection with Whisper word gaps for accurate silence identification
 */

import {
  SilenceSegment,
  SilenceMergeOptions,
  DEFAULT_MERGE_OPTIONS,
  AGGRESSIVENESS_PRESETS,
  SilenceDetectionOptions,
} from "@/types/silence";

/**
 * Word with timing information from Whisper transcription
 */
interface TranscribedWord {
  id: string;
  text: string;
  start: number;
  end: number;
}

/**
 * Detect word gaps from Whisper transcription
 * These are silences between spoken words that Whisper identified
 */
export function detectWhisperGaps(
  words: TranscribedWord[],
  clipIndex: number,
  minGapDuration: number = 0.3
): SilenceSegment[] {
  const gaps: SilenceSegment[] = [];

  for (let i = 0; i < words.length - 1; i++) {
    const currentWord = words[i];
    const nextWord = words[i + 1];
    const gapDuration = nextWord.start - currentWord.end;

    if (gapDuration >= minGapDuration) {
      gaps.push({
        id: `whisper-${clipIndex}-${i}`,
        start: currentWord.end,
        end: nextWord.start,
        clipIndex,
        source: 'whisper',
        confidence: 0.7, // Whisper gaps are generally reliable
        duration: gapDuration,
        type: 'mid',
      });
    }
  }

  return gaps;
}

/**
 * Check if two time intervals overlap
 */
function intervalsOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number,
  minOverlap: number = 0
): boolean {
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  const overlap = overlapEnd - overlapStart;
  return overlap >= minOverlap;
}

/**
 * Calculate overlap amount between two intervals
 */
function calculateOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): number {
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Merge FFmpeg silence segments with Whisper word gaps
 *
 * Priority rules:
 * 1. Overlapping segments get boosted confidence
 * 2. FFmpeg-only segments (no Whisper confirmation) get reduced confidence
 * 3. Whisper-only gaps are kept as-is (speech context is reliable)
 * 4. Boundary silences always get high confidence
 */
export function mergeSilenceData(
  ffmpegSegments: SilenceSegment[],
  whisperGaps: SilenceSegment[],
  clipIndex: number,
  options: Partial<SilenceMergeOptions> = {}
): SilenceSegment[] {
  const {
    overlapThreshold,
    agreementBoost,
    ffmpegOnlyPenalty,
  } = { ...DEFAULT_MERGE_OPTIONS, ...options };

  const mergedSegments: SilenceSegment[] = [];
  const usedWhisperGaps = new Set<string>();

  // Process each FFmpeg segment
  for (const ffmpegSeg of ffmpegSegments) {
    // Find overlapping Whisper gaps
    const overlappingGaps = whisperGaps.filter(gap =>
      intervalsOverlap(
        ffmpegSeg.start,
        ffmpegSeg.end,
        gap.start,
        gap.end,
        overlapThreshold
      )
    );

    if (overlappingGaps.length > 0) {
      // Agreement between FFmpeg and Whisper - merge with boosted confidence
      for (const gap of overlappingGaps) {
        usedWhisperGaps.add(gap.id);
      }

      // Calculate merged interval (union of all overlapping segments)
      const mergedStart = Math.min(
        ffmpegSeg.start,
        ...overlappingGaps.map(g => g.start)
      );
      const mergedEnd = Math.max(
        ffmpegSeg.end,
        ...overlappingGaps.map(g => g.end)
      );

      // Boost confidence due to agreement
      const boostedConfidence = Math.min(
        ffmpegSeg.confidence + agreementBoost,
        1.0
      );

      mergedSegments.push({
        id: `merged-${clipIndex}-${mergedSegments.length}`,
        start: mergedStart,
        end: mergedEnd,
        clipIndex,
        source: 'merged',
        confidence: boostedConfidence,
        duration: mergedEnd - mergedStart,
        type: ffmpegSeg.type,
      });
    } else {
      // FFmpeg-only detection - may be background noise, not speech gap
      // Reduce confidence unless it's a boundary silence
      let adjustedConfidence = ffmpegSeg.confidence;

      if (ffmpegSeg.type !== 'boundary') {
        adjustedConfidence = Math.max(0, ffmpegSeg.confidence - ffmpegOnlyPenalty);
      }

      mergedSegments.push({
        ...ffmpegSeg,
        id: `ffmpeg-adj-${clipIndex}-${mergedSegments.length}`,
        confidence: adjustedConfidence,
      });
    }
  }

  // Add any Whisper gaps that weren't matched by FFmpeg
  // These are reliable speech context gaps
  for (const gap of whisperGaps) {
    if (!usedWhisperGaps.has(gap.id)) {
      mergedSegments.push({
        ...gap,
        id: `whisper-only-${clipIndex}-${mergedSegments.length}`,
      });
    }
  }

  // Sort by start time
  mergedSegments.sort((a, b) => a.start - b.start);

  // Merge overlapping segments
  return deduplicateSegments(mergedSegments, clipIndex);
}

/**
 * Merge overlapping silence segments into single segments
 */
function deduplicateSegments(
  segments: SilenceSegment[],
  clipIndex: number
): SilenceSegment[] {
  if (segments.length === 0) return [];

  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const result: SilenceSegment[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if segments overlap or are adjacent (within 0.1s)
    if (next.start <= current.end + 0.1) {
      // Merge: extend current segment, keep highest confidence
      current.end = Math.max(current.end, next.end);
      current.duration = current.end - current.start;
      current.confidence = Math.max(current.confidence, next.confidence);
      // If either is merged source, mark as merged
      if (current.source !== next.source) {
        current.source = 'merged';
      }
      // Boundary type takes precedence
      if (next.type === 'boundary') {
        current.type = 'boundary';
      }
    } else {
      // No overlap, finalize current and start new
      result.push({
        ...current,
        id: `dedup-${clipIndex}-${result.length}`,
      });
      current = { ...next };
    }
  }

  // Don't forget the last segment
  result.push({
    ...current,
    id: `dedup-${clipIndex}-${result.length}`,
  });

  return result;
}

/**
 * Filter silence segments based on aggressiveness level
 */
export function filterByAggressiveness(
  segments: SilenceSegment[],
  aggressiveness: SilenceDetectionOptions['aggressiveness']
): SilenceSegment[] {
  const preset = AGGRESSIVENESS_PRESETS[aggressiveness];

  return segments.filter(segment => {
    // Apply minimum duration threshold
    if (segment.duration < preset.threshold) {
      return false;
    }

    // Apply minimum confidence threshold
    if (segment.confidence < preset.minConfidence) {
      return false;
    }

    return true;
  });
}

/**
 * High-level function to merge all silence data for a clip
 */
export function processSilenceForClip(
  ffmpegSegments: SilenceSegment[],
  words: TranscribedWord[],
  clipIndex: number,
  aggressiveness: SilenceDetectionOptions['aggressiveness'] = 'natural'
): SilenceSegment[] {
  const preset = AGGRESSIVENESS_PRESETS[aggressiveness];

  // Detect word gaps from Whisper data
  const whisperGaps = detectWhisperGaps(words, clipIndex, preset.threshold);

  // Merge FFmpeg and Whisper data
  const merged = mergeSilenceData(ffmpegSegments, whisperGaps, clipIndex);

  // Filter by aggressiveness level
  const filtered = filterByAggressiveness(merged, aggressiveness);

  return filtered;
}

/**
 * Calculate summary statistics for silence segments
 */
export function calculateSilenceStats(segments: SilenceSegment[]): {
  totalSilence: number;
  boundaryTotal: number;
  midTotal: number;
  count: number;
  avgConfidence: number;
} {
  if (segments.length === 0) {
    return {
      totalSilence: 0,
      boundaryTotal: 0,
      midTotal: 0,
      count: 0,
      avgConfidence: 0,
    };
  }

  const totalSilence = segments.reduce((sum, s) => sum + s.duration, 0);
  const boundaryTotal = segments
    .filter(s => s.type === 'boundary')
    .reduce((sum, s) => sum + s.duration, 0);
  const midTotal = segments
    .filter(s => s.type === 'mid')
    .reduce((sum, s) => sum + s.duration, 0);
  const avgConfidence =
    segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length;

  return {
    totalSilence,
    boundaryTotal,
    midTotal,
    count: segments.length,
    avgConfidence,
  };
}
