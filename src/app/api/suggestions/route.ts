import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { HookResponse, HookSuggestionsRequest } from "@/lib/types/suggestions";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const SYSTEM_PROMPT = `You are a viral video expert who specializes in creating attention-grabbing hooks for short-form content. Your job is to analyze video openings and suggest better alternatives that would increase watch time and engagement.

You will receive the first 30 seconds of a video transcript and the full context. Analyze the opening and suggest 3-5 alternative hooks.

For each hook suggestion:
1. The hook should grab attention in the first 3 seconds
2. It should create curiosity or urgency to keep watching
3. It must match the video's actual content (no clickbait)

Categorize each hook as one of:
- "question": Poses an intriguing question the viewer wants answered
- "shock": Opens with a surprising or unexpected statement
- "curiosity": Creates an information gap that makes viewers want to learn more
- "controversy": Takes a provocative or contrarian stance
- "relatable": Connects with a shared experience or common frustration

IMPORTANT: Return ONLY valid JSON in this exact format with no additional text:
{
  "currentHook": "The exact words from the first sentence of the transcript",
  "analysis": "A brief 1-2 sentence analysis of why the current opening does or doesn't work",
  "suggestions": [
    {
      "hook": "The suggested opening line",
      "reason": "Why this would grab attention better",
      "hookType": "question|shock|curiosity|controversy|relatable"
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as HookSuggestionsRequest;

    if (!body.openingTranscript || !body.fullTranscript) {
      return NextResponse.json(
        { error: "Missing openingTranscript or fullTranscript" },
        { status: 400 }
      );
    }

    console.log("[Suggestions] Generating hook suggestions...");
    console.log(`[Suggestions] Opening: ${body.openingTranscript.substring(0, 100)}...`);

    const userPrompt = `Analyze this video's opening and suggest better hooks.

Current transcript (first 30 seconds):
${body.openingTranscript}

Full context:
${body.fullTranscript}

Remember: Return ONLY the JSON response, no markdown formatting or additional text.`;

    const startTime = Date.now();

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Suggestions] Groq completed in ${elapsed}s`);

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error("No response from AI model");
    }

    // Parse the JSON response
    let hookResponse: HookResponse;
    try {
      // Try to extract JSON if wrapped in markdown code blocks
      let jsonText = responseText.trim();
      if (jsonText.startsWith("```")) {
        const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
          jsonText = match[1].trim();
        }
      }
      hookResponse = JSON.parse(jsonText);
    } catch {
      console.error("[Suggestions] Failed to parse response:", responseText);
      throw new Error("Failed to parse AI response as JSON");
    }

    // Validate the response structure
    if (!hookResponse.currentHook || !hookResponse.suggestions || !Array.isArray(hookResponse.suggestions)) {
      throw new Error("Invalid response structure from AI");
    }

    console.log(`[Suggestions] Generated ${hookResponse.suggestions.length} hook suggestions`);

    return NextResponse.json(hookResponse);
  } catch (error) {
    console.error("[Suggestions] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate suggestions", details: errorMessage },
      { status: 500 }
    );
  }
}
