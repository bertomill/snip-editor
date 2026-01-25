import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Define the tools/functions the AI can call to edit the video
const editorTools: Anthropic.Tool[] = [
  {
    name: "add_text",
    description: "Add a text overlay to the video at the current time. Use this when the user wants to add text, titles, or labels to their video.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "The text content to display",
        },
        position: {
          type: "string",
          enum: ["top", "center", "bottom"],
          description: "Where to position the text vertically",
        },
        style: {
          type: "string",
          enum: ["bold", "minimal", "outline", "neon", "handwritten", "gradient", "shadow", "retro"],
          description: "The visual style of the text",
        },
        duration: {
          type: "number",
          description: "How long the text should appear in seconds (default 3)",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "set_filter",
    description: "Apply a visual filter/color grade to the entire video. Use when user wants to change the look, mood, or color of the video.",
    input_schema: {
      type: "object" as const,
      properties: {
        filter: {
          type: "string",
          enum: ["none", "cinematic", "vibrant", "vintage", "warm", "cool", "bw", "sepia", "dramatic", "soft", "hdr"],
          description: "The filter to apply",
        },
      },
      required: ["filter"],
    },
  },
  {
    name: "toggle_captions",
    description: "Turn captions/subtitles on or off. Use when user wants to show or hide the auto-generated captions.",
    input_schema: {
      type: "object" as const,
      properties: {
        enabled: {
          type: "boolean",
          description: "Whether captions should be visible",
        },
      },
      required: ["enabled"],
    },
  },
  {
    name: "set_caption_style",
    description: "Change the visual style of the captions. Use when user wants different looking subtitles.",
    input_schema: {
      type: "object" as const,
      properties: {
        style: {
          type: "string",
          enum: ["classic", "minimal", "bold", "neon"],
          description: "The caption style template",
        },
      },
      required: ["style"],
    },
  },
  {
    name: "add_sticker",
    description: "Add an emoji or sticker to the video. Use when user wants to add emojis, reactions, or decorative elements.",
    input_schema: {
      type: "object" as const,
      properties: {
        emoji: {
          type: "string",
          description: "The emoji character to add (e.g. '🔥', '😂', '👍')",
        },
        position: {
          type: "object",
          properties: {
            x: { type: "number", description: "Horizontal position 0-100" },
            y: { type: "number", description: "Vertical position 0-100" },
          },
        },
      },
      required: ["emoji"],
    },
  },
  {
    name: "remove_silence",
    description: "Automatically detect and remove silent parts/pauses from the video. Use when user wants to cut dead air, pauses, or make the video more fast-paced.",
    input_schema: {
      type: "object" as const,
      properties: {
        aggressiveness: {
          type: "string",
          enum: ["conservative", "natural", "tight"],
          description: "How aggressively to cut silences. Conservative keeps more pauses, tight removes most.",
        },
      },
      required: [],
    },
  },
  {
    name: "seek_to_time",
    description: "Jump to a specific time in the video. Use when user wants to go to a particular moment.",
    input_schema: {
      type: "object" as const,
      properties: {
        seconds: {
          type: "number",
          description: "The time in seconds to jump to",
        },
      },
      required: ["seconds"],
    },
  },
  {
    name: "set_audio_enhancement",
    description: "Enable or disable audio enhancement (noise reduction, loudness normalization). Use when user wants to improve audio quality.",
    input_schema: {
      type: "object" as const,
      properties: {
        enabled: {
          type: "boolean",
          description: "Whether to enhance the audio",
        },
        noiseReduction: {
          type: "boolean",
          description: "Whether to reduce background noise",
        },
      },
      required: ["enabled"],
    },
  },
  {
    name: "export_video",
    description: "Start exporting/rendering the final video. Use when user says they're done editing and want to export, download, or save.",
    input_schema: {
      type: "object" as const,
      properties: {
        quality: {
          type: "string",
          enum: ["720p", "1080p"],
          description: "Export quality/resolution",
        },
      },
      required: [],
    },
  },
];

const systemPrompt = `You are an AI video editing assistant for Snip, a short-form vertical video editor. You help users edit their videos through natural conversation.

You have access to tools that can:
- Add text overlays with different styles
- Apply visual filters (cinematic, vintage, vibrant, etc.)
- Toggle and style captions/subtitles
- Add emoji stickers
- Remove silence/dead air automatically
- Enhance audio quality
- Navigate to specific times
- Export the final video

Guidelines:
1. Be concise and helpful. Confirm what you're doing in a brief, friendly way.
2. If the user's request is unclear, ask a clarifying question.
3. Use tools when the user wants to make edits. Don't just describe what you could do - do it.
4. If a user asks about something you can't do, explain what IS possible.
5. For text content, use exactly what the user specifies (don't paraphrase their text).
6. Default to sensible values when parameters aren't specified (center position, 3 second duration, etc.)

Current video context will be provided with each message.`;

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Build context message about current video state
    const contextMessage = context
      ? `Current video state:
- Duration: ${context.duration?.toFixed(1) || 0} seconds
- Current time: ${context.currentTime?.toFixed(1) || 0} seconds
- Captions: ${context.captionsEnabled ? "on" : "off"}
- Filter: ${context.currentFilter || "none"}
- Text overlays: ${context.textOverlayCount || 0}
- Stickers: ${context.stickerCount || 0}
- Has transcript: ${context.hasTranscript ? "yes" : "no"}`
      : "";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      tools: editorTools,
      messages: [
        {
          role: "user",
          content: `${contextMessage}\n\nUser request: ${message}`,
        },
      ],
    });

    // Extract text response and any tool calls
    const textContent = response.content.find((block) => block.type === "text");
    const toolUse = response.content.find((block) => block.type === "tool_use");

    return NextResponse.json({
      response: textContent?.type === "text" ? textContent.text : null,
      toolCall: toolUse?.type === "tool_use"
        ? {
            name: toolUse.name,
            input: toolUse.input,
          }
        : null,
      stopReason: response.stop_reason,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}
