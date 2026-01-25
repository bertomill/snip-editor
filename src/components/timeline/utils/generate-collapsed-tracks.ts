/**
 * Generate collapsed timeline tracks where deleted words/pauses are removed
 * and remaining items are shifted to fill the gaps.
 * This shows a preview of what the exported video will look like.
 */

import { TimelineTrack, TimelineItem, TrackItemType } from '../types';
import { mergeTimeRanges, invertTimeRanges, calculateAdjustedTime, TimeSegment } from '@/lib/utils/time-ranges';
import { SCRIPT_TRACK_CONSTANTS } from '../constants';
import { SilenceSegment } from '@/types/silence';

interface TranscriptWord {
  id: string;
  text: string;
  start: number;
  end: number;
  clipIndex: number;
}

interface ClipInfo {
  duration: number;
  file?: File | null;
  url?: string;
  silenceSegments?: SilenceSegment[];
}

interface GenerateCollapsedTracksOptions {
  words: TranscriptWord[];
  deletedWordIds: Set<string>;
  deletedPauseIds: Set<string>;
  clips: ClipInfo[];
  pauseThreshold?: number;
}

interface CollapsedTracksResult {
  videoTrack: TimelineTrack;
  scriptTrack: TimelineTrack;
  totalDuration: number;
  deletedRanges: TimeSegment[];
}

/**
 * Get deleted word time ranges for a specific clip
 */
function getDeletedWordRangesForClip(
  clipIndex: number,
  words: TranscriptWord[],
  deletedWordIds: Set<string>,
  clipStartTime: number
): TimeSegment[] {
  const ranges: TimeSegment[] = [];

  for (const word of words) {
    if (word.clipIndex === clipIndex && deletedWordIds.has(word.id)) {
      ranges.push({
        start: clipStartTime + word.start,
        end: clipStartTime + word.end,
      });
    }
  }

  return ranges;
}

/**
 * Get deleted silence segment ranges for a specific clip
 * Handles the `silence-${clipIndex}-${silence.id}` format from AutoCut
 */
function getDeletedSilenceSegmentRanges(
  clipIndex: number,
  silenceSegments: SilenceSegment[] | undefined,
  deletedPauseIds: Set<string>,
  clipStartTime: number
): TimeSegment[] {
  const ranges: TimeSegment[] = [];

  if (!silenceSegments || silenceSegments.length === 0) return ranges;

  for (const silence of silenceSegments) {
    // Check for the silence segment ID format from AutoCut
    const silenceId = `silence-${clipIndex}-${silence.id}`;
    if (deletedPauseIds.has(silenceId)) {
      ranges.push({
        start: clipStartTime + silence.start,
        end: clipStartTime + silence.end,
      });
    }
  }

  return ranges;
}

/**
 * Get deleted pause time ranges for a specific clip
 * Handles multiple ID formats:
 * - `pause-after-${word.id}` - manual pause deletion
 * - `pause-before-clip-${clipIndex}` - leading silence
 * - `pause-clip-${clipIndex}-${wordId1}-${wordId2}` - word gap from AutoCut
 */
function getDeletedPauseRangesForClip(
  clipIndex: number,
  words: TranscriptWord[],
  deletedPauseIds: Set<string>,
  clipStartTime: number,
  clipDuration: number,
  pauseThreshold: number
): TimeSegment[] {
  const ranges: TimeSegment[] = [];
  const clipWords = words.filter(w => w.clipIndex === clipIndex);

  if (clipWords.length === 0) return ranges;

  // Check for leading silence (multiple ID formats)
  const firstWord = clipWords[0];
  if (firstWord.start >= pauseThreshold) {
    const pauseId1 = `pause-before-clip-${clipIndex}-first-word`;
    const pauseId2 = `pause-before-clip-${clipIndex}`;
    if (deletedPauseIds.has(pauseId1) || deletedPauseIds.has(pauseId2)) {
      ranges.push({
        start: clipStartTime,
        end: clipStartTime + firstWord.start,
      });
    }
  }

  // Check pauses between words (multiple ID formats)
  for (let i = 0; i < clipWords.length - 1; i++) {
    const word = clipWords[i];
    const nextWord = clipWords[i + 1];
    const gap = nextWord.start - word.end;

    if (gap >= pauseThreshold) {
      // Check multiple possible ID formats
      const pauseId1 = `pause-after-${word.id}`;
      const pauseId2 = `pause-clip-${clipIndex}-${word.id}-${nextWord.id}`;

      if (deletedPauseIds.has(pauseId1) || deletedPauseIds.has(pauseId2)) {
        ranges.push({
          start: clipStartTime + word.end,
          end: clipStartTime + nextWord.start,
        });
      }
    }
  }

  // Check for trailing silence
  const lastWord = clipWords[clipWords.length - 1];
  const trailingGap = clipDuration - lastWord.end;
  if (trailingGap >= pauseThreshold) {
    const pauseId = `pause-after-clip-${clipIndex}-last-word`;
    if (deletedPauseIds.has(pauseId)) {
      ranges.push({
        start: clipStartTime + lastWord.end,
        end: clipStartTime + clipDuration,
      });
    }
  }

  return ranges;
}

