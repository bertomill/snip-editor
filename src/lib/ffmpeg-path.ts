/**
 * FFmpeg binary path - uses bundled ffmpeg-static for Vercel compatibility
 * Falls back to system ffmpeg for local development
 */
import ffmpegStatic from "ffmpeg-static";
import { existsSync } from "fs";

let cachedPath: string | null = null;

// Get the ffmpeg path, with fallback to system ffmpeg
export function getFFmpegPath(): string {
  if (cachedPath) return cachedPath;

  // Try bundled ffmpeg-static first
  if (ffmpegStatic && typeof ffmpegStatic === 'string' && existsSync(ffmpegStatic)) {
    console.log(`[ffmpeg] Using bundled ffmpeg: ${ffmpegStatic}`);
    cachedPath = ffmpegStatic;
    return cachedPath;
  }

  // Fall back to system ffmpeg (for local dev or if bundled doesn't exist)
  console.log(`[ffmpeg] Bundled path not found (${ffmpegStatic}), using system ffmpeg`);
  cachedPath = "ffmpeg";
  return cachedPath;
}

// For backward compatibility - lazy evaluation
export const ffmpeg: string = "ffmpeg"; // Default, but use getFFmpegPath() in code
