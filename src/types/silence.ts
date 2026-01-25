/**
 * Types for silence detection and removal in AutoCut feature
 */

/**
 * A detected silence segment in the audio/video
 */
export interface SilenceSegment {
  id: string;
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
  /** Which clip this silence belongs to (0-indexed) */
  clipIndex: number;
  /** How this silence was detected */
  source: 'whisper' | 'ffmpeg' | 'merged';
  /** Confidence score 0-1, higher = more confident this is removable silence */
  confidence: number;
  /** Duration of the silence in seconds */
  duration: number;
  /** Type of silence (boundary = start/end of clip, mid = between words) */
  type: 'boundary' | 'mid';
}

/**
 * Options for FFmpeg silence detection
 */
export interface SilenceDetectionOptions {
  /** Minimum duration to consider as silence (seconds) */
  threshold: number;
  /** Audio level below which is considered silence (e.g., -30dB) */
  decibelLevel: number;
  /** How aggressively to cut silences */
  aggressiveness: 'tight' | 'natural' | 'conservative';
}

/**
 * Preset aggressiveness levels with their corresponding settings
 */
export const AGGRESSIVENESS_PRESETS: Record<SilenceDetectionOptions['aggressiveness'], {
  threshold: number;
  decibelLevel: number;
  minConfidence: number;
}> = {
  /** Tight: Remove all silences > 0.3s, more aggressive cutting */
  tight: {
    threshold: 0.3,
    decibelLevel: -25,
    minConfidence: 0.5,
  },
  /** Natural: Remove silences > 0.5s, balanced cutting */
  natural: {
    threshold: 0.5,
    decibelLevel: -30,
    minConfidence: 0.6,
  },
  /** Conservative: Remove only obvious silences > 0.8s */
  conservative: {
    threshold: 0.8,
    decibelLevel: -35,
    minConfidence: 0.7,
  },
};

/**
 * Raw FFmpeg silence detection result (before processing)
 */
export interface FFmpegSilenceResult {
  start: number;
  end: number;
  duration: number;
}

/**
 * Result from the transcribe API with silence data
 */
export interface TranscribeWithSilenceResult {
  transcript: string;
  segments: {
    text: string;
    start: number;
    end: number;
  }[];
  words: {
    id: string;
    text: string;
    start: number;
    end: number;
  }[];
  /** Detected silence segments from FFmpeg */
  silenceSegments: SilenceSegment[];
  /** Total silence duration detected (seconds) */
  totalSilenceDuration: number;
  /** Audio duration (seconds) */
  audioDuration: number;
}

/**
 * Options for merging FFmpeg and Whisper silence data
 */
export interface SilenceMergeOptions {
  /** Minimum overlap (seconds) to consider FFmpeg and Whisper detections as same silence */
  overlapThreshold: number;
  /** Boost confidence when both sources agree */
  agreementBoost: number;
  /** Penalty for FFmpeg-only detection (no Whisper gap) */
  ffmpegOnlyPenalty: number;
}

/**
 * Default merge options
 */
export const DEFAULT_MERGE_OPTIONS: SilenceMergeOptions = {
  overlapThreshold: 0.1,
  agreementBoost: 0.2,
  ffmpegOnlyPenalty: 0.2,
};