/**
 * Generate collapsed timeline tracks where deleted content is removed
 * and remaining content is shifted to fill the gaps.
 */
export function generateCollapsedTracks({
  words,
  deletedWordIds,
  deletedPauseIds,
  clips,
  pauseThreshold = SCRIPT_TRACK_CONSTANTS.PAUSE_THRESHOLD_SECONDS,
}: GenerateCollapsedTracksOptions): CollapsedTracksResult {
  // Calculate clip start times
  const clipStartTimes: number[] = [];
  let cumulative = 0;
  for (const clip of clips) {
    clipStartTimes.push(cumulative);
    cumulative += clip.duration;
  }
  const originalTotalDuration = cumulative;

  // Collect all deleted ranges across all clips
  const allDeletedRanges: TimeSegment[] = [];

  for (let i = 0; i < clips.length; i++) {
    const clipStartTime = clipStartTimes[i];
    const clip = clips[i];
    const clipDuration = clip.duration;

    // Get deleted word ranges
    const wordRanges = getDeletedWordRangesForClip(i, words, deletedWordIds, clipStartTime);
    allDeletedRanges.push(...wordRanges);

    // Get deleted silence segment ranges (from AutoCut FFmpeg detection)
    const silenceRanges = getDeletedSilenceSegmentRanges(
      i, clip.silenceSegments, deletedPauseIds, clipStartTime
    );
    allDeletedRanges.push(...silenceRanges);

    // Get deleted pause ranges (from word gap detection)
    const pauseRanges = getDeletedPauseRangesForClip(
      i, words, deletedPauseIds, clipStartTime, clipDuration, pauseThreshold
    );
    allDeletedRanges.push(...pauseRanges);
  }

  // Merge overlapping deleted ranges
  const mergedDeletedRanges = mergeTimeRanges(allDeletedRanges);

  // Get the segments to keep
  const keepSegments = invertTimeRanges(mergedDeletedRanges, originalTotalDuration);

  // Calculate new total duration
  const newTotalDuration = keepSegments.reduce((acc, seg) => acc + (seg.end - seg.start), 0);

  // Generate collapsed video track - each keep segment becomes a video item
  const videoItems: TimelineItem[] = [];
  let collapsedTime = 0;

  for (let segIndex = 0; segIndex < keepSegments.length; segIndex++) {
    const seg = keepSegments[segIndex];
    const segDuration = seg.end - seg.start;

    // Find which clip this segment belongs to
    let clipIndex = 0;
    for (let i = 0; i < clips.length; i++) {
      const clipEnd = clipStartTimes[i] + clips[i].duration;
      if (seg.start < clipEnd) {
        clipIndex = i;
        break;
      }
    }

    const clip = clips[clipIndex];
    const videoSrc = clip?.url || '';

    videoItems.push({
      id: `video-seg-${segIndex}`,
      trackId: 'video-track',
      start: collapsedTime,
      end: collapsedTime + segDuration,
      type: TrackItemType.VIDEO,
      label: (clip?.file?.name || `Clip ${clipIndex + 1}`).slice(0, 15),
      data: {
        clipIndex,
        originalStart: seg.start,
        originalEnd: seg.end,
        url: clip?.url,
        videoSrc,
        cacheKey: clip?.file?.name || `clip-${clipIndex}`,
      },
    });

    collapsedTime += segDuration;
  }

  // Generate collapsed script track - only active words with adjusted times
  const scriptItems: TimelineItem[] = [];
  const activeWords = words.filter(w => !deletedWordIds.has(w.id));

  for (let i = 0; i < activeWords.length; i++) {
    const word = activeWords[i];
    const clipStartTime = clipStartTimes[word.clipIndex] || 0;
    const globalWordStart = clipStartTime + word.start;
    const globalWordEnd = clipStartTime + word.end;

    // Adjust times based on deleted ranges
    const adjustedStart = calculateAdjustedTime(globalWordStart, mergedDeletedRanges);
    const adjustedEnd = calculateAdjustedTime(globalWordEnd, mergedDeletedRanges);

    scriptItems.push({
      id: word.id,
      trackId: 'script-track',
      start: adjustedStart,
      end: adjustedEnd,
      type: TrackItemType.SCRIPT,
      label: word.text,
      data: {
        isDeleted: false,
        wordIndex: i,
        originalStart: globalWordStart,
        originalEnd: globalWordEnd,
      },
    });
  }

  return {
    videoTrack: {
      id: 'video-track',
      name: 'Video',
      items: videoItems,
    },
    scriptTrack: {
      id: 'script-track',
      name: 'Script',
      items: scriptItems,
    },
    totalDuration: newTotalDuration,
    deletedRanges: mergedDeletedRanges,
  };
}
