import { TimelineTrack, TimelineItem, TrackItemType } from '../types';
import { SCRIPT_TRACK_CONSTANTS } from '../constants';

interface TranscriptWord {
  id: string;
  text: string;
  start: number;
  end: number;
  clipIndex: number;
}

interface GenerateScriptTrackOptions {
  words: TranscriptWord[];
  deletedWordIds: Set<string>;
  deletedPauseIds: Set<string>;
  pauseThreshold?: number;
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
}: GenerateScriptTrackOptions): TimelineTrack {
  const items: TimelineItem[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

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
  }

  return {
    id: 'script-track',
    name: 'Script',
    items,
  };
}
