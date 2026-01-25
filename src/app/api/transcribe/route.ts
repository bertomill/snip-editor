import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { cleanupVoice, VoiceCleanupOptions } from "@/lib/audio/voice-cleanup";
import { detectSilence } from "@/lib/audio/silence-detect";
import { processSilenceForClip, calculateSilenceStats } from "@/lib/audio/silence-merger";
import { SilenceSegment, SilenceDetectionOptions } from "@/types/silence";
import { downloadFromStorage, deleteFromStorage } from "@/lib/supabase/download";
import { getFFmpegPath } from "@/lib/ffmpeg-path";

const execAsync = promisify(exec);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface GroqWord {
  word: string;
  start: number;
  end: number;
}

interface GroqSegment {
  text: string;
  start: number;
  end: number;
}

interface GroqTranscriptionResponse {
  text: string;
  words?: GroqWord[];
  segments?: GroqSegment[];
}

// JSON body interface for storage-based transcription
interface StorageTranscribeRequest {
  storagePath: string;
  enhanceAudio?: boolean;
  noiseReduction?: boolean;
  noiseReductionStrength?: 'light' | 'medium' | 'strong';
  loudnessNormalization?: boolean;
  /** Enable silence detection for AutoCut (default: true) */
  detectSilence?: boolean;
  /** Silence detection aggressiveness (default: 'natural') */
  silenceAggressiveness?: SilenceDetectionOptions['aggressiveness'];
}

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;
  let audioFilePath: string | null = null;
  let cleanedAudioPath: string | null = null;
  let storagePathToCleanup: string | null = null;

  try {
    console.log("Transcribe API called (Groq Whisper)");

    // Check content type to determine request format
    const contentType = request.headers.get("content-type") || "";
    const isJsonRequest = contentType.includes("application/json");

    let videoFile: File | null = null;
    let audioFile: File | null = null;
    let enhanceAudio = false;
    let noiseReduction = true;
    let noiseReductionStrength: 'light' | 'medium' | 'strong' = "medium";
    let loudnessNormalization = true;
    let enableSilenceDetection = true;
    let silenceAggressiveness: SilenceDetectionOptions['aggressiveness'] = 'natural';

    if (isJsonRequest) {
      // New: JSON body with storage path
      const body = await request.json() as StorageTranscribeRequest;

      if (!body.storagePath) {
        return NextResponse.json(
          { error: "No storagePath provided" },
          { status: 400 }
        );
      }

      console.log(`[Transcribe] Downloading video from storage: ${body.storagePath}`);

      // Download video from Supabase Storage
      const videoBuffer = await downloadFromStorage(body.storagePath);
      storagePathToCleanup = body.storagePath;

      // Extract filename from storage path
      const filename = body.storagePath.split('/').pop() || 'video.mp4';

      // Determine content type from filename
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'webm': 'video/webm',
        'm4v': 'video/x-m4v',
        'avi': 'video/x-msvideo',
      };
      const mimeType = mimeMap[ext || ''] || 'video/mp4';

      // Create a File object from the buffer (convert to Uint8Array for type compatibility)
      const uint8Array = new Uint8Array(videoBuffer);
      videoFile = new File([uint8Array], filename, { type: mimeType });

      console.log(`[Transcribe] Downloaded video: ${filename}, size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)}MB`);

      // Parse audio enhancement options from JSON
      enhanceAudio = body.enhanceAudio ?? false;
      noiseReduction = body.noiseReduction ?? true;
      noiseReductionStrength = body.noiseReductionStrength ?? "medium";
      loudnessNormalization = body.loudnessNormalization ?? true;
      enableSilenceDetection = body.detectSilence ?? true;
      silenceAggressiveness = body.silenceAggressiveness ?? 'natural';

    } else {
      // Existing: FormData with video/audio file
      const formData = await request.formData();
      videoFile = formData.get("video") as File;
      audioFile = formData.get("audio") as File;

      // Parse audio enhancement options from FormData
      enhanceAudio = formData.get("enhanceAudio") === "true";
      noiseReduction = formData.get("noiseReduction") !== "false";
      noiseReductionStrength = (formData.get("noiseReductionStrength") as 'light' | 'medium' | 'strong') || "medium";
      loudnessNormalization = formData.get("loudnessNormalization") !== "false";
      enableSilenceDetection = formData.get("detectSilence") !== "false";
      const aggParam = formData.get("silenceAggressiveness") as string | null;
      if (aggParam && ['tight', 'natural', 'conservative'].includes(aggParam)) {
        silenceAggressiveness = aggParam as SilenceDetectionOptions['aggressiveness'];
      }
    }

    // Check if we received pre-extracted audio (from client-side FFmpeg)
    const hasPreExtractedAudio = audioFile && audioFile.size > 0;

    if (!videoFile && !audioFile) {
      console.log("No video or audio file in request");
      return NextResponse.json(
        { error: "No video or audio file provided" },
        { status: 400 }
      );
    }

    if (hasPreExtractedAudio && audioFile) {
      // Client already extracted audio - use it directly
      console.log(`Using pre-extracted audio: ${audioFile.name}, size: ${audioFile.size} bytes, type: ${audioFile.type}`);

      const bytes = await audioFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      audioFilePath = join(tmpdir(), `audio-${Date.now()}.mp3`);
      await writeFile(audioFilePath, buffer);
      console.log(`Wrote audio file: ${audioFilePath}`);
    } else if (videoFile) {
      // Need to extract audio from video server-side
      console.log(`Processing video: ${videoFile.name}, size: ${videoFile.size} bytes, type: ${videoFile.type}`);
      console.log(`Audio enhancement: ${enhanceAudio ? "enabled" : "disabled"}`);

      // Convert File to buffer
      const bytes = await videoFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Write to temp file
      const tempFileName = `video-${Date.now()}-${videoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      tempFilePath = join(tmpdir(), tempFileName);
      await writeFile(tempFilePath, buffer);
      console.log(`Wrote temp file: ${tempFilePath}`);

      // Extract audio from video using FFmpeg
      // Use mp3 format for good compatibility and reasonable file size
      audioFilePath = join(tmpdir(), `audio-${Date.now()}.mp3`);
      console.log("Extracting audio from video...");

      try {
        // Extract audio: -vn removes video, -acodec mp3 converts to mp3
        // -ar 16000 downsamples to 16kHz (optimal for speech recognition)
        // -ac 1 converts to mono
        // Use bundled ffmpeg binary for Vercel compatibility
        await execAsync(`"${getFFmpegPath()}" -i "${tempFilePath}" -vn -acodec libmp3lame -ar 16000 -ac 1 -q:a 2 -y "${audioFilePath}"`);
        console.log(`Extracted audio to: ${audioFilePath}`);
      } catch (ffmpegError) {
        console.error("FFmpeg audio extraction failed:", ffmpegError);
        throw new Error("Failed to extract audio from video");
      }
    }

    // Ensure we have an audio file path at this point
    if (!audioFilePath) {
      throw new Error("No audio file available for transcription");
    }

    // Apply voice cleanup if enabled (only for server-extracted audio, not pre-extracted)
    let finalAudioPath: string = audioFilePath;
    if (enhanceAudio && !hasPreExtractedAudio) {
      console.log("Applying voice cleanup...");
      const cleanupOptions: VoiceCleanupOptions = {
        noiseReduction,
        noiseReductionStrength,
        loudnessNormalization,
      };
      cleanedAudioPath = await cleanupVoice(audioFilePath, cleanupOptions);
      finalAudioPath = cleanedAudioPath;
      console.log(`Voice cleanup complete: ${cleanedAudioPath}`);
    }

    // Check audio file size (Groq limit is 25MB)
    const audioBuffer = await readFile(finalAudioPath);
    const audioSizeMB = audioBuffer.length / (1024 * 1024);
    console.log(`Audio file size: ${audioSizeMB.toFixed(2)} MB`);

    if (audioSizeMB > 25) {
      throw new Error(`Audio file too large (${audioSizeMB.toFixed(2)} MB). Maximum is 25MB.`);
    }

    // Create a File object for Groq API
    const groqAudioFile = new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" });

    console.log("Sending audio to Groq Whisper...");
    const startTime = Date.now();

    // Run Whisper transcription and silence detection in parallel
    const whisperPromise = groq.audio.transcriptions.create({
      file: groqAudioFile,
      model: "whisper-large-v3-turbo",
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"],
      language: "en",
    }) as Promise<GroqTranscriptionResponse>;

    // Only run silence detection if enabled
    const silencePromise = enableSilenceDetection
      ? detectSilence(finalAudioPath, 0, { aggressiveness: silenceAggressiveness })
      : Promise.resolve({ segments: [] as SilenceSegment[], totalDuration: 0, audioDuration: 0 });

    // Wait for both to complete
    const [transcription, rawSilenceData] = await Promise.all([whisperPromise, silencePromise]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Groq Whisper completed in ${elapsed}s`);
    console.log(`Transcript preview: ${transcription.text?.substring(0, 200)}...`);
    if (enableSilenceDetection) {
      console.log(`Silence detection found ${rawSilenceData.segments.length} raw segments`);
    }

    // Convert Groq response to our segment format
    // Prefer word-level timestamps for more accurate segments
    let segments: { text: string; start: number; end: number }[] = [];

    if (transcription.segments && transcription.segments.length > 0) {
      // Use segment-level timestamps
      segments = transcription.segments.map((seg) => ({
        text: seg.text.trim(),
        start: seg.start,
        end: seg.end,
      }));
      console.log(`Created ${segments.length} segments from Groq response`);
    } else if (transcription.words && transcription.words.length > 0) {
      // Fall back to grouping words into segments (roughly by sentence)
      segments = groupWordsIntoSegments(transcription.words);
      console.log(`Created ${segments.length} segments from word grouping`);
    } else {
      // No timing info, return full transcript as single segment
      segments = [{
        text: transcription.text,
        start: 0,
        end: 0,
      }];
    }

    // Format words with unique IDs for script-based editing
    const words = (transcription.words || []).map((w, i) => ({
      id: `word-${i}`,
      text: w.word,
      start: w.start,
      end: w.end,
    }));

    // Process silence data: merge FFmpeg detection with Whisper word gaps
    let silenceSegments: SilenceSegment[] = [];
    let totalSilenceDuration = 0;
    const audioDuration = rawSilenceData.audioDuration;

    if (enableSilenceDetection && words.length > 0) {
      // Merge FFmpeg silence with Whisper word gaps for higher accuracy
      silenceSegments = processSilenceForClip(
        rawSilenceData.segments,
        words,
        0, // clipIndex is 0 for single clip transcription
        silenceAggressiveness
      );

      const stats = calculateSilenceStats(silenceSegments);
      totalSilenceDuration = stats.totalSilence;

      console.log(`[Transcribe] Merged silence segments: ${silenceSegments.length}`);
      console.log(`[Transcribe] Total silence: ${totalSilenceDuration.toFixed(2)}s (${((totalSilenceDuration / audioDuration) * 100).toFixed(1)}% of audio)`);
    }

    return NextResponse.json({
      transcript: transcription.text,
      segments,
      words,  // Word-level timestamps for script-driven editing
      // Silence detection data for AutoCut
      silenceSegments,
      totalSilenceDuration,
      audioDuration,
    });
  } catch (error) {
    console.error("Transcription error:", error);
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error("Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error);
    }
    return NextResponse.json(
      { error: "Failed to transcribe video", details: errorMessage },
      { status: 500 }
    );
  } finally {
    // Clean up temp files
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
        console.log(`Cleaned up temp file: ${tempFilePath}`);
      } catch {
        // Ignore cleanup errors
      }
    }
    if (audioFilePath) {
      try {
        await unlink(audioFilePath);
        console.log(`Cleaned up audio file: ${audioFilePath}`);
      } catch {
        // Ignore cleanup errors
      }
    }
    if (cleanedAudioPath) {
      try {
        await unlink(cleanedAudioPath);
        console.log(`Cleaned up cleaned audio file: ${cleanedAudioPath}`);
      } catch {
        // Ignore cleanup errors
      }
    }
    // Clean up storage file (from JSON body requests)
    if (storagePathToCleanup) {
      try {
        await deleteFromStorage(storagePathToCleanup);
        console.log(`Cleaned up storage file: ${storagePathToCleanup}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Group words into natural segments based on punctuation and timing gaps
 */
function groupWordsIntoSegments(words: GroqWord[]): { text: string; start: number; end: number }[] {
  const segments: { text: string; start: number; end: number }[] = [];
  let currentSegment: GroqWord[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentSegment.push(word);

    // End segment on sentence-ending punctuation or significant pause
    const endsWithPunctuation = /[.!?]$/.test(word.word);
    const nextWord = words[i + 1];
    const hasLongPause = nextWord && (nextWord.start - word.end) > 0.5;
    const segmentTooLong = currentSegment.length >= 15;

    if (endsWithPunctuation || hasLongPause || segmentTooLong || i === words.length - 1) {
      if (currentSegment.length > 0) {
        segments.push({
          text: currentSegment.map(w => w.word).join(" "),
          start: currentSegment[0].start,
          end: currentSegment[currentSegment.length - 1].end,
        });
        currentSegment = [];
      }
    }
  }

  return segments;
}

// App Router: Configure max duration for processing large video files
export const maxDuration = 300;
