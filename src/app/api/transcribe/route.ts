import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;
  let convertedFilePath: string | null = null;

  try {
    console.log("Transcribe API called");

    const formData = await request.formData();
    const videoFile = formData.get("video") as File;

    if (!videoFile) {
      console.log("No video file in request");
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    console.log(`Processing video: ${videoFile.name}, size: ${videoFile.size} bytes, type: ${videoFile.type}`);

    // Convert File to buffer
    const bytes = await videoFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Write to temp file
    const tempFileName = `video-${Date.now()}-${videoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    tempFilePath = join(tmpdir(), tempFileName);
    await writeFile(tempFilePath, buffer);
    console.log(`Wrote temp file: ${tempFilePath}`);

    // Determine if we need to convert (MOV files often have issues)
    let uploadFilePath = tempFilePath;
    let mimeType = videoFile.type || "video/mp4";

    if (videoFile.type === "video/quicktime" || videoFile.name.toLowerCase().endsWith(".mov")) {
      console.log("Converting MOV to MP4...");
      convertedFilePath = join(tmpdir(), `converted-${Date.now()}.mp4`);

      try {
        // Convert to MP4 with ffmpeg - fast conversion preserving quality
        await execAsync(`ffmpeg -i "${tempFilePath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -y "${convertedFilePath}"`);
        console.log(`Converted to MP4: ${convertedFilePath}`);
        uploadFilePath = convertedFilePath;
        mimeType = "video/mp4";
      } catch (ffmpegError) {
        console.error("FFmpeg conversion failed, trying original file:", ffmpegError);
        // Fall back to original file if conversion fails
      }
    }

    // Upload file using the File API for large files
    console.log("Uploading file to Gemini...");
    const uploadedFile = await ai.files.upload({
      file: uploadFilePath,
      config: {
        mimeType: mimeType,
      },
    });
    console.log(`File uploaded: ${uploadedFile.name}, state: ${uploadedFile.state}`);

    // Wait for file to be processed
    let file = uploadedFile;
    while (file.state === "PROCESSING") {
      console.log("Waiting for file processing...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const fileInfo = await ai.files.get({ name: file.name! });
      file = fileInfo;
    }

    if (file.state === "FAILED") {
      console.error("File processing failed:", JSON.stringify(file));
      throw new Error(`File processing failed: ${file.error?.message || "Unknown reason"}`);
    }

    console.log("File ready, generating transcription...");

    // Use Gemini 2.5 Flash (stable) for video transcription
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Transcribe this video. Return ONLY a JSON object with this exact structure (no markdown, no code blocks, just raw JSON):
{
  "transcript": "the full transcript text here",
  "segments": [
    {
      "text": "segment text",
      "start": 0.0,
      "end": 2.5
    }
  ]
}

Rules:
- Break the transcript into natural segments (sentences or phrases)
- Provide accurate timestamps in seconds for each segment
- Start time is in seconds from the beginning
- Be accurate with the transcription
- If there's no speech, return empty transcript and empty segments array`,
            },
            {
              fileData: {
                fileUri: file.uri!,
                mimeType: file.mimeType!,
              },
            },
          ],
        },
      ],
    });

    const text = response.text;
    console.log("Gemini response:", text?.substring(0, 500));

    if (!text) {
      return NextResponse.json(
        { error: "No response from Gemini" },
        { status: 500 }
      );
    }

    // Clean up the uploaded file from Gemini
    try {
      await ai.files.delete({ name: file.name! });
      console.log("Deleted uploaded file from Gemini");
    } catch {
      // Ignore deletion errors
    }

    // Parse the JSON response
    try {
      // Clean up the response - remove any markdown code blocks if present
      let cleanedText = text.trim();
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.slice(7);
      }
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.slice(3);
      }
      if (cleanedText.endsWith("```")) {
        cleanedText = cleanedText.slice(0, -3);
      }
      cleanedText = cleanedText.trim();

      const transcriptData = JSON.parse(cleanedText);
      return NextResponse.json(transcriptData);
    } catch {
      // If JSON parsing fails, return the raw text as transcript
      return NextResponse.json({
        transcript: text,
        segments: [{ text: text, start: 0, end: 0 }],
      });
    }
  } catch (error) {
    console.error("Transcription error:", error);
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
      // Log full error for debugging
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
    if (convertedFilePath) {
      try {
        await unlink(convertedFilePath);
        console.log(`Cleaned up converted file: ${convertedFilePath}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// App Router: Configure max duration for processing large video files
export const maxDuration = 300;
