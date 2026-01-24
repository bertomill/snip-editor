import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Generate a thumbnail from a video buffer using FFmpeg
 * Extracts a frame at 1 second (or 0 if video is shorter)
 * Returns the thumbnail as a JPEG buffer
 */
export async function generateThumbnailFromBuffer(
  videoBuffer: Buffer,
  filename: string
): Promise<Buffer | null> {
  const tempDir = os.tmpdir();
  const tempVideoPath = path.join(tempDir, `thumb_input_${Date.now()}_${filename}`);
  const tempOutputPath = path.join(tempDir, `thumb_output_${Date.now()}.jpg`);

  try {
    // Write video buffer to temp file
    fs.writeFileSync(tempVideoPath, videoBuffer);

    // Generate thumbnail using FFmpeg
    // -ss 1: seek to 1 second (or start if shorter)
    // -vframes 1: extract 1 frame
    // -vf scale=...: scale to max 400px width/height while maintaining aspect ratio
    // -q:v 2: high quality JPEG
    const ffmpegCmd = `ffmpeg -y -ss 1 -i "${tempVideoPath}" -vframes 1 -vf "scale='min(400,iw)':'min(400,ih)':force_original_aspect_ratio=decrease" -q:v 2 "${tempOutputPath}" 2>/dev/null || ffmpeg -y -ss 0 -i "${tempVideoPath}" -vframes 1 -vf "scale='min(400,iw)':'min(400,ih)':force_original_aspect_ratio=decrease" -q:v 2 "${tempOutputPath}" 2>/dev/null`;

    await execAsync(ffmpegCmd);

    // Read the generated thumbnail
    if (fs.existsSync(tempOutputPath)) {
      const thumbnailBuffer = fs.readFileSync(tempOutputPath);
      return thumbnailBuffer;
    }

    return null;
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return null;
  } finally {
    // Cleanup temp files
    try {
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
