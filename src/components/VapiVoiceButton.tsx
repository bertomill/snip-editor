"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import Vapi from "@vapi-ai/web";

interface VapiVoiceButtonProps {
  assistantId?: string;
  /** The video transcript/script to give context to the assistant */
  transcript?: string;
  /** Current filter applied to the video */
  currentFilter?: string;
  /** Number of text overlays */
  textOverlayCount?: number;
  /** Number of stickers */
  stickerCount?: number;
  /** User's recent X posts for content inspiration */
  xPosts?: Array<{ id: string; text: string; likes: number }>;
}

export function VapiVoiceButton({
  assistantId,
  transcript,
  currentFilter,
  textOverlayCount = 0,
  stickerCount = 0,
  xPosts = [],
}: VapiVoiceButtonProps) {
  const [vapi, setVapi] = useState<Vapi | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");

  // Initialize VAPI
  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!publicKey) {
      console.warn("VAPI public key not found");
      return;
    }

    const vapiInstance = new Vapi(publicKey);

    vapiInstance.on("call-start", () => {
      setIsConnecting(false);
      setIsCallActive(true);
      setLiveTranscript("");
    });

    vapiInstance.on("call-end", () => {
      setIsConnecting(false);
      setIsCallActive(false);
      setIsSpeaking(false);
      setIsListening(false);
    });

    vapiInstance.on("speech-start", () => {
      setIsSpeaking(true);
      setIsListening(false);
    });

    vapiInstance.on("speech-end", () => {
      setIsSpeaking(false);
    });

    vapiInstance.on("message", (message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        setLiveTranscript(message.transcript || "");
      }
    });

    vapiInstance.on("volume-level", (level) => {
      // User is speaking if volume is above threshold
      if (level > 0.01 && !isSpeaking) {
        setIsListening(true);
      } else if (level < 0.01 && isListening) {
        setIsListening(false);
      }
    });

    vapiInstance.on("error", (error) => {
      console.error("VAPI error:", error);
      setIsConnecting(false);
      setIsCallActive(false);
    });

    setVapi(vapiInstance);

    return () => {
      vapiInstance.stop();
    };
  }, []);

  const toggleCall = useCallback(async () => {
    if (!vapi) return;

    if (isCallActive || isConnecting) {
      vapi.stop();
      setIsConnecting(false);
    } else {
      setIsConnecting(true);
      try {
        // Use assistant ID if provided, otherwise use a default assistant config
        if (assistantId) {
          await vapi.start(assistantId);
        } else {
          // Fallback: start with inline assistant config
          // Build context-aware system prompt
          const scriptContext = transcript
            ? `\n\nThe user is editing a video with this script/transcript:\n"""${transcript}"""`
            : "\n\nThe user hasn't transcribed their video yet.";

          const editingContext = `\n\nCurrent editing state:
- Filter: ${currentFilter || "none"}
- Text overlays: ${textOverlayCount}
- Stickers: ${stickerCount}`;

          // Add X posts context if available
          const xPostsContext = xPosts.length > 0
            ? `\n\nThe user's recent X posts (for content inspiration and understanding their voice/topics):
${xPosts.slice(0, 5).map(p => `- "${p.text.substring(0, 100)}${p.text.length > 100 ? '...' : ''}" (${p.likes} likes)`).join('\n')}

Use these posts to suggest video ideas that match their content style and interests.`
            : "";

          await vapi.start({
            model: {
              provider: "openai",
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: `You are Snip, a chill video editing assistant. You help creators make short-form content.

CRITICAL VOICE RULES - you MUST follow these:
- Talk like a real person chatting with a friend. Use "like", "you know", "honestly", "kinda", "pretty much"
- NEVER read or quote the transcript back. You know what it's about - just reference the topic casually
- Keep it super short. One thought at a time. Let them respond.
- Sound excited but not fake. Like a creative friend, not a customer service bot.
- Use contractions always (don't, can't, I'd, you're, that's)
- Pause naturally. Don't rush through ideas.

BAD (robotic): "I see your transcript mentions the importance of morning routines. I would suggest..."
GOOD (natural): "Oh nice, morning routine content! That stuff does so well. Have you thought about opening with like, the one thing that changed everything for you?"

BAD: "Based on your script about productivity tips, I recommend adding a sticker at the 3 second mark."
GOOD: "Yo the productivity angle is solid. Maybe throw a quick emoji pop when you hit that main point?"

You know about their video:
${scriptContext}${editingContext}${xPostsContext}

Help with: hooks, filters, stickers, captions, pacing. But keep it conversational - like you're texting a friend who makes content.`,
                },
              ],
            },
            voice: {
              provider: "11labs",
              voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel voice
            },
            firstMessage: transcript
              ? "Hey! Okay I peeped your script - pretty solid. What are you thinking for this one?"
              : "Yo what's up! I'm Snip. Drop a video in and I can help you make it hit.",
          });
        }
      } catch (error) {
        console.error("Failed to start call:", error);
        setIsConnecting(false);
      }
    }
  }, [vapi, isCallActive, isConnecting, assistantId, transcript, currentFilter, textOverlayCount, stickerCount]);

  const isActive = isCallActive || isConnecting;

  return (
    <>
      {/* Voice Button */}
      <motion.button
        type="button"
        onClick={toggleCall}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className={`relative rounded-full transition-all flex-shrink-0 overflow-hidden ${
          isActive
            ? "p-5 bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/40"
            : "p-1.5 bg-[#1a1a1a]/90 backdrop-blur-2xl border-2 border-white/30 hover:border-[#00f2ea] shadow-[0_0_25px_rgba(0,242,234,0.3)]"
        }`}
        title={isActive ? "End call" : "Talk to Snip"}
      >
        {/* Animated rings when active */}
        {isActive && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full bg-[#ff2d55]"
              animate={{
                scale: [1, 1.5, 1.5],
                opacity: [0.5, 0, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
            <motion.span
              className="absolute inset-0 rounded-full bg-[#00f2ea]"
              animate={{
                scale: [1, 1.3, 1.3],
                opacity: [0.5, 0, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.4,
              }}
            />
          </>
        )}

        {/* Snip mascot or X icon */}
        {isActive ? (
          // X icon when active
          <svg
            className="w-7 h-7 text-white relative z-10"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          // Snip mascot image - zoomed in on face
          <div className="w-14 h-14 rounded-full overflow-hidden">
            <img
              src="/snip.jpg"
              alt="Talk to Snip"
              className="w-full h-full object-cover scale-150"
            />
          </div>
        )}
      </motion.button>

      {/* Voice Chat Overlay */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-28 left-4 right-4 lg:left-[296px] lg:right-8 z-50 flex justify-center"
          >
            <div className="bg-[#1a1a1a]/95 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-2xl p-6 w-full max-w-sm">
              {/* Snip Avatar + Status */}
              <div className="flex items-center gap-4 mb-4">
                {/* Snip mascot */}
                <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
                  {isSpeaking ? (
                    <video
                      src="/snip-animation.mp4"
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover scale-150"
                    />
                  ) : (
                    <img
                      src="/snip.jpg"
                      alt="Snip"
                      className="w-full h-full object-cover scale-150"
                    />
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-white font-semibold text-lg">
                    {isConnecting
                      ? "Connecting..."
                      : isSpeaking
                      ? "Snip is speaking..."
                      : isListening
                      ? "Listening..."
                      : "Connected"}
                  </p>
                  <p className="text-white/50 text-sm">
                    {isConnecting
                      ? "Setting up voice chat"
                      : "Ask about video editing tips"}
                  </p>
                </div>
              </div>

              {/* Live Transcript */}
              {liveTranscript && (
                <div className="bg-white/5 rounded-xl p-3 mb-4">
                  <p className="text-white/80 text-sm">{liveTranscript}</p>
                </div>
              )}

              {/* Connecting indicator */}
              {isConnecting && (
                <div className="flex items-center justify-center gap-2 py-3 mb-4">
                  <div className="flex gap-1">
                    <motion.div
                      className="w-2 h-2 bg-[#00f2ea] rounded-full"
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                    />
                    <motion.div
                      className="w-2 h-2 bg-white rounded-full"
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.1 }}
                    />
                    <motion.div
                      className="w-2 h-2 bg-[#ff2d55] rounded-full"
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                    />
                  </div>
                </div>
              )}

              {/* End call button */}
              <button
                onClick={toggleCall}
                className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full font-medium transition-colors"
              >
                {isConnecting ? "Cancel" : "End conversation"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
