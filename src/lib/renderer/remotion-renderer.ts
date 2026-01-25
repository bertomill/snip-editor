import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, RenderMediaOnProgress } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import { getFFmpegPath } from "@/lib/ffmpeg-path";

const execAsync = promisify(exec);

import {
  saveRenderState,
  updateRenderProgress,
  completeRender,
  failRender,
} from "./render-state";
import { SnipCompositionProps } from "../types/composition";
import { uploadRenderedVideo, deleteTempVideos } from "../supabase/storage-server";

// Ensure the videos directory exists
const VIDEOS_DIR = path.join(process.cwd(), "public", "rendered-videos");
const TEMP_DIR = path.join(process.cwd(), "public", "temp-videos");

// Cache for Remotion bundle - avoids rebundling on every render
let cachedBundleLocation: string | null = null;
let bundlePromise: Promise<string> | null = null;

/**
 * Get or create Remotion bundle (cached for performance)
 * This is a major optimization - bundling takes 15-30 seconds
 */
async function getOrCreateBundle(): Promise<string> {
  // If we have a cached bundle that still exists, use it
  if (cachedBundleLocation && fs.existsSync(cachedBundleLocation)) {
    console.log(`📦 Using cached bundle at ${cachedBundleLocation}`);
    return cachedBundleLocation;
  }

  // If a bundle is already being created, wait for it
  if (bundlePromise) {
    console.log(`⏳ Waiting for bundle in progress...`);
    return bundlePromise;
  }

  // Create new bundle
  console.log(`📦 Creating new Remotion bundle...`);
  bundlePromise = bundle(
    path.join(process.cwd(), "src", "lib", "remotion", "index.ts"),
    undefined,
    {
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          fallback: {
            ...config.resolve?.fallback,
            "@remotion/compositor": false,
            "@remotion/compositor-darwin-arm64": false,
            "@remotion/compositor-darwin-x64": false,
            "@remotion/compositor-linux-x64": false,
            "@remotion/compositor-linux-arm64": false,
            "@remotion/compositor-win32-x64-msvc": false,
            "@remotion/compositor-windows-x64": false,
          },
        },
      }),
    }
  ).then((location) => {
    cachedBundleLocation = location;
    bundlePromise = null;
    console.log(`✅ Bundle created and cached at ${location}`);
    return location;
  }).catch((error) => {
    bundlePromise = null;
    cachedBundleLocation = null;
    throw error;
  });

  return bundlePromise;
}

function ensureDirs() {
  if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

/**
 * Convert a video buffer from MOV/HEVC to MP4
 * Uses FFmpeg for conversion
 * Returns the converted buffer and new filename
 */
export async function convertVideoToMp4(
  buffer: Buffer,
  filename: string
): Promise<{ buffer: Buffer; filename: string }> {
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `input-${Date.now()}-${filename}`);
  const outputFilename = filename.replace(/\.(mov|hevc)$/i, '.mp4');
  const outputPath = path.join(tempDir, `output-${Date.now()}-${outputFilename}`);

  try {
    // Write input file
    fs.writeFileSync(inputPath, buffer);

    // Convert to MP4 with balanced speed/quality settings
    // Using -preset fast (was medium) for ~2x faster encoding with minimal quality loss
    await execAsync(
      `"${getFFmpegPath()}" -i "${inputPath}" -c:v libx264 -preset fast -crf 20 -c:a aac -b:a 128k -movflags +faststart -y "${outputPath}"`
    );

    // Read converted file
    const convertedBuffer = fs.readFileSync(outputPath);

    return { buffer: convertedBuffer, filename: outputFilename };
  } finally {
    // Clean up temp files
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
  }
}

/**
 * Save video buffer to local temp directory for SSR access
 * Returns the URL path for Remotion (e.g., /temp-videos/clip-xxx.mp4)
 * Used as fallback when Supabase is not available
 */
export async function saveVideoToTemp(
  buffer: Buffer,
  filename: string
): Promise<string> {
  ensureDirs();

  const filePath = path.join(TEMP_DIR, filename);
  fs.writeFileSync(filePath, buffer);

  // Return URL path for Remotion (relative to public folder)
  return `/temp-videos/${filename}`;
}

/**
 * Clean up local temp video files after render
 * Only cleans local files (not Supabase URLs)
 */
function cleanupLocalTempVideos(filePaths: string[]) {
  for (const filePath of filePaths) {
    // Skip Supabase URLs
    if (filePath.startsWith('http')) continue;

    try {
      const filename = filePath.replace('/temp-videos/', '');
      const fullPath = path.join(TEMP_DIR, filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`🧹 Cleaned up local temp file: ${filename}`);
      }
    } catch (e) {
      console.error(`Failed to cleanup temp file ${filePath}:`, e);
    }
  }
}

