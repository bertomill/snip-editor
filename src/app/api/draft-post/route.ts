import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const systemPrompt = `You are a social media content expert. Your job is to write engaging, platform-appropriate posts based on the user's idea description.

Guidelines:
1. Match the tone and style for each platform:
   - X (Twitter): Concise, punchy, use relevant hashtags sparingly (1-2)
   - Instagram: Engaging, visual-focused language, more hashtags acceptable (3-5), include call-to-action
   - TikTok: Casual, trendy, hook-focused, use popular sounds/trends references
   - YouTube: SEO-friendly title suggestions, engaging description, relevant tags
   - LinkedIn: Professional, value-driven, thought leadership tone

2. STRICTLY enforce platform character limits - this is critical:
   - X (Twitter): MAXIMUM 280 characters total (including spaces, hashtags, and punctuation). This is a HARD LIMIT - never exceed it.
   - Instagram: 2,200 characters (but front-load important content)
   - TikTok: 150 characters for caption
   - LinkedIn: 3,000 characters (but 150-200 optimal for engagement)

3. Be authentic and avoid generic corporate speak
4. Include a hook that grabs attention in the first line
5. End with engagement prompt when appropriate (question, CTA)

Return ONLY the drafted post content, no explanations or meta-commentary.`;

export async function POST(request: NextRequest) {
  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is not set");
      return NextResponse.json(
        { error: "AI service not configured. Please add ANTHROPIC_API_KEY to your environment." },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const { platform, accountName, description, title, includeContext = true } = await request.json();

    if (!description && !title) {
      return NextResponse.json(
        { error: "Description or title is required" },
        { status: 400 }
      );
    }

    // Fetch previous posts for context if requested
    let contextSection = "";
    if (includeContext) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: previousPosts } = await supabase
            .from('ideas')
            .select('title, published_content, draft_content, description, tags, published_at')
            .eq('user_id', user.id)
            .eq('status', 'published')
            .order('published_at', { ascending: false, nullsFirst: false })
            .limit(5);

          if (previousPosts && previousPosts.length > 0) {
            const postsContext = previousPosts
              .map(p => {
                const content = p.published_content || p.draft_content || p.description;
                return content ? `- "${content.slice(0, 200)}${content.length > 200 ? '...' : ''}"` : null;
              })
              .filter(Boolean)
              .join('\n');

            if (postsContext) {
              contextSection = `\n\nHere are some of the user's previous posts to help match their voice and style:\n${postsContext}\n\nUse these as reference for tone and style, but create fresh, original content for the new post.`;
            }
          }
        }
      } catch (err) {
        // Continue without context if there's an error
        console.error('Error fetching context:', err);
      }
    }

    const userMessage = `Draft a ${platform} post for the account "${accountName || 'my account'}".

Idea/Topic: ${title || 'No title provided'}
${description ? `\nDetails: ${description}` : ''}${contextSection}

Write an engaging post optimized for ${platform}.`;

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
    const draft = textContent?.type === "text" ? textContent.text : "";

    return NextResponse.json({ draft });
  } catch (error: unknown) {
    console.error("Draft post API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate draft: ${errorMessage}` },
      { status: 500 }
    );
  }
}
