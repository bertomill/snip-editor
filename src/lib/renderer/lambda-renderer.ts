import {
  renderMediaOnLambda,
  getRenderProgress,
  AwsRegion,
} from "@remotion/lambda/client";
import {
  saveRenderState,
  updateRenderProgress,
  completeRender,
  failRender,
} from "./render-state";
import { SnipCompositionProps } from "../types/composition";

// Lambda configuration from environment
const REGION = (process.env.AWS_REGION || "us-east-2") as AwsRegion;
const FUNCTION_NAME = process.env.REMOTION_LAMBDA_FUNCTION_NAME || "remotion-render-4-0-380-mem2048mb-disk2048mb-120sec";
const SERVE_URL = process.env.REMOTION_SERVE_URL || "";

/**
 * Start a video render using Remotion Lambda
 * Videos are rendered on AWS Lambda and stored in S3
 */
export async function startLambdaRendering(
  inputProps: SnipCompositionProps,
  userId?: string,
  renderId?: string
): Promise<void> {
  const id = renderId || `render-${Date.now()}`;

  if (!SERVE_URL) {
    throw new Error("REMOTION_SERVE_URL environment variable is not set");
  }

  // Initialize render state
  saveRenderState(id, {
    status: "rendering",
    progress: 0,
    timestamp: Date.now(),
  });

  // Start rendering asynchronously
  (async () => {
    try {
      console.log(`🚀 Starting Lambda render ${id}...`);
      console.log(`📍 Region: ${REGION}`);
      console.log(`⚡ Function: ${FUNCTION_NAME}`);
      console.log(`🌐 Serve URL: ${SERVE_URL}`);

      updateRenderProgress(id, 5);

      // Start the render on Lambda with retry logic for rate limits
      let lambdaRenderId: string;
      let bucketName: string;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount <= maxRetries) {
        try {
          const result = await renderMediaOnLambda({
            region: REGION,
            functionName: FUNCTION_NAME,
            serveUrl: SERVE_URL,
            composition: "SnipVideo",
            inputProps: inputProps as unknown as Record<string, unknown>,
            codec: "h264",
            // Quality settings
            crf: 23,
            imageFormat: "jpeg",
            jpegQuality: 80,
            // Lambda-specific settings - higher value = fewer parallel invocations
            framesPerLambda: 60, // Reduced from 20 to avoid concurrency limits
            privacy: "public", // Make output accessible
            downloadBehavior: {
              type: "download",
              fileName: `${id}.mp4`,
            },
            timeoutInMilliseconds: 300000, // 5 minutes
          });
          lambdaRenderId = result.renderId;
          bucketName = result.bucketName;
          break; // Success, exit retry loop
        } catch (e) {
          const error = e as Error;
          if (error.message?.includes('Rate') || error.message?.includes('Concurrency')) {
            retryCount++;
            if (retryCount > maxRetries) {
              throw new Error(`Lambda rate limit exceeded after ${maxRetries} retries. Try again in a few minutes.`);
            }
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
            console.log(`⚠️ Rate limit hit, retrying in ${delay/1000}s (attempt ${retryCount}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw e; // Re-throw non-rate-limit errors
          }
        }
      }

      console.log(`🎬 Lambda render started: ${lambdaRenderId}`);
      console.log(`🪣 Bucket: ${bucketName}`);

      // Poll for progress with retry logic for rate limits
      let isComplete = false;
      let pollInterval = 5000; // Start with 5 seconds (reduced API calls)
      let progressRetryCount = 0;
      const maxProgressRetries = 5;

      while (!isComplete) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));

        try {
          const progress = await getRenderProgress({
            renderId: lambdaRenderId,
            bucketName,
            region: REGION,
            functionName: FUNCTION_NAME,
          });

          // Reset retry count on success
          progressRetryCount = 0;
          pollInterval = 5000; // Reset to normal interval

          if (progress.fatalErrorEncountered) {
            throw new Error(progress.errors?.[0]?.message || "Lambda render failed");
          }

          if (progress.done) {
            isComplete = true;

            if (progress.outputFile) {
              const outputUrl = progress.outputFile;
              const outputSize = progress.outputSizeInBytes || 0;

              console.log(`✅ Lambda render ${id} completed`);
              console.log(`📦 Output: ${outputUrl}`);
              console.log(`📊 Size: ${Math.round(outputSize / 1024 / 1024)}MB`);

              // Complete with the S3 URL as the supabase URL (since it's already cloud-hosted)
              completeRender(id, outputUrl, outputSize, outputUrl);
            } else {
              throw new Error("Render completed but no output file found");
            }
          } else {
            // Update progress (scale from 5% to 100%)
            const overallProgress = progress.overallProgress || 0;
            const scaledProgress = 5 + overallProgress * 95;
            updateRenderProgress(id, scaledProgress);

            console.log(`⏳ Render progress: ${Math.round(overallProgress * 100)}%`);
          }
        } catch (pollError) {
          const errorMsg = pollError instanceof Error ? pollError.message : String(pollError);

          // Check if it's a rate limit error
          if (errorMsg.includes('Rate') || errorMsg.includes('TooManyRequests') || errorMsg.includes('Concurrency')) {
            progressRetryCount++;
            if (progressRetryCount > maxProgressRetries) {
              throw new Error(`Progress polling rate limited after ${maxProgressRetries} retries`);
            }
            // Exponential backoff for polling: 10s, 20s, 40s, 80s, 160s
            pollInterval = Math.min(10000 * Math.pow(2, progressRetryCount - 1), 180000);
            console.log(`⚠️ Progress poll rate limited, backing off to ${pollInterval/1000}s (attempt ${progressRetryCount}/${maxProgressRetries})`);
          } else {
            throw pollError; // Re-throw non-rate-limit errors
          }
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failRender(id, errorMessage);
      console.error(`❌ Lambda render ${id} failed:`, error);
    }
  })();
}

/**
 * Check if Lambda rendering is configured
 */
export function isLambdaConfigured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.REMOTION_SERVE_URL
  );
}
