import { NextRequest, NextResponse } from "next/server";
import { getRenderState } from "@/lib/renderer/render-state";

interface ProgressRequestBody {
  renderId: string;
}

/**
 * POST /api/render/progress
 * Check the progress of a video render
 */
export async function POST(request: NextRequest) {
  try {
    const body: ProgressRequestBody = await request.json();

    if (!body.renderId) {
      return NextResponse.json(
        { error: "No renderId provided" },
        { status: 400 }
      );
    }

    // Get the render state
    let renderState = getRenderState(body.renderId);

    // If not found on first attempt, wait briefly and retry
    if (!renderState) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      renderState = getRenderState(body.renderId);
    }

    if (!renderState) {
      return NextResponse.json({
        type: "error",
        message: `No render found with ID: ${body.renderId}. The render may have expired. Please try again.`,
      });
    }

    // Return appropriate response based on status
    switch (renderState.status) {
      case "error":
        return NextResponse.json({
          type: "error",
          message: renderState.error || "Unknown error occurred",
        });

      case "done":
        return NextResponse.json({
          type: "done",
          url: renderState.supabaseUrl || renderState.url!,
          size: renderState.size!,
          isSupabaseUrl: !!renderState.supabaseUrl,
        });

      case "rendering":
      default:
        return NextResponse.json({
          type: "progress",
          progress: renderState.progress || 0,
        });
    }
  } catch (error) {
    console.error("Progress endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to get render progress" },
      { status: 500 }
    );
  }
}
