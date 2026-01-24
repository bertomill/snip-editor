import { NextRequest, NextResponse } from "next/server";
import { startRendering, saveVideoToTemp, convertVideoToMp4 } from "@/lib/renderer/remotion-renderer";
import { transcriptToCaption, wordsToCaption, SnipCompositionProps, TranscriptSegment, TranscriptWord } from "@/lib/types/composition";
import { getCaptionTemplate, getDefaultCaptionTemplate } from "@/lib/caption-templates";
import { TextOverlay, StickerOverlay } from "@/types/overlays";
import { uploadTempVideo } from "@/lib/supabase/storage-server";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import {
  TimeSegment,
  mergeTimeRanges,
  invertTimeRanges,
  calculateAdjustedTime,
  cutVideoBufferSegments,
} from "@/lib/renderer/video-cutter";

interface RenderRequestBody {
  clips: {
    data: string; // Base64 encoded video data
    filename: string;
    duration: number; // seconds
  }[];
  segments: TranscriptSegment[];
  deletedSegmentIndices: number[];
  // Word-level editing
  words?: TranscriptWord[];
  deletedWordIds?: string[];
  captionTemplateId: string;
  width?: number;
  height?: number;
  fps?: number;
  // New overlay parameters
  filterId?: string;
  textOverlays?: TextOverlay[];
  stickers?: StickerOverlay[];
  // Caption position (percentage from top)
  captionPositionY?: number;
  // User ID for Supabase storage
  userId?: string;
  // Convert MOV/HEVC files to MP4 before rendering
  convertIfNeeded?: boolean;
}

/**
 * Calculate deleted time ranges for a specific clip based on deleted words
 */
function getDeletedRangesForClip(
  clipIndex: number,
  words: TranscriptWord[],
  deletedWordIds: Set<string>
): TimeSegment[] {
  return words
    .filter((w) => w.clipIndex === clipIndex && deletedWordIds.has(w.id))
    .map((w) => ({ start: w.start, end: w.end }));
}

/**
 * Check if any words from a clip were deleted
 */
function clipHasDeletedWords(
  clipIndex: number,
  words: TranscriptWord[],
  deletedWordIds: Set<string>
): boolean {
  return words.some((w) => w.clipIndex === clipIndex && deletedWordIds.has(w.id));
}


/**
 * POST /api/render
 * Starts a new video render with burned-in captions and overlays
 */
