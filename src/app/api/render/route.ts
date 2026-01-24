import { NextRequest, NextResponse } from "next/server";
import { startRendering, saveVideoToTemp } from "@/lib/renderer/remotion-renderer";
import { transcriptToCaption, SnipCompositionProps, TranscriptSegment } from "@/lib/types/composition";
import { getCaptionTemplate, getDefaultCaptionTemplate } from "@/lib/caption-templates";
import { TextOverlay, StickerOverlay } from "@/types/overlays";
import path from "path";

interface RenderRequestBody {
  clips: {
    data: string; // Base64 encoded video data
    filename: string;
    duration: number; // seconds
  }[];
  segments: TranscriptSegment[];
  deletedSegmentIndices: number[];
  captionTemplateId: string;
  width?: number;
  height?: number;
  fps?: number;
  // New overlay parameters
  filterId?: string;
  textOverlays?: TextOverlay[];
  stickers?: StickerOverlay[];
  // User ID for Supabase storage
  userId?: string;
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

    // Save video files to temp directory for SSR access
    const clipInputs: SnipCompositionProps["clips"] = [];
    let currentTimeMs = 0;

    for (let i = 0; i < body.clips.length; i++) {
      const clip = body.clips[i];

      // Decode base64 and save to temp
      const buffer = Buffer.from(clip.data, "base64");
      const filename = `clip-${Date.now()}-${i}${path.extname(clip.filename) || ".mp4"}`;
      const filePath = await saveVideoToTemp(buffer, filename);

      const durationMs = clip.duration * 1000;
      clipInputs.push({
        filePath,
        startMs: currentTimeMs,
        endMs: currentTimeMs + durationMs,
        originalDuration: clip.duration,
      });
      currentTimeMs += durationMs;
    }

    // Filter out deleted segments and convert to captions
    const activeSegments = body.segments.filter(
      (_, index) => !body.deletedSegmentIndices.includes(index)
    );

    const captions = activeSegments.map(transcriptToCaption);
    console.log(`📝 ${captions.length} captions to render`);

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
    };

    // Start the render
    const renderId = await startRendering(inputProps, body.userId);

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
