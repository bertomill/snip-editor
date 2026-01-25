import { NextRequest, NextResponse } from "next/server";
import { startRendering, saveVideoToTemp, convertVideoToMp4 } from "@/lib/renderer/remotion-renderer";
import { startLambdaRendering, isLambdaConfigured } from "@/lib/renderer/lambda-renderer";
import { transcriptToCaption, wordsToCaption, SnipCompositionProps, TranscriptSegment, TranscriptWord } from "@/lib/types/composition";
import { getCaptionTemplate, getDefaultCaptionTemplate } from "@/lib/caption-templates";
import { TextOverlay, StickerOverlay, MusicTrack, ClipTransition } from "@/types/overlays";
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

interface SilenceSegment {
  id: string;
  start: number;
  end: number;
  clipIndex: number;
  source: 'whisper' | 'ffmpeg' | 'merged';
  confidence: number;
  duration: number;
  type: 'boundary' | 'mid';
}

interface RenderRequestBody {
  clips: {
    data: string; // Base64 encoded video data
    filename: string;
    duration: number; // seconds
    volume?: number; // Audio volume (0-1, default 1)
    silenceSegments?: SilenceSegment[]; // Detected silence segments to remove
  }[];
  segments: TranscriptSegment[];
  deletedSegmentIndices: number[];
  // Word-level editing
  words?: TranscriptWord[];
  deletedWordIds?: string[];
  deletedPauseIds?: string[];  // Pause deletions (jump cuts)
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
  // Clip transitions
  clipTransitions?: ClipTransition[];
  // Music tracks
  musicTracks?: MusicTrack[];
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
 * Calculate deleted pause ranges for a specific clip based on deleted pause IDs
 * Pause IDs follow the format: "pause-after-{wordId}"
 */
function getDeletedPauseRangesForClip(
  clipIndex: number,
  words: TranscriptWord[],
  deletedPauseIds: Set<string>,
  pauseThreshold: number = 0.3
): TimeSegment[] {
  const ranges: TimeSegment[] = [];

  for (let i = 0; i < words.length - 1; i++) {
    const word = words[i];
    const nextWord = words[i + 1];

    // Only consider pauses within the same clip
    if (word.clipIndex !== clipIndex) continue;

    const gap = nextWord.start - word.end;
    if (gap >= pauseThreshold) {
      const pauseId = `pause-after-${word.id}`;
      if (deletedPauseIds.has(pauseId)) {
        ranges.push({ start: word.end, end: nextWord.start });
      }
    }
  }

  return ranges;
}

/**
 * Check if any pauses from a clip were deleted
 */
function clipHasDeletedPauses(
  clipIndex: number,
  words: TranscriptWord[],
  deletedPauseIds: Set<string>,
  pauseThreshold: number = 0.3
): boolean {
  for (let i = 0; i < words.length - 1; i++) {
    const word = words[i];
    const nextWord = words[i + 1];

    if (word.clipIndex !== clipIndex) continue;

    const gap = nextWord.start - word.end;
    if (gap >= pauseThreshold) {
      const pauseId = `pause-after-${word.id}`;
      if (deletedPauseIds.has(pauseId)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get deleted ranges from silence segments
 * Silence segments already contain start/end times, so we just extract them
 */
function getSilenceRangesForClip(
  silenceSegments: SilenceSegment[] | undefined,
  deletedPauseIds: Set<string>,
  clipIndex: number
): TimeSegment[] {
  if (!silenceSegments || silenceSegments.length === 0) {
    return [];
  }

  const ranges: TimeSegment[] = [];

  for (const silence of silenceSegments) {
    // Check if this silence was marked for deletion
    // AutoCut uses format: silence-{clipIndex}-{silenceId}
    const silenceId = `silence-${clipIndex}-${silence.id}`;
    if (deletedPauseIds.has(silenceId)) {
      ranges.push({ start: silence.start, end: silence.end });
    }
  }

  return ranges;
}

/**
 * Check if any silences from a clip were deleted
 */
function clipHasDeletedSilences(
  silenceSegments: SilenceSegment[] | undefined,
  deletedPauseIds: Set<string>,
  clipIndex: number
): boolean {
  if (!silenceSegments || silenceSegments.length === 0) {
    return false;
  }

  for (const silence of silenceSegments) {
    const silenceId = `silence-${clipIndex}-${silence.id}`;
    if (deletedPauseIds.has(silenceId)) {
      return true;
    }
  }
  return false;
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
    if (body.musicTracks?.length) {
      console.log(`🎵 Music tracks: ${body.musicTracks.length}`);
    }

    // Generate render ID upfront for Supabase temp folder
    const renderId = uuidv4();
    const useSupabase = !!body.userId;

    // Process video files - upload to Supabase or save locally
    const clipInputs: SnipCompositionProps["clips"] = [];
    let currentTimeMs = 0;

    // Prepare deleted word and pause tracking for video cutting
    const deletedWordIds = new Set(body.deletedWordIds || []);
    const deletedPauseIds = new Set(body.deletedPauseIds || []);
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

      // Cut video segments for deleted words, pauses, and silence segments
      const hasDeletedWords = words.length > 0 && clipHasDeletedWords(i, words, deletedWordIds);
      const hasDeletedPauses = words.length > 0 && clipHasDeletedPauses(i, words, deletedPauseIds);
      const hasDeletedSilences = clipHasDeletedSilences(clip.silenceSegments, deletedPauseIds, i);

      if (hasDeletedWords || hasDeletedPauses || hasDeletedSilences) {
        // Get deleted ranges from words
        const wordRanges = hasDeletedWords
          ? getDeletedRangesForClip(i, words, deletedWordIds)
          : [];

        // Get deleted ranges from pauses (jump cuts based on word gaps)
        const pauseRanges = hasDeletedPauses
          ? getDeletedPauseRangesForClip(i, words, deletedPauseIds)
          : [];

        // Get deleted ranges from silence segments (FFmpeg + Whisper detected)
        const silenceRanges = hasDeletedSilences
          ? getSilenceRangesForClip(clip.silenceSegments, deletedPauseIds, i)
          : [];

        // Merge all deleted ranges
        const allDeletedRanges = [...wordRanges, ...pauseRanges, ...silenceRanges];
        const mergedDeleted = mergeTimeRanges(allDeletedRanges);
        deletedRangesByClip.set(i, mergedDeleted);

        const keepSegments = invertTimeRanges(mergedDeleted, clip.duration);

        if (keepSegments.length === 0) {
          console.log(`⚠️ Clip ${i} would be empty after cuts, skipping...`);
          continue;
        }

        const totalCutDuration = mergedDeleted.reduce((acc, r) => acc + (r.end - r.start), 0);
        console.log(`✂️ Cutting clip ${i}: removing ${totalCutDuration.toFixed(2)}s across ${mergedDeleted.length} ranges (${wordRanges.length} words, ${pauseRanges.length} pauses, ${silenceRanges.length} silences)`);

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
        volume: clip.volume ?? 1,
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
      // Clip transitions
      clipTransitions: body.clipTransitions || [],
      // Music tracks
      musicTracks: body.musicTracks || [],
    };

    // Start the render (pass renderId so it matches the temp folder)
    // Use Lambda rendering if configured, otherwise fall back to local
    if (isLambdaConfigured()) {
      console.log(`🚀 Using Lambda rendering`);
      await startLambdaRendering(inputProps, body.userId, renderId);
    } else {
      console.log(`💻 Using local rendering (Lambda not configured)`);
      await startRendering(inputProps, body.userId, renderId);
    }

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
