import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, RenderMediaOnProgress } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

import {
  saveRenderState,
  updateRenderProgress,
  completeRender,
  failRender,
} from "./render-state";
import { SnipCompositionProps } from "../types/composition";
import { uploadRenderedVideo } from "../supabase/storage-server";

// Ensure the videos directory exists
const VIDEOS_DIR = path.join(process.cwd(), "public", "rendered-videos");
const TEMP_DIR = path.join(process.cwd(), "tmp", "video-uploads");

function ensureDirs() {
  if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

/**
 * Check if a file needs conversion (MOV/HEVC formats)
 */
function needsConversion(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.endsWith('.mov') || lower.endsWith('.hevc');
}

/**
 * Save uploaded video file to temp directory for SSR access
 * Optionally converts MOV/HEVC files to MP4 for Remotion compatibility
 */
export async function saveVideoToTemp(
  buffer: Buffer,
  filename: string,
  convertIfNeeded?: boolean
): Promise<string> {
  ensureDirs();

  const inputPath = path.join(TEMP_DIR, filename);
  fs.writeFileSync(inputPath, buffer);

  // Convert MOV/HEVC to MP4 if requested and needed
  if (convertIfNeeded && needsConversion(filename)) {
    const outputFilename = filename.replace(/\.(mov|hevc)$/i, '.mp4');
    const outputPath = path.join(TEMP_DIR, outputFilename);

    console.log(`🔄 Converting ${filename} to MP4 for Remotion compatibility...`);

    try {
      // High quality conversion for final render
      await execAsync(
        `ffmpeg -i "${inputPath}" -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 192k -movflags +faststart -y "${outputPath}"`
      );

      // Remove original MOV file
      fs.unlinkSync(inputPath);

      console.log(`✅ Converted to ${outputFilename}`);
      return outputPath;
    } catch (error) {
      console.error(`❌ FFmpeg conversion failed:`, error);
      throw new Error(`Failed to convert ${filename} to MP4. Make sure FFmpeg is installed.`);
    }
  }

  return inputPath;
}

/**
 * Clean up temp video files after render
 */
export function cleanupTempVideos(filePaths: string[]) {
  for (const filePath of filePaths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.error(`Failed to cleanup temp file ${filePath}:`, e);
    }
  }
}

/**
 * Start a video render with Remotion SSR
 * Returns a render ID that can be used to poll progress
 * If userId is provided, the video will be uploaded to Supabase storage
 */
export async function startRendering(
  inputProps: SnipCompositionProps,
  userId?: string
): Promise<string> {
  const renderId = uuidv4();

  // Initialize render state
  saveRenderState(renderId, {
    status: "rendering",
    progress: 0,
    timestamp: Date.now(),
  });

  // Start rendering asynchronously
  (async () => {
    try {
      updateRenderProgress(renderId, 0);
      console.log(`🎬 Starting render ${renderId}...`);

      // Bundle the Remotion project
      const bundleLocation = await bundle(
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
      );

      console.log(`📦 Bundle created at ${bundleLocation}`);
      updateRenderProgress(renderId, 10);

      // Select the composition
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "SnipVideo",
        inputProps: inputProps as unknown as Record<string, unknown>,
      });

      console.log(`🎯 Composition selected: ${composition.width}x${composition.height}, ${inputProps.durationInFrames} frames`);
      updateRenderProgress(renderId, 15);

      // Render the video
      await renderMedia({
        codec: "h264",
        composition: {
          ...composition,
          durationInFrames: inputProps.durationInFrames,
          width: inputProps.width,
          height: inputProps.height,
        },
        serveUrl: bundleLocation,
        outputLocation: path.join(VIDEOS_DIR, `${renderId}.mp4`),
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
          updateRenderProgress(renderId, scaledProgress);
        }) as RenderMediaOnProgress,
        // Quality settings optimized for social media
        crf: 18, // Good quality, reasonable file size
        imageFormat: "jpeg",
        jpegQuality: 90,
      });

      // Get file size
      const localPath = path.join(VIDEOS_DIR, `${renderId}.mp4`);
      const stats = fs.statSync(localPath);
      const outputPath = `/rendered-videos/${renderId}.mp4`;

      // Upload to Supabase if userId is provided
      let supabaseUrl: string | undefined;
      if (userId) {
        console.log(`📤 Uploading to Supabase storage for user ${userId}...`);
        const uploadResult = await uploadRenderedVideo(userId, renderId, localPath);
        if (uploadResult) {
          supabaseUrl = uploadResult.signedUrl;
          console.log(`☁️ Uploaded to Supabase: ${uploadResult.path}`);
          // Clean up local file after successful upload
          try {
            fs.unlinkSync(localPath);
            console.log(`🧹 Cleaned up local file`);
          } catch (cleanupError) {
            console.error(`Failed to cleanup local file:`, cleanupError);
          }
        } else {
          console.warn(`⚠️ Supabase upload failed, falling back to local file`);
        }
      }

      completeRender(renderId, outputPath, stats.size, supabaseUrl);
      console.log(`✅ Render ${renderId} completed successfully (${Math.round(stats.size / 1024 / 1024)}MB)`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failRender(renderId, errorMessage);
      console.error(`❌ Render ${renderId} failed:`, error);
    }
  })();

  return renderId;
}
