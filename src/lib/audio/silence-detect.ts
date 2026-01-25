/**
 * Silence detection module using FFmpeg silencedetect filter
 * Detects silent portions in audio for AutoCut feature
 */

import { exec } from "child_process";
import { promisify } from "util";
import {
  FFmpegSilenceResult,
  SilenceSegment,
  SilenceDetectionOptions,
  AGGRESSIVENESS_PRESETS,
} from "@/types/silence";
import { ffmpeg } from "@/lib/ffmpeg-path";

const execAsync = promisify(exec);

/**
 * Default silence detection options
 */
export const DEFAULT_SILENCE_OPTIONS: SilenceDetectionOptions = {
  threshold: 0.5,
  decibelLevel: -30,
  aggressiveness: 'natural',
};

/**
 * Detect silence in an audio file using FFmpeg's silencedetect filter
 *
 * @param audioPath - Path to audio file
 * @param options - Detection options
 * @returns Array of raw silence detection results
 */
export async function detectSilenceFFmpeg(
  audioPath: string,
  options: Partial<SilenceDetectionOptions> = {}
): Promise<FFmpegSilenceResult[]> {
  const {
    aggressiveness = 'natural',
  } = options;

  // Get preset settings based on aggressiveness
  const preset = AGGRESSIVENESS_PRESETS[aggressiveness];
  const threshold = options.threshold ?? preset.threshold;
  const decibelLevel = options.decibelLevel ?? preset.decibelLevel;

  console.log(`[silence-detect] Detecting silence with threshold=${threshold}s, db=${decibelLevel}dB`);

  // FFmpeg silencedetect filter outputs to stderr
  // -af silencedetect=n=<noise_level>:d=<duration>
  // n = noise level (dB below which is silence)
  // d = minimum duration to detect
  const command = `"${ffmpeg}" -i "${audioPath}" -af silencedetect=n=${decibelLevel}dB:d=${threshold} -f null - 2>&1`;

  try {
    const startTime = Date.now();
    const { stdout } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`[silence-detect] FFmpeg completed in ${elapsed}s`);

    // Parse silencedetect output
    const silences = parseSilenceDetectOutput(stdout);

    console.log(`[silence-detect] Found ${silences.length} silence segments`);

    return silences;
  } catch (error) {
    // FFmpeg writes to stderr, but the command may still succeed
    // Check if the error output contains silence data
    if (error instanceof Error && 'stderr' in error) {
      const stderr = (error as { stderr: string }).stderr;
      if (stderr.includes('silence_start') || stderr.includes('silence_end')) {
        return parseSilenceDetectOutput(stderr);
      }
    }

    // Also check stdout in case of redirect
    if (error instanceof Error && 'stdout' in error) {
      const stdout = (error as { stdout: string }).stdout;
      if (stdout.includes('silence_start') || stdout.includes('silence_end')) {
        return parseSilenceDetectOutput(stdout);
      }
    }

    console.error("[silence-detect] FFmpeg silencedetect failed:", error);
    // Return empty array instead of throwing - silence detection is optional
    return [];
  }
}

/**
 * Parse FFmpeg silencedetect output to extract silence intervals
 *
 * Example output:
 * [silencedetect @ 0x...] silence_start: 0.5
 * [silencedetect @ 0x...] silence_end: 1.2 | silence_duration: 0.7
 */
