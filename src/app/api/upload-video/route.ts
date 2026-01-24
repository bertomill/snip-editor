import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";

// Allow larger uploads (100MB) and longer processing time
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Upload video to Supabase Storage for transcription
 * Supports both authenticated and anonymous users
 *
 * POST /api/upload-video
 * FormData: { video: File }
 * Returns: { storagePath: string, signedUrl: string }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File;

    if (!videoFile) {
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    console.log(`[upload-video] Uploading: ${videoFile.name}, size: ${(videoFile.size / 1024 / 1024).toFixed(2)}MB`);

    const supabase = await createClient();

    // Get current user (may be null for anonymous)
    const { data: { user } } = await supabase.auth.getUser();

    // Generate storage path
    // For authenticated users: {userId}/transcribe/{timestamp}-{filename}
    // For anonymous users: anonymous/{timestamp}-{uuid}/{filename}
    const timestamp = Date.now();
    const sanitizedFilename = videoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');

    let storagePath: string;
    if (user) {
      storagePath = `${user.id}/transcribe/${timestamp}-${sanitizedFilename}`;
    } else {
      const sessionId = uuidv4();
      storagePath = `anonymous/${timestamp}-${sessionId}/${sanitizedFilename}`;
    }

    // Convert File to Buffer
    const arrayBuffer = await videoFile.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(storagePath, buffer, {
        contentType: videoFile.type || "video/mp4",
        upsert: false,
      });

    if (uploadError) {
      console.error("[upload-video] Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload video", details: uploadError.message },
        { status: 500 }
      );
    }

    // Create signed URL for server to download
    const { data: signedData, error: signedError } = await supabase.storage
      .from("videos")
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (signedError || !signedData?.signedUrl) {
      console.error("[upload-video] Signed URL error:", signedError);
      return NextResponse.json(
        { error: "Failed to create signed URL" },
        { status: 500 }
      );
    }

    console.log(`[upload-video] Uploaded to: ${storagePath}`);

    return NextResponse.json({
      storagePath,
      signedUrl: signedData.signedUrl,
    });
  } catch (error) {
    console.error("[upload-video] Error:", error);
    return NextResponse.json(
      { error: "Failed to upload video", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

