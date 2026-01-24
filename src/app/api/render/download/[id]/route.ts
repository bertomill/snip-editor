import { NextRequest, NextResponse } from "next/server";
import { getRenderState } from "@/lib/renderer/render-state";
import path from "path";
import fs from "fs";

/**
 * GET /api/render/download/[id]
 * Download a rendered video file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`📥 Download request for render ID: ${id}`);

    // Construct the file path
    const filePath = path.join(
      process.cwd(),
      "public",
      "rendered-videos",
      `${id}.mp4`
    );

    // Check render state
    const renderState = getRenderState(id);

    if (!renderState) {
      // Fallback: if render state is missing but file exists, allow download
      if (fs.existsSync(filePath)) {
        console.log("📥 Render state missing but file exists, allowing download");
      } else {
        return NextResponse.json(
          {
            error: `No render found with ID: ${id}. The render may have expired. Please render again.`,
          },
          { status: 404 }
        );
      }
    } else {
      if (renderState.status !== "done") {
        return NextResponse.json(
          {
            error: `Render ${id} is not completed yet. Status: ${renderState.status}`,
          },
          { status: 400 }
        );
      }

      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          { error: `Video file not found for render ${id}` },
          { status: 404 }
        );
      }
    }

    // Read and return the file
    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": fileBuffer.length.toString(),
        "Content-Disposition": `attachment; filename="snip-video-${id}.mp4"`,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Download endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to download video" },
      { status: 500 }
    );
  }
}