function parseSilenceDetectOutput(output: string): FFmpegSilenceResult[] {
  const silences: FFmpegSilenceResult[] = [];

  // Regex patterns for silencedetect output
  const startPattern = /silence_start:\s*([\d.]+)/g;
  const endPattern = /silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g;

  // Extract all silence starts
  const starts: number[] = [];
  let match;
  while ((match = startPattern.exec(output)) !== null) {
    starts.push(parseFloat(match[1]));
  }

  // Extract all silence ends with durations
  const ends: { end: number; duration: number }[] = [];
  while ((match = endPattern.exec(output)) !== null) {
    ends.push({
      end: parseFloat(match[1]),
      duration: parseFloat(match[2]),
    });
  }

  // Match starts with ends
  for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
    silences.push({
      start: starts[i],
      end: ends[i].end,
      duration: ends[i].duration,
    });
  }

  // Handle trailing silence (start without end - silence extends to end of file)
  if (starts.length > ends.length) {
    const lastStart = starts[starts.length - 1];
    // We don't know the exact end, so mark it with a sentinel
    // This will be handled by the caller who knows the audio duration
    silences.push({
      start: lastStart,
      end: -1, // Sentinel for "end of file"
      duration: -1,
    });
  }

  return silences;
}

/**
 * Get audio duration using FFprobe
 */
export async function getAudioDuration(audioPath: string): Promise<number> {
  const command = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`;

  try {
    const { stdout } = await execAsync(command);
    const duration = parseFloat(stdout.trim());
    if (isNaN(duration)) {
      throw new Error("Could not parse duration");
    }
    return duration;
  } catch (error) {
    console.error("[silence-detect] Failed to get audio duration:", error);
    return 0;
  }
}

/**
 * Convert raw FFmpeg results to SilenceSegment objects
 *
 * @param ffmpegResults - Raw FFmpeg silence detection results
 * @param clipIndex - Index of the clip these silences belong to
 * @param audioDuration - Total duration of the audio (for boundary detection)
 * @param options - Detection options for confidence calculation
 */
export function convertToSilenceSegments(
  ffmpegResults: FFmpegSilenceResult[],
  clipIndex: number,
  audioDuration: number,
  options: Partial<SilenceDetectionOptions> = {}
): SilenceSegment[] {
  const aggressiveness = options.aggressiveness ?? 'natural';
  const preset = AGGRESSIVENESS_PRESETS[aggressiveness];

  return ffmpegResults.map((result, index) => {
    // Handle trailing silence (end of file sentinel)
    const end = result.end === -1 ? audioDuration : result.end;
    const duration = result.duration === -1 ? audioDuration - result.start : result.duration;

    // Determine if this is boundary silence (within 0.1s of start/end)
    const isBoundary = result.start < 0.1 || end > audioDuration - 0.1;

    // Calculate confidence based on duration and type
    // Longer silences and boundary silences get higher confidence
    let confidence = 0.5;

    // Duration factor: longer silences are more likely to be unwanted
    const durationFactor = Math.min(duration / 2, 1); // Cap at 2 seconds
    confidence += durationFactor * 0.3;

    // Boundary factor: start/end silences are almost always unwanted
    if (isBoundary) {
      confidence += 0.2;
    }

    // Normalize to [0, 1]
    confidence = Math.min(Math.max(confidence, 0), 1);

    return {
      id: `ffmpeg-${clipIndex}-${index}`,
      start: result.start,
      end,
      clipIndex,
      source: 'ffmpeg' as const,
      confidence,
      duration,
      type: isBoundary ? 'boundary' : 'mid',
    };
  });
}

/**
 * High-level function to detect all silence in an audio file
 * Returns both raw and processed silence data
 */
export async function detectSilence(
  audioPath: string,
  clipIndex: number,
  options: Partial<SilenceDetectionOptions> = {}
): Promise<{
  segments: SilenceSegment[];
  totalDuration: number;
  audioDuration: number;
}> {
  // Get audio duration first
  const audioDuration = await getAudioDuration(audioPath);

  // Detect silence using FFmpeg
  const ffmpegResults = await detectSilenceFFmpeg(audioPath, options);

  // Convert to SilenceSegment objects
  const segments = convertToSilenceSegments(
    ffmpegResults,
    clipIndex,
    audioDuration,
    options
  );

  // Calculate total silence duration
  const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);

  return {
    segments,
    totalDuration,
    audioDuration,
  };
}
