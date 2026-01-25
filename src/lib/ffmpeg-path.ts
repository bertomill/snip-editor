/**
 * FFmpeg binary path - tries multiple sources for Vercel/serverless compatibility
 * Uses dynamic requires to avoid Turbopack bundling issues with native binaries
 */
import { existsSync } from "fs";

let cachedPath: string | null = null;

// Get the ffmpeg path, with multiple fallbacks
export function getFFmpegPath(): string {
  if (cachedPath) return cachedPath;

  // Try @ffmpeg-installer/ffmpeg first (best for Vercel)
  try {
    // Dynamic require to avoid Turbopack bundling issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
    if (ffmpegInstaller?.path && existsSync(ffmpegInstaller.path)) {
      console.log(`[ffmpeg] Using ffmpeg-installer: ${ffmpegInstaller.path}`);
      cachedPath = ffmpegInstaller.path;
      return cachedPath;
    }
  } catch {
    // ffmpeg-installer not available
  }

  // Try ffmpeg-static as fallback
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic && typeof ffmpegStatic === 'string' && existsSync(ffmpegStatic)) {
      console.log(`[ffmpeg] Using ffmpeg-static: ${ffmpegStatic}`);
      cachedPath = ffmpegStatic;
      return cachedPath;
    }
  } catch {
    // ffmpeg-static not available
  }

  // Fall back to system ffmpeg (for local dev)
  console.log(`[ffmpeg] No bundled ffmpeg found, using system ffmpeg`);
  cachedPath = "ffmpeg";
  return cachedPath;
}

// For backward compatibility
export const ffmpeg: string = "ffmpeg";
