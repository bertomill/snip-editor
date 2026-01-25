import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";

/**
 * Generate a presigned upload URL for direct browser-to-Supabase uploads
 * This bypasses Vercel's 4.5MB payload limit entirely
 */
export async function POST(request: NextRequest) {
  try {
    const { filename, contentType, folder = 'transcribe' } = await request.json();

    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user (may be null for anonymous)
    const { data: { user } } = await supabase.auth.getUser();

    // Generate storage path
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');

    let storagePath: string;
    if (user) {
      storagePath = `${user.id}/${folder}/${timestamp}-${sanitizedFilename}`;
    } else {
      const sessionId = uuidv4();
      storagePath = `anonymous/${timestamp}-${sessionId}/${sanitizedFilename}`;
    }

    // Create a presigned upload URL
    const { data, error } = await supabase.storage
      .from('videos')
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error("[presigned-url] Error creating signed URL:", error);
      return NextResponse.json(
        { error: "Failed to create upload URL", details: error.message },
        { status: 500 }
      );
    }

    console.log(`[presigned-url] Created upload URL for: ${storagePath}`);

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      token: data.token,
      storagePath,
    });
  } catch (error) {
    console.error("[presigned-url] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
