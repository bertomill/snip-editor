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

// Re-export time range utilities from shared module
export type { TimeSegment } from "@/lib/utils/time-ranges";
export {
  mergeTimeRanges,
  invertTimeRanges,
  calculateAdjustedTime,
  sumSegmentDurations,
} from "@/lib/utils/time-ranges";

import type { TimeSegment } from "@/lib/utils/time-ranges";

const execAsync = promisify(exec);

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