export async function POST(request: NextRequest) {
  try {
    const body: RenderRequestBody = await request.json();
    console.log(`🎬 Render request received: ${body.clips.length} clips, ${body.segments.length} segments`);

    // Validate request
    if (!body.clips || body.clips.length === 0) {
      return NextResponse.json(
        { error: "No video clips provided" },
        { status: 400 }
      );
    }

    // Get caption template
    const captionTemplate = getCaptionTemplate(body.captionTemplateId) || getDefaultCaptionTemplate();
    console.log(`🎨 Using caption template: ${captionTemplate.name}`);

    // Log overlay info
    if (body.filterId) {
      console.log(`🎨 Filter: ${body.filterId}`);
    }
    if (body.textOverlays?.length) {
      console.log(`📝 Text overlays: ${body.textOverlays.length}`);
    }
    if (body.stickers?.length) {
      console.log(`🎭 Stickers: ${body.stickers.length}`);
    }

    // Generate render ID upfront for Supabase temp folder
    const renderId = uuidv4();
    const useSupabase = !!body.userId;

    // Process video files - upload to Supabase or save locally
    const clipInputs: SnipCompositionProps["clips"] = [];
    let currentTimeMs = 0;

    // Prepare deleted word tracking for video cutting
    const deletedWordIds = new Set(body.deletedWordIds || []);
    const words = body.words || [];

    // Track deleted ranges per clip for timestamp adjustment later
    const deletedRangesByClip: Map<number, TimeSegment[]> = new Map();

    for (let i = 0; i < body.clips.length; i++) {
      const clip = body.clips[i];
      let buffer = Buffer.from(clip.data, "base64");
      let filename = `clip-${Date.now()}-${i}${path.extname(clip.filename) || ".mp4"}`;
      const contentType = 'video/mp4';
      let clipDuration = clip.duration;

      // Convert MOV/HEVC to MP4 if needed (required for Remotion)
      const needsConversion = body.convertIfNeeded && (
        clip.filename.toLowerCase().endsWith('.mov') ||
        clip.filename.toLowerCase().endsWith('.hevc')
      );

      if (needsConversion) {
        console.log(`🔄 Converting ${clip.filename} to MP4...`);
        const converted = await convertVideoToMp4(buffer, filename);
        buffer = Buffer.from(converted.buffer);
        filename = converted.filename;
        console.log(`✅ Converted to ${filename}`);
      }

      // Cut video segments for deleted words
      if (words.length > 0 && clipHasDeletedWords(i, words, deletedWordIds)) {
        const deletedRanges = getDeletedRangesForClip(i, words, deletedWordIds);
        const mergedDeleted = mergeTimeRanges(deletedRanges);
        deletedRangesByClip.set(i, mergedDeleted);

        const keepSegments = invertTimeRanges(mergedDeleted, clip.duration);

        if (keepSegments.length === 0) {
          console.log(`⚠️ Clip ${i} would be empty after cuts, skipping...`);
          continue;
        }

        const totalCutDuration = mergedDeleted.reduce((acc, r) => acc + (r.end - r.start), 0);
        console.log(`✂️ Cutting clip ${i}: removing ${totalCutDuration.toFixed(2)}s across ${mergedDeleted.length} ranges`);

        const cutResult = await cutVideoBufferSegments(buffer, keepSegments, filename);
        buffer = Buffer.from(cutResult.buffer);
        clipDuration = cutResult.newDuration;

        console.log(`✅ Clip ${i} cut: ${clip.duration.toFixed(2)}s -> ${clipDuration.toFixed(2)}s`);
      }

      let filePath: string;

      if (useSupabase) {
        // Upload to Supabase for Vercel/serverless compatibility
        console.log(`☁️ Uploading ${filename} to Supabase...`);
        const uploadResult = await uploadTempVideo(body.userId!, renderId, filename, buffer, contentType);
        if (!uploadResult) {
          throw new Error(`Failed to upload ${filename} to Supabase`);
        }
        filePath = uploadResult.signedUrl;
        console.log(`✅ Uploaded to Supabase`);
      } else {
        // Fall back to local temp storage (for local development without auth)
        filePath = await saveVideoToTemp(buffer, filename);
      }

      const durationMs = clipDuration * 1000;
      clipInputs.push({
        filePath,
        startMs: currentTimeMs,
        endMs: currentTimeMs + durationMs,
        originalDuration: clipDuration,
      });
      currentTimeMs += durationMs;
    }

    // Generate captions from words (preferred) or segments (fallback)
    let captions;

    if (body.words && body.words.length > 0) {
      // Word-level editing: filter deleted words and adjust timestamps
      const activeWords = words.filter((w) => !deletedWordIds.has(w.id));

      // Adjust word timestamps to account for cut video sections
      const adjustedWords = activeWords.map((w) => {
        const deletedRanges = deletedRangesByClip.get(w.clipIndex) || [];
        if (deletedRanges.length === 0) {
          return w;
        }

        // Adjust this word's timestamps within its clip
        const adjustedStart = calculateAdjustedTime(w.start, deletedRanges);
        const adjustedEnd = calculateAdjustedTime(w.end, deletedRanges);

        return {
          ...w,
          start: adjustedStart,
          end: adjustedEnd,
        };
      });

      captions = wordsToCaption(adjustedWords);
      console.log(`📝 ${captions.length} captions from ${adjustedWords.length} words (${deletedWordIds.size} deleted)`);
    } else {
      // Fallback: segment-based captions
      const activeSegments = body.segments.filter(
        (_, index) => !body.deletedSegmentIndices.includes(index)
      );
      captions = activeSegments.map(transcriptToCaption);
      console.log(`📝 ${captions.length} captions from segments`);
    }

    // Calculate total duration and composition props
    const fps = body.fps || 30;
    const totalDurationMs = clipInputs.reduce(
      (acc, clip) => acc + (clip.endMs - clip.startMs),
      0
    );
    const durationInFrames = Math.ceil((totalDurationMs / 1000) * fps);

    const inputProps: SnipCompositionProps = {
      clips: clipInputs,
      captions,
      captionStyles: captionTemplate.styles,
      durationInFrames,
      fps,
      width: body.width || 1080,
      height: body.height || 1920,
      // Include overlays
      filterId: body.filterId,
      textOverlays: body.textOverlays || [],
      stickers: body.stickers || [],
      // Caption position
      captionPositionY: body.captionPositionY ?? 75,
    };

    // Start the render (pass renderId so it matches the temp folder)
    await startRendering(inputProps, body.userId, renderId);

    return NextResponse.json({
      renderId,
      message: "Render started",
    });
  } catch (error) {
    console.error("Render endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to start render" },
      { status: 500 }
    );
  }
}