/**
 * Start a video render with Remotion SSR
 * If userId is provided, the video will be uploaded to Supabase storage
 */
export async function startRendering(
  inputProps: SnipCompositionProps,
  userId?: string,
  renderId?: string
): Promise<void> {
  // Use provided renderId or generate one
  const id = renderId || `render-${Date.now()}`;

  // Check if videos are from Supabase (URLs start with http)
  const useSupabase = userId && inputProps.clips.some(clip => clip.filePath.startsWith('http'));

  // Initialize render state
  saveRenderState(id, {
    status: "rendering",
    progress: 0,
    timestamp: Date.now(),
  });

  // Start rendering asynchronously
  (async () => {
    try {
      updateRenderProgress(id, 0);
      console.log(`🎬 Starting render ${id}...`);

      // Get or create cached Remotion bundle (major perf optimization)
      const bundleLocation = await getOrCreateBundle();
      updateRenderProgress(id, 10);

      // Select the composition
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "SnipVideo",
        inputProps: inputProps as unknown as Record<string, unknown>,
      });

      console.log(`🎯 Composition selected: ${composition.width}x${composition.height}, ${inputProps.durationInFrames} frames`);
      updateRenderProgress(id, 15);

      // Render the video with optimized settings for speed
      ensureDirs();

      // Determine concurrency based on available CPU cores
      const cpuCount = os.cpus().length;
      const concurrency = Math.max(2, Math.min(cpuCount - 1, 8)); // 2-8 threads
      console.log(`⚡ Rendering with ${concurrency} concurrent threads (${cpuCount} CPUs available)`);

      await renderMedia({
        codec: "h264",
        composition: {
          ...composition,
          durationInFrames: inputProps.durationInFrames,
          width: inputProps.width,
          height: inputProps.height,
        },
        serveUrl: bundleLocation,
        outputLocation: path.join(VIDEOS_DIR, `${id}.mp4`),
        inputProps: inputProps as unknown as Record<string, unknown>,
        chromiumOptions: {
          headless: true,
          disableWebSecurity: false,
          ignoreCertificateErrors: false,
        },
        timeoutInMilliseconds: 300000, // 5 minutes
        onProgress: ((progress) => {
          // Scale progress from 15% to 100%
          const scaledProgress = 15 + progress.progress * 85;
          updateRenderProgress(id, scaledProgress);
        }) as RenderMediaOnProgress,
        // Quality settings balanced for speed + social media quality
        crf: 23, // Slightly lower quality but faster (was 18)
        imageFormat: "jpeg",
        jpegQuality: 80, // Faster encoding (was 90)
        concurrency, // Parallel frame rendering
        // Use hardware encoding if available
        x264Preset: "fast", // Faster h264 encoding preset
      });

      // Get file size
      const localPath = path.join(VIDEOS_DIR, `${id}.mp4`);
      const stats = fs.statSync(localPath);
      const outputPath = `/rendered-videos/${id}.mp4`;

      // Upload to Supabase if userId is provided
      let supabaseUrl: string | undefined;
      if (userId) {
        console.log(`📤 Uploading rendered video to Supabase...`);
        const uploadResult = await uploadRenderedVideo(userId, id, localPath);
        if (uploadResult) {
          supabaseUrl = uploadResult.signedUrl;
          console.log(`☁️ Uploaded to Supabase: ${uploadResult.path}`);
          // Clean up local rendered file
          try {
            fs.unlinkSync(localPath);
            console.log(`🧹 Cleaned up local rendered file`);
          } catch (cleanupError) {
            console.error(`Failed to cleanup local file:`, cleanupError);
          }
        } else {
          console.warn(`⚠️ Supabase upload failed, falling back to local file`);
        }
      }

      completeRender(id, outputPath, stats.size, supabaseUrl);
      console.log(`✅ Render ${id} completed successfully (${Math.round(stats.size / 1024 / 1024)}MB)`);

      // Clean up temp video files
      if (useSupabase && userId) {
        // Delete temp videos from Supabase
        await deleteTempVideos(userId, id);
      } else {
        // Clean up local temp files
        const tempFilePaths = inputProps.clips.map(clip => clip.filePath);
        cleanupLocalTempVideos(tempFilePaths);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failRender(id, errorMessage);
      console.error(`❌ Render ${id} failed:`, error);

      // Clean up temp video files even on error
      if (useSupabase && userId) {
        await deleteTempVideos(userId, id);
      } else {
        const tempFilePaths = inputProps.clips.map(clip => clip.filePath);
        cleanupLocalTempVideos(tempFilePaths);
      }
    }
  })();
}
