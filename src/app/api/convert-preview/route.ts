import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { ffmpeg } from "@/lib/ffmpeg-path";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  let inputPath: string | null = null;
  let outputPath: string | null = null;

  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File;

    if (!videoFile) {
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    // Check if conversion is needed
    const needsConversion =
      videoFile.type === "video/quicktime" ||
      videoFile.name.toLowerCase().endsWith(".mov") ||
      videoFile.name.toLowerCase().endsWith(".hevc");

    if (!needsConversion) {
      // Return original file as base64 data URL
      const bytes = await videoFile.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const dataUrl = `data:${videoFile.type};base64,${base64}`;
      return NextResponse.json({ url: dataUrl, converted: false });
    }

    console.log(`Converting for preview: ${videoFile.name}`);

    // Write input file
    const bytes = await videoFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const timestamp = Date.now();
    inputPath = join(tmpdir(), `input-${timestamp}.mov`);
    outputPath = join(tmpdir(), `preview-${timestamp}.mp4`);

    await writeFile(inputPath, buffer);

    // Convert to browser-compatible MP4 (H.264 + AAC)
    // Using fast preset and lower quality for quick preview
    await execAsync(
      `"${ffmpeg}" -i "${inputPath}" -c:v libx264 -preset ultrafast -crf 28 -c:a aac -b:a 96k -movflags +faststart -y "${outputPath}"`
    );

    // Read converted file and return as base64 data URL
    const convertedBuffer = await readFile(outputPath);
    const base64 = convertedBuffer.toString("base64");
    const dataUrl = `data:video/mp4;base64,${base64}`;

    console.log(`Preview conversion complete: ${videoFile.name}`);

    return NextResponse.json({ url: dataUrl, converted: true });
  } catch (error) {
    console.error("Preview conversion error:", error);
    return NextResponse.json(
      { error: "Failed to convert video for preview" },
      { status: 500 }
    );
  } finally {
    // Clean up temp files
    if (inputPath) {
      try {
        await unlink(inputPath);
      } catch {}
    }
    if (outputPath) {
      try {
        await unlink(outputPath);
      } catch {}
    }
  }
}

export const maxDuration = 120;
