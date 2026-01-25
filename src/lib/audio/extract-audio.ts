'use client';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let ffmpegLoaded = false;
let ffmpegLoading = false;

/**
 * Load FFmpeg.wasm (only once)
 */
async function loadFFmpeg(onProgress?: (progress: number) => void): Promise<FFmpeg> {
  if (ffmpegLoaded && ffmpeg) {
    return ffmpeg;
  }

  if (ffmpegLoading) {
    // Wait for existing load to complete
    while (ffmpegLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (ffmpeg) return ffmpeg;
  }

  ffmpegLoading = true;

  try {
    ffmpeg = new FFmpeg();

    // Log progress
    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    ffmpeg.on('progress', ({ progress }) => {
      onProgress?.(progress * 100);
    });

    // Load FFmpeg core from local files (avoids CORS issues with cross-origin isolation)
    const baseURL = window.location.origin;
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegLoaded = true;
    console.log('[FFmpeg] Loaded successfully');
    return ffmpeg;
  } catch (error) {
    console.error('[FFmpeg] Failed to load:', error);
    ffmpeg = null;
    throw error;
  } finally {
    ffmpegLoading = false;
  }
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

  const ff = await loadFFmpeg(onProgress);

  const inputName = 'input' + getExtension(videoFile.name);
  const outputName = 'output.mp3';

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

    // Cleanup
    await ff.deleteFile(inputName);
    await ff.deleteFile(outputName);

    return audioFile;
  } catch (error) {
    console.error('[extractAudio] Failed:', error);
    throw new Error('Failed to extract audio from video');
  }
}

function getExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? `.${ext}` : '.mp4';
}

/**
 * Check if FFmpeg.wasm is supported in this browser
 */
export function isFFmpegSupported(): boolean {
  return typeof SharedArrayBuffer !== 'undefined';
}
