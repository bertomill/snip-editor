/**
 * FFmpeg binary path - uses bundled ffmpeg-static for Vercel compatibility
 */
import ffmpegPath from "ffmpeg-static";

export const ffmpeg: string = ffmpegPath || "ffmpeg";
