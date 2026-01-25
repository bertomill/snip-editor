/**
 * FFmpeg binary path
 * - Uses ffmpeg-static on Vercel production (webpack build)
 * - Falls back to system ffmpeg for local dev with Turbopack
 */
import { existsSync } from "fs";

let cachedPath: string | null = null;

// Get the ffmpeg path
export function getFFmpegPath(): string {
  if (cachedPath) return cachedPath;

  // Try ffmpeg-static (works on Vercel production with webpack)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic && typeof ffmpegStatic === 'string' && existsSync(ffmpegStatic)) {
      console.log(`[ffmpeg] Using ffmpeg-static: ${ffmpegStatic}`);
      cachedPath = ffmpegStatic;
      return cachedPath;
    }
  } catch {
    // ffmpeg-static not available or path doesn't exist
  }

  // Fall back to system ffmpeg (for local dev with Turbopack)
  console.log(`[ffmpeg] Using system ffmpeg`);
  cachedPath = "ffmpeg";
  return cachedPath;
}

// For backward compatibility
export const ffmpeg: string = "ffmpeg";
