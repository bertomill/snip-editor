/**
 * FFmpeg-based video cutter for removing deleted word segments
 * Cuts out sections of video corresponding to deleted words,
 * then concatenates the remaining "keep" segments.
 */

import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

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
 * Cut a video file keeping only specified segments
 * Uses FFmpeg concat demuxer for fast, quality-preserving cuts
 *
 * @param inputPath - Path to input video (local file or URL)
 * @param segments - Time ranges to KEEP (in seconds)
 * @param outputPath - Where to save the cut video
 * @returns Path to the output video
 */
export async function cutVideoSegments(
  inputPath: string,
  segments: TimeSegment[],
  outputPath: string
): Promise<string> {
  // If only one segment covering the whole video, just copy
  if (segments.length === 0) {
    throw new Error("No segments to keep - video would be empty");
  }

  const tempDir = path.join(os.tmpdir(), `snip-cuts-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const segmentFiles: string[] = [];

    // Extract each segment
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segFile = path.join(tempDir, `seg-${i}.mp4`);

      // Use -c copy for fast, lossless cutting
      // -avoid_negative_ts make_zero helps with timestamp issues
      const duration = seg.end - seg.start;
      await execAsync(
        `ffmpeg -y -i "${inputPath}" -ss ${seg.start.toFixed(3)} -t ${duration.toFixed(3)} ` +
        `-c copy -avoid_negative_ts make_zero "${segFile}"`,
        { timeout: 60000 }
      );

      segmentFiles.push(segFile);
    }

    // If only one segment, just move it
    if (segmentFiles.length === 1) {
      fs.copyFileSync(segmentFiles[0], outputPath);
      return outputPath;
    }

    // Create concat list file
    const listFile = path.join(tempDir, "list.txt");
    const listContent = segmentFiles.map((f) => `file '${f}'`).join("\n");
    fs.writeFileSync(listFile, listContent);

    // Concatenate all segments
    await execAsync(
      `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}"`,
      { timeout: 120000 }
    );

    return outputPath;
  } finally {
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.warn(`Failed to cleanup temp dir ${tempDir}:`, e);
    }
  }
}

/**
 * Cut a video from a buffer, removing deleted segments
 *
 * @param buffer - Input video buffer
 * @param segments - Time ranges to KEEP
 * @param filename - Original filename for temp file
 * @returns Buffer of the cut video
 */
export async function cutVideoBufferSegments(
  buffer: Buffer,
  segments: TimeSegment[],
  filename: string
): Promise<{ buffer: Buffer; newDuration: number }> {
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `input-${Date.now()}-${filename}`);
  const outputPath = path.join(tempDir, `output-${Date.now()}-cut-${filename}`);

  try {
    // Write input buffer to temp file
    fs.writeFileSync(inputPath, buffer);

    // Cut the video
    await cutVideoSegments(inputPath, segments, outputPath);

    // Read the result
    const resultBuffer = fs.readFileSync(outputPath);

    // Calculate new duration
    const newDuration = segments.reduce((acc, seg) => acc + (seg.end - seg.start), 0);

    return { buffer: resultBuffer, newDuration };
  } finally {
    // Cleanup
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
  }
}

/**
 * Sum total duration of segments
 */
export function sumSegmentDurations(segments: TimeSegment[]): number {
  return segments.reduce((acc, seg) => acc + (seg.end - seg.start), 0);
}
