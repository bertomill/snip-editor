import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Generate a signed URL for viewing a file in storage
 */
export async function POST(request: NextRequest) {
  try {
    const { storagePath } = await request.json();

    if (!storagePath) {
      return NextResponse.json(
        { error: "Storage path is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from('videos')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

    if (error) {
      console.error("[signed-url] Error:", error);
      return NextResponse.json(
        { error: "Failed to create signed URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (error) {
    console.error("[signed-url] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 }
    );
  }
}
