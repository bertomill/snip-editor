'use client';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let ffmpegLoaded = false;
let ffmpegLoading = false;
let loadPromise: Promise<FFmpeg> | null = null;
let extractionCounter = 0;

/**
 * Reset FFmpeg instance (used when FFmpeg crashes or gets corrupted)
 */
function resetFFmpeg(): void {
  console.log('[FFmpeg] Resetting instance...');
  if (ffmpeg) {
    try {
      ffmpeg.terminate();
    } catch {
      // Ignore termination errors
    }
  }
  ffmpeg = null;
  ffmpegLoaded = false;
  ffmpegLoading = false;
  loadPromise = null;
}

/**
 * Load FFmpeg.wasm (only once, or reload after reset)
 */
async function loadFFmpeg(onProgress?: (progress: number) => void): Promise<FFmpeg> {
  if (ffmpegLoaded && ffmpeg) {
    return ffmpeg;
  }

  // If already loading, wait for the existing promise
  if (ffmpegLoading && loadPromise) {
    return loadPromise;
  }

  ffmpegLoading = true;

  loadPromise = (async () => {
    try {
      ffmpeg = new FFmpeg();

      // Log progress
      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      ffmpeg.on('progress', ({ progress }) => {
        // Clamp progress to valid range (FFmpeg can report negative/huge values during metadata parsing)
        const validProgress = Math.max(0, Math.min(1, progress));
        onProgress?.(validProgress * 100);
      });

      // Load FFmpeg core from CDN using direct URLs
      // Using direct URLs instead of toBlobURL to avoid module loading issues in production
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: `${baseURL}/ffmpeg-core.js`,
        wasmURL: `${baseURL}/ffmpeg-core.wasm`,
      });

      ffmpegLoaded = true;
      console.log('[FFmpeg] Loaded successfully');
      return ffmpeg;
    } catch (error) {
      console.error('[FFmpeg] Failed to load:', error);
      ffmpeg = null;
      ffmpegLoaded = false;
      throw error;
    } finally {
      ffmpegLoading = false;
    }
  })();

  return loadPromise;
}

/**
 * Extract audio from a video file using FFmpeg.wasm
 * Returns a small MP3 file suitable for transcription
 */
export async function extractAudioFromVideo(
  videoFile: File,
  onProgress?: (progress: number) => void
): Promise<File> {
  console.log(`[extractAudio] Starting extraction from ${videoFile.name} (${(videoFile.size / 1024 / 1024).toFixed(1)}MB)`);

  // Use unique filenames to avoid conflicts between extractions
  const uniqueId = ++extractionCounter;
  const inputName = `input_${uniqueId}${getExtension(videoFile.name)}`;
  const outputName = `output_${uniqueId}.mp3`;

  let ff: FFmpeg;
  try {
    ff = await loadFFmpeg(onProgress);
  } catch (loadError) {
    console.error('[extractAudio] Failed to load FFmpeg:', loadError);
    throw new Error('Failed to load FFmpeg');
  }

  try {
    // Write video file to FFmpeg virtual filesystem
    const videoData = await fetchFile(videoFile);
    await ff.writeFile(inputName, videoData);

    // Extract audio as MP3 (mono, 16kHz - optimized for speech recognition)
    await ff.exec([
      '-i', inputName,
      '-vn',                    // No video
      '-acodec', 'libmp3lame',  // MP3 codec
      '-ar', '16000',           // 16kHz sample rate (optimal for Whisper)
      '-ac', '1',               // Mono
      '-b:a', '64k',            // 64kbps bitrate (good enough for speech)
      '-y',                     // Overwrite output
      outputName
    ]);

    // Read the output file
    const audioData = await ff.readFile(outputName);

    // audioData is Uint8Array for binary files (which MP3 always is)
    if (typeof audioData === 'string') {
      throw new Error('Unexpected string data from FFmpeg');
    }

    // Create a copy with a standard ArrayBuffer (not SharedArrayBuffer)
    const audioBytes = new Uint8Array(audioData);
    const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });
    const audioFile = new File([audioBlob], 'audio.mp3', { type: 'audio/mpeg' });

    console.log(`[extractAudio] Extracted audio: ${(audioFile.size / 1024 / 1024).toFixed(2)}MB (was ${(videoFile.size / 1024 / 1024).toFixed(1)}MB)`);

    // Cleanup - wrapped in try-catch to not fail if files already cleaned up
    try {
      await ff.deleteFile(inputName);
    } catch {
      // Ignore cleanup errors
    }
    try {
      await ff.deleteFile(outputName);
    } catch {
      // Ignore cleanup errors
    }

    return audioFile;
  } catch (error) {
    console.error('[extractAudio] Failed:', error);

    // Try to clean up on error
    try {
      await ff.deleteFile(inputName);
    } catch {
      // Ignore
    }
    try {
      await ff.deleteFile(outputName);
    } catch {
      // Ignore
    }

    // Reset FFmpeg for the next attempt (it may be in a corrupted state)
    resetFFmpeg();

    throw new Error('Failed to extract audio from video');
  }
}

function getExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? `.${ext}` : '.mp4';
}

/**
 * Convert a video file to browser-compatible MP4 using FFmpeg.wasm
 * Used for MOV/HEVC files that can't play directly in browsers
 */
export async function convertVideoToMP4(
  videoFile: File,
  onProgress?: (progress: number) => void
): Promise<{ file: File; url: string }> {
  console.log(`[convertVideo] Starting conversion of ${videoFile.name} (${(videoFile.size / 1024 / 1024).toFixed(1)}MB)`);

  // Use unique filenames to avoid conflicts
  const uniqueId = ++extractionCounter;
  const inputName = `input_${uniqueId}${getExtension(videoFile.name)}`;
  const outputName = `output_${uniqueId}.mp4`;

  let ff: FFmpeg;
  try {
    ff = await loadFFmpeg(onProgress);
  } catch (loadError) {
    console.error('[convertVideo] Failed to load FFmpeg:', loadError);
    throw new Error('Failed to load FFmpeg');
  }

  try {
    // Write video file to FFmpeg virtual filesystem
    const videoData = await fetchFile(videoFile);
    await ff.writeFile(inputName, videoData);

    // Convert to browser-compatible MP4 (H.264 + AAC)
    // Using fast settings for quick preview conversion
    await ff.exec([
      '-i', inputName,
      '-c:v', 'libx264',        // H.264 codec (widely supported)
      '-preset', 'ultrafast',   // Fast encoding for preview
      '-crf', '28',             // Lower quality for smaller file (preview only)
      '-c:a', 'aac',            // AAC audio codec
      '-b:a', '96k',            // Audio bitrate
      '-movflags', '+faststart', // Enable fast start for web playback
      '-y',                     // Overwrite output
      outputName
    ]);

    // Read the output file
    const mp4Data = await ff.readFile(outputName);

    if (typeof mp4Data === 'string') {
      throw new Error('Unexpected string data from FFmpeg');
    }

    // Create a copy with a standard ArrayBuffer
    const mp4Bytes = new Uint8Array(mp4Data);
    const mp4Blob = new Blob([mp4Bytes], { type: 'video/mp4' });
    const mp4File = new File([mp4Blob], videoFile.name.replace(/\.[^.]+$/, '.mp4'), { type: 'video/mp4' });
    const mp4Url = URL.createObjectURL(mp4Blob);

    console.log(`[convertVideo] Converted: ${(mp4File.size / 1024 / 1024).toFixed(2)}MB (was ${(videoFile.size / 1024 / 1024).toFixed(1)}MB)`);

    // Cleanup - wrapped in try-catch
    try {
      await ff.deleteFile(inputName);
    } catch {
      // Ignore cleanup errors
    }
    try {
      await ff.deleteFile(outputName);
    } catch {
      // Ignore cleanup errors
    }

    return { file: mp4File, url: mp4Url };
  } catch (error) {
    console.error('[convertVideo] Failed:', error);

    // Try to clean up on error
    try {
      await ff.deleteFile(inputName);
    } catch {
      // Ignore
    }
    try {
      await ff.deleteFile(outputName);
    } catch {
      // Ignore
    }

    // Reset FFmpeg for the next attempt
    resetFFmpeg();

    throw new Error('Failed to convert video to MP4');
  }
}

/**
 * Check if a file needs conversion for browser preview
 */
export function needsVideoConversion(file: File): boolean {
  const filename = file.name.toLowerCase();
  return filename.endsWith('.mov') ||
         filename.endsWith('.hevc') ||
         file.type === 'video/quicktime';
}

/**
 * Check if FFmpeg.wasm is supported in this browser
 * Works in all modern browsers (single-threaded mode without SharedArrayBuffer)
 */
export function isFFmpegSupported(): boolean {
  return typeof WebAssembly !== 'undefined';
}
