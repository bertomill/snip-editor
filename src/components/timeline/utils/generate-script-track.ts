import { TimelineTrack, TimelineItem, TrackItemType } from '../types';
import { SCRIPT_TRACK_CONSTANTS } from '../constants';

interface TranscriptWord {
  id: string;
  text: string;
  start: number;
  end: number;
  clipIndex: number;
}

interface ClipInfo {
  duration: number;
}

interface GenerateScriptTrackOptions {
  words: TranscriptWord[];
  deletedWordIds: Set<string>;
  deletedPauseIds: Set<string>;
  pauseThreshold?: number;
  clips?: ClipInfo[];  // Clip durations for detecting boundary silence
}

/**
 * Generates a script track from transcript words.
 * Each word becomes a timeline item, and gaps between words (above threshold)
 * become pause items displayed as "...".
 */
export function generateScriptTrack({
  words,
  deletedWordIds,
  deletedPauseIds,
  pauseThreshold = SCRIPT_TRACK_CONSTANTS.PAUSE_THRESHOLD_SECONDS,
  clips,
}: GenerateScriptTrackOptions): TimelineTrack {
  const items: TimelineItem[] = [];

  // Group words by clipIndex
  const wordsByClip = new Map<number, TranscriptWord[]>();
  for (const word of words) {
    const clipWords = wordsByClip.get(word.clipIndex) || [];
    clipWords.push(word);
    wordsByClip.set(word.clipIndex, clipWords);
  }

  // Calculate clip start times (cumulative duration of previous clips)
  const clipStartTimes: number[] = [];
  if (clips) {
    let cumulativeTime = 0;
    for (const clip of clips) {
      clipStartTimes.push(cumulativeTime);
      cumulativeTime += clip.duration;
    }
  }

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const clipIndex = word.clipIndex;

    // Check for leading silence at clip boundary (before first word of this clip)
    if (clips && clipStartTimes.length > clipIndex) {
      const clipWords = wordsByClip.get(clipIndex);
      const isFirstWordOfClip = clipWords && clipWords[0]?.id === word.id;

      if (isFirstWordOfClip) {
        const clipStartTime = clipStartTimes[clipIndex];
        const leadingGap = word.start - clipStartTime;

        if (leadingGap >= pauseThreshold) {
          const pauseId = `pause-before-clip-${clipIndex}-first-word`;
          items.push({
            id: pauseId,
            trackId: 'script-track',
            start: clipStartTime,
            end: word.start,
            type: TrackItemType.PAUSE,
            label: '...',
            data: {
              isPause: true,
              duration: leadingGap,
              isDeleted: deletedPauseIds.has(pauseId),
              isBoundaryPause: true,
            },
          });
        }
      }
    }

    // Add word item
    items.push({
      id: word.id,
      trackId: 'script-track',
      start: word.start,
      end: word.end,
      type: TrackItemType.SCRIPT,
      label: word.text,
      data: {
        isDeleted: deletedWordIds.has(word.id),
        wordIndex: i,
      },
    });

    // Check for pause after this word
    if (i < words.length - 1) {
      const nextWord = words[i + 1];
      const gap = nextWord.start - word.end;

      if (gap >= pauseThreshold) {
        const pauseId = `pause-after-${word.id}`;
        items.push({
          id: pauseId,
          trackId: 'script-track',
          start: word.end,
          end: nextWord.start,
          type: TrackItemType.PAUSE,
          label: '...',
          data: {
            isPause: true,
            duration: gap,
            isDeleted: deletedPauseIds.has(pauseId),
          },
        });
      }
    }

    // Check for trailing silence at clip boundary (after last word of this clip)
    if (clips && clipStartTimes.length > clipIndex) {
      const clipWords = wordsByClip.get(clipIndex);
      const isLastWordOfClip = clipWords && clipWords[clipWords.length - 1]?.id === word.id;

      if (isLastWordOfClip) {
        const clipEndTime = clipStartTimes[clipIndex] + clips[clipIndex].duration;
        const trailingGap = clipEndTime - word.end;

        if (trailingGap >= pauseThreshold) {
          const pauseId = `pause-after-clip-${clipIndex}-last-word`;
          items.push({
            id: pauseId,
            trackId: 'script-track',
            start: word.end,
            end: clipEndTime,
            type: TrackItemType.PAUSE,
            label: '...',
            data: {
              isPause: true,
              duration: trailingGap,
              isDeleted: deletedPauseIds.has(pauseId),
              isBoundaryPause: true,
            },
          });
        }
      }
    }
  }

  return {
    id: 'script-track',
    name: 'Script',
    items,
  };
}
