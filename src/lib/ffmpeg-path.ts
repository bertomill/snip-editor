/**
 * FFmpeg binary path - tries multiple sources for Vercel/serverless compatibility
 * 1. @ffmpeg-installer/ffmpeg (best for serverless)
 * 2. ffmpeg-static (fallback)
 * 3. System ffmpeg (local development)
 */
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { existsSync } from "fs";

let cachedPath: string | null = null;

// Get the ffmpeg path, with multiple fallbacks
export function getFFmpegPath(): string {
  if (cachedPath) return cachedPath;

  // Try @ffmpeg-installer/ffmpeg first (best for Vercel)
  if (ffmpegInstaller?.path && existsSync(ffmpegInstaller.path)) {
    console.log(`[ffmpeg] Using ffmpeg-installer: ${ffmpegInstaller.path}`);
    cachedPath = ffmpegInstaller.path;
    return cachedPath;
  }

  // Try ffmpeg-static as fallback
  if (ffmpegStatic && typeof ffmpegStatic === 'string' && existsSync(ffmpegStatic)) {
    console.log(`[ffmpeg] Using ffmpeg-static: ${ffmpegStatic}`);
    cachedPath = ffmpegStatic;
    return cachedPath;
  }

  // Fall back to system ffmpeg (for local dev)
  console.log(`[ffmpeg] No bundled ffmpeg found, using system ffmpeg`);
  cachedPath = "ffmpeg";
  return cachedPath;
}

// For backward compatibility
export const ffmpeg: string = "ffmpeg";
