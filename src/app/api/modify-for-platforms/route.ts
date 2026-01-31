import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const systemPrompt = `You are a social media content expert. Your job is to adapt existing content for different social media platforms while maintaining the core message.

Platform-specific guidelines:
- X (Twitter): Concise, punchy, max 280 chars, 1-2 hashtags
- Instagram: Visual-focused, 3-5 hashtags, include CTA, can be longer
- TikTok: Casual, trendy, hook in first line, max 150 chars
- YouTube: SEO-friendly, detailed description, include timestamps if relevant
- LinkedIn: Professional, thought leadership, value-driven, can be longer form
- Facebook: Conversational, community-focused, questions work well
- Threads: Similar to Twitter but can be slightly longer, conversational
- Substack: Newsletter-style, more in-depth, storytelling, can include sections

Adapt the content naturally for each platform - don't just shorten or lengthen, actually rewrite to match the platform's culture and best practices.

Return ONLY the adapted post content, no explanations.`;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const { originalContent, targetPlatforms, title } = await request.json();

    if (!originalContent) {
      return NextResponse.json(
        { error: "Original content is required" },
        { status: 400 }
      );
    }

    if (!targetPlatforms || targetPlatforms.length === 0) {
      return NextResponse.json(
        { error: "At least one target platform is required" },
        { status: 400 }
      );
    }

    // Generate adapted content for each platform
    const platformDrafts: Record<string, string> = {};

    for (const platform of targetPlatforms) {
      const userMessage = `Adapt the following content for ${platform}:

Original content:
${originalContent}

${title ? `Topic/Title: ${title}` : ''}

Rewrite this for ${platform}, matching that platform's style and best practices.`;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      });

      const textContent = response.content.find((block) => block.type === "text");
      platformDrafts[platform] = textContent?.type === "text" ? textContent.text : "";
    }

    return NextResponse.json({ platformDrafts });
  } catch (error: unknown) {
    console.error("Modify for platforms API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to modify content: ${errorMessage}` },
      { status: 500 }
    );
  }
}
